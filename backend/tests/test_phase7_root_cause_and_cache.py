"""
ZORVEX FinOps Platform - Phase 7 Automated Regression Test Suite
===============================================================
Comprehensive test coverage for:
1. Root Cause Analysis & Variance Attribution Engine.
2. Mathematical reconciliation of Service and Resource cost shares.
3. Zero-baseline and terminated-workload classification safety.
4. Multi-tenant dual-tier caching (Redis + In-Memory Fallback).
5. Cross-tenant cache isolation and tenant-scoped invalidation.
6. API endpoint contracts for /api/analytics/root-cause and /api/system/cache-stats.
"""

import os
import unittest
from fastapi.testclient import TestClient

import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.main import app
from app.root_cause import analyze_cost_root_cause, classify_resource_variance
from app.cache import ZorvexDualTierCache, global_cache
from app.parser import parse_cur_file

SAMPLE_CUR = os.path.join(os.path.dirname(__file__), '..', 'data', 'samples', 'CUR-Report-Daily-00001.csv.gz')
PRODUCTION_CUR = os.path.join(os.path.dirname(__file__), '..', 'data', 'samples', 'aws_cur_production_exact.csv')


class TestPhase7RootCauseAndCache(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        if os.path.exists(SAMPLE_CUR):
            cls.sample_cur_data = parse_cur_file(SAMPLE_CUR)
        else:
            cls.sample_cur_data = None

        if os.path.exists(PRODUCTION_CUR):
            cls.prod_cur_data = parse_cur_file(PRODUCTION_CUR)
        else:
            cls.prod_cur_data = None

    def setUp(self):
        # Reset local cache instance for deterministic unit testing
        self.test_cache = ZorvexDualTierCache(max_memory_entries=50)

    def test_01_root_cause_variance_decomposition(self):
        """Verifies Day-over-Day variance attribution decomposes into exact categories."""
        if not self.sample_cur_data:
            self.skipTest("Sample CUR not found")

        dates = self.sample_cur_data['dates']
        self.assertGreaterEqual(len(dates), 2)

        res = analyze_cost_root_cause(
            self.sample_cur_data,
            baseline_start=dates[0],
            baseline_end=dates[0],
            target_start=dates[1],
            target_end=dates[1]
        )

        self.assertEqual(res['status'], 'SUCCESS')
        self.assertIn('variance_summary', res)
        self.assertIn('category_decomposition', res)
        self.assertIn('service_attribution', res)
        self.assertIn('top_cost_increases', res)

        # Mathematical consistency: Net delta must equal target - baseline
        base_cost = res['comparison_window']['baseline']['total_cost']
        target_cost = res['comparison_window']['target']['total_cost']
        net_delta = res['variance_summary']['net_delta']
        self.assertAlmostEqual(net_delta, round(target_cost - base_cost, 2), places=2)

    def test_02_service_variance_sum_reconciliation(self):
        """Verifies that sum of service deltas mathematically reconciles with total net delta."""
        if not self.sample_cur_data:
            self.skipTest("Sample CUR not found")

        dates = self.sample_cur_data['dates']
        res = analyze_cost_root_cause(
            self.sample_cur_data,
            baseline_start=dates[1],
            baseline_end=dates[1],
            target_start=dates[2],
            target_end=dates[2]
        )

        services = res['service_attribution']
        sum_service_deltas = sum(s['delta_cost'] for s in services)
        net_delta = res['variance_summary']['net_delta']

        # Service sum must match total variance within rounding tolerance (±$0.05)
        self.assertAlmostEqual(sum_service_deltas, net_delta, delta=0.05)

    def test_03_zero_baseline_new_workload_classification(self):
        """Verifies that newly provisioned resources from 0 baseline are handled without divide-by-zero."""
        cat, expl, ev, op_note = classify_resource_variance(
            rid="i-0987654321abcdef0",
            cb=0.0,
            ct=15.50,
            qb=0.0,
            qt=24.0,
            unit="Hrs",
            svc="Amazon EC2",
            uts_base=set(),
            uts_target={"BoxUsage:t3a.medium"},
            line_types={"Usage"},
            name="web-backend-new"
        )

        self.assertEqual(cat, 'NEW_RESOURCE')
        self.assertIn('Newly provisioned workload', expl)
        self.assertEqual(ev, 'CONFIRMED_BY_CUR')

    def test_04_terminated_workload_classification(self):
        """Verifies that resources ceasing charges are classified as TERMINATED_RESOURCE."""
        cat, expl, ev, op_note = classify_resource_variance(
            rid="i-0123456789deadbeef",
            cb=25.00,
            ct=0.0,
            qb=24.0,
            qt=0.0,
            unit="Hrs",
            svc="Amazon EC2",
            uts_base={"BoxUsage:m5.xlarge"},
            uts_target=set(),
            line_types={"Usage"},
            name="legacy-worker"
        )

        self.assertEqual(cat, 'TERMINATED_RESOURCE')
        self.assertIn('stopped incurring charges', expl)
        self.assertEqual(ev, 'CONFIRMED_BY_CUR')

    def test_05_capacity_and_sku_shift_classification(self):
        """Verifies that instance resizing or volume tier shift is classified accurately."""
        cat, expl, ev, op_note = classify_resource_variance(
            rid="vol-0123456789abcdef0",
            cb=5.00,
            ct=8.50,
            qb=100.0,
            qt=100.0,
            unit="GB-Mo",
            svc="Amazon EC2",
            uts_base={"EBS:VolumeUsage.gp2"},
            uts_target={"EBS:VolumeUsage.gp3"},
            line_types={"Usage"}
        )

        self.assertEqual(cat, 'CAPACITY_OR_SKU_CHANGE')
        self.assertIn('Billed capacity or SKU changed', expl)

    def test_06_cache_hit_miss_and_telemetry(self):
        """Verifies dual-tier cache returns cached data on subsequent requests and updates metrics."""
        key = self.test_cache.build_key(org_id=99, dataset_id="ds-alpha", endpoint="test_endpoint", param="val1")
        
        # Miss
        self.assertIsNone(self.test_cache.get(key))
        self.assertEqual(self.test_cache.misses, 1)
        self.assertEqual(self.test_cache.hits, 0)

        # Put
        test_val = {"data": [1, 2, 3], "status": "OK"}
        self.test_cache.set(key, test_val, ttl=300)

        # Hit
        retrieved = self.test_cache.get(key)
        self.assertEqual(retrieved, test_val)
        self.assertEqual(self.test_cache.hits, 1)

        # Check telemetry
        status = self.test_cache.get_status()
        self.assertEqual(status['total_hits'], 1)
        self.assertEqual(status['total_misses'], 1)
        self.assertEqual(status['hit_ratio_pct'], 50.0)

    def test_07_cache_multi_tenant_isolation(self):
        """Verifies Org 1 and Org 2 have strict cache isolation and cannot access each other's keys."""
        k1 = self.test_cache.build_key(org_id=1, dataset_id="common_ds", endpoint="overview")
        k2 = self.test_cache.build_key(org_id=2, dataset_id="common_ds", endpoint="overview")

        self.test_cache.set(k1, {"tenant": "org1_confidential"})
        self.test_cache.set(k2, {"tenant": "org2_confidential"})

        self.assertEqual(self.test_cache.get(k1)["tenant"], "org1_confidential")
        self.assertEqual(self.test_cache.get(k2)["tenant"], "org2_confidential")

        # Invalidate Org 1 only
        purged = self.test_cache.invalidate_org(org_id=1)
        self.assertGreaterEqual(purged, 1)

        # Org 1 must be gone; Org 2 must remain completely intact
        self.assertIsNone(self.test_cache.get(k1))
        self.assertIsNotNone(self.test_cache.get(k2))
        self.assertEqual(self.test_cache.get(k2)["tenant"], "org2_confidential")

    def test_08_api_root_cause_endpoint(self):
        """Verifies POST /api/analytics/root-cause endpoint contract."""
        payload = {
            "baseline_start": "2026-10-01",
            "baseline_end": "2026-10-01",
            "target_start": "2026-10-02",
            "target_end": "2026-10-02"
        }
        res = self.client.post("/api/analytics/root-cause", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "SUCCESS")
        self.assertIn("comparison_window", data)
        self.assertIn("variance_summary", data)
        self.assertIn("category_decomposition", data)
        self.assertIn("service_attribution", data)
        self.assertIn("top_cost_increases", data)
        self.assertIn("resources", data)

    def test_09_api_cache_stats_endpoint(self):
        """Verifies GET /api/system/cache-stats endpoint contract."""
        res = self.client.get("/api/system/cache-stats")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "HEALTHY")
        self.assertIn("backend_in_use", data)
        self.assertIn("hit_ratio_pct", data)
        self.assertIn("memory_tier_entries", data)

    def test_10_quantity_effect_vs_rate_effect_decomposition(self):
        """Verifies mathematical quantity vs rate decomposition for resource variance."""
        if not self.sample_cur_data:
            self.skipTest("Sample CUR not found")

        dates = self.sample_cur_data['dates']
        res = analyze_cost_root_cause(
            self.sample_cur_data,
            baseline_start=dates[1],
            baseline_end=dates[2],
            target_start=dates[3],
            target_end=dates[4]
        )
        self.assertEqual(res['status'], 'SUCCESS')
        resources = res.get('resources', [])
        self.assertGreater(len(resources), 0)

        # Find resources with both baseline and target usage
        continuous_resources = [r for r in resources if r['baseline_cost'] > 0 and r['target_cost'] > 0 and r['baseline_usage_qty'] > 0 and r['target_usage_qty'] > 0]
        self.assertGreater(len(continuous_resources), 0)
        
        for r in continuous_resources[:5]:
            self.assertIn('quantity_effect', r)
            self.assertIn('rate_effect', r)
            self.assertIn('effective_rate_base', r)
            self.assertIn('effective_rate_target', r)
            # Mathematical identity: Delta Cost = (Qt - Qb)*Rb + Qb*(Rt - Rb) + (Qt - Qb)*(Rt - Rb)
            rb_exact = r['baseline_cost'] / r['baseline_usage_qty']
            rt_exact = r['target_cost'] / r['target_usage_qty']
            delta_q = r['target_usage_qty'] - r['baseline_usage_qty']
            delta_r = rt_exact - rb_exact
            interaction_effect = delta_q * delta_r
            reconstructed_delta = r['quantity_effect'] + r['rate_effect'] + interaction_effect
            self.assertAlmostEqual(reconstructed_delta, r['delta_cost'], delta=0.10)

    def test_11_financial_reconciliation_contract(self):
        """Verifies financial reconciliation guarantee: gross = allocated + unallocated."""
        if not self.sample_cur_data:
            self.skipTest("Sample CUR not found")

        dates = self.sample_cur_data['dates']
        res = analyze_cost_root_cause(
            self.sample_cur_data,
            baseline_start=dates[0],
            baseline_end=dates[1],
            target_start=dates[2],
            target_end=dates[3]
        )
        self.assertIn('financial_reconciliation', res)
        recon = res['financial_reconciliation']
        self.assertTrue(recon['is_reconciled'])
        self.assertAlmostEqual(
            recon['gross_target_cost'],
            recon['allocated_target_cost'] + recon['unallocated_target_cost'],
            places=2
        )

    def test_12_single_period_mode_handling(self):
        """Verifies single-period mode without baseline does not throw ZeroDivisionError."""
        if not self.sample_cur_data:
            self.skipTest("Sample CUR not found")

        res = analyze_cost_root_cause(
            self.sample_cur_data,
            baseline_start="",
            baseline_end="",
            target_start="2026-10-05",
            target_end="2026-10-07"
        )
        self.assertEqual(res['status'], 'SUCCESS')
        self.assertEqual(res['comparison_window']['baseline']['total_cost'], 0.0)
        self.assertGreater(res['comparison_window']['target']['total_cost'], 0.0)
        self.assertEqual(res['variance_summary']['net_delta'], res['comparison_window']['target']['total_cost'])

    def test_13_daily_timeline_peaks_troughs_spikes(self):
        """Verifies daily timeline contains peaks, troughs, and anomaly spikes/drops."""
        if not self.sample_cur_data:
            self.skipTest("Sample CUR not found")

        dates = self.sample_cur_data['dates']
        res = analyze_cost_root_cause(
            self.sample_cur_data,
            baseline_start=dates[0],
            baseline_end=dates[3],
            target_start=dates[4],
            target_end=dates[7]
        )
        self.assertIn('daily_timeline', res)
        self.assertIn('peak_spend_day', res)
        self.assertIn('trough_spend_day', res)
        self.assertIn('daily_spikes', res)
        self.assertIn('daily_drops', res)
        
        timeline = res['daily_timeline']
        self.assertGreater(len(timeline), 0)
        
        # Verify peak spend day is flagged in timeline
        peak_day = res['peak_spend_day']['date']
        peak_items = [item for item in timeline if item['date'] == peak_day]
        self.assertEqual(len(peak_items), 1)
        self.assertTrue(peak_items[0]['is_peak'])

    def test_14_data_completeness_diagnostics(self):
        """Verifies CUR data completeness diagnostics and partial day indicators."""
        if not self.sample_cur_data:
            self.skipTest("Sample CUR not found")

        res = analyze_cost_root_cause(
            self.sample_cur_data,
            baseline_start="2026-10-01",
            baseline_end="2026-10-01",
            target_start="2026-10-13",
            target_end="2026-10-13"
        )
        self.assertIn('data_completeness', res)
        diag = res['data_completeness']
        self.assertEqual(diag['earliest_ingested_date'], "2026-10-01")
        self.assertEqual(diag['latest_ingested_date'], "2026-10-13")
        self.assertIsInstance(diag['is_partial_latest_day'], bool)

    def test_15_sampled_line_items_per_resource(self):
        """Verifies top resources contain sampled raw CUR line items for forensic audit."""
        if not self.sample_cur_data:
            self.skipTest("Sample CUR not found")

        res = analyze_cost_root_cause(
            self.sample_cur_data,
            baseline_start="2026-10-02",
            baseline_end="2026-10-02",
            target_start="2026-10-03",
            target_end="2026-10-03"
        )
        top_res = res['resources'][0]
        self.assertIn('line_items_sample', top_res)
        self.assertIsInstance(top_res['line_items_sample'], list)
        self.assertGreater(len(top_res['line_items_sample']), 0)
        self.assertLessEqual(len(top_res['line_items_sample']), 20)
        first_item = top_res['line_items_sample'][0]
        self.assertIn('cost', first_item)
        self.assertIn('usage_type', first_item)
        self.assertIn('date', first_item)


if __name__ == '__main__':
    unittest.main()
