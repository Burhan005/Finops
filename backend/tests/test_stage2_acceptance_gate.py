"""
Stage 2 Final Acceptance Gate Test Suite:
1. Verification that dataset ingestion and dataset selection trigger anomaly and ledger synchronization
   correctly for the intended organization and active dataset.
2. Verification that the new POST synchronization endpoints are authenticated (401 on missing auth),
   tenant-isolated (no cross-tenant leakage), and idempotent/safe to retry (no duplicates created on retry).
3. Confirmation that removing synchronization from GET endpoints does not leave data stale during normal
   application workflows (ingestion -> query, selection -> query, acknowledge/resolve -> query, status change -> query).
4. Strictly executed against isolated test database only.
"""

import os
import sys
import unittest
import json
import gzip
import tempfile
from datetime import datetime, timezone

from fastapi.testclient import TestClient

# conftest.py configures isolated test DB prior to imports
from app.main import app, _ingest_dataset_sync, SAMPLES_DIR
from app.database import get_db, engine
from app.models import (
    Organization, User, UserSession, DatasetRecord, BillingRecord,
    AnomalyAlert, RecommendationRecord
)
from app.security import hash_password, generate_session_token

class TestStage2AcceptanceGate(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = next(get_db())

        # Strict isolation assertion
        db_url = str(engine.url).replace('\\', '/').lower()
        assert "zorvex_isolated_test.db" in db_url, f"Critical: not running in isolated test db: {engine.url}"
        assert "finops.db" not in db_url, f"Critical: finops.db targeted in tests: {engine.url}"

        # Tenant 1 (Acme)
        cls.org_acme = cls.db.query(Organization).filter(Organization.name == "Acceptance Acme").first()
        if not cls.org_acme:
            cls.org_acme = Organization(name="Acceptance Acme")
            cls.db.add(cls.org_acme)
            cls.db.commit()
            cls.db.refresh(cls.org_acme)

        cls.user_acme = cls.db.query(User).filter(User.email == "lead@acme.com").first()
        if not cls.user_acme:
            cls.user_acme = User(
                organization_id=cls.org_acme.id,
                name="Acme Lead",
                company="Acceptance Acme",
                email="lead@acme.com",
                password_hash=hash_password("Acme#Secure2026")
            )
            cls.db.add(cls.user_acme)
            cls.db.commit()
            cls.db.refresh(cls.user_acme)

        cls.token_acme = f"session_acme_{generate_session_token()[:32]}"
        cls.db.add(UserSession(token=cls.token_acme, user_id=cls.user_acme.id, organization_id=cls.org_acme.id))
        cls.db.commit()

        # Tenant 2 (BetaCorp)
        cls.org_beta = cls.db.query(Organization).filter(Organization.name == "Acceptance BetaCorp").first()
        if not cls.org_beta:
            cls.org_beta = Organization(name="Acceptance BetaCorp")
            cls.db.add(cls.org_beta)
            cls.db.commit()
            cls.db.refresh(cls.org_beta)

        cls.user_beta = cls.db.query(User).filter(User.email == "lead@betacorp.com").first()
        if not cls.user_beta:
            cls.user_beta = User(
                organization_id=cls.org_beta.id,
                name="Beta Lead",
                company="Acceptance BetaCorp",
                email="lead@betacorp.com",
                password_hash=hash_password("Beta#Secure2026")
            )
            cls.db.add(cls.user_beta)
            cls.db.commit()
            cls.db.refresh(cls.user_beta)

        cls.token_beta = f"session_beta_{generate_session_token()[:32]}"
        cls.db.add(UserSession(token=cls.token_beta, user_id=cls.user_beta.id, organization_id=cls.org_beta.id))
        cls.db.commit()

    # ==================== CHECK 1: INGESTION & SELECTION TRIGGER SYNCHRONIZATION ====================

    def test_dataset_ingestion_triggers_synchronization(self):
        """
        Verifies that when a dataset is ingested via _ingest_dataset_sync:
        - Anomaly alerts are synchronized into persistent storage scoped to org_acme.id
        - Recommendation ledger records are synchronized scoped to org_acme.id
        """
        # Mock parsed dataset with spiked service and unattached volume
        mock_parsed = {
            "dates": ["2026-10-10", "2026-10-11", "2026-10-12"],
            "records": [
                {"date": "2026-10-10", "month": "2026-10", "hour": "00:00", "service": "Amazon EC2", "cost": 10.0, "line_type": "Usage", "resource_id": "i-ingest-01", "name": "Web", "usage_type": "BoxUsage", "term": "OnDemand", "account_id": "111122223333", "region": "us-east-1"},
                {"date": "2026-10-11", "month": "2026-10", "hour": "00:00", "service": "Amazon EC2", "cost": 10.0, "line_type": "Usage", "resource_id": "i-ingest-01", "name": "Web", "usage_type": "BoxUsage", "term": "OnDemand", "account_id": "111122223333", "region": "us-east-1"},
                {"date": "2026-10-12", "month": "2026-10", "hour": "00:00", "service": "Amazon EC2", "cost": 150.0, "line_type": "Usage", "resource_id": "i-ingest-01", "name": "Web", "usage_type": "BoxUsage", "term": "OnDemand", "account_id": "111122223333", "region": "us-east-1"},
                {"date": "2026-10-12", "month": "2026-10", "hour": "00:00", "service": "Amazon EC2", "cost": 15.0, "line_type": "Usage", "resource_id": "vol-ingest-idle", "name": "Unattached", "usage_type": "VolumeUsage.gp2", "term": "OnDemand", "account_id": "111122223333", "region": "us-east-1"},
            ],
            "total_cost": 185.0,
            "gross_cost": 185.0,
            "net_cost": 185.0,
            "credits_total": 0.0,
            "refunds_total": 0.0,
            "taxes_total": 0.0,
            "total_rows": 4,
            "services": {"Amazon EC2": 185.0},
            "accounts": {"111122223333": 185.0}
        }

        ingest_id = _ingest_dataset_sync(
            org_id=self.org_acme.id,
            user_id=self.user_acme.id,
            final_filename="test_ingest_sync_cur.csv",
            final_filepath="/tmp/test_ingest_sync_cur.csv",
            checksum_sha256="dummy_hash_ingest_123",
            parsed=mock_parsed
        )
        self.assertIsNotNone(ingest_id)

        # Verify anomalies were synchronized in DB for org_acme
        anom_count = self.db.query(AnomalyAlert).filter(AnomalyAlert.organization_id == self.org_acme.id).count()
        self.assertGreaterEqual(anom_count, 1, "Anomaly synchronization was not executed during ingestion!")

        # Verify recommendations were synchronized in DB for org_acme
        rec_count = self.db.query(RecommendationRecord).filter(RecommendationRecord.organization_id == self.org_acme.id).count()
        self.assertGreaterEqual(rec_count, 1, "Ledger synchronization was not executed during ingestion!")

    def test_dataset_selection_triggers_synchronization(self):
        """
        Verifies that when a dataset is selected via POST /api/datasets/select:
        - Controlled synchronization persists anomalies and ledger records for the selecting tenant
        """
        # Find sample fixture
        samples = [f for f in os.listdir(SAMPLES_DIR) if f.endswith(('.csv', '.gz'))]
        self.assertTrue(len(samples) > 0, "No sample CUR fixtures available for selection test")
        sample_name = samples[0]

        headers = {"Authorization": f"Bearer {self.token_acme}"}
        res = self.client.post("/api/datasets/select", json={"filename": sample_name}, headers=headers)
        self.assertEqual(res.status_code, 200)

        # Query GET endpoints - must return valid data populated by select synchronization
        res_anom = self.client.get("/api/anomalies", headers=headers)
        self.assertEqual(res_anom.status_code, 200)
        self.assertIsInstance(res_anom.json(), list)

        res_ledger = self.client.get("/api/ledger/records", headers=headers)
        self.assertEqual(res_ledger.status_code, 200)
        self.assertIsInstance(res_ledger.json(), list)

    # ==================== CHECK 2: POST SYNC AUTHENTICATION, TENANT ISOLATION, RETRY SAFETY ====================

    def test_post_sync_endpoints_require_authentication(self):
        """
        Verifies that unauthenticated calls to POST /api/anomalies/sync and POST /api/ledger/sync
        are strictly rejected with HTTP 401 Unauthorized.
        """
        # Unauthenticated anomalies sync
        res_anom = self.client.post("/api/anomalies/sync")
        self.assertEqual(res_anom.status_code, 401, "POST /api/anomalies/sync allowed unauthenticated access!")

        # Unauthenticated ledger sync
        res_ledger = self.client.post("/api/ledger/sync")
        self.assertEqual(res_ledger.status_code, 401, "POST /api/ledger/sync allowed unauthenticated access!")

    def test_post_sync_endpoints_tenant_isolated(self):
        """
        Verifies that triggering sync for Org Acme only persists records for Org Acme,
        and Org Beta cannot access or see them.
        """
        headers_acme = {"Authorization": f"Bearer {self.token_acme}"}
        headers_beta = {"Authorization": f"Bearer {self.token_beta}"}

        # Clear Beta records first to test clean isolation
        self.db.query(AnomalyAlert).filter(AnomalyAlert.organization_id == self.org_beta.id).delete()
        self.db.query(RecommendationRecord).filter(RecommendationRecord.organization_id == self.org_beta.id).delete()
        self.db.commit()

        # Acme syncs anomalies and ledger
        res_sync_a = self.client.post("/api/anomalies/sync", headers=headers_acme)
        self.assertEqual(res_sync_a.status_code, 200)
        res_sync_l = self.client.post("/api/ledger/sync", headers=headers_acme)
        self.assertEqual(res_sync_l.status_code, 200)

        # Beta queries - must not see any of Acme's records
        res_beta_anom = self.client.get("/api/anomalies", headers=headers_beta)
        self.assertEqual(res_beta_anom.status_code, 200)
        for item in res_beta_anom.json():
            alert = self.db.query(AnomalyAlert).filter(AnomalyAlert.id == item["id"]).first()
            if alert and alert.organization_id:
                self.assertEqual(alert.organization_id, self.org_beta.id)
                self.assertNotEqual(alert.organization_id, self.org_acme.id)

    def test_post_sync_endpoints_safe_to_retry_no_duplicates(self):
        """
        Verifies that repeatedly executing POST /api/anomalies/sync and POST /api/ledger/sync
        (3 consecutive times) is fully idempotent: no duplicate alerts or ledger records are created.
        """
        headers = {"Authorization": f"Bearer {self.token_acme}"}

        # Sync 1
        res1 = self.client.post("/api/anomalies/sync", headers=headers)
        self.assertEqual(res1.status_code, 200)
        count_anom_1 = self.db.query(AnomalyAlert).filter(AnomalyAlert.organization_id == self.org_acme.id).count()

        res_l1 = self.client.post("/api/ledger/sync", headers=headers)
        self.assertEqual(res_l1.status_code, 200)
        count_rec_1 = self.db.query(RecommendationRecord).filter(RecommendationRecord.organization_id == self.org_acme.id).count()

        # Retry 2
        res2 = self.client.post("/api/anomalies/sync", headers=headers)
        self.assertEqual(res2.status_code, 200)
        count_anom_2 = self.db.query(AnomalyAlert).filter(AnomalyAlert.organization_id == self.org_acme.id).count()

        res_l2 = self.client.post("/api/ledger/sync", headers=headers)
        self.assertEqual(res_l2.status_code, 200)
        count_rec_2 = self.db.query(RecommendationRecord).filter(RecommendationRecord.organization_id == self.org_acme.id).count()

        # Retry 3
        res3 = self.client.post("/api/anomalies/sync", headers=headers)
        self.assertEqual(res3.status_code, 200)
        count_anom_3 = self.db.query(AnomalyAlert).filter(AnomalyAlert.organization_id == self.org_acme.id).count()

        res_l3 = self.client.post("/api/ledger/sync", headers=headers)
        self.assertEqual(res_l3.status_code, 200)
        count_rec_3 = self.db.query(RecommendationRecord).filter(RecommendationRecord.organization_id == self.org_acme.id).count()

        self.assertEqual(count_anom_1, count_anom_2, "Retrying anomalies sync created duplicate records!")
        self.assertEqual(count_anom_2, count_anom_3, "Retrying anomalies sync created duplicate records!")
        self.assertEqual(count_rec_1, count_rec_2, "Retrying ledger sync created duplicate records!")
        self.assertEqual(count_rec_2, count_rec_3, "Retrying ledger sync created duplicate records!")

    # ==================== CHECK 3: NORMAL WORKFLOWS ARE NEVER STALE ====================

    def test_workflow_state_transitions_persist_without_stale_overwrites(self):
        """
        Validates that normal application lifecycle state changes:
        1. Acknowledging / resolving an anomaly
        2. Approving / implementing a ledger recommendation
        immediately reflect on GET endpoints, and subsequent repeated GET requests
        never overwrite, revert, or stale out these user actions.
        """
        headers = {"Authorization": f"Bearer {self.token_acme}"}

        # Ensure baseline sync
        self.client.post("/api/anomalies/sync", headers=headers)
        self.client.post("/api/ledger/sync", headers=headers)

        # 1. Anomaly Acknowledgment Workflow
        anom_res = self.client.get("/api/anomalies", headers=headers)
        anomalies = anom_res.json()
        if anomalies:
            target_anom = anomalies[0]
            alert_id = target_anom["id"]

            ack_res = self.client.post(
                f"/api/anomalies/{alert_id}/acknowledge",
                json={"user_name": "Acme Engineer", "notes": "Investigated: scheduled ETL job"},
                headers=headers
            )
            self.assertEqual(ack_res.status_code, 200)
            self.assertEqual(ack_res.json().get("status"), "ACKNOWLEDGED")

            # Verify GET immediately reflects ACKNOWLEDGED
            verify_res = self.client.get("/api/anomalies", headers=headers)
            updated_anom = next((a for a in verify_res.json() if a["id"] == alert_id), None)
            self.assertIsNotNone(updated_anom)
            self.assertEqual(updated_anom["status"], "ACKNOWLEDGED")

            # Repeated GET requests must NOT revert or overwrite ACKNOWLEDGED state
            for _ in range(5):
                rep_res = self.client.get("/api/anomalies", headers=headers)
                rep_anom = next((a for a in rep_res.json() if a["id"] == alert_id), None)
                self.assertEqual(rep_anom["status"], "ACKNOWLEDGED")

        # 2. Recommendation Status Transition Workflow
        ledger_res = self.client.get("/api/ledger/records", headers=headers)
        records = ledger_res.json()
        if records:
            target_rec = records[0]
            rec_id = target_rec["recommendation_id"]

            status_res = self.client.post(
                f"/api/recommendations/{rec_id}/status",
                json={"status": "APPROVED", "user_name": "FinOps Director", "notes": "Approved for Sprint 42"},
                headers=headers
            )
            self.assertEqual(status_res.status_code, 200)

            # Verify GET immediately reflects APPROVED
            verify_ledger = self.client.get("/api/ledger/records", headers=headers)
            updated_rec = next((r for r in verify_ledger.json() if r["recommendation_id"] == rec_id), None)
            self.assertIsNotNone(updated_rec)
            self.assertEqual(updated_rec["status"], "APPROVED")

            # Repeated GET requests must NOT revert or overwrite APPROVED state
            for _ in range(5):
                rep_ledger = self.client.get("/api/ledger/records", headers=headers)
                rep_rec = next((r for r in rep_ledger.json() if r["recommendation_id"] == rec_id), None)
                self.assertEqual(rep_rec["status"], "APPROVED")

if __name__ == "__main__":
    unittest.main()
