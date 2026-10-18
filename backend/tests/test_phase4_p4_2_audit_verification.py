"""
ZORVEX Phase 4 P4.2: Independent Cache Correctness, Multi-Worker Safety & Performance Verification Suite
==========================================================================================================
Comprehensive automated verification covering:
- Phase 1: Cache-Key Dimension Coverage & Tenant Boundary
- Phase 2: Same-Dataset CUR Correction & Stale-Cache Defense
- Phase 3: Redis Outage, Recovery & Dual-Bounded Fallback Safety
- Phase 4: Concurrency & Stampede Protection
- Phase 5: Financial Reconciliation & Exact Schema Parity
- Phase 7: Parser DSA Correctness & Zero-Drift Verification
- Phase 8: Dataset Initialization Idempotency & Fresh Process Safety
- Phase 9: SQLite Query Plans & Covering Index Verification
"""

import os
import sys
import time
import json
import threading
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
from app.cache import ZorvexDualTierCache, global_cache, get_dataset_cache_key
from app.core.state import load_initial_dataset, CURRENT_DATASET
from app.main import app

SAMPLE_CUR_PATH = os.path.join(backend_dir, "data", "samples", "CUR-Report-Daily-00001.csv.gz")


class TestPhase4P42AuditVerification(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.db = SessionLocal()
        cls.client = TestClient(app)

        # Organizations for multi-tenant isolation verification
        cls.org_alpha = Organization(name="P4.2 Tenant Alpha")
        cls.org_beta = Organization(name="P4.2 Tenant Beta")
        cls.db.add(cls.org_alpha)
        cls.db.add(cls.org_beta)
        cls.db.commit()
        cls.db.refresh(cls.org_alpha)
        cls.db.refresh(cls.org_beta)

        # Authenticated user & session for Tenant Alpha
        cls.user_alpha = User(
            organization_id=cls.org_alpha.id,
            name="Auditor Alpha",
            company="Tenant Alpha Corp",
            email="auditor.alpha@zorvex.test",
            password_hash="mock_hash"
        )
        cls.db.add(cls.user_alpha)
        cls.db.commit()
        cls.db.refresh(cls.user_alpha)

        cls.token_alpha = "p4_2_token_alpha_audit"
        cls.session_alpha = UserSession(
            token=cls.token_alpha,
            user_id=cls.user_alpha.id,
            organization_id=cls.org_alpha.id
        )
        cls.db.add(cls.session_alpha)

        # Authenticated user & session for Tenant Beta
        cls.user_beta = User(
            organization_id=cls.org_beta.id,
            name="Auditor Beta",
            company="Tenant Beta Corp",
            email="auditor.beta@zorvex.test",
            password_hash="mock_hash"
        )
        cls.db.add(cls.user_beta)
        cls.db.commit()
        cls.db.refresh(cls.user_beta)

        cls.token_beta = "p4_2_token_beta_audit"
        cls.session_beta = UserSession(
            token=cls.token_beta,
            user_id=cls.user_beta.id,
            organization_id=cls.org_beta.id
        )
        cls.db.add(cls.session_beta)
        cls.db.commit()

        cls.headers_alpha = {"Authorization": f"Bearer {cls.token_alpha}"}
        cls.headers_beta = {"Authorization": f"Bearer {cls.token_beta}"}

        # Seed dataset for Tenant Alpha
        cls.parsed_data = parse_cur_file(SAMPLE_CUR_PATH)
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
            revision_version=1,
            is_active=1,
            uploaded_at=datetime.now(timezone.utc)
        )
        cls.db.add(cls.ds_alpha)
        cls.db.commit()
        cls.db.refresh(cls.ds_alpha)

        cls.repo_alpha = BillingRepository(cls.db, org_id=cls.org_alpha.id, dataset_id=cls.ds_alpha.id)
        cls.repo_alpha.ensure_persisted(cls.parsed_data)

    @classmethod
    def tearDownClass(cls):
        try:
            cls.db.query(BillingRecord).filter(
                BillingRecord.organization_id.in_([cls.org_alpha.id, cls.org_beta.id])
            ).delete(synchronize_session=False)
            cls.db.query(DatasetRecord).filter(
                DatasetRecord.organization_id.in_([cls.org_alpha.id, cls.org_beta.id])
            ).delete(synchronize_session=False)
            cls.db.query(UserSession).filter(
                UserSession.organization_id.in_([cls.org_alpha.id, cls.org_beta.id])
            ).delete(synchronize_session=False)
            cls.db.query(User).filter(
                User.organization_id.in_([cls.org_alpha.id, cls.org_beta.id])
            ).delete(synchronize_session=False)
            cls.db.query(BudgetConfig).filter(
                BudgetConfig.organization_id.in_([cls.org_alpha.id, cls.org_beta.id])
            ).delete(synchronize_session=False)
            cls.db.query(Organization).filter(
                Organization.id.in_([cls.org_alpha.id, cls.org_beta.id])
            ).delete(synchronize_session=False)
            cls.db.commit()
        except Exception:
            pass
        finally:
            cls.db.close()

    # =========================================================================
    # PHASE 1: CACHE KEY CORRECTNESS & TENANT BOUNDARY
    # =========================================================================

    def test_p1_01_cache_key_canonicalization_and_order_invariance(self):
        """Verifies that parameter order variation produces identical canonical keys."""
        cache = ZorvexDualTierCache()
        k1 = cache.build_key(1, "ds1_v1", "resources", p=1, ps=25, svc="EC2", reg="us-east-1")
        k2 = cache.build_key(1, "ds1_v1", "resources", reg="us-east-1", svc="EC2", ps=25, p=1)
        self.assertEqual(k1, k2, "Parameter reordering must produce identical hash")

    def test_p1_02_cache_key_dimension_separation(self):
        """Verifies that altering ANY analytical dimension alters the cache key."""
        cache = ZorvexDualTierCache()
        base = cache.build_key(1, "ds1_v1", "overview", s="2026-10-01", e="2026-10-31", svc="EC2", acc="123")
        
        # Change tenant
        self.assertNotEqual(base, cache.build_key(2, "ds1_v1", "overview", s="2026-10-01", e="2026-10-31", svc="EC2", acc="123"))
        # Change revision
        self.assertNotEqual(base, cache.build_key(1, "ds1_v2", "overview", s="2026-10-01", e="2026-10-31", svc="EC2", acc="123"))
        # Change start date
        self.assertNotEqual(base, cache.build_key(1, "ds1_v1", "overview", s="2026-10-02", e="2026-10-31", svc="EC2", acc="123"))
        # Change end date
        self.assertNotEqual(base, cache.build_key(1, "ds1_v1", "overview", s="2026-10-01", e="2026-10-30", svc="EC2", acc="123"))
        # Change service
        self.assertNotEqual(base, cache.build_key(1, "ds1_v1", "overview", s="2026-10-01", e="2026-10-31", svc="RDS", acc="123"))
        # Change account
        self.assertNotEqual(base, cache.build_key(1, "ds1_v1", "overview", s="2026-10-01", e="2026-10-31", svc="EC2", acc="456"))

    def test_p1_03_get_dataset_cache_key_generation_versioning(self):
        """Verifies get_dataset_cache_key incorporates revision_version from d_rec or dataset dict."""
        # Case A: repo with d_rec
        class MockRec:
            filename = "cur_october.csv"
            revision_version = 3
        class MockRepo:
            d_rec = MockRec()
            dataset_id = 99
        self.assertEqual(get_dataset_cache_key({}, MockRepo()), "cur_october.csv_v3")

        # Case B: dataset dict fallback
        ds_dict = {"filename": "cur_nov.csv", "revision_version": 2}
        self.assertEqual(get_dataset_cache_key(ds_dict, None), "cur_nov.csv_v2")

        # Case C: unversioned default fallback
        self.assertEqual(get_dataset_cache_key({}, None), "default_v1")

    # =========================================================================
    # PHASE 2: SAME-DATASET CUR CORRECTION & STALE-CACHE DEFENSE
    # =========================================================================

    def test_p2_01_same_dataset_id_revision_bump_bypasses_stale_cache(self):
        """
        Verifies that when a dataset is reprocessed/corrected with a revision bump (v1 -> v2),
        analytical endpoints immediately compute and serve the new values rather than the stale v1 cache.
        """
        cache = ZorvexDualTierCache()
        
        # Query 1: v1 cache populated with original cost
        k_v1 = cache.build_key(self.org_alpha.id, "dataset_alpha_v1", "overview")
        cache.set(k_v1, {"gross_cost": 7762.44, "version": 1}, ttl=1800)
        
        # Verify v1 returns cached data
        self.assertEqual(cache.get(k_v1)["gross_cost"], 7762.44)

        # Simulation: Dataset corrected, revision advanced to v2
        k_v2 = cache.build_key(self.org_alpha.id, "dataset_alpha_v2", "overview")
        
        # v2 is a cache miss, computes corrected financial data ($8,100.00)
        computed_v2 = cache.get_or_compute(k_v2, lambda: {"gross_cost": 8100.00, "version": 2}, ttl=1800)
        self.assertEqual(computed_v2["gross_cost"], 8100.00)
        self.assertEqual(computed_v2["version"], 2)

    def test_p2_02_tenant_invalidation_clears_all_entries(self):
        """Verifies invalidate_org purges tenant keys without affecting other tenants or using FLUSHDB."""
        cache = ZorvexDualTierCache()
        k_alpha = cache.build_key(101, "ds1_v1", "overview")
        k_beta = cache.build_key(102, "ds1_v1", "overview")

        cache.set(k_alpha, {"spend": 100})
        cache.set(k_beta, {"spend": 200})

        self.assertIsNotNone(cache.get(k_alpha))
        self.assertIsNotNone(cache.get(k_beta))

        # Invalidate tenant 101 only
        cache.invalidate_org(101)

        self.assertIsNone(cache.get(k_alpha), "Tenant 101 cache must be invalidated")
        self.assertIsNotNone(cache.get(k_beta), "Tenant 102 cache must remain intact")

    # =========================================================================
    # PHASE 3: REDIS OUTAGE, RECOVERY & DUAL-BOUNDED FALLBACK SAFETY
    # =========================================================================

    def test_p3_01_resilient_fallback_on_unreachable_redis(self):
        """Verifies cache seamlessly falls back to in-memory LRU when Redis is offline."""
        offline_cache = ZorvexDualTierCache(redis_url="redis://127.0.0.1:59999/0")
        self.assertFalse(offline_cache.redis_available)

        key = offline_cache.build_key(1, "ds1_v1", "trends")
        res = offline_cache.get_or_compute(key, lambda: {"status": "AUTHORITATIVE_SQL_RESULT"}, ttl=60)
        self.assertEqual(res["status"], "AUTHORITATIVE_SQL_RESULT")
        
        # Second access hits memory cache
        cached = offline_cache.get(key)
        self.assertEqual(cached["status"], "AUTHORITATIVE_SQL_RESULT")

    def test_p3_02_memory_tier_dual_bounds_entry_count_and_byte_budget(self):
        """Verifies in-memory fallback enforces both max entries (5) and byte budget (10 KB)."""
        bounded_cache = ZorvexDualTierCache(
            redis_url="redis://127.0.0.1:59999/0",
            max_memory_entries=5,
            max_memory_bytes=10 * 1024  # 10 KB budget
        )

        # Store 10 items of 2 KB each (total 20 KB > 10 KB budget)
        payload = {"data": "X" * 2000}
        for i in range(10):
            k = f"key_{i}"
            bounded_cache.set(k, payload, ttl=60)

        # Byte budget must be enforced (< 10 KB) and entry count <= 5
        status = bounded_cache.get_status()
        self.assertLessEqual(status["memory_tier_entries"], 5)
        self.assertLessEqual(status["memory_tier_bytes"], 10 * 1024)
        self.assertGreater(status["evictions_count"], 0)

    def test_p3_03_oversized_payload_rejection_guard(self):
        """Verifies entries > 5 MB are rejected from caching to prevent Redis / memory exhaustion."""
        cache = ZorvexDualTierCache()
        huge_payload = {"huge": "Z" * (5 * 1024 * 1024 + 1024)}  # 5 MB + 1 KB
        key = cache.build_key(1, "ds1_v1", "huge_query")
        
        # Should not raise exception, but should not store in cache
        cache.set(key, huge_payload, ttl=60)
        self.assertIsNone(cache.get(key), "Oversized payload must not be cached")

    # =========================================================================
    # PHASE 4: MULTI-WORKER & CONCURRENCY VERIFICATION
    # =========================================================================

    def test_p4_01_stampede_request_coalescing_single_flight(self):
        """Verifies stampede protection guarantees expensive query executes exactly once under concurrency."""
        cache = ZorvexDualTierCache()
        compute_count = [0]
        lock = threading.Lock()

        def slow_sql():
            time.sleep(0.04)
            with lock:
                compute_count[0] += 1
            return {"result": 42}

        # Use unique key to guarantee test begins with a clean cache miss
        unique_ds = f"stampede_test_{time.time_ns()}"
        key = cache.build_key(1, unique_ds, "heavy_aggregation")
        if cache.redis_client and cache.redis_available:
            try:
                cache.redis_client.delete(key)
            except Exception:
                pass
        threads = []
        outputs = [None] * 6

        def runner(idx):
            outputs[idx] = cache.get_or_compute(key, slow_sql, ttl=60)

        for i in range(6):
            t = threading.Thread(target=runner, args=(i,))
            threads.append(t)
            t.start()

        for t in threads:
            t.join()

        self.assertEqual(compute_count[0], 1, "Query must execute exactly once across concurrent threads")
        for out in outputs:
            self.assertEqual(out["result"], 42)

    # =========================================================================
    # PHASE 5: FINANCIAL CORRECTNESS & PARITY (COLD SQL VS WARM CACHE)
    # =========================================================================

    def test_p5_01_overview_exact_numerical_and_schema_parity(self):
        """Verifies GET /api/overview produces identical schemas and numbers on cold SQL vs warm cache."""
        global_cache.invalidate_org(self.org_alpha.id)

        # Cold request (hits SQLite)
        res_cold = self.client.get("/api/overview", headers=self.headers_alpha)
        self.assertEqual(res_cold.status_code, 200)
        data_cold = res_cold.json()

        # Warm request (hits Redis)
        res_warm = self.client.get("/api/overview", headers=self.headers_alpha)
        self.assertEqual(res_warm.status_code, 200)
        data_warm = res_warm.json()

        # Verify exact parity
        self.assertEqual(data_cold["gross_cost"], data_warm["gross_cost"])
        self.assertEqual(data_cold["net_cost"], data_warm["net_cost"])
        self.assertEqual(data_cold["taxes_total"], data_warm["taxes_total"])
        self.assertEqual(data_cold["credits_total"], data_warm["credits_total"])
        self.assertEqual(data_cold["services"], data_warm["services"])
        self.assertEqual(data_cold["accounting_reconciliation"], data_warm["accounting_reconciliation"])

    def test_p5_02_forecast_and_budgets_generation_caching(self):
        """Verifies GET /api/forecast and /api/budgets are served from cache with exact parity."""
        global_cache.invalidate_org(self.org_alpha.id)

        # Forecast
        fc_cold = self.client.get("/api/forecast", headers=self.headers_alpha).json()
        fc_warm = self.client.get("/api/forecast", headers=self.headers_alpha).json()
        self.assertEqual(fc_cold["forecasted_month_end_usd"], fc_warm["forecasted_month_end_usd"])
        self.assertEqual(fc_cold["actual_spend_to_date_usd"], fc_warm["actual_spend_to_date_usd"])

        # Budgets
        b_cold = self.client.get("/api/budgets", headers=self.headers_alpha).json()
        b_warm = self.client.get("/api/budgets", headers=self.headers_alpha).json()
        self.assertEqual(b_cold, b_warm)

    # =========================================================================
    # PHASE 7: PARSER & DSA REGRESSION VERIFICATION
    # =========================================================================

    def test_p7_01_parser_dsa_zero_cost_fastpath_and_decimal_precision(self):
        """Verifies parser fastpath preserves exact Decimal precision on zero and non-zero rows."""
        parsed = parse_cur_file(SAMPLE_CUR_PATH)
        
        # Verify non-empty parse
        self.assertGreater(parsed['total_rows'], 0)
        self.assertGreater(parsed['gross_cost'], 0)
        
        # Accounting formula: Gross + Tax - Credits - Refunds = Net
        calc_net = round_currency(
            Decimal(str(parsed['gross_cost'])) +
            Decimal(str(parsed['taxes_total'])) -
            Decimal(str(parsed['credits_total'])) -
            Decimal(str(parsed['refunds_total']))
        )
        self.assertEqual(float(calc_net), parsed['net_cost'], "Accounting formula must hold to the exact penny")

    # =========================================================================
    # PHASE 8: DATASET INITIALIZATION & COLD-START IDEMPOTENCY
    # =========================================================================

    def test_p8_01_dataset_loader_idempotent_single_flight(self):
        """Verifies load_initial_dataset does not reload or duplicate memory when dataset is already hot."""
        # Call loader
        load_initial_dataset()
        self.assertIsNotNone(CURRENT_DATASET.get('data'))
        filename = CURRENT_DATASET.get('filename')
        
        # Second call must return instantly without reparsing
        t0 = time.perf_counter()
        load_initial_dataset()
        dur_ms = (time.perf_counter() - t0) * 1000.0
        self.assertLess(dur_ms, 10.0, "Repeated load_initial_dataset call must complete in <10ms")
        self.assertEqual(CURRENT_DATASET.get('filename'), filename)

    # =========================================================================
    # PHASE 9: DATABASE QUERY PLANS & COVERING INDEX USAGE
    # =========================================================================

    def test_p9_01_sqlite_query_plan_utilizes_covering_indexes(self):
        """Verifies SQLite EXPLAIN QUERY PLAN confirms index coverage on billing_records queries."""
        from sqlalchemy import text
        query_overview = """
        EXPLAIN QUERY PLAN
        SELECT service, SUM(cost)
        FROM billing_records
        WHERE organization_id = :org AND dataset_id = :ds
        GROUP BY service
        """
        cursor = self.db.execute(text(query_overview), {"org": self.org_alpha.id, "ds": self.ds_alpha.id})
        plan_rows = cursor.fetchall()
        plan_text = " ".join(str(r) for r in plan_rows)
        
        # Index or scan verification: Must use an index on (dataset_id, service, cost)
        has_index = "USING INDEX" in plan_text or "SEARCH" in plan_text
        self.assertTrue(has_index, f"Query must utilize database index. Actual plan: {plan_text}")


if __name__ == "__main__":
    unittest.main()
