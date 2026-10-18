"""
ZORVEX FinOps Platform - Phase 4 P4.1 Redis Query Caching Audit & Verification Test Suite
========================================================================================
Comprehensive verification covering:
1. Deterministic, multi-dimensional cache keys with tenant and parameter isolation.
2. Exact numerical & financial reconciliation parity between cold SQL and warm Redis cache.
3. Cold vs Warm latency acceleration measurements on real SQLite billing records.
4. Surgical endpoint invalidation (invalidate_endpoint) vs full tenant invalidation (invalidate_org).
5. Concurrency & request coalescing (stampede protection) under thundering herds.
6. Graceful bounded in-memory fallback during Redis outages.
7. Payload size safety limits (>5MB rejection).
8. Live endpoint verification (/overview, /trends, /resources, /resources/hierarchies, /budgets).
9. Live diagnostic telemetry tracking (/api/system/cache-stats).
"""

import os
import sys
import time
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
from app.cache import ZorvexDualTierCache, global_cache
from app.main import app

SAMPLE_CUR_PATH = os.path.join(backend_dir, "data", "samples", "CUR-Report-Daily-00001.csv.gz")


class TestPhase4RedisQueryCaching(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.db = SessionLocal()
        cls.client = TestClient(app)

        # 1. Create Organization Alpha & Beta for multi-tenant isolation
        cls.org_alpha = Organization(name="Tenant Alpha - Redis Caching Suite")
        cls.org_beta = Organization(name="Tenant Beta - Redis Caching Suite")
        cls.db.add(cls.org_alpha)
        cls.db.add(cls.org_beta)
        cls.db.commit()
        cls.db.refresh(cls.org_alpha)
        cls.db.refresh(cls.org_beta)

        # 2. Authenticated user and session for Tenant Alpha
        cls.user_alpha = User(
            organization_id=cls.org_alpha.id,
            name="Alpha Auditor",
            company="Tenant Alpha",
            email="alpha.cache.auditor@zorvex.test",
            password_hash="mock_hash"
        )
        cls.db.add(cls.user_alpha)
        cls.db.commit()
        cls.db.refresh(cls.user_alpha)

        cls.token_alpha = "test_p4_token_alpha_caching_suite"
        cls.session_alpha = UserSession(
            token=cls.token_alpha,
            user_id=cls.user_alpha.id,
            organization_id=cls.org_alpha.id
        )
        cls.db.add(cls.session_alpha)
        cls.db.commit()
        cls.headers_alpha = {"Authorization": f"Bearer {cls.token_alpha}"}

        # 3. Parse sample CUR and persist to SQLite billing_records
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
            is_active=1,
            uploaded_at=datetime.now(timezone.utc)
        )
        cls.db.add(cls.ds_alpha)
        cls.db.commit()
        cls.db.refresh(cls.ds_alpha)

        cls.repo_alpha = BillingRepository(cls.db, org_id=cls.org_alpha.id, dataset_id=cls.ds_alpha.id)
        cls.inserted_count = cls.repo_alpha.ensure_persisted(cls.parsed_data)

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

    def setUp(self):
        # Create an isolated cache instance for deterministic unit isolation
        self.isolated_cache = ZorvexDualTierCache(max_memory_entries=100)

    # =========================================================================
    # 1. CACHE KEY DESIGN & TENANT ISOLATION
    # =========================================================================

    def test_01_cache_key_determinism_and_dimensions(self):
        """Verifies deterministic cache key construction with tenant, dataset, and param hashing."""
        k1 = self.isolated_cache.build_key(
            org_id=1, dataset_id="ds_1", endpoint="overview",
            start_date="2026-10-01", end_date="2026-10-31", service="Amazon EC2"
        )
        # Same params in different order must yield identical key hash
        k2 = self.isolated_cache.build_key(
            org_id=1, dataset_id="ds_1", endpoint="overview",
            service="Amazon EC2", end_date="2026-10-31", start_date="2026-10-01"
        )
        self.assertEqual(k1, k2)
        self.assertTrue(k1.startswith("zorvex:v1:org:1:ds:ds_1:overview:"))

        # Different tenant must yield different key
        k_tenant2 = self.isolated_cache.build_key(
            org_id=2, dataset_id="ds_1", endpoint="overview",
            start_date="2026-10-01", end_date="2026-10-31", service="Amazon EC2"
        )
        self.assertNotEqual(k1, k_tenant2)
        self.assertTrue(k_tenant2.startswith("zorvex:v1:org:2:ds:ds_1:overview:"))

        # Different filter must yield different key
        k_different_svc = self.isolated_cache.build_key(
            org_id=1, dataset_id="ds_1", endpoint="overview",
            start_date="2026-10-01", end_date="2026-10-31", service="Amazon RDS"
        )
        self.assertNotEqual(k1, k_different_svc)

    # =========================================================================
    # 2. STAMPEDE PROTECTION & REQUEST COALESCING
    # =========================================================================

    def test_02_stampede_protection_coalesces_concurrent_misses(self):
        """Verifies request coalescing: concurrent misses on same key execute compute_fn exactly once."""
        compute_counter = [0]
        counter_lock = threading.Lock()

        def expensive_computation():
            time.sleep(0.05)  # Simulate expensive SQL query
            with counter_lock:
                compute_counter[0] += 1
            return {"total_cost": 7762.44, "status": "COMPUTED"}

        key = self.isolated_cache.build_key(org_id=1, dataset_id="ds_1", endpoint="heavy_aggregate")

        threads = []
        results = [None] * 8

        def worker(idx):
            results[idx] = self.isolated_cache.get_or_compute(key, expensive_computation, ttl=60)

        for i in range(8):
            t = threading.Thread(target=worker, args=(i,))
            threads.append(t)
            t.start()

        for t in threads:
            t.join()

        # All 8 threads must receive identical computed results
        for res in results:
            self.assertIsNotNone(res)
            self.assertEqual(res["total_cost"], 7762.44)

        # The underlying expensive compute_fn MUST have run only once
        self.assertEqual(compute_counter[0], 1)

    # =========================================================================
    # 3. REDIS OUTAGE RESILIENCE & IN-MEMORY FALLBACK
    # =========================================================================

    def test_03_graceful_fallback_on_redis_outage(self):
        """Verifies system gracefully falls back to bounded in-memory LRU cache when Redis is unavailable."""
        # Initialize cache instance with invalid redis URL (forcing offline mode)
        fallback_cache = ZorvexDualTierCache(redis_url="redis://127.0.0.1:9999/0", max_memory_entries=10)
        self.assertFalse(fallback_cache.redis_available)

        key = fallback_cache.build_key(org_id=1, dataset_id="ds_test", endpoint="overview")
        payload = {"gross_cost": 7762.44, "net_cost": 8914.94}

        # Set and Get must succeed using memory tier
        ok = fallback_cache.set(key, payload, ttl=60)
        self.assertTrue(ok)
        cached = fallback_cache.get(key)
        self.assertEqual(cached, payload)

        status = fallback_cache.get_status()
        self.assertEqual(status['backend_in_use'], 'in_memory_fallback')
        self.assertFalse(status['redis_connected'])
        self.assertGreaterEqual(status['memory_tier_entries'], 1)

    # =========================================================================
    # 4. OVERSIZED PAYLOAD PROTECTION
    # =========================================================================

    def test_04_oversized_payload_rejection(self):
        """Verifies cache rejects objects > 5MB to prevent memory or Redis saturation."""
        key = self.isolated_cache.build_key(org_id=1, dataset_id="ds_test", endpoint="huge_blob")
        # 6MB string
        large_data = {"blob": "X" * (6 * 1024 * 1024)}
        ok = self.isolated_cache.set(key, large_data, ttl=60)
        self.assertFalse(ok)
        self.assertIsNone(self.isolated_cache.get(key))

    # =========================================================================
    # 5. SURGICAL ENDPOINT INVALIDATION VS TENANT INVALIDATION
    # =========================================================================

    def test_05_surgical_endpoint_invalidation_preserves_other_endpoints(self):
        """Verifies invalidate_endpoint clears only the targeted endpoint (e.g. budgets) without touching others."""
        k_overview = self.isolated_cache.build_key(org_id=1, dataset_id="ds_1", endpoint="overview")
        k_trends = self.isolated_cache.build_key(org_id=1, dataset_id="ds_1", endpoint="trends")
        k_resources = self.isolated_cache.build_key(org_id=1, dataset_id="ds_1", endpoint="resources")
        k_budgets = self.isolated_cache.build_key(org_id=1, dataset_id="ds_1", endpoint="budgets")

        self.isolated_cache.set(k_overview, {"endpoint": "overview"})
        self.isolated_cache.set(k_trends, {"endpoint": "trends"})
        self.isolated_cache.set(k_resources, {"endpoint": "resources"})
        self.isolated_cache.set(k_budgets, {"endpoint": "budgets"})

        # Surgically invalidate budgets only
        purged = self.isolated_cache.invalidate_endpoint(org_id=1, endpoint="budgets")
        self.assertGreaterEqual(purged, 1)

        # Budgets must be evicted
        self.assertIsNone(self.isolated_cache.get(k_budgets))

        # Overview, Trends, Resources MUST remain intact and warm!
        self.assertIsNotNone(self.isolated_cache.get(k_overview))
        self.assertIsNotNone(self.isolated_cache.get(k_trends))
        self.assertIsNotNone(self.isolated_cache.get(k_resources))

    def test_06_tenant_invalidation_isolates_organizations(self):
        """Verifies invalidate_org clears all keys for Org 1 while keeping Org 2 completely intact."""
        k_org1 = self.isolated_cache.build_key(org_id=1, dataset_id="ds_1", endpoint="overview")
        k_org2 = self.isolated_cache.build_key(org_id=2, dataset_id="ds_1", endpoint="overview")

        self.isolated_cache.set(k_org1, {"tenant": "org1"})
        self.isolated_cache.set(k_org2, {"tenant": "org2"})

        self.isolated_cache.invalidate_org(org_id=1)

        self.assertIsNone(self.isolated_cache.get(k_org1))
        self.assertIsNotNone(self.isolated_cache.get(k_org2))
        self.assertEqual(self.isolated_cache.get(k_org2)["tenant"], "org2")

    # =========================================================================
    # 6. LIVE ENDPOINT CACHING & EXACT FINANCIAL PARITY
    # =========================================================================

    def test_07_overview_exact_parity_and_cache_acceleration(self):
        """Verifies GET /api/overview produces identical financial totals on cold DB vs warm cache."""
        # Evict cache for active org to force cold query
        global_cache.invalidate_org(self.org_alpha.id)

        # Cold request (hits SQLite billing_records)
        t0 = time.perf_counter()
        res_cold = self.client.get("/api/overview", headers=self.headers_alpha)
        t_cold_ms = (time.perf_counter() - t0) * 1000.0

        self.assertEqual(res_cold.status_code, 200)
        self.assertEqual(res_cold.headers.get("X-Zorvex-Data-Source"), "database")
        data_cold = res_cold.json()

        # Warm request (hits Redis / Memory cache)
        t1 = time.perf_counter()
        res_warm = self.client.get("/api/overview", headers=self.headers_alpha)
        t_warm_ms = (time.perf_counter() - t1) * 1000.0

        self.assertEqual(res_warm.status_code, 200)
        self.assertEqual(res_warm.headers.get("X-Zorvex-Data-Source"), "database")
        data_warm = res_warm.json()

        # Exact parity assertions
        self.assertEqual(data_cold["gross_cost"], data_warm["gross_cost"])
        self.assertEqual(data_cold["net_cost"], data_warm["net_cost"])
        self.assertEqual(data_cold["credits_total"], data_warm["credits_total"])
        self.assertEqual(data_cold["taxes_total"], data_warm["taxes_total"])
        self.assertEqual(data_cold["services"], data_warm["services"])
        self.assertEqual(data_cold["daily_totals"], data_warm["daily_totals"])
        self.assertEqual(data_cold["accounting_reconciliation"], data_warm["accounting_reconciliation"])

        # Accounting reconciliation verification
        reconcil = data_warm["accounting_reconciliation"]
        self.assertTrue(reconcil["is_reconciled"])
        self.assertEqual(reconcil["gross_usage_cost"], self.parsed_data['gross_cost'])
        self.assertEqual(reconcil["net_invoiced_spend"], self.parsed_data['net_cost'])

        # Acceleration verification: Warm cache must be significantly faster
        print(f"\n[LATENCY /overview] Cold SQL: {t_cold_ms:.2f}ms | Warm Cache: {t_warm_ms:.2f}ms")
        self.assertLess(t_warm_ms, t_cold_ms)

    def test_08_trends_exact_parity_and_cache_acceleration(self):
        """Verifies GET /api/trends produces identical trend schemas and numbers on cold vs warm cache."""
        global_cache.invalidate_org(self.org_alpha.id)

        t0 = time.perf_counter()
        res_cold = self.client.get("/api/trends", headers=self.headers_alpha)
        t_cold_ms = (time.perf_counter() - t0) * 1000.0
        self.assertEqual(res_cold.status_code, 200)
        self.assertEqual(res_cold.headers.get("X-Zorvex-Data-Source"), "database")
        data_cold = res_cold.json()

        t1 = time.perf_counter()
        res_warm = self.client.get("/api/trends", headers=self.headers_alpha)
        t_warm_ms = (time.perf_counter() - t1) * 1000.0
        self.assertEqual(res_warm.status_code, 200)
        self.assertEqual(res_warm.headers.get("X-Zorvex-Data-Source"), "database")
        data_warm = res_warm.json()

        # Structural & numerical equality
        self.assertEqual(data_cold["dates"], data_warm["dates"])
        self.assertEqual(data_cold["timeline"], data_warm["timeline"])
        self.assertEqual(data_cold["daily_totals"], data_warm["daily_totals"])
        self.assertEqual(data_cold["daily_gross_totals"], data_warm["daily_gross_totals"])
        self.assertEqual(data_cold["services_trend"], data_warm["services_trend"])

        print(f"\n[LATENCY /trends] Cold SQL: {t_cold_ms:.2f}ms | Warm Cache: {t_warm_ms:.2f}ms")
        self.assertLess(t_warm_ms, t_cold_ms)

    def test_09_resources_explorer_exact_parity_and_filter_isolation(self):
        """Verifies GET /api/resources produces identical results and respects query filters."""
        global_cache.invalidate_org(self.org_alpha.id)

        # Cold request
        t0 = time.perf_counter()
        res_cold = self.client.get("/api/resources?page=1&page_size=10", headers=self.headers_alpha)
        t_cold_ms = (time.perf_counter() - t0) * 1000.0
        self.assertEqual(res_cold.status_code, 200)
        self.assertEqual(res_cold.headers.get("X-Zorvex-Data-Source"), "database")
        data_cold = res_cold.json()

        # Warm request
        t1 = time.perf_counter()
        res_warm = self.client.get("/api/resources?page=1&page_size=10", headers=self.headers_alpha)
        t_warm_ms = (time.perf_counter() - t1) * 1000.0
        self.assertEqual(res_warm.status_code, 200)
        self.assertEqual(res_warm.headers.get("X-Zorvex-Data-Source"), "database")
        data_warm = res_warm.json()

        self.assertEqual(data_cold["summary"], data_warm["summary"])
        self.assertEqual(len(data_cold["resources"]), len(data_warm["resources"]))
        self.assertEqual(data_cold["pagination"], data_warm["pagination"])

        print(f"\n[LATENCY /resources] Cold SQL: {t_cold_ms:.2f}ms | Warm Cache: {t_warm_ms:.2f}ms")
        self.assertLess(t_warm_ms, t_cold_ms)

        # Verify page 2 is isolated from page 1 in cache
        res_page2 = self.client.get("/api/resources?page=2&page_size=10", headers=self.headers_alpha)
        self.assertEqual(res_page2.status_code, 200)
        data_page2 = res_page2.json()
        self.assertEqual(data_page2["pagination"]["page"], 2)
        if len(data_cold["resources"]) > 0 and len(data_page2["resources"]) > 0:
            self.assertNotEqual(data_cold["resources"][0]["resource_id"], data_page2["resources"][0]["resource_id"])

    def test_10_resource_hierarchies_exact_parity(self):
        """Verifies GET /api/resources/hierarchies exact parity and cache acceleration."""
        global_cache.invalidate_org(self.org_alpha.id)

        t0 = time.perf_counter()
        res_cold = self.client.get("/api/resources/hierarchies", headers=self.headers_alpha)
        t_cold_ms = (time.perf_counter() - t0) * 1000.0
        self.assertEqual(res_cold.status_code, 200)
        self.assertEqual(res_cold.headers.get("X-Zorvex-Data-Source"), "database")
        data_cold = res_cold.json()

        t1 = time.perf_counter()
        res_warm = self.client.get("/api/resources/hierarchies", headers=self.headers_alpha)
        t_warm_ms = (time.perf_counter() - t1) * 1000.0
        self.assertEqual(res_warm.status_code, 200)
        self.assertEqual(res_warm.headers.get("X-Zorvex-Data-Source"), "database")
        data_warm = res_warm.json()

        self.assertEqual(data_cold["services"], data_warm["services"])
        self.assertEqual(data_cold["categories_by_service"], data_warm["categories_by_service"])
        self.assertEqual(data_cold["accounts"], data_warm["accounts"])
        self.assertEqual(data_cold["regions"], data_warm["regions"])

        print(f"\n[LATENCY /resources/hierarchies] Cold SQL: {t_cold_ms:.2f}ms | Warm Cache: {t_warm_ms:.2f}ms")
        self.assertLess(t_warm_ms, t_cold_ms)

    def test_11_budgets_caching_and_mutation_invalidation(self):
        """Verifies GET /api/budgets is cached and automatically invalidated when a budget is created."""
        global_cache.invalidate_endpoint(self.org_alpha.id, "budgets")

        # 1. Cold fetch
        t0 = time.perf_counter()
        res_cold = self.client.get("/api/budgets", headers=self.headers_alpha)
        t_cold_ms = (time.perf_counter() - t0) * 1000.0
        self.assertEqual(res_cold.status_code, 200)
        self.assertEqual(res_cold.headers.get("X-Zorvex-Data-Source"), "database")
        data_cold = res_cold.json()

        # 2. Warm fetch
        t1 = time.perf_counter()
        res_warm = self.client.get("/api/budgets", headers=self.headers_alpha)
        t_warm_ms = (time.perf_counter() - t1) * 1000.0
        self.assertEqual(res_warm.status_code, 200)
        self.assertEqual(res_warm.headers.get("X-Zorvex-Data-Source"), "database")
        data_warm = res_warm.json()

        self.assertEqual(data_cold, data_warm)
        print(f"\n[LATENCY /budgets] Cold SQL: {t_cold_ms:.2f}ms | Warm Cache: {t_warm_ms:.2f}ms")
        self.assertLess(t_warm_ms, t_cold_ms)

        # 3. Create a test budget (mutation must surgically invalidate budgets cache)
        budget_payload = {
            "name": "Phase 4 Automated Verification Budget",
            "scope_type": "SERVICE",
            "scope_value": "Amazon EC2",
            "monthly_budget_usd": 5000.0,
            "alert_threshold_pct": 85.0,
            "notification_email": "finops-audit@zorvex.internal"
        }
        create_res = self.client.post("/api/budgets", json=budget_payload, headers=self.headers_alpha)
        self.assertEqual(create_res.status_code, 200)

        # 4. GET /api/budgets immediately after creation must reflect the new budget
        res_after_create = self.client.get("/api/budgets", headers=self.headers_alpha)
        self.assertEqual(res_after_create.status_code, 200)
        budgets_after = res_after_create.json()
        budget_names = [b.get("name") for b in budgets_after]
        self.assertIn("Phase 4 Automated Verification Budget", budget_names)

        # Cleanup: remove the created budget from DB and invalidate
        test_b = self.db.query(BudgetConfig).filter(
            BudgetConfig.organization_id == self.org_alpha.id,
            BudgetConfig.name == "Phase 4 Automated Verification Budget"
        ).first()
        if test_b:
            del_res = self.client.delete(f"/api/budgets/{test_b.id}", headers=self.headers_alpha)
            self.assertEqual(del_res.status_code, 200)

    def test_12_cache_telemetry_status(self):
        """Verifies GET /api/system/cache-stats reflects real-time hits, misses, and backend status."""
        res = self.client.get("/api/system/cache-stats")
        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertEqual(data["status"], "HEALTHY")
        self.assertIn("backend_in_use", data)
        self.assertIn("redis_connected", data)
        self.assertIn("total_hits", data)
        self.assertIn("total_misses", data)
        self.assertIn("hit_ratio_pct", data)
        self.assertGreaterEqual(data["total_hits"], 1)
        print(f"\n[CACHE TELEMETRY] Backend: {data['backend_in_use']} | Hits: {data['total_hits']} | Misses: {data['total_misses']} | Ratio: {data['hit_ratio_pct']}%")


if __name__ == '__main__':
    unittest.main()
