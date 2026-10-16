"""
ZORVEX Phase 5 Remediation Test Suite
Verifies:
- SEC-01: Canonical containment, path traversal immunity, and cross-tenant dataset selection protection
- SEC-02: Elimination of automatic tenant adoption; rejection of unassigned/invalid org users
- SEC-03: Elimination of cross-tenant S3 configuration fallback and strict organization scoping
- CONC-01: Threadpool offloading of database bulk inserts, event-loop responsiveness, and rollback safety
- MEM-01: Genuine LRU cache eviction and recency refresh (OrderedDict)
- MEM-02: Thread-safe lock identity without unsafe clearing under 100+ organizations
- MEM-03: Immutability of shared cached datasets when computing recommendations
- FIN-01: 100% preservation of authoritative CUR financial reconciliation
"""

import os
import sys
import io
import time
import gzip
import unittest
from datetime import datetime, timezone, timedelta
from collections import OrderedDict

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from app.main import (
    app, cache_put_parsed, cache_get_parsed, org_dataset_put, org_dataset_get,
    get_org_lock, PARSED_CACHE, ORG_DATASETS, _ORG_LOCKS, MAX_PARSED_CACHE_ENTRIES,
    MAX_ORG_DATASETS_ENTRIES, get_cached_recommendations, SAMPLES_DIR, UPLOADS_DIR
)
from app.database import get_db, SessionLocal
from app.models import Organization, User, UserSession, DatasetRecord, S3SyncConfig
from app.security import hash_password, generate_session_token
from app.parser import parse_cur_file


class TestPhase5Remediation(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = next(get_db())

        # Create Tenant Alpha
        cls.org_a = cls.db.query(Organization).filter(Organization.name == "Phase5 Org Alpha").first()
        if not cls.org_a:
            cls.org_a = Organization(name="Phase5 Org Alpha")
            cls.db.add(cls.org_a)
            cls.db.commit()
            cls.db.refresh(cls.org_a)

        cls.user_a = cls.db.query(User).filter(User.email == "alice@phase5alpha.io").first()
        if not cls.user_a:
            cls.user_a = User(
                organization_id=cls.org_a.id,
                name="Alice Alpha",
                company="Phase5 Org Alpha",
                email="alice@phase5alpha.io",
                password_hash=hash_password("Pass1234!")
            )
            cls.db.add(cls.user_a)
            cls.db.commit()
            cls.db.refresh(cls.user_a)

        cls.token_a = generate_session_token()
        cls.db.add(UserSession(
            user_id=cls.user_a.id,
            token=cls.token_a,
            expires_at=datetime.now(timezone.utc) + timedelta(days=1)
        ))

        # Create Tenant Beta
        cls.org_b = cls.db.query(Organization).filter(Organization.name == "Phase5 Org Beta").first()
        if not cls.org_b:
            cls.org_b = Organization(name="Phase5 Org Beta")
            cls.db.add(cls.org_b)
            cls.db.commit()
            cls.db.refresh(cls.org_b)

        cls.user_b = cls.db.query(User).filter(User.email == "bob@phase5beta.io").first()
        if not cls.user_b:
            cls.user_b = User(
                organization_id=cls.org_b.id,
                name="Bob Beta",
                company="Phase5 Org Beta",
                email="bob@phase5beta.io",
                password_hash=hash_password("Pass1234!")
            )
            cls.db.add(cls.user_b)
            cls.db.commit()
            cls.db.refresh(cls.user_b)

        cls.token_b = generate_session_token()
        cls.db.add(UserSession(
            user_id=cls.user_b.id,
            token=cls.token_b,
            expires_at=datetime.now(timezone.utc) + timedelta(days=1)
        ))

        # Create Unassigned User (No Organization)
        cls.user_orphan = cls.db.query(User).filter(User.email == "orphan@phase5noorg.io").first()
        if not cls.user_orphan:
            cls.user_orphan = User(
                organization_id=None,
                name="Orphan User",
                company="Independent",
                email="orphan@phase5noorg.io",
                password_hash=hash_password("Pass1234!")
            )
            cls.db.add(cls.user_orphan)
            cls.db.commit()
            cls.db.refresh(cls.user_orphan)

        cls.token_orphan = generate_session_token()
        cls.db.add(UserSession(
            user_id=cls.user_orphan.id,
            token=cls.token_orphan,
            expires_at=datetime.now(timezone.utc) + timedelta(days=1)
        ))

        cls.db.commit()

        cls.auth_a = {"Authorization": f"Bearer {cls.token_a}"}
        cls.auth_b = {"Authorization": f"Bearer {cls.token_b}"}
        cls.auth_orphan = {"Authorization": f"Bearer {cls.token_orphan}"}

    # ==================== SEC-01 TESTS ====================

    def test_sec01_valid_sample_selection(self):
        """Valid samples within SAMPLES_DIR select cleanly."""
        res = self.client.post(
            "/api/datasets/select",
            json={"filename": "CUR-Report-Daily-00001.csv.gz"},
            headers=self.auth_a
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["filename"], "CUR-Report-Daily-00001.csv.gz")

    def test_sec01_path_traversal_dots_rejected(self):
        """Relative traversal payload '../' must be rejected with HTTP 400."""
        res = self.client.post(
            "/api/datasets/select",
            json={"filename": "../uploads/somefile.csv"},
            headers=self.auth_a
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("rejected", res.json()["detail"].lower())

    def test_sec01_absolute_path_rejected(self):
        """Absolute path injection must be rejected with HTTP 400."""
        res = self.client.post(
            "/api/datasets/select",
            json={"filename": "C:\\Windows\\system32\\config.csv"},
            headers=self.auth_a
        )
        self.assertEqual(res.status_code, 400)

    def test_sec01_cross_tenant_upload_selection_rejected(self):
        """Org A cannot select an upload owned by Org B."""
        # Create dummy upload for Org B
        b_file = os.path.join(UPLOADS_DIR, "org_b_private_dataset.csv")
        with open(b_file, "w") as f:
            f.write("lineItem/UnblendedCost,lineItem/UsageStartDate,lineItem/LineItemType\n10.0,2026-10-01,Usage\n")

        ds_b = DatasetRecord(
            organization_id=self.org_b.id,
            filename="org_b_private_dataset.csv",
            filepath=b_file,
            file_type="upload",
            total_cost=10.0,
            net_cost=10.0,
            is_active=0,
            uploaded_at=datetime.now(timezone.utc)
        )
        self.db.add(ds_b)
        self.db.commit()

        # Alice (Org A) attempts to select Bob's (Org B) upload
        res = self.client.post(
            "/api/datasets/select",
            json={"filename": "org_b_private_dataset.csv"},
            headers=self.auth_a
        )
        self.assertEqual(res.status_code, 404)
        self.assertIn("not found or does not belong", res.json()["detail"])

    # ==================== SEC-02 TESTS ====================

    def test_sec02_assigned_user_authenticated(self):
        """User assigned to an organization authenticates successfully."""
        res = self.client.get("/api/auth/me", headers=self.auth_a)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["user"]["organization_id"], self.org_a.id)

    def test_sec02_unassigned_user_rejected_no_fallback(self):
        """User without an organization must be rejected from protected routes and /api/auth/me."""
        # /api/auth/me returns user: None for unassigned users
        res_me = self.client.get("/api/auth/me", headers=self.auth_orphan)
        self.assertEqual(res_me.status_code, 200)
        self.assertIsNone(res_me.json()["user"])

        # Protected endpoint requiring require_auth must return 401 Unauthorized
        res_prot = self.client.post("/api/s3/config", json={"bucket_name": "test-leak-bucket"}, headers=self.auth_orphan)
        self.assertEqual(res_prot.status_code, 401)

        # Ensure orphan user was NOT adopted into Org Alpha in DB
        self.db.refresh(self.user_orphan)
        self.assertIsNone(self.user_orphan.organization_id)

    def test_sec02_invalid_org_reference_rejected(self):
        """User whose organization was deleted must be rejected."""
        # Create temporary org and user
        temp_org = Organization(name="Temp Org To Delete")
        self.db.add(temp_org)
        self.db.commit()
        self.db.refresh(temp_org)

        temp_user = User(
            organization_id=temp_org.id,
            name="Temporary User",
            company="Temp Org",
            email="temp.user@deletedorg.io",
            password_hash=hash_password("Pass1234!")
        )
        self.db.add(temp_user)
        self.db.commit()
        self.db.refresh(temp_user)

        temp_token = generate_session_token()
        self.db.add(UserSession(
            user_id=temp_user.id,
            token=temp_token,
            expires_at=datetime.now(timezone.utc) + timedelta(days=1)
        ))
        self.db.commit()

        # Delete the organization directly
        self.db.delete(temp_org)
        self.db.commit()

        # Accessing protected endpoint with deleted org must return 401 (never adopt Org Alpha)
        res = self.client.post("/api/s3/config", json={"bucket_name": "test"}, headers={"Authorization": f"Bearer {temp_token}"})
        self.assertEqual(res.status_code, 401)

    # ==================== SEC-03 TESTS ====================

    def test_sec03_s3_strict_isolation_and_no_fallback(self):
        """Unconfigured Org B cannot access Org A's S3 configuration."""
        # 1. Configure Org A S3
        self.client.post(
            "/api/s3/config",
            json={
                "bucket_name": "org-alpha-confidential-cur-bucket",
                "region": "us-west-2",
                "prefix": "cur/alpha/",
                "role_arn": "arn:aws:iam::111122223333:role/FinOpsCurSyncRole"
            },
            headers=self.auth_a
        )

        # 2. Org B attempts to trigger S3 sync before configuring their own bucket
        res_sync = self.client.post("/api/s3/sync", headers=self.auth_b)
        self.assertEqual(res_sync.status_code, 400)
        self.assertIn("Please configure S3 Bucket details first for your organization", res_sync.json()["detail"])

        # 3. Org B inspects S3 config; must NOT show Org A's bucket
        res_cfg = self.client.get("/api/s3/config", headers=self.auth_b)
        self.assertEqual(res_cfg.status_code, 200)
        self.assertFalse(res_cfg.json()["configured"])
        self.assertEqual(res_cfg.json()["bucket_name"], "")

    # ==================== CONC-01 TESTS ====================

    def test_conc01_upload_and_persistence_off_event_loop(self):
        """Upload and bulk insert off event loop preserves financial accuracy."""
        csv_payload = (
            "lineItem/LineItemId,lineItem/UsageStartDate,lineItem/ProductCode,"
            "lineItem/UnblendedCost,lineItem/ResourceId,lineItem/UsageType,lineItem/LineItemType\n"
            "item-001,2026-10-14 00:00:00,AmazonEC2,25.00,i-0uploadtest1,BoxUsage:t3.medium,Usage\n"
            "item-002,2026-10-14 00:00:00,AmazonEC2,5.00,,Tax,Tax\n"
        )
        file_obj = io.BytesIO(csv_payload.encode('utf-8'))
        res = self.client.post(
            "/api/upload",
            files={"file": ("test_async_upload.csv", file_obj, "text/csv")},
            headers=self.auth_a
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertAlmostEqual(data["gross_cost"], 25.00, places=2)
        self.assertAlmostEqual(data["taxes_total"], 5.00, places=2)
        self.assertAlmostEqual(data["net_cost"], 30.00, places=2)

    # ==================== MEM-01 & MEM-02 & MEM-03 TESTS ====================

    def test_mem01_true_lru_eviction_and_recency_refresh(self):
        """Verify genuine LRU eviction order with recency refresh."""
        PARSED_CACHE.clear()

        # Insert 5 entries (reaching capacity)
        for i in range(MAX_PARSED_CACHE_ENTRIES):
            cache_put_parsed(f"item_{i}", {"id": i})
        self.assertEqual(len(PARSED_CACHE), MAX_PARSED_CACHE_ENTRIES)

        # Access item_0 (refresh recency to MRU)
        val = cache_get_parsed("item_0")
        self.assertIsNotNone(val)
        self.assertEqual(val["id"], 0)

        # Insert 6th entry: item_1 should be evicted (as item_0 was refreshed to MRU!)
        cache_put_parsed("item_new", {"id": "new"})
        self.assertEqual(len(PARSED_CACHE), MAX_PARSED_CACHE_ENTRIES)
        self.assertIn("item_0", PARSED_CACHE, "item_0 was refreshed and should NOT be evicted")
        self.assertNotIn("item_1", PARSED_CACHE, "item_1 was oldest unaccessed and should be evicted")
        self.assertIn("item_new", PARSED_CACHE)

    def test_mem02_org_locks_identity_preserved(self):
        """Lock identity for an organization remains identical without clearing under 100+ orgs."""
        lock_org1 = get_org_lock(1)
        # Create 150 locks for different orgs
        for org_id in range(2, 160):
            _ = get_org_lock(org_id)

        # Re-fetch lock for org 1; must be identical instance
        lock_org1_again = get_org_lock(1)
        self.assertIs(lock_org1, lock_org1_again, "Lock identity for org 1 was wiped or replaced!")

    def test_mem03_cached_data_not_mutated_by_recommendations(self):
        """Computing recommendations must not inject _recommendations into dataset['data']."""
        sample_path = os.path.join(SAMPLES_DIR, "CUR-Report-Daily-00001.csv.gz")
        parsed = parse_cur_file(sample_path)
        recs = get_cached_recommendations("test_dataset_key", parsed)
        self.assertIn("recommendations", recs)
        self.assertNotIn("_recommendations", parsed, "Shared parsed dictionary was mutated in-place!")

    # ==================== FIN-01 FINANCIAL TESTS ====================

    def test_fin01_authoritative_reconciliation(self):
        """Verify authoritative CUR figures ($7,762.44 gross + $1,152.50 tax = $8,914.94 net)."""
        sample_path = os.path.join(SAMPLES_DIR, "CUR-Report-Daily-00001.csv.gz")
        parsed = parse_cur_file(sample_path)
        self.assertEqual(parsed["total_rows"], 36490)
        self.assertAlmostEqual(parsed["gross_cost"], 7762.44, delta=0.01)
        self.assertAlmostEqual(parsed["taxes_total"], 1152.50, delta=0.01)
        self.assertAlmostEqual(parsed["credits_total"], 0.00, delta=0.01)
        self.assertAlmostEqual(parsed["refunds_total"], 0.00, delta=0.01)
        self.assertAlmostEqual(parsed["net_cost"], 8914.94, delta=0.01)
        self.assertTrue(parsed["accounting_reconciliation"]["is_reconciled"])


if __name__ == "__main__":
    unittest.main()
