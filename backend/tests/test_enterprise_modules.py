import unittest
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import (
    AnomalyAlert, BudgetConfig, RecommendationRecord, 
    AiAnalystQuery, User
)
from app.anomalies import detect_anomalies_from_dataset, sync_anomalies_to_db, get_stored_anomalies
from app.budget_guard import calculate_cost_forecast, evaluate_budgets
from app.savings_ledger import (
    sync_recommendations_to_ledger, update_recommendation_status, 
    get_executive_ledger_summary, get_ledger_records
)
from app.ai_analyst import ask_zorvex_analyst, sanitize_query, analyze_intent

class TestEnterpriseModules(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=cls.engine)
        cls.SessionLocal = sessionmaker(bind=cls.engine)

    def setUp(self):
        self.db = self.SessionLocal()
        # Mock realistic multi-day dataset
        self.mock_dataset = {
            "total_cost": 3450.0,
            "dates": ["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04"],
            "daily_totals": {
                "2026-03-01": 50.0,
                "2026-03-02": 52.0,
                "2026-03-03": 48.0,
                "2026-03-04": 250.0  # Clear spike!
            },
            "services": {
                "AmazonEC2": 2400.0,
                "AmazonRDS": 800.0,
                "AmazonS3": 250.0
            },
            "accounts": {
                "111122223333": 3450.0
            },
            "records": [
                {"date": "2026-03-01", "service": "AmazonEC2", "account_id": "111122223333", "resource_id": "i-001", "cost": 50.0},
                {"date": "2026-03-02", "service": "AmazonEC2", "account_id": "111122223333", "resource_id": "i-001", "cost": 52.0},
                {"date": "2026-03-03", "service": "AmazonEC2", "account_id": "111122223333", "resource_id": "i-001", "cost": 48.0},
                {"date": "2026-03-04", "service": "AmazonEC2", "account_id": "111122223333", "resource_id": "i-002", "cost": 250.0}
            ]
        }

    def tearDown(self):
        self.db.close()

    def test_anomaly_detection(self):
        anomalies = detect_anomalies_from_dataset(self.mock_dataset)
        self.assertGreaterEqual(len(anomalies), 1)
        top = anomalies[0]
        self.assertEqual(top["service"], "AmazonEC2")
        self.assertEqual(top["date"], "2026-03-04")
        self.assertGreater(top["delta_usd"], 100.0)

        # Test sync to DB
        synced = sync_anomalies_to_db(self.db, self.mock_dataset)
        self.assertGreaterEqual(len(synced), 1)
        
        stored = get_stored_anomalies(self.db)
        self.assertGreaterEqual(len(stored), 1)

    def test_forecasting_and_budgets(self):
        forecast = calculate_cost_forecast(self.mock_dataset)
        self.assertEqual(forecast["days_observed"], 4)
        self.assertGreater(forecast["forecasted_month_end_usd"], forecast["actual_spend_to_date_usd"])
        self.assertGreater(forecast["daily_burn_rate_usd"], 0)
        self.assertIn("usd_to_inr_rate", forecast)

        # Create budget and evaluate
        budget = BudgetConfig(
            name="Production Cap",
            scope_type="WORKSPACE",
            scope_value="all",
            monthly_budget_usd=2000.0,  # lower than forecasted spend
            alert_threshold_pct=80.0
        )
        self.db.add(budget)
        self.db.commit()

        evals = evaluate_budgets(self.db, self.mock_dataset)
        self.assertEqual(len(evals), 1)
        self.assertTrue(evals[0]["is_breached"])

    def test_savings_ledger_lifecycle(self):
        raw_recs = [
            {
                "id": "ebs_test_vol_1",
                "category": "EBS_UNATTACHED",
                "title": "Unattached gp2 volume",
                "resource_id": "vol-01234",
                "service": "AmazonEC2",
                "monthly_savings": 50.0
            },
            {
                "id": "ec2_test_idle_1",
                "category": "EC2_IDLE",
                "title": "Idle t3.large instance",
                "resource_id": "i-09999",
                "service": "AmazonEC2",
                "monthly_savings": 120.0
            }
        ]
        sync_recommendations_to_ledger(self.db, raw_recs)
        records = get_ledger_records(self.db)
        self.assertEqual(len(records), 2)

        # Test approve and implement
        updated = update_recommendation_status(self.db, "ebs_test_vol_1", "APPROVED", user_name="Burhan")
        self.assertEqual(updated["status"], "APPROVED")
        self.assertEqual(updated["approved_by"], "Burhan")

        updated_impl = update_recommendation_status(self.db, "ebs_test_vol_1", "IMPLEMENTED", user_name="Burhan")
        self.assertEqual(updated_impl["status"], "IMPLEMENTED")
        self.assertEqual(updated_impl["realized_monthly_savings_usd"], 50.0)

        # Test summary
        summary = get_executive_ledger_summary(self.db, monthly_retainer_inr=35000.0)
        self.assertEqual(summary["total_identified_monthly_usd"], 170.0)
        self.assertEqual(summary["total_implemented_monthly_usd"], 50.0)
        self.assertIn("roi_multiplier", summary)

    def test_ai_analyst(self):
        q = "Why did AWS spending increase this month?"
        intent = analyze_intent(q)
        self.assertEqual(intent, "SPEND_INCREASE_ANALYSIS")

        res = ask_zorvex_analyst(q, self.mock_dataset, self.db)
        self.assertIn("authoritative CUR telemetry", res["answer"])
        self.assertEqual(res["intent"], "SPEND_INCREASE_ANALYSIS")
        self.assertGreater(len(res["data_references"]), 0)

        # Test injection sanitization
        clean = sanitize_query("<script>alert('pwn')</script> Which services spend the most; DROP TABLE users;")
        self.assertNotIn("<script>", clean)
        self.assertNotIn(";", clean)

if __name__ == "__main__":
    unittest.main()
