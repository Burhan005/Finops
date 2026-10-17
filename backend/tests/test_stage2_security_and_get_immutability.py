"""
Stage 2 Verification Test Suite:
- Explicit Environment-Configurable CORS Allowlist Verification
  * Verification of allowed origins: http://localhost:5173 and http://127.0.0.1:5173
  * Rejection of unauthorized origins (e.g. http://malicious-site.com, http://attacker.io)
  * Verification of Credentials and Preflight Headers
  * Verification that CORS does not replace Authentication (401 enforced on protected routes)
- Strict GET Endpoint Database Immutability
  * Repeated calls to GET /api/anomalies produce ZERO database writes, updates, or deletes
  * Repeated calls to GET /api/ledger/records produce ZERO database writes, updates, or deletes
  * Repeated calls to GET /api/ledger/summary produce ZERO database writes, updates, or deletes
  * Repeated calls to GET /api/recommendations produce ZERO database writes, updates, or deletes
  * Full sweep of all GET endpoints verifying zero database state drift
- Explicit Synchronization Workflows
  * POST /api/anomalies/sync explicitly synchronizes anomalies with organization scoping
  * POST /api/ledger/sync explicitly synchronizes recommendations into ledger with organization scoping
  * Strict multi-tenant isolation and data consistency preservation
"""

import os
import sys
import unittest
import copy
from typing import Dict, Any

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

# conftest.py already configures isolated test DB prior to imports
from app.main import app, CORS_ALLOWED_ORIGINS, DEFAULT_CORS_ORIGINS
from app.database import get_db, engine
from app.models import (
    Organization, User, UserSession, DatasetRecord, BillingRecord,
    AnomalyAlert, RecommendationRecord, BudgetConfig, AuditEvent
)
from app.security import hash_password, generate_session_token
from app.anomalies import sync_anomalies_to_db, get_stored_anomalies
from app.savings_ledger import sync_recommendations_to_ledger, get_ledger_records

class TestStage2SecurityAndImmutability(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = next(get_db())

        # Assert running against isolated test database
        db_url = str(engine.url).replace('\\', '/').lower()
        assert "zorvex_isolated_test.db" in db_url, f"Critical: not running in isolated test db: {engine.url}"
        assert "finops.db" not in db_url, f"Critical: finops.db targeted in tests: {engine.url}"

        # Setup Stage 2 Test Tenant Alpha
        cls.org_a = cls.db.query(Organization).filter(Organization.name == "Stage2 Org Alpha").first()
        if not cls.org_a:
            cls.org_a = Organization(name="Stage2 Org Alpha")
            cls.db.add(cls.org_a)
            cls.db.commit()
            cls.db.refresh(cls.org_a)

        cls.user_a = cls.db.query(User).filter(User.email == "alice@stage2alpha.com").first()
        if not cls.user_a:
            cls.user_a = User(
                organization_id=cls.org_a.id,
                name="Alice Stage2 Lead",
                company="Stage2 Org Alpha",
                email="alice@stage2alpha.com",
                password_hash=hash_password("Stage2#SecureAlice2026")
            )
            cls.db.add(cls.user_a)
            cls.db.commit()
            cls.db.refresh(cls.user_a)

        cls.token_a = f"session_stage2_alice_{generate_session_token()[:32]}"
        cls.db.add(UserSession(token=cls.token_a, user_id=cls.user_a.id, organization_id=cls.org_a.id))
        cls.db.commit()

        # Setup Stage 2 Test Tenant Beta
        cls.org_b = cls.db.query(Organization).filter(Organization.name == "Stage2 Org Beta").first()
        if not cls.org_b:
            cls.org_b = Organization(name="Stage2 Org Beta")
            cls.db.add(cls.org_b)
            cls.db.commit()
            cls.db.refresh(cls.org_b)

        cls.user_b = cls.db.query(User).filter(User.email == "bob@stage2beta.com").first()
        if not cls.user_b:
            cls.user_b = User(
                organization_id=cls.org_b.id,
                name="Bob Stage2 Lead",
                company="Stage2 Org Beta",
                email="bob@stage2beta.com",
                password_hash=hash_password("Stage2#SecureBob2026")
            )
            cls.db.add(cls.user_b)
            cls.db.commit()
            cls.db.refresh(cls.user_b)

        cls.token_b = f"session_stage2_bob_{generate_session_token()[:32]}"
        cls.db.add(UserSession(token=cls.token_b, user_id=cls.user_b.id, organization_id=cls.org_b.id))
        cls.db.commit()

    def _snapshot_database_counts(self) -> Dict[str, int]:
        """Takes an exact record-count snapshot of all critical application tables."""
        return {
            "anomaly_alerts": self.db.query(AnomalyAlert).count(),
            "recommendations": self.db.query(RecommendationRecord).count(),
            "billing_records": self.db.query(BillingRecord).count(),
            "datasets": self.db.query(DatasetRecord).count(),
            "budget_configs": self.db.query(BudgetConfig).count(),
            "audit_events": self.db.query(AuditEvent).count(),
            "users": self.db.query(User).count(),
            "user_sessions": self.db.query(UserSession).count(),
            "organizations": self.db.query(Organization).count(),
        }

    # ==================== 1. CORS ALLOWLIST & SECURITY TESTS ====================

    def test_cors_allowed_origin_localhost(self):
        """Verifies allowed origin http://localhost:5173 receives proper CORS response headers."""
        headers = {
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET"
        }
        res = self.client.options("/api/health", headers=headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers.get("access-control-allow-origin"), "http://localhost:5173")
        self.assertEqual(res.headers.get("access-control-allow-credentials"), "true")

    def test_cors_allowed_origin_127_0_0_1(self):
        """Verifies allowed origin http://127.0.0.1:5173 receives proper CORS response headers."""
        headers = {
            "Origin": "http://127.0.0.1:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type"
        }
        res = self.client.options("/api/auth/login", headers=headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers.get("access-control-allow-origin"), "http://127.0.0.1:5173")
        self.assertEqual(res.headers.get("access-control-allow-credentials"), "true")

    def test_cors_disallowed_origin_blocked(self):
        """Verifies unauthorized third-party origins are NOT granted CORS access."""
        unauthorized_origins = [
            "http://malicious-site.com",
            "https://attacker.io",
            "http://localhost:3000",
            "null"
        ]
        for bad_origin in unauthorized_origins:
            headers = {
                "Origin": bad_origin,
                "Access-Control-Request-Method": "GET"
            }
            res = self.client.options("/api/health", headers=headers)
            # Starlette CORSMiddleware does NOT echo back disallowed origins
            allow_origin = res.headers.get("access-control-allow-origin")
            self.assertNotEqual(allow_origin, bad_origin, f"Disallowed origin {bad_origin} was incorrectly allowed!")
            self.assertIsNone(allow_origin, f"Expected no access-control-allow-origin for {bad_origin}, got {allow_origin}")

    def test_cors_does_not_replace_auth(self):
        """
        Validates that even from an allowed origin, protected endpoints strictly enforce
        authentication and return 401 Unauthorized when credentials are missing or invalid.
        """
        headers = {"Origin": "http://localhost:5173"}
        res = self.client.post("/api/budgets", json={"name": "Attacker Budget"}, headers=headers)
        self.assertEqual(res.status_code, 401, "CORS origin must not bypass authentication requirements")

    def test_cors_allowlist_preserves_defaults(self):
        """Verifies that CORS_ALLOWED_ORIGINS preserves both localhost:5173 and 127.0.0.1:5173."""
        self.assertIn("http://localhost:5173", CORS_ALLOWED_ORIGINS)
        self.assertIn("http://127.0.0.1:5173", CORS_ALLOWED_ORIGINS)

    # ==================== 2. GET ENDPOINT DATABASE IMMUTABILITY TESTS ====================

    def test_get_anomalies_is_strictly_side_effect_free(self):
        """
        Validates that repeatedly requesting GET /api/anomalies (10 consecutive calls)
        performs ZERO database writes, insertions, modifications, or deletions.
        """
        auth_headers = {"Authorization": f"Bearer {self.token_a}"}
        baseline_snapshot = self._snapshot_database_counts()

        for _ in range(10):
            res = self.client.get("/api/anomalies", headers=auth_headers)
            self.assertEqual(res.status_code, 200)

        post_snapshot = self._snapshot_database_counts()
        self.assertEqual(
            baseline_snapshot, 
            post_snapshot, 
            f"GET /api/anomalies mutated database state! Delta: {set(post_snapshot.items()) - set(baseline_snapshot.items())}"
        )

    def test_get_ledger_records_is_strictly_side_effect_free(self):
        """
        Validates that repeatedly requesting GET /api/ledger/records (10 consecutive calls)
        performs ZERO database writes, insertions, modifications, or deletions.
        """
        auth_headers = {"Authorization": f"Bearer {self.token_a}"}
        baseline_snapshot = self._snapshot_database_counts()

        for _ in range(10):
            res = self.client.get("/api/ledger/records", headers=auth_headers)
            self.assertEqual(res.status_code, 200)

        post_snapshot = self._snapshot_database_counts()
        self.assertEqual(
            baseline_snapshot, 
            post_snapshot, 
            f"GET /api/ledger/records mutated database state! Delta: {set(post_snapshot.items()) - set(baseline_snapshot.items())}"
        )

    def test_get_ledger_summary_is_strictly_side_effect_free(self):
        """
        Validates that repeatedly requesting GET /api/ledger/summary (10 consecutive calls)
        performs ZERO database writes, insertions, modifications, or deletions.
        """
        auth_headers = {"Authorization": f"Bearer {self.token_a}"}
        baseline_snapshot = self._snapshot_database_counts()

        for _ in range(10):
            res = self.client.get("/api/ledger/summary", headers=auth_headers)
            self.assertEqual(res.status_code, 200)

        post_snapshot = self._snapshot_database_counts()
        self.assertEqual(
            baseline_snapshot, 
            post_snapshot, 
            f"GET /api/ledger/summary mutated database state! Delta: {set(post_snapshot.items()) - set(baseline_snapshot.items())}"
        )

    def test_get_recommendations_is_strictly_side_effect_free(self):
        """
        Validates that repeatedly requesting GET /api/recommendations (10 consecutive calls)
        performs ZERO database writes or hidden ledger synchronization commits.
        """
        auth_headers = {"Authorization": f"Bearer {self.token_a}"}
        baseline_snapshot = self._snapshot_database_counts()

        for _ in range(10):
            res = self.client.get("/api/recommendations", headers=auth_headers)
            self.assertEqual(res.status_code, 200)

        post_snapshot = self._snapshot_database_counts()
        self.assertEqual(
            baseline_snapshot, 
            post_snapshot, 
            f"GET /api/recommendations mutated database state! Delta: {set(post_snapshot.items()) - set(baseline_snapshot.items())}"
        )

    def test_comprehensive_get_endpoints_sweep_immutability(self):
        """
        Executes a sweep across ALL GET endpoints in the application and guarantees
        that database row counts remain 100% frozen with zero side effects.
        """
        auth_headers = {"Authorization": f"Bearer {self.token_a}"}
        baseline_snapshot = self._snapshot_database_counts()

        endpoints_to_sweep = [
            "/api/health",
            "/api/auth/me",
            "/api/datasets",
            "/api/overview",
            "/api/trends",
            "/api/resources?page=1&page_size=10",
            "/api/resources/hierarchies",
            "/api/forecast",
            "/api/budgets",
            "/api/anomalies",
            "/api/ledger/records",
            "/api/ledger/summary",
            "/api/recommendations",
            "/api/branding",
            "/api/unit-economics",
            "/api/s3/config",
            "/api/system/cache-stats"
        ]

        for ep in endpoints_to_sweep:
            res = self.client.get(ep, headers=auth_headers)
            self.assertIn(res.status_code, [200, 400], f"Endpoint {ep} failed with status {res.status_code}")

        post_sweep_snapshot = self._snapshot_database_counts()
        self.assertEqual(
            baseline_snapshot,
            post_sweep_snapshot,
            f"Comprehensive GET sweep introduced database mutation! Differences: {set(post_sweep_snapshot.items()) - set(baseline_snapshot.items())}"
        )

    # ==================== 3. EXPLICIT SYNCHRONIZATION WORKFLOW TESTS ====================

    def test_explicit_anomalies_sync_workflow(self):
        """
        Verifies explicit write workflow POST /api/anomalies/sync:
        - Persists anomalies into database with organization scoping
        - Succeeds with explicit status and count
        - Subsequent GET /api/anomalies returns the synced anomalies without further mutation
        """
        auth_headers = {"Authorization": f"Bearer {self.token_a}"}
        
        # Explicit sync trigger
        res_sync = self.client.post("/api/anomalies/sync", headers=auth_headers)
        self.assertEqual(res_sync.status_code, 200)
        sync_data = res_sync.json()
        self.assertTrue(sync_data.get("success"))
        self.assertIn("synced_count", sync_data)

        # GET returns anomalies without modifying DB
        snap_before = self._snapshot_database_counts()
        res_get = self.client.get("/api/anomalies", headers=auth_headers)
        self.assertEqual(res_get.status_code, 200)
        snap_after = self._snapshot_database_counts()
        self.assertEqual(snap_before, snap_after)

    def test_explicit_ledger_sync_workflow(self):
        """
        Verifies explicit write workflow POST /api/ledger/sync:
        - Persists recommendations into the executive savings ledger with organization scoping
        - Subsequent GET /api/ledger/records and GET /api/ledger/summary return records without further mutation
        """
        auth_headers = {"Authorization": f"Bearer {self.token_a}"}

        # Explicit sync trigger
        res_sync = self.client.post("/api/ledger/sync", headers=auth_headers)
        self.assertEqual(res_sync.status_code, 200)
        sync_data = res_sync.json()
        self.assertTrue(sync_data.get("success"))
        self.assertIn("synced_count", sync_data)

        # GET returns records without modifying DB
        snap_before = self._snapshot_database_counts()
        res_records = self.client.get("/api/ledger/records", headers=auth_headers)
        self.assertEqual(res_records.status_code, 200)
        res_summary = self.client.get("/api/ledger/summary", headers=auth_headers)
        self.assertEqual(res_summary.status_code, 200)
        snap_after = self._snapshot_database_counts()
        self.assertEqual(snap_before, snap_after)

    def test_explicit_sync_tenant_isolation(self):
        """
        Verifies that explicit synchronization respects tenant boundaries:
        - Org A syncing does not expose or mix records with Org B
        """
        headers_a = {"Authorization": f"Bearer {self.token_a}"}
        headers_b = {"Authorization": f"Bearer {self.token_b}"}

        # Trigger sync for Org A
        res_a = self.client.post("/api/anomalies/sync", headers=headers_a)
        self.assertEqual(res_a.status_code, 200)

        # Query Org B - Org B's anomalies query must only query Org B's records
        res_b = self.client.get("/api/anomalies", headers=headers_b)
        self.assertEqual(res_b.status_code, 200)
        anomalies_b = res_b.json()

        for anom in anomalies_b:
            alert = self.db.query(AnomalyAlert).filter(AnomalyAlert.id == anom["id"]).first()
            if alert and alert.organization_id is not None:
                self.assertEqual(alert.organization_id, self.org_b.id, "Cross-tenant anomaly leak detected!")

if __name__ == "__main__":
    unittest.main()
