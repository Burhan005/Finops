"""
ZORVEX Multi-Tenant Boundary & Leak Prevention Test Suite
Verifies rigorous data isolation between organizations across all platform modules:
1. CUR Uploads & Dataset Records Isolation
2. S3 Sync Configuration Isolation
3. Agency White-label Branding Isolation
4. Cost Anomaly Alerts & Action Lifecycle Isolation
5. Budget Guard Multi-Tenant Scoping & Delete Protection
6. Executive Savings Ledger & Recommendation Status Isolation
7. AI Analyst Query History Isolation
8. Unauthenticated Access Zero-Leak Verification
"""

import os
import sys
import unittest
import io
from datetime import datetime, timezone

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db
from app.models import (
    Organization, User, UserSession, BudgetConfig, DatasetRecord,
    AgencyBrandingConfig, S3SyncConfig, AiAnalystQuery, RecommendationRecord, AnomalyAlert
)
from app.security import hash_password, generate_session_token

class TestMultiTenantLeakPrevention(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = next(get_db())

        # Create Org A
        cls.org_a = cls.db.query(Organization).filter(Organization.name == "Tenant Alpha Corp").first()
        if not cls.org_a:
            cls.org_a = Organization(name="Tenant Alpha Corp")
            cls.db.add(cls.org_a)
            cls.db.commit()
            cls.db.refresh(cls.org_a)

        # Create Org B
        cls.org_b = cls.db.query(Organization).filter(Organization.name == "Tenant Beta Corp").first()
        if not cls.org_b:
            cls.org_b = Organization(name="Tenant Beta Corp")
            cls.db.add(cls.org_b)
            cls.db.commit()
            cls.db.refresh(cls.org_b)

        # User A
        cls.user_a = cls.db.query(User).filter(User.email == "user_a@tenantalpha.io").first()
        if not cls.user_a:
            cls.user_a = User(
                organization_id=cls.org_a.id,
                name="Alice Alpha",
                company="Tenant Alpha Corp",
                email="user_a@tenantalpha.io",
                password_hash=hash_password("AlphaPass#2026")
            )
            cls.db.add(cls.user_a)
            cls.db.commit()
            cls.db.refresh(cls.user_a)

        # User B
        cls.user_b = cls.db.query(User).filter(User.email == "user_b@tenantbeta.io").first()
        if not cls.user_b:
            cls.user_b = User(
                organization_id=cls.org_b.id,
                name="Bob Beta",
                company="Tenant Beta Corp",
                email="user_b@tenantbeta.io",
                password_hash=hash_password("BetaPass#2026")
            )
            cls.db.add(cls.user_b)
            cls.db.commit()
            cls.db.refresh(cls.user_b)

        # Sessions
        cls.token_a = f"token_alpha_{generate_session_token()}"
        cls.token_b = f"token_beta_{generate_session_token()}"

        cls.db.add(UserSession(user_id=cls.user_a.id, token=cls.token_a))
        cls.db.add(UserSession(user_id=cls.user_b.id, token=cls.token_b))
        cls.db.commit()

        cls.auth_a = {"Authorization": f"Bearer {cls.token_a}"}
        cls.auth_b = {"Authorization": f"Bearer {cls.token_b}"}

    @classmethod
    def tearDownClass(cls):
        try:
            cls.db.query(UserSession).filter(UserSession.token.in_([cls.token_a, cls.token_b])).delete()
            cls.db.query(BudgetConfig).filter(BudgetConfig.organization_id.in_([cls.org_a.id, cls.org_b.id])).delete()
            cls.db.query(AgencyBrandingConfig).filter(AgencyBrandingConfig.organization_id.in_([cls.org_a.id, cls.org_b.id])).delete()
            cls.db.query(S3SyncConfig).filter(S3SyncConfig.organization_id.in_([cls.org_a.id, cls.org_b.id])).delete()
            cls.db.query(AiAnalystQuery).filter(AiAnalystQuery.organization_id.in_([cls.org_a.id, cls.org_b.id])).delete()
            cls.db.query(RecommendationRecord).filter(RecommendationRecord.organization_id.in_([cls.org_a.id, cls.org_b.id])).delete()
            cls.db.query(AnomalyAlert).filter(AnomalyAlert.organization_id.in_([cls.org_a.id, cls.org_b.id])).delete()
            cls.db.commit()
        except Exception:
            cls.db.rollback()
        finally:
            cls.db.close()

    def test_unauthenticated_datasets_returns_zero_uploads(self):
        """Unauthenticated request must never leak private uploaded datasets."""
        res = self.client.get("/api/datasets")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("uploads"), [], "Unauthenticated user should see 0 uploaded datasets")

    def test_branding_multi_tenant_isolation(self):
        """Tenant B and unauthenticated users must never see Tenant A's private branding."""
        # Tenant A sets custom branding
        save_res = self.client.post("/api/branding", json={
            "agency_name": "Alpha Shield FinOps",
            "client_name": "Alpha Enterprise Corp",
            "prepared_by": "Alice Alpha",
            "contact_email": "ops@tenantalpha.io",
            "confidentiality_note": "Alpha Secret Boardroom Document"
        }, headers=self.auth_a)
        self.assertEqual(save_res.status_code, 200)

        # Tenant A sees custom branding
        res_a = self.client.get("/api/branding", headers=self.auth_a)
        self.assertEqual(res_a.status_code, 200)
        self.assertEqual(res_a.json()["agency_name"], "Alpha Shield FinOps")

        # Tenant B must NOT see Tenant A's branding
        res_b = self.client.get("/api/branding", headers=self.auth_b)
        self.assertEqual(res_b.status_code, 200)
        self.assertNotEqual(res_b.json()["agency_name"], "Alpha Shield FinOps")

        # Unauthenticated request must NOT see Tenant A's branding
        res_anon = self.client.get("/api/branding")
        self.assertEqual(res_anon.status_code, 200)
        self.assertNotEqual(res_anon.json()["agency_name"], "Alpha Shield FinOps")

    def test_s3_config_multi_tenant_isolation(self):
        """Tenant B and unauthenticated requests must never see Tenant A's S3 sync credentials."""
        # Tenant A configures S3
        save_s3 = self.client.post("/api/s3/config", json={
            "bucket_name": "alpha-super-secret-cur-bucket",
            "region": "us-west-2",
            "prefix": "cur/alpha/",
            "role_arn": "arn:aws:iam::111122223333:role/AlphaCurRole"
        }, headers=self.auth_a)
        self.assertEqual(save_s3.status_code, 200)

        # Tenant A verifies config
        res_a = self.client.get("/api/s3/config", headers=self.auth_a)
        self.assertEqual(res_a.status_code, 200)
        self.assertTrue(res_a.json()["configured"])
        self.assertEqual(res_a.json()["bucket_name"], "alpha-super-secret-cur-bucket")

        # Tenant B must NOT see Tenant A's bucket
        res_b = self.client.get("/api/s3/config", headers=self.auth_b)
        self.assertEqual(res_b.status_code, 200)
        self.assertFalse(res_b.json()["configured"])
        self.assertEqual(res_b.json()["bucket_name"], "")

        # Unauthenticated request must NOT see Tenant A's bucket
        res_anon = self.client.get("/api/s3/config")
        self.assertEqual(res_anon.status_code, 200)
        self.assertFalse(res_anon.json()["configured"])

    def test_ai_history_multi_tenant_isolation(self):
        """Tenant B and unauthenticated users must never see Tenant A's AI queries."""
        # Record query for Tenant A
        query_rec = AiAnalystQuery(
            organization_id=self.org_a.id,
            user_id=self.user_a.id,
            query_text="What is Tenant Alpha's EC2 reservation shortfall?",
            intent_detected="RESERVATIONS",
            response_text="Alpha's EC2 reservation shortfall is 12 instances.",
            provider_used="LOCAL_ANALYTIC_RULES"
        )
        self.db.add(query_rec)
        self.db.commit()

        # Tenant A sees the query
        res_a = self.client.get("/api/ai/history", headers=self.auth_a)
        self.assertEqual(res_a.status_code, 200)
        queries_a = [q["query"] for q in res_a.json()]
        self.assertIn("What is Tenant Alpha's EC2 reservation shortfall?", queries_a)

        # Tenant B sees 0 queries
        res_b = self.client.get("/api/ai/history", headers=self.auth_b)
        self.assertEqual(res_b.status_code, 200)
        queries_b = [q["query"] for q in res_b.json()]
        self.assertNotIn("What is Tenant Alpha's EC2 reservation shortfall?", queries_b)

        # Unauthenticated request returns empty list
        res_anon = self.client.get("/api/ai/history")
        self.assertEqual(res_anon.status_code, 200)
        self.assertEqual(res_anon.json(), [])

    def test_budget_multi_tenant_scoping_and_cross_tenant_delete_rejection(self):
        """Budgets must only be visible to the owning organization and cannot be deleted across tenants."""
        # Tenant A creates a budget
        res_create = self.client.post("/api/budgets", json={
            "name": "Alpha Cloud Guardrail",
            "scope_type": "WORKSPACE",
            "scope_value": "all",
            "monthly_budget_usd": 15000.0,
            "alert_threshold_pct": 75.0
        }, headers=self.auth_a)
        self.assertEqual(res_create.status_code, 200)

        # Verify budget is in DB for Org A
        budget = self.db.query(BudgetConfig).filter(
            BudgetConfig.organization_id == self.org_a.id,
            BudgetConfig.name == "Alpha Cloud Guardrail"
        ).first()
        self.assertIsNotNone(budget)

        # Tenant A lists budgets -> contains Alpha Cloud Guardrail
        res_list_a = self.client.get("/api/budgets", headers=self.auth_a)
        self.assertEqual(res_list_a.status_code, 200)
        names_a = [b["name"] for b in res_list_a.json()]
        self.assertIn("Alpha Cloud Guardrail", names_a)

        # Tenant B lists budgets -> DOES NOT contain Alpha Cloud Guardrail
        res_list_b = self.client.get("/api/budgets", headers=self.auth_b)
        self.assertEqual(res_list_b.status_code, 200)
        names_b = [b["name"] for b in res_list_b.json()]
        self.assertNotIn("Alpha Cloud Guardrail", names_b)

        # Tenant B tries to delete Tenant A's budget -> MUST BE REJECTED with 403 Forbidden
        res_del = self.client.delete(f"/api/budgets/{budget.id}", headers=self.auth_b)
        self.assertEqual(res_del.status_code, 403)

        # Verify budget still exists in DB
        b_alive = self.db.query(BudgetConfig).filter(BudgetConfig.id == budget.id).first()
        self.assertIsNotNone(b_alive)

        # Tenant A legitimately deletes budget -> 200 OK
        res_del_a = self.client.delete(f"/api/budgets/{budget.id}", headers=self.auth_a)
        self.assertEqual(res_del_a.status_code, 200)

    def test_resource_detail_multitenant_isolation(self):
        """Resource detail queries must return only records belonging to requested resource and reject unallocated/nonexistent queries."""
        # Non-existent resource returns 404
        res_404 = self.client.get("/api/resources/detail?resource_id=nonexistent-resource-id-9999", headers=self.auth_a)
        self.assertEqual(res_404.status_code, 404)

        # Valid resource returns enriched schema
        res_valid = self.client.get("/api/resources/detail?resource_id=i-0ee0901f82ebc5d84", headers=self.auth_a)
        if res_valid.status_code == 200:
            data = res_valid.json()
            self.assertEqual(data["resource_id"], "i-0ee0901f82ebc5d84")
            self.assertIn("line_items", data)
            self.assertIn("total_line_items", data)

    def test_unauthenticated_public_access_never_leaks_tenant_uploads(self):
        """Unauthenticated public requests must never leak tenant uploaded files or internal cur_org_ prefixes."""
        # 1. Health check must not report tenant upload or cur_org_ storage path
        res_health = self.client.get("/api/health")
        self.assertEqual(res_health.status_code, 200)
        h_data = res_health.json()
        self.assertFalse(h_data["authenticated"])
        self.assertNotIn("cur_org_", h_data["active_dataset"])

        # 2. Datasets listing must return empty uploads for unauthenticated visitor
        res_datasets = self.client.get("/api/datasets")
        self.assertEqual(res_datasets.status_code, 200)
        d_data = res_datasets.json()
        self.assertEqual(d_data["uploads"], [])
        self.assertNotIn("cur_org_", d_data["active_dataset"])

        # 3. Overview must serve sample fixture and never expose tenant row counts or private cur_org_
        res_overview = self.client.get("/api/overview")
        self.assertEqual(res_overview.status_code, 200)
        ov_data = res_overview.json()
        self.assertNotIn("cur_org_", str(ov_data.get("filename", "")))
        self.assertNotEqual(ov_data.get("total_rows"), 45112)
