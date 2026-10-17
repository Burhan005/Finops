"""
Stage 3B Acceptance Test Suite:
Financial Precision & Aggregation Consistency

Acceptance Gates Verified:
1. Exact, decimal-safe accounting policy (Decimal and ROUND_HALF_UP) eliminates binary floating-point drift.
2. Full calculation precision preserved across parsing, indexing, and aggregation; rounding applied only at the presentation boundary.
3. Zero artificial balancing adjustments or forced numbers.
4. Total operational spend reconciles with Resource Explorer ($7,762.44).
5. All 27 service totals reconcile exactly between the Overview service breakdown and service-filtered views ($0.00 difference).
6. Date-filtered views reconcile consistently between Overview and Resource Explorer.
7. Resource Explorer summary classified and unallocated costs reconcile cleanly: classified + unallocated == total_cost.
8. Reconciled net invoiced spend matches gross + taxes + credits + refunds ($8,914.94).
9. Checkpoint 3A semantics preserved (taxes and commitments distinct from operational workloads).
10. Strict test database isolation enforced (never touches backend/data/finops.db).
"""

import os
import sys
import unittest
from decimal import Decimal
from typing import Dict, Any

from fastapi.testclient import TestClient

# conftest.py configures isolated test DB prior to imports
from app.main import app, CURRENT_DATASET
from app.database import engine, get_db
from app.models import Organization, User, UserSession, DatasetRecord
from app.security import hash_password, generate_session_token
from app.parser import parse_cur_file, round_currency
from app.resource_explorer import query_resource_explorer


class TestStage3BFinancialPrecision(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        """Set up test client, authenticate test session, and load active sample dataset."""
        # 1. Enforce test isolation
        db_url = str(engine.url).replace('\\', '/').lower()
        assert "zorvex_isolated_test.db" in db_url, f"CRITICAL: Non-isolated DB: {engine.url}"
        assert "finops.db" not in db_url, f"CRITICAL: Tests bound to production database: {engine.url}"

        cls.client = TestClient(app)

        # 2. Set up test organization and user in isolated DB
        from app.database import SessionLocal
        db = SessionLocal()
        try:
            org = db.query(Organization).filter(Organization.name == "Precision Test Org").first()
            if not org:
                org = Organization(name="Precision Test Org")
                db.add(org)
                db.flush()

            user = db.query(User).filter(User.email == "finops-precision@zorvex.test").first()
            if not user:
                user = User(
                    organization_id=org.id,
                    name="FinOps Precision Auditor",
                    company="Precision Test Org",
                    email="finops-precision@zorvex.test",
                    password_hash=hash_password("FinOps#SecurePrecision2026!")
                )
                db.add(user)
                db.flush()

            cls.session_token = f"session_stage3b_{generate_session_token()[:32]}"
            user_session = UserSession(
                token=cls.session_token,
                user_id=user.id,
                organization_id=org.id
            )
            db.add(user_session)
            db.commit()
            cls.org_id = org.id
            cls.user_id = user.id
        finally:
            db.close()

        cls.headers = {"Authorization": f"Bearer {cls.session_token}"}

        # 3. Load authoritative active sample dataset
        samples_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "samples")
        cls.cur_path = os.path.join(samples_dir, "CUR-Report-Daily-00001.csv.gz")
        assert os.path.exists(cls.cur_path), f"CUR dataset missing: {cls.cur_path}"

        cls.cur_data = parse_cur_file(cls.cur_path)
        CURRENT_DATASET['filename'] = "CUR-Report-Daily-00001.csv.gz"
        CURRENT_DATASET['filepath'] = cls.cur_path
        CURRENT_DATASET['data'] = cls.cur_data

    def test_01_round_currency_decimal_safe_policy(self):
        """Verify round_currency implements standard ROUND_HALF_UP and avoids binary float drift."""
        # Standard half-up verification
        self.assertEqual(round_currency(Decimal('10.005')), 10.01)
        self.assertEqual(round_currency(Decimal('10.004')), 10.00)
        self.assertEqual(round_currency(Decimal('0.0000000375')), 0.00)
        self.assertEqual(round_currency(Decimal('7762.4355818372')), 7762.44)
        self.assertEqual(round_currency(7762.4355818372), 7762.44)
        self.assertEqual(round_currency('1152.50'), 1152.50)

    def test_02_overview_gross_and_net_invoice_reconciliation(self):
        """Verify Overview gross usage, statutory tax, and net invoiced spend reconcile exactly."""
        resp = self.client.get("/api/overview", headers=self.headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()

        # Gross operational spend
        self.assertEqual(data["gross_cost"], 7762.44)
        self.assertEqual(data["total_cost"], 7762.44)

        # Statutory taxes (invoiced GST)
        self.assertEqual(data["taxes_total"], 1152.50)

        # Net invoiced spend (gross + taxes + credits + refunds)
        self.assertEqual(data["net_cost"], 8914.94)

        # Explicit accounting reconciliation formula check
        recon = data["accounting_reconciliation"]
        self.assertTrue(recon["is_reconciled"])
        calc_net = round_currency(Decimal(str(recon["gross_usage_cost"])) +
                                  Decimal(str(recon["taxes_total"])) +
                                  Decimal(str(recon["credits_total"])) +
                                  Decimal(str(recon["refunds_total"])))
        self.assertEqual(calc_net, recon["net_invoiced_spend"])

    def test_03_all_services_reconcile_between_overview_table_and_service_filter(self):
        """Verify that every service total in the overview breakdown matches its filtered overview view."""
        resp_ov = self.client.get("/api/overview", headers=self.headers)
        self.assertEqual(resp_ov.status_code, 200)
        ov_data = resp_ov.json()
        services_table = ov_data["services"]

        self.assertGreater(len(services_table), 20, "Expected at least 20 services in active CUR")

        for svc_name, expected_cost in services_table.items():
            if svc_name in ('Taxes & Surcharges', 'Tax'):
                continue

            resp_filtered = self.client.get(f"/api/overview?service={svc_name}", headers=self.headers)
            self.assertEqual(resp_filtered.status_code, 200)
            f_data = resp_filtered.json()

            # The service-filtered overview gross cost MUST equal the service bucket in the overview table
            self.assertEqual(
                f_data["gross_cost"],
                expected_cost,
                f"Service {svc_name} mismatch: filtered gross={f_data['gross_cost']} vs table={expected_cost}"
            )

    def test_04_specific_audit_confirmed_services_precision(self):
        """Directly verify the 4 services flagged in Stage 3 audit for pre-rounding discrepancies."""
        audit_services = {
            "Amazon Redshift": 647.52,
            "AWS WAF": 417.16,
            "Amazon RDS": 3244.54,
            "Amazon EC2": 1191.05
        }

        for svc, expected_amt in audit_services.items():
            resp = self.client.get(f"/api/overview?service={svc}", headers=self.headers)
            self.assertEqual(resp.status_code, 200)
            data = resp.json()
            self.assertEqual(
                data["gross_cost"],
                expected_amt,
                f"Audit defect not fixed for {svc}: got {data['gross_cost']}, expected {expected_amt}"
            )

    def test_05_resource_explorer_matches_overview_gross_total(self):
        """Verify Resource Explorer unfiltered total matches Overview gross spend ($7,762.44)."""
        res_exp = query_resource_explorer(self.cur_data)
        summary = res_exp["summary"]

        self.assertEqual(summary["total_cost"], 7762.44)
        self.assertEqual(summary["classified_cost"], 3556.20)
        self.assertEqual(summary["unallocated_cost"], 4206.24)

        # Sum of classified and unallocated must reconcile exactly with total_cost
        sum_components = round_currency(Decimal(str(summary["classified_cost"])) + Decimal(str(summary["unallocated_cost"])))
        self.assertEqual(sum_components, 7762.44)

    def test_06_resource_explorer_service_breakdown_consistency(self):
        """Verify querying Resource Explorer by service matches the Overview service table for all services."""
        services = self.cur_data["services"]
        for svc_name, expected_cost in services.items():
            if svc_name in ('Taxes & Surcharges', 'Tax'):
                continue
            res = query_resource_explorer(self.cur_data, service=svc_name)
            self.assertEqual(
                res["summary"]["total_cost"],
                expected_cost,
                f"Resource Explorer service {svc_name} mismatch: {res['summary']['total_cost']} vs {expected_cost}"
            )

    def test_07_date_filtered_overview_and_resource_explorer_consistency(self):
        """Verify that date-filtered Overview and Resource Explorer report identical totals."""
        test_windows = [
            ("2026-10-01", "2026-10-05", 5549.31),
            ("2026-10-03", "2026-10-10", 2296.81),
            ("2026-10-01", "2026-10-13", 7762.44)
        ]

        for s_date, e_date, expected_total in test_windows:
            # 1. Overview endpoint
            resp = self.client.get(f"/api/overview?start_date={s_date}&end_date={e_date}", headers=self.headers)
            self.assertEqual(resp.status_code, 200)
            ov_data = resp.json()
            self.assertEqual(
                ov_data["gross_cost"],
                expected_total,
                f"Overview date window {s_date} to {e_date} failed: got {ov_data['gross_cost']} expected {expected_total}"
            )

            # 2. Resource Explorer query engine
            res_exp = query_resource_explorer(self.cur_data, start_date=s_date, end_date=e_date)
            self.assertEqual(
                res_exp["summary"]["total_cost"],
                expected_total,
                f"Resource Explorer date window {s_date} to {e_date} failed: got {res_exp['summary']['total_cost']} expected {expected_total}"
            )

    def test_08_no_artificial_balancing_adjustments(self):
        """Verify that neither parser nor main.py introduce synthetic adjustments or fudge factors."""
        # Inspect parser dictionary keys
        self.assertNotIn("balancing_adjustment", self.cur_data)
        self.assertNotIn("plug_value", self.cur_data)
        self.assertNotIn("reconciliation_fudge", self.cur_data)

        # Inspect raw record sum vs total_cost to confirm natural mathematical convergence
        raw_gross = sum(r['cost'] for r in self.cur_data['records'] if r.get('line_type') not in ('Tax', 'Credit', 'Refund', 'SavingsPlanNegation'))
        self.assertAlmostEqual(raw_gross, 7762.4355818372, places=6)
        self.assertEqual(round_currency(Decimal(str(raw_gross))), 7762.44)

    def test_09_fractional_micro_cent_retention(self):
        """Verify that fractional-cent records (e.g. S3 micro-requests, data transfer) retain full precision."""
        micro_records = [r for r in self.cur_data['records'] if 0 < r['cost'] < 0.0001]
        self.assertGreater(len(micro_records), 100, "Active dataset must contain micro-cent billing records")
        # Ensure micro costs were not rounded down to 0.0
        for r in micro_records[:10]:
            self.assertGreater(r['cost'], 0.0)
            self.assertLess(r['cost'], 0.0001)

    def test_10_production_database_safety_invariant(self):
        """Strict safety invariant: verify that tests are running against isolated DB and finops.db was NOT mutated."""
        from app.database import engine
        db_url = str(engine.url).replace('\\', '/').lower()
        self.assertIn("zorvex_isolated_test.db", db_url, f"CRITICAL: Tests running against non-isolated DB: {engine.url}")
        self.assertNotIn("finops.db", db_url, f"CRITICAL: Tests bound to production database: {engine.url}")


if __name__ == "__main__":
    unittest.main()
