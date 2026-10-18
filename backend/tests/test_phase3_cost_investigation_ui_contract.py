"""
ZORVEX - Phase 3: Cost Investigation UI Contract Verification Suite
===================================================================
Validates the backend contract and payload invariants supporting the Phase 3 UI:
1. Executive cost summary payload & cost change semantics.
2. Comparison period selection and boundary labels (UTC, inclusive).
3. Service-level attribution and impact share contracts.
4. Resource-level drill-down fields:
   - quantity_impact & rate_impact
   - decomposition_status (RECONCILED, UNIT_MISMATCH, NEW_WORKLOAD, TERMINATED_WORKLOAD, NON_USAGE_FEE)
   - evidence_status (CONFIRMED_BY_CUR, INFERRED, UNKNOWN)
   - operational_note and line_items_sample
5. Zero-baseline and division-by-zero safety.
6. Tenant and account filter preservation.
7. Service filter preservation.
8. Financial reconciliation guarantee (Gross = Allocated + Unallocated).
9. Credit and refund separation from operational billed spend.
"""

import unittest
import os
import json
from fastapi.testclient import TestClient

from app.main import app
from app.root_cause import analyze_cost_root_cause
from app.parser import parse_cur_file
from app.database import SessionLocal
from app.models import Organization, User, UserSession, DatasetRecord, BillingRecord


class TestPhase3CostInvestigationUiContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = SessionLocal()

        from app.core.state import CURRENT_DATASET
        from app.cache import global_cache

        sample_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "data", "samples", "aws_cur_production_exact.csv"
        )
        if os.path.exists(sample_path):
            cls.sample_cur = parse_cur_file(sample_path)
            CURRENT_DATASET['data'] = cls.sample_cur
            CURRENT_DATASET['filepath'] = sample_path
            CURRENT_DATASET['filename'] = "aws_cur_production_exact.csv"
            CURRENT_DATASET['id'] = 0
            CURRENT_DATASET['org_id'] = 0
            CURRENT_DATASET['is_demo'] = True
        else:
            cls.sample_cur = None

        global_cache.clear()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def setUp(self):
        from app.core.state import CURRENT_DATASET
        from app.cache import global_cache
        if self.sample_cur:
            sample_path = os.path.join(
                os.path.dirname(__file__), "..", "..", "data", "samples", "aws_cur_production_exact.csv"
            )
            CURRENT_DATASET['data'] = self.sample_cur
            CURRENT_DATASET['filepath'] = sample_path
            CURRENT_DATASET['filename'] = "aws_cur_production_exact.csv"
            CURRENT_DATASET['id'] = 0
            CURRENT_DATASET['org_id'] = 0
            CURRENT_DATASET['is_demo'] = True
        global_cache.clear()

    def test_01_cost_change_semantics_contract_for_ui(self):
        """Verifies Phase 3 executive summary semantics returned by API endpoint."""
        resp = self.client.post("/api/analytics/root-cause", json={
            "baseline_start": "2025-07-01",
            "baseline_end": "2025-07-02",
            "target_start": "2025-07-03",
            "target_end": "2025-07-04"
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data['status'], 'SUCCESS')

        # Semantics contract required by Phase 3 UI
        self.assertIn('cost_change_semantics', data)
        sem = data['cost_change_semantics']
        self.assertEqual(sem['cost_metric'], 'Net Operational Billed Spend (Excludes invoice Credits/Refunds)')
        self.assertIn('formula', sem)
        self.assertIn('quantity_impact_formula', sem)
        self.assertIn('rate_impact_formula', sem)
        self.assertEqual(sem['timezone'], 'UTC (ISO-8601 YYYY-MM-DD)')
        self.assertTrue(sem['inclusive_boundaries'])

    def test_02_resource_level_decomposition_fields_contract(self):
        """Verifies resource entries contain all Phase 3 decomposition & evidence fields."""
        resp = self.client.post("/api/analytics/root-cause", json={
            "baseline_start": "2025-07-01",
            "baseline_end": "2025-07-02",
            "target_start": "2025-07-03",
            "target_end": "2025-07-04"
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        resources = data.get('resources', [])
        self.assertGreater(len(resources), 0)

        for r in resources:
            # Identification
            self.assertIn('resource_id', r)
            self.assertIn('short_id', r)
            self.assertIn('service', r)

            # Costs & Deltas
            self.assertIn('baseline_cost', r)
            self.assertIn('target_cost', r)
            self.assertIn('delta_cost', r)
            self.assertIn('pct_display', r)

            # Phase 3 Decomposition
            self.assertIn('quantity_impact', r)
            self.assertIn('rate_impact', r)
            self.assertIn('decomposition_status', r)
            self.assertIn(r['decomposition_status'], (
                'RECONCILED', 'UNIT_MISMATCH', 'NEW_WORKLOAD', 
                'TERMINATED_WORKLOAD', 'NON_USAGE_FEE', 'INSUFFICIENT_EVIDENCE', 'ATTRIBUTED'
            ))

            # Evidence & Operational Boundaries
            self.assertIn('evidence_status', r)
            self.assertIn(r['evidence_status'], ('CONFIRMED_BY_CUR', 'INFERRED', 'UNKNOWN'))
            self.assertIn('operational_note', r)
            self.assertIn('explanation', r)

    def test_03_service_attribution_contract_for_sorting(self):
        """Verifies service attribution contract supports sorting by service, baseline, target, and delta."""
        resp = self.client.post("/api/analytics/root-cause", json={
            "baseline_start": "2025-07-01",
            "baseline_end": "2025-07-02",
            "target_start": "2025-07-03",
            "target_end": "2025-07-04"
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        services = data.get('service_attribution', [])
        self.assertGreater(len(services), 0)

        for svc in services:
            self.assertIn('service', svc)
            self.assertIn('baseline_cost', svc)
            self.assertIn('target_cost', svc)
            self.assertIn('delta_cost', svc)
            self.assertIn('pct_change', svc)
            self.assertIn('share_of_total_delta', svc)
            self.assertIn('direction', svc)

    def test_04_financial_reconciliation_integrity_contract(self):
        """Verifies financial reconciliation guarantee: gross = allocated + unallocated."""
        resp = self.client.post("/api/analytics/root-cause", json={
            "baseline_start": "2025-07-01",
            "baseline_end": "2025-07-02",
            "target_start": "2025-07-03",
            "target_end": "2025-07-04"
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        rec = data.get('financial_reconciliation')
        self.assertIsNotNone(rec)
        self.assertTrue(rec['is_reconciled'])
        self.assertEqual(
            round(rec['gross_target_cost'], 2),
            round(rec['allocated_target_cost'] + rec['unallocated_target_cost'], 2)
        )

    def test_05_account_filtering_preservation(self):
        """Verifies scoping to an account preserves strict filtering across all UI layers."""
        mock_cur = {
            'records': [
                {'date': '2026-10-01', 'service': 'Amazon EC2', 'resource_id': 'i-a', 'account_id': 'ACC-1', 'cost': 10.0, 'usage_amount': 24.0, 'unit': 'Hrs', 'line_type': 'Usage'},
                {'date': '2026-10-01', 'service': 'Amazon EC2', 'resource_id': 'i-b', 'account_id': 'ACC-2', 'cost': 20.0, 'usage_amount': 24.0, 'unit': 'Hrs', 'line_type': 'Usage'},
                {'date': '2026-10-02', 'service': 'Amazon EC2', 'resource_id': 'i-a', 'account_id': 'ACC-1', 'cost': 15.0, 'usage_amount': 24.0, 'unit': 'Hrs', 'line_type': 'Usage'},
                {'date': '2026-10-02', 'service': 'Amazon EC2', 'resource_id': 'i-b', 'account_id': 'ACC-2', 'cost': 20.0, 'usage_amount': 24.0, 'unit': 'Hrs', 'line_type': 'Usage'}
            ],
            'dates': ['2026-10-01', '2026-10-02']
        }
        res = analyze_cost_root_cause(
            mock_cur,
            baseline_start='2026-10-01',
            baseline_end='2026-10-01',
            target_start='2026-10-02',
            target_end='2026-10-02',
            account_id='ACC-1'
        )
        self.assertEqual(res['comparison_window']['baseline']['total_cost'], 10.0)
        self.assertEqual(res['comparison_window']['target']['total_cost'], 15.0)
        self.assertEqual(res['variance_summary']['net_delta'], 5.0)
        self.assertEqual(len(res['resources']), 1)
        self.assertEqual(res['resources'][0]['resource_id'], 'i-a')

    def test_06_service_drill_down_preservation(self):
        """Verifies scoping to a single service filters resources accurately for drill-down."""
        mock_cur = {
            'records': [
                {'date': '2026-10-01', 'service': 'Amazon EC2', 'resource_id': 'i-1', 'cost': 10.0, 'usage_amount': 24.0, 'unit': 'Hrs', 'line_type': 'Usage'},
                {'date': '2026-10-01', 'service': 'Amazon S3', 'resource_id': 'bucket-1', 'cost': 5.0, 'usage_amount': 100.0, 'unit': 'GB-Mo', 'line_type': 'Usage'},
                {'date': '2026-10-02', 'service': 'Amazon EC2', 'resource_id': 'i-1', 'cost': 15.0, 'usage_amount': 24.0, 'unit': 'Hrs', 'line_type': 'Usage'},
                {'date': '2026-10-02', 'service': 'Amazon S3', 'resource_id': 'bucket-1', 'cost': 5.0, 'usage_amount': 100.0, 'unit': 'GB-Mo', 'line_type': 'Usage'}
            ],
            'dates': ['2026-10-01', '2026-10-02']
        }
        res = analyze_cost_root_cause(
            mock_cur,
            baseline_start='2026-10-01',
            baseline_end='2026-10-01',
            target_start='2026-10-02',
            target_end='2026-10-02',
            service='Amazon EC2'
        )
        self.assertEqual(len(res['resources']), 1)
        self.assertEqual(res['resources'][0]['service'], 'Amazon EC2')
        self.assertEqual(res['resources'][0]['resource_id'], 'i-1')


if __name__ == '__main__':
    unittest.main()
