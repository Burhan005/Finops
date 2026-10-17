"""
ZORVEX FinOps Platform - Complete DB-First Persistence & State Verification Test Suite
====================================================================================
Tests verifying:
1. Fresh ingestion persists all 36,218 records into SQLite.
2. Deduplication guarantee: Repeating ingestion does not double count or insert duplicate rows.
3. Transaction rollback on partial/failed ingestion.
4. Dataset selection and active state switching properly resolves persistent billing records.
5. DB-backed Overview, Trends, Resources, Forecast, and Budgets return X-Zorvex-Data-Source: database.
6. Controlled error handling: Missing persisted records with no parsed data returns HTTP 503, never silent fallback.
7. Multi-tenant isolation: Tenant B cannot access or view Tenant A's persistent billing records.
8. GET immutability: Analytical GET requests produce zero state mutation or side effects in billing_records.
"""

import os
import sys
import unittest
from decimal import Decimal
from datetime import datetime, timezone
from fastapi.testclient import TestClient

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database import engine, Base, SessionLocal
from app.models import Organization, User, UserSession, DatasetRecord, BillingRecord, BudgetConfig
from app.repository import BillingRepository
from app.parser import parse_cur_file, round_currency
from app.cache import global_cache
from app.main import app

SAMPLE_CUR_PATH = os.path.join(backend_dir, "data", "samples", "CUR-Report-Daily-00001.csv.gz")


class TestDbFirstPersistenceCompletion(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.db = SessionLocal()
        cls.client = TestClient(app)

        # 1. Create Organization Alpha & Beta for multi-tenant tests
        cls.org_alpha = Organization(name="Tenant Alpha - Persistence Suite")
        cls.org_beta = Organization(name="Tenant Beta - Persistence Suite")
        cls.db.add(cls.org_alpha)
        cls.db.add(cls.org_beta)
        cls.db.commit()
        cls.db.refresh(cls.org_alpha)
        cls.db.refresh(cls.org_beta)

        # 2. Authenticated user for Tenant Alpha
        cls.user_alpha = User(
            organization_id=cls.org_alpha.id,
            name="Alpha Auditor",
            company="Tenant Alpha",
            email="alpha.auditor@zorvex.test",
            password_hash="mock_hash"
        )
        cls.db.add(cls.user_alpha)
        cls.db.commit()
        cls.db.refresh(cls.user_alpha)

        cls.token_alpha = "test_alpha_token_persistence_suite"
        cls.session_alpha = UserSession(
            token=cls.token_alpha,
            user_id=cls.user_alpha.id,
            organization_id=cls.org_alpha.id
        )
        cls.db.add(cls.session_alpha)
        cls.db.commit()
        cls.headers_alpha = {"Authorization": f"Bearer {cls.token_alpha}"}

        # 3. Parse sample CUR
        cls.parsed_data = parse_cur_file(SAMPLE_CUR_PATH)

        # 4. Create active DatasetRecord for Tenant Alpha
        cls.ds_alpha = DatasetRecord(
            organization_id=cls.org_alpha.id,
            filename="CUR-Report-Daily-00001.csv.gz",
            filepath=SAMPLE_CUR_PATH,
            file_type="sample",
            total_cost=cls.parsed_data['gross_cost'],
            net_cost=cls.parsed_data['net_cost'],
            credits_total=cls.parsed_data['credits_total'],
            refunds_total=cls.parsed_data['refunds_total'],
            taxes_total=cls.parsed_data['taxes_total'],
            total_rows=cls.parsed_data['total_rows'],
            is_active=1,
            uploaded_at=datetime.now(timezone.utc)
        )
        cls.db.add(cls.ds_alpha)
        cls.db.commit()
        cls.db.refresh(cls.ds_alpha)

        cls.repo_alpha = BillingRepository(cls.db, org_id=cls.org_alpha.id, dataset_id=cls.ds_alpha.id)

    @classmethod
    def tearDownClass(cls):
        try:
            cls.db.query(BillingRecord).filter(
                BillingRecord.organization_id.in_([cls.org_alpha.id, cls.org_beta.id])
            ).delete(synchronize_session=False)
            cls.db.query(DatasetRecord).filter(
                DatasetRecord.organization_id.in_([cls.org_alpha.id, cls.org_beta.id])
            ).delete(synchronize_session=False)
            cls.db.query(UserSession).filter(UserSession.token == cls.token_alpha).delete()
            cls.db.query(User).filter(User.id == cls.user_alpha.id).delete()
            cls.db.query(Organization).filter(
                Organization.id.in_([cls.org_alpha.id, cls.org_beta.id])
            ).delete(synchronize_session=False)
            cls.db.commit()
            global_cache.clear()
        except Exception:
            pass
        finally:
            cls.db.close()

    def test_01_fresh_ingestion_persists_all_records(self):
        """Verify initial fresh ingestion accurately writes all 36,218 records to SQLite."""
        self.assertFalse(self.repo_alpha.has_records())
        inserted = self.repo_alpha.ensure_persisted(self.parsed_data)
        self.assertEqual(inserted, 36218)
        self.assertTrue(self.repo_alpha.has_records())
        self.assertEqual(self.repo_alpha.get_record_count(), 36218)

    def test_02_repeating_ingestion_does_not_duplicate_records(self):
        """Verify calling ensure_persisted multiple times never inserts duplicate rows."""
        count_before = self.repo_alpha.get_record_count()
        repeat_inserted = self.repo_alpha.ensure_persisted(self.parsed_data)
        self.assertEqual(repeat_inserted, count_before)
        count_after = self.repo_alpha.get_record_count()
        self.assertEqual(count_before, count_after)
        self.assertEqual(count_after, 36218)

    def test_03_transaction_rollback_guarantee(self):
        """Verify failed batch insertion safely rolls back without leaving corrupted partial rows."""
        # Create separate temp dataset for rollback test
        ds_fail = DatasetRecord(
            organization_id=self.org_alpha.id,
            filename="fail_test.csv",
            filepath="",
            file_type="sample",
            is_active=0
        )
        self.db.add(ds_fail)
        self.db.commit()
        self.db.refresh(ds_fail)

        fail_repo = BillingRepository(self.db, org_id=self.org_alpha.id, dataset_id=ds_fail.id)
        # Mock bad data that will trigger an exception
        bad_data = {
            'records': [
                {'date': '2026-10-01', 'cost': 10.0, 'line_type': 'Usage'},
                # Triggers unhandled error during mapping
                {'date': None, 'cost': 'INVALID_FLOAT_THAT_FAILS', 'line_type': 'Usage'}
            ]
        }
        with self.assertRaises(Exception):
            fail_repo.ensure_persisted(bad_data)

        # Confirm 0 records were left behind
        self.assertFalse(fail_repo.has_records())
        self.assertEqual(fail_repo.get_record_count(), 0)

        # Cleanup
        self.db.delete(ds_fail)
        self.db.commit()

    def test_04_overview_endpoint_serves_db_first_with_header(self):
        """Verify /api/overview queries the database and attaches X-Zorvex-Data-Source: database header."""
        resp = self.client.get("/api/overview", headers=self.headers_alpha)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.headers.get("X-Zorvex-Data-Source"), "database")
        data = resp.json()
        self.assertEqual(data["gross_cost"], 7762.44)
        self.assertEqual(data["net_cost"], 8914.94)
        self.assertEqual(data["taxes_total"], 1152.50)
        self.assertEqual(data["data_source"], "database")

    def test_05_trends_and_resources_endpoints_serve_db_first(self):
        """Verify /api/trends and /api/resources serve DB-first with database header."""
        resp_trends = self.client.get("/api/trends", headers=self.headers_alpha)
        self.assertEqual(resp_trends.status_code, 200)
        self.assertEqual(resp_trends.headers.get("X-Zorvex-Data-Source"), "database")

        resp_res = self.client.get("/api/resources?page=1&page_size=10", headers=self.headers_alpha)
        self.assertEqual(resp_res.status_code, 200)
        self.assertEqual(resp_res.headers.get("X-Zorvex-Data-Source"), "database")
        res_data = resp_res.json()
        self.assertEqual(len(res_data["resources"]), 10)
        self.assertTrue(res_data["total_count"] > 100)

    def test_06_forecast_and_budgets_serve_db_first(self):
        """Verify /api/forecast and /api/budgets execute from SQLite with database header."""
        resp_fc = self.client.get("/api/forecast", headers=self.headers_alpha)
        self.assertEqual(resp_fc.status_code, 200)
        self.assertEqual(resp_fc.headers.get("X-Zorvex-Data-Source"), "database")
        fc_data = resp_fc.json()
        self.assertEqual(fc_data["forecasted_month_end_usd"], 13696.33)
        self.assertEqual(fc_data["operational_burn_rate_usd"], 265.63)

        resp_b = self.client.get("/api/budgets", headers=self.headers_alpha)
        self.assertEqual(resp_b.status_code, 200)
        self.assertEqual(resp_b.headers.get("X-Zorvex-Data-Source"), "database")

    def test_07_root_cause_endpoint_exposes_explicit_engine_header(self):
        """Verify /api/analytics/root-cause explicitly signals in-memory-quantity-rate-engine header."""
        body = {
            "baseline_start": "2026-10-02",
            "baseline_end": "2026-10-04",
            "target_start": "2026-10-08",
            "target_end": "2026-10-10"
        }
        resp = self.client.post("/api/analytics/root-cause", json=body, headers=self.headers_alpha)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.headers.get("X-Zorvex-Data-Source"), "in-memory-quantity-rate-engine")

    def test_08_controlled_error_on_unpersisted_dataset(self):
        """Verify that an active DB dataset record with 0 billing rows and no parsed data raises HTTP 503."""
        # Create unpersisted dataset record with total_rows > 0
        ds_empty = DatasetRecord(
            organization_id=self.org_beta.id,
            filename="unpersisted_empty.csv",
            filepath="",
            file_type="upload",
            total_rows=1000,
            is_active=1
        )
        self.db.add(ds_empty)
        self.db.commit()
        self.db.refresh(ds_empty)

        # Authenticate Tenant Beta
        user_beta = User(
            organization_id=self.org_beta.id,
            name="Beta Auditor",
            company="Tenant Beta",
            email="beta.auditor@zorvex.test",
            password_hash="mock_hash"
        )
        self.db.add(user_beta)
        self.db.commit()
        self.db.refresh(user_beta)

        token_beta = "test_beta_token_persistence_suite"
        sess_beta = UserSession(token=token_beta, user_id=user_beta.id, organization_id=self.org_beta.id)
        self.db.add(sess_beta)
        self.db.commit()
        headers_beta = {"Authorization": f"Bearer {token_beta}"}

        # Query Tenant Beta: must raise 503, NOT silently compute bogus totals
        resp = self.client.get("/api/overview", headers=headers_beta)
        self.assertEqual(resp.status_code, 503)
        self.assertIn("not yet persisted", resp.json()["detail"])

        # Cleanup
        self.db.delete(sess_beta)
        self.db.delete(user_beta)
        self.db.delete(ds_empty)
        self.db.commit()

    def test_09_multi_tenant_isolation(self):
        """Verify Tenant Beta cannot see or aggregate Tenant Alpha's persisted billing records."""
        token_beta = "test_beta_token_persistence_suite_2"
        sess_beta = UserSession(token=token_beta, user_id=1, organization_id=self.org_beta.id)
        self.db.add(sess_beta)
        self.db.commit()
        headers_beta = {"Authorization": f"Bearer {token_beta}"}

        repo_beta = BillingRepository(self.db, org_id=self.org_beta.id, dataset_id=self.ds_alpha.id)
        self.assertFalse(repo_beta.has_records())
        self.assertEqual(repo_beta.get_record_count(), 0)

        # Overview for Tenant Beta must be zero
        b_ov = repo_beta.get_overview()
        self.assertEqual(b_ov["gross_cost"], 0.0)
        self.assertEqual(b_ov["net_cost"], 0.0)

        # Cleanup
        self.db.delete(sess_beta)
        self.db.commit()

    def test_10_get_requests_are_side_effect_free(self):
        """Verify repeated GET requests to analytical endpoints never mutate billing_records count."""
        initial_count = self.repo_alpha.get_record_count()
        for _ in range(5):
            self.client.get("/api/overview", headers=self.headers_alpha)
            self.client.get("/api/trends", headers=self.headers_alpha)
            self.client.get("/api/resources?page=1&page_size=5", headers=self.headers_alpha)
            self.client.get("/api/forecast", headers=self.headers_alpha)
            self.client.get("/api/budgets", headers=self.headers_alpha)

        final_count = self.repo_alpha.get_record_count()
        self.assertEqual(initial_count, final_count)
        self.assertEqual(final_count, 36218)


if __name__ == "__main__":
    unittest.main()
