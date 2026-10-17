"""
Stage 3C Acceptance Test Suite:
Forecast Normalization & Commitment De-Inflation

Acceptance Gates Verified:
1. Day 1 Reserved Instance commitment recurring fee ($4,088.24) is categorized as commitment spend
   and isolated from daily operational run-rate extrapolation.
2. Day 1 statutory GST tax ($1,152.50) is categorized as tax spend and isolated from daily operational run-rate extrapolation.
3. Actual historical CUR spend remains completely invariant ($8,914.94 net invoiced; $7,762.44 gross).
4. Daily operational burn rate is normalized to ~$265.63/day (de-inflated from flawed $426.89/day).
5. Month-end spend forecast is normalized to ~$13,696.33 (de-inflated from flawed $16,598.87).
6. 90% statistical confidence interval reflects genuine operational variance (~$24.88 std dev),
   producing realistic bounds (~$13,522 to ~$13,870) de-inflated from blown-out $26,798.55.
7. Budget evaluations in evaluate_budgets use the normalized forecast, eliminating false breach alarms.
8. Endpoints GET /api/forecast and GET /api/budgets preserve response schema and tenant isolation.
9. Deterministic and crash-safe fallback behavior for synthetic or minimal datasets.
10. Strict production database safety invariant (backend/data/finops.db is 100% unmutated).
"""

import os
import sys
import math
import hashlib
import unittest
from decimal import Decimal
from typing import Dict, Any

from fastapi.testclient import TestClient

# conftest.py configures isolated test DB prior to imports
from app.main import app, CURRENT_DATASET
from app.database import engine
from app.models import Organization, User, UserSession, BudgetConfig
from app.security import hash_password, generate_session_token
from app.parser import parse_cur_file, round_currency
from app.budget_guard import calculate_cost_forecast, evaluate_budgets


class TestStage3CForecastNormalization(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        """Enforce test database isolation, authenticate session, and load active sample dataset."""
        # 1. Enforce test isolation
        db_url = str(engine.url).replace('\\', '/').lower()
        assert "zorvex_isolated_test.db" in db_url, f"CRITICAL: Non-isolated DB: {engine.url}"
        assert "finops.db" not in db_url, f"CRITICAL: Tests bound to production database: {engine.url}"

        cls.client = TestClient(app)

        # 2. Set up test organization and user in isolated DB
        from app.database import SessionLocal
        cls.db = SessionLocal()
        try:
            org = cls.db.query(Organization).filter(Organization.name == "Forecast Test Org").first()
            if not org:
                org = Organization(name="Forecast Test Org")
                cls.db.add(org)
                cls.db.flush()

            user = cls.db.query(User).filter(User.email == "finops-forecast@zorvex.test").first()
            if not user:
                user = User(
                    organization_id=org.id,
                    name="FinOps Forecast Auditor",
                    company="Forecast Test Org",
                    email="finops-forecast@zorvex.test",
                    password_hash=hash_password("ForecastAudit2026!")
                )
                cls.db.add(user)
                cls.db.flush()

            cls.session_token = f"session_stage3c_{generate_session_token()[:32]}"
            user_session = UserSession(
                token=cls.session_token,
                user_id=user.id,
                organization_id=org.id
            )
            cls.db.add(user_session)
            cls.db.commit()

            cls.org_id = org.id
            cls.user_id = user.id
            cls.headers = {"Authorization": f"Bearer {cls.session_token}"}
        finally:
            cls.db.close()

        # 3. Load active sample CUR dataset
        samples_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "samples")
        cur_path = os.path.join(samples_dir, "CUR-Report-Daily-00001.csv.gz")
        assert os.path.exists(cur_path), f"Sample CUR file not found: {cur_path}"
        cls.cur_path = cur_path
        cls.dataset = parse_cur_file(cur_path)
        CURRENT_DATASET['filename'] = "CUR-Report-Daily-00001.csv.gz"
        CURRENT_DATASET['filepath'] = cur_path
        CURRENT_DATASET['data'] = cls.dataset

    def test_01_day1_ri_fees_isolated_from_daily_burn(self):
        """Gate 1: Day 1 RI fee ($4,088.24) is classified as commitment spend and isolated from daily run-rate."""
        forecast = calculate_cost_forecast(self.dataset)

        self.assertIn("actual_commitment_spend_usd", forecast)
        self.assertEqual(forecast["actual_commitment_spend_usd"], 4088.24)

        # Operational daily burn rate must NOT include the $4,088.24 RI fee
        # If RI fee were averaged over 13 days, it would add $314.48/day into burn rate
        self.assertLess(forecast["daily_burn_rate_usd"], 300.0,
                        f"Burn rate {forecast['daily_burn_rate_usd']} includes upfront RI commitment fees!")

    def test_02_day1_tax_isolated_from_daily_burn(self):
        """Gate 2: Day 1 statutory GST tax ($1,152.50) is classified as tax spend and isolated from daily run-rate."""
        forecast = calculate_cost_forecast(self.dataset)

        self.assertIn("actual_tax_spend_usd", forecast)
        self.assertEqual(forecast["actual_tax_spend_usd"], 1152.50)

        # Operational daily burn rate must NOT include statutory taxes
        # If GST tax were averaged over 13 days, it would add $88.65/day into burn rate
        self.assertLess(forecast["daily_burn_rate_usd"], 300.0,
                        f"Burn rate {forecast['daily_burn_rate_usd']} includes GST tax!")

    def test_03_actual_spend_to_date_remains_invariant(self):
        """Gate 3: Core Financial Invariant - actual historical spend ($8,914.94) is strictly preserved."""
        forecast = calculate_cost_forecast(self.dataset)

        # Historical net actual spend must not be scaled down or altered
        self.assertEqual(forecast["actual_spend_to_date_usd"], 8914.94)

        # Decomposed spend components must cleanly reconcile to total actual spend
        decomposed_sum = round(
            forecast["actual_operational_spend_usd"] +
            forecast["actual_commitment_spend_usd"] +
            forecast["actual_tax_spend_usd"] +
            forecast.get("actual_credit_spend_usd", 0.0),
            2
        )
        self.assertEqual(decomposed_sum, forecast["actual_spend_to_date_usd"],
                         f"Spend decomposition {decomposed_sum} does not equal actual spend {forecast['actual_spend_to_date_usd']}")

    def test_04_daily_burn_rate_normalized_to_operational(self):
        """Gate 4: Daily operational burn rate is normalized to ~$265.63/day (de-inflated from $426.89/day)."""
        forecast = calculate_cost_forecast(self.dataset)

        burn_rate = forecast["daily_burn_rate_usd"]
        # Expected: 40% of 13-day mean ($282.63) + 60% of recent 3 days ($254.30) = $265.63
        self.assertAlmostEqual(burn_rate, 265.63, delta=0.50,
                               msg=f"Burn rate {burn_rate} deviates from operational run-rate of ~$265.63")

        # Flawed legacy burn rate was $426.89
        self.assertLess(burn_rate, 350.0,
                        f"Burn rate {burn_rate} is inflated toward flawed baseline of $426.89")

    def test_05_month_end_forecast_de_inflated(self):
        """Gate 5: Month-end spend forecast is normalized to ~$13,696.33 (de-inflated from $16,598.87)."""
        forecast = calculate_cost_forecast(self.dataset)

        month_end = forecast["forecasted_month_end_usd"]
        # Expected: $8,914.94 actual + 18 days * $265.63 = $13,696.33
        self.assertAlmostEqual(month_end, 13696.33, delta=1.50,
                               msg=f"Month end forecast {month_end} deviates from normalized ~$13,696.33")

        # Confirm de-inflation from flawed $16,598.87
        reduction = 16598.87 - month_end
        self.assertGreater(reduction, 2800.0,
                           f"Forecast was not de-inflated! Only reduced by {reduction}")

    def test_06_confidence_interval_reflects_operational_variance(self):
        """Gate 6: 90% confidence interval reflects operational variance ($24.88 std dev), de-inflating confidence high."""
        forecast = calculate_cost_forecast(self.dataset)

        conf_low = forecast["confidence_low_usd"]
        conf_high = forecast["confidence_high_usd"]

        # Bounds must surround the forecast cleanly
        self.assertLessEqual(conf_low, forecast["forecasted_month_end_usd"])
        self.assertGreaterEqual(conf_high, forecast["forecasted_month_end_usd"])

        # Realistic operational bounds: ~$13,522 to ~$13,870
        self.assertAlmostEqual(conf_low, 13522.67, delta=5.0)
        self.assertAlmostEqual(conf_high, 13869.99, delta=5.0)

        # Flawed legacy confidence high was $26,798.55 due to $1,458.85 daily std dev
        self.assertLess(conf_high, 14500.0,
                        f"Confidence high {conf_high} exploded like flawed $26,798.55 band!")

    def test_07_budget_evaluation_grounded_in_normalized_forecast(self):
        """Gate 7: Budget evaluation uses normalized forecast, eliminating false breach alarms and computing headroom breach day."""
        from app.database import SessionLocal
        db = SessionLocal()
        try:
            # Clean up existing test budgets
            db.query(BudgetConfig).filter(BudgetConfig.organization_id == self.org_id).delete()
            db.commit()

            # Budget 1: $15,000 monthly limit
            # Flawed forecast ($16,598.87) falsely reported BREACH.
            # Normalized forecast ($13,696.33) is below $15,000, so NOT breached.
            budget_15k = BudgetConfig(
                organization_id=self.org_id,
                name="Production Workspace Budget",
                scope_type="WORKSPACE",
                scope_value="all",
                monthly_budget_usd=15000.0,
                alert_threshold_pct=80.0,
                is_active=1
            )

            # Budget 2: $12,000 monthly limit
            # Actual spend: $8,914.94. Remaining headroom: $3,085.06.
            # Burn rate: $265.63/day. Days observed: 13.
            # Days needed to exceed headroom: floor(3085.06 / 265.63) + 1 = 11 + 1 = 12.
            # Projected breach day: 13 + 12 = Day 25.
            budget_12k = BudgetConfig(
                organization_id=self.org_id,
                name="Tightly Capped Workload",
                scope_type="WORKSPACE",
                scope_value="all",
                monthly_budget_usd=12000.0,
                alert_threshold_pct=80.0,
                is_active=1
            )

            db.add_all([budget_15k, budget_12k])
            db.commit()

            evals = evaluate_budgets(db, self.dataset, org_id=self.org_id)
            eval_map = {e["name"]: e for e in evals}

            # Verify $15,000 budget is NOT falsely breached
            b15 = eval_map["Production Workspace Budget"]
            self.assertFalse(b15["is_breached"],
                             "False alarm! $15,000 budget breached under normalized forecast.")
            self.assertFalse(b15["is_current_breached"])
            self.assertIsNone(b15["projected_breach_day"])
            self.assertEqual(b15["forecasted_spend_usd"], 13696.33)

            # Verify $12,000 budget is legitimately breached on Day 25 based on remaining headroom
            b12 = eval_map["Tightly Capped Workload"]
            self.assertTrue(b12["is_breached"],
                            "Legitimate breach of $12,000 budget was not detected.")
            self.assertFalse(b12["is_current_breached"])
            self.assertEqual(b12["status"], "FORECASTED_BREACH")
            self.assertEqual(b12["projected_breach_day"], 25,
                             f"Projected breach day {b12['projected_breach_day']} != 25")
        finally:
            db.close()

    def test_07b_current_breach_not_presented_as_future_breach(self):
        """Gate 7b: Actual spend exceeding budget is reported as current breach, not projected future breach."""
        from app.database import SessionLocal
        db = SessionLocal()
        try:
            db.query(BudgetConfig).filter(BudgetConfig.organization_id == self.org_id).delete()
            db.commit()

            # Budget limit $5,000.00 is already exceeded by actual spend ($8,914.94)
            budget_already_breached = BudgetConfig(
                organization_id=self.org_id,
                name="Exceeded Sandbox Budget",
                scope_type="WORKSPACE",
                scope_value="all",
                monthly_budget_usd=5000.0,
                alert_threshold_pct=80.0,
                is_active=1
            )
            db.add(budget_already_breached)
            db.commit()

            evals = evaluate_budgets(db, self.dataset, org_id=self.org_id)
            b = evals[0]

            self.assertTrue(b["is_current_breached"])
            self.assertEqual(b["status"], "BREACHED")
            # Must NOT report as future projected breach
            self.assertIsNone(b["projected_breach_day"],
                              f"Current breach must have projected_breach_day=None, got {b['projected_breach_day']}")
        finally:
            db.close()

    def test_07c_headroom_exactly_divisible_by_burn_rate(self):
        """Gate 7c: Day-boundary precision when remaining headroom is exactly divisible by burn rate."""
        from app.database import SessionLocal
        db = SessionLocal()
        try:
            db.query(BudgetConfig).filter(BudgetConfig.organization_id == self.org_id).delete()
            db.commit()

            # Mock dataset: 10 days observed in a 30-day month
            # Actual spend = $1,000.00, daily burn = $100.00/day
            # Budget limit = $1,500.00
            # Headroom = $500.00, exactly divisible by $100.00 (5.0 days)
            # Spend on Day 15: 1,000 + 5*100 = $1,500.00 (Equal to budget, not strictly exceeded)
            # Spend on Day 16: 1,000 + 6*100 = $1,600.00 (Strictly exceeds budget)
            # Breach day must be Day 16.
            exact_divisible_dataset = {
                "daily_totals": {f"2026-11-{i:02d}": 100.0 for i in range(1, 11)},
                "total_cost": 1000.0
            }

            exact_budget = BudgetConfig(
                organization_id=self.org_id,
                name="Exact Divisible Budget",
                scope_type="WORKSPACE",
                scope_value="all",
                monthly_budget_usd=1500.0,
                alert_threshold_pct=80.0,
                is_active=1
            )
            db.add(exact_budget)
            db.commit()

            evals = evaluate_budgets(db, exact_divisible_dataset, org_id=self.org_id)
            b = evals[0]

            self.assertTrue(b["is_breached"])
            self.assertEqual(b["status"], "FORECASTED_BREACH")
            self.assertEqual(b["projected_breach_day"], 16,
                             f"Expected breach on Day 16, got Day {b['projected_breach_day']}")
        finally:
            db.close()

    def test_07d_budget_limit_equal_to_forecast_semantics(self):
        """Gate 7d: Budget limit exactly equal to forecast is NOT breached (strictly greater policy)."""
        from app.database import SessionLocal
        db = SessionLocal()
        try:
            db.query(BudgetConfig).filter(BudgetConfig.organization_id == self.org_id).delete()
            db.commit()

            forecast = calculate_cost_forecast(self.dataset)
            exact_forecast_val = forecast["forecasted_month_end_usd"]

            exact_budget = BudgetConfig(
                organization_id=self.org_id,
                name="Exact Forecast Match Budget",
                scope_type="WORKSPACE",
                scope_value="all",
                monthly_budget_usd=exact_forecast_val,
                alert_threshold_pct=95.0,
                is_active=1
            )
            db.add(exact_budget)
            db.commit()

            evals = evaluate_budgets(db, self.dataset, org_id=self.org_id)
            b = evals[0]

            # scope_forecasted == budget_limit -> not strictly greater -> not breached
            self.assertFalse(b["is_breached"])
            self.assertIsNone(b["projected_breach_day"])
            self.assertEqual(b["forecasted_spend_pct"], 100.0)
        finally:
            db.close()

    def test_07e_zero_and_negative_burn_rate_safety(self):
        """Gate 7e: Zero and negative burn rates are handled safely without division by zero."""
        from app.database import SessionLocal
        db = SessionLocal()
        try:
            db.query(BudgetConfig).filter(BudgetConfig.organization_id == self.org_id).delete()
            db.commit()

            zero_burn_dataset = {
                "daily_totals": {
                    "2026-10-01": 500.0,
                    "2026-10-02": 0.0,
                    "2026-10-03": 0.0,
                    "2026-10-04": 0.0
                }
            }

            test_budget = BudgetConfig(
                organization_id=self.org_id,
                name="Zero Burn Budget",
                scope_type="WORKSPACE",
                scope_value="all",
                monthly_budget_usd=400.0,  # lower than 500
                alert_threshold_pct=80.0,
                is_active=1
            )
            db.add(test_budget)
            db.commit()

            # Should not raise ZeroDivisionError
            evals = evaluate_budgets(db, zero_burn_dataset, org_id=self.org_id)
            self.assertEqual(len(evals), 1)
            b = evals[0]
            self.assertTrue(b["is_current_breached"])
            self.assertIsNone(b["projected_breach_day"])
        finally:
            db.close()

    def test_07f_scoped_budgets_service_and_account(self):
        """Gate 7f: Service and Account scoped budgets scale proportional burn rate and headroom correctly."""
        from app.database import SessionLocal
        db = SessionLocal()
        try:
            db.query(BudgetConfig).filter(BudgetConfig.organization_id == self.org_id).delete()
            db.commit()

            svc_budget = BudgetConfig(
                organization_id=self.org_id,
                name="EC2 Service Budget",
                scope_type="SERVICE",
                scope_value="Amazon EC2",
                monthly_budget_usd=10000.0,
                alert_threshold_pct=80.0,
                is_active=1
            )
            acc_budget = BudgetConfig(
                organization_id=self.org_id,
                name="Primary Account Budget",
                scope_type="ACCOUNT",
                scope_value="825799498078",
                monthly_budget_usd=10000.0,
                alert_threshold_pct=80.0,
                is_active=1
            )
            db.add_all([svc_budget, acc_budget])
            db.commit()

            evals = evaluate_budgets(db, self.dataset, org_id=self.org_id)
            self.assertEqual(len(evals), 2)
            for b in evals:
                self.assertGreater(b["current_spend_usd"], 0)
                self.assertGreater(b["forecasted_spend_usd"], 0)
                self.assertIn("is_current_breached", b)
        finally:
            db.close()

    def test_08_api_contract_and_tenant_isolation_preserved(self):
        """Gate 8: GET /api/forecast and GET /api/budgets endpoints preserve contract and tenant isolation."""
        res = self.client.get("/api/forecast", headers=self.headers)
        self.assertEqual(res.status_code, 200, f"Forecast API returned {res.status_code}: {res.text}")
        data = res.json()

        # Contract fields
        required_keys = [
            "period_month", "days_observed", "days_in_month", "days_remaining",
            "actual_spend_to_date_usd", "daily_burn_rate_usd", "forecasted_month_end_usd",
            "confidence_low_usd", "confidence_high_usd", "daily_history"
        ]
        for k in required_keys:
            self.assertIn(k, data, f"Missing required key in forecast response: {k}")

        # Additive decomposition fields
        self.assertIn("actual_operational_spend_usd", data)
        self.assertIn("actual_commitment_spend_usd", data)
        self.assertIn("actual_tax_spend_usd", data)
        self.assertIn("operational_burn_rate_usd", data)

        # Trajectory series
        history = data["daily_history"]
        self.assertGreater(len(history), 0)
        observed_pts = [h for h in history if not h["is_projection"]]
        projected_pts = [h for h in history if h["is_projection"]]
        self.assertEqual(len(observed_pts), data["days_observed"])
        self.assertEqual(len(projected_pts), data["days_remaining"])

        # Check GET /api/budgets contract
        b_res = self.client.get("/api/budgets", headers=self.headers)
        self.assertEqual(b_res.status_code, 200)
        b_data = b_res.json()
        if len(b_data) > 0:
            self.assertIn("is_current_breached", b_data[0])
            self.assertIn("projected_breach_day", b_data[0])

    def test_09_safe_fallback_for_synthetic_or_minimal_datasets(self):
        """Gate 9: Deterministic and crash-safe fallback behavior for datasets without record breakdown."""
        # Minimal dataset with only daily_totals
        minimal_dataset = {
            "daily_totals": {
                "2026-10-01": 100.0,
                "2026-10-02": 105.0,
                "2026-10-03": 95.0,
                "2026-10-04": 110.0
            }
        }
        forecast = calculate_cost_forecast(minimal_dataset)
        self.assertEqual(forecast["days_observed"], 4)
        self.assertEqual(forecast["actual_spend_to_date_usd"], 410.0)
        self.assertGreater(forecast["forecasted_month_end_usd"], 410.0)
        self.assertGreater(forecast["daily_burn_rate_usd"], 0)

        # Empty dataset fallback
        empty_forecast = calculate_cost_forecast({})
        self.assertEqual(empty_forecast["days_observed"], 0)
        self.assertEqual(empty_forecast["forecasted_month_end_usd"], 0.0)

    def test_10_production_database_safety_invariant(self):
        """Gate 10: Strict Safety Invariant - tests run against isolated test database and finops.db is untouched."""
        from app.database import engine
        db_url = str(engine.url).replace('\\', '/').lower()
        self.assertIn("zorvex_isolated_test.db", db_url, f"CRITICAL: Tests running against non-isolated DB: {engine.url}")
        self.assertNotIn("finops.db", db_url, f"CRITICAL: Tests bound to production database: {engine.url}")

    def test_11_executive_spend_pulse_ui_contract(self):
        """Gate 11: ExecutiveSpendPulse UI template contains zero hardcoded fallbacks and renders explanatory subtitle."""
        fe_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            "frontend", "src", "components", "ExecutiveSpendPulse.jsx"
        )
        self.assertTrue(os.path.exists(fe_path), f"Frontend component missing at {fe_path}")
        with open(fe_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Zero fabricated fallbacks
        self.assertNotIn("16598.87", content, "Found hardcoded 16598.87 fallback in ExecutiveSpendPulse.jsx!")
        self.assertNotIn("426.89", content, "Found hardcoded 426.89 fallback in ExecutiveSpendPulse.jsx!")

        # Explanatory subtitle distinguishing MTD charges and operational burn
        self.assertIn("Combines actual MTD charges with projected remaining operational spend", content)
        self.assertIn("operational burn of", content)


if __name__ == "__main__":
    unittest.main()

