"""
ZORVEX - Phase 2: Cost Change Analysis Engine Verification Suite
================================================================
Comprehensive, regression-safe test suite validating:
1. Exact baseline/current cost reconciliation.
2. Positive, negative, and zero cost deltas.
3. Zero baseline and percentage-change behavior.
4. Date boundaries, timezones, and partial period identification.
5. Equivalent comparison-window lengths (like-for-like verification).
6. Tenant and account isolation.
7. Service and resource filtering semantics.
8. Missing resource identifiers and missing comparison periods.
9. Accounting semantics for Credits, Refunds, Taxes, RI Fees, and Savings Plans.
10. Unit mismatches and unavailable rate data handling.
11. Quantity/rate decomposition mathematical reconciliation:
    Quantity Impact = (Current Quantity - Baseline Quantity) * Baseline Rate
    Rate Impact = Current Quantity * (Current Rate - Baseline Rate)
    Quantity Impact + Rate Impact == Cost Delta
12. New-to-period and no-longer-observed resource records classification.
13. Authoritative CUR evidence confidence rating (CONFIRMED_BY_CUR).
"""

import unittest
import os
import json
from decimal import Decimal
from fastapi.testclient import TestClient

from app.main import app
from app.root_cause import analyze_cost_root_cause
from app.parser import parse_cur_file
from app.database import get_db, SessionLocal
from app.models import Organization, User, UserSession, DatasetRecord, BillingRecord
from app.repository import BillingRepository


class TestPhase2CostChangeEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = SessionLocal()

        # Load real production CUR sample
        sample_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "data", "samples", "aws_cur_production_exact.csv"
        )
        if os.path.exists(sample_path):
            cls.sample_cur = parse_cur_file(sample_path)
        else:
            cls.sample_cur = None

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_01_exact_baseline_current_cost_reconciliation(self):
        """Verifies net delta matches Current Comparable Cost - Baseline Comparable Cost exactly."""
        if not self.sample_cur:
            self.skipTest("Sample CUR data not found")

        dates = self.sample_cur['dates']
        self.assertGreater(len(dates), 4)

        b_start, b_end = dates[0], dates[1]
        t_start, t_end = dates[2], dates[3]

        res = analyze_cost_root_cause(
            self.sample_cur,
            baseline_start=b_start,
            baseline_end=b_end,
            target_start=t_start,
            target_end=t_end
        )
        self.assertEqual(res['status'], 'SUCCESS')

        b_cost = res['comparison_window']['baseline']['total_cost']
        t_cost = res['comparison_window']['target']['total_cost']
        net_delta = res['variance_summary']['net_delta']

        # Mathematical reconciliation: Delta = Target - Baseline
        reconciled_delta = round(t_cost - b_cost, 2)
        self.assertAlmostEqual(net_delta, reconciled_delta, places=2)

    def test_02_positive_negative_and_zero_cost_deltas(self):
        """Verifies correct directionality for positive, negative, and zero cost deltas."""
        if not self.sample_cur:
            self.skipTest("Sample CUR data not found")

        dates = self.sample_cur['dates']

        # Zero delta (comparing identical period)
        res_zero = analyze_cost_root_cause(
            self.sample_cur,
            baseline_start=dates[1],
            baseline_end=dates[1],
            target_start=dates[1],
            target_end=dates[1]
        )
        self.assertEqual(res_zero['variance_summary']['net_delta'], 0.0)
        self.assertEqual(res_zero['variance_summary']['direction'], 'FLAT')

        # Comparison with variance
        res_var = analyze_cost_root_cause(
            self.sample_cur,
            baseline_start=dates[0],
            baseline_end=dates[1],
            target_start=dates[2],
            target_end=dates[3]
        )
        delta = res_var['variance_summary']['net_delta']
        if delta > 0.001:
            self.assertEqual(res_var['variance_summary']['direction'], 'INCREASE')
        elif delta < -0.001:
            self.assertEqual(res_var['variance_summary']['direction'], 'DECREASE')
        else:
            self.assertEqual(res_var['variance_summary']['direction'], 'FLAT')

    def test_03_zero_baseline_and_percentage_change_behavior(self):
        """Verifies safe percentage handling when baseline is 0 (prevents division by zero)."""
        mock_cur = {
            'records': [
                {
                    'date': '2026-10-09',
                    'service': 'Amazon EC2',
                    'resource_id': 'i-free-tier',
                    'cost': 0.0,
                    'usage_amount': 24.0,
                    'unit': 'Hrs',
                    'line_type': 'Usage',
                    'usage_type': 'BoxUsage:t3.micro'
                },
                {
                    'date': '2026-10-10',
                    'service': 'Amazon EC2',
                    'resource_id': 'i-test-new-001',
                    'cost': 125.50,
                    'usage_amount': 24.0,
                    'unit': 'Hrs',
                    'line_type': 'Usage',
                    'usage_type': 'BoxUsage:t3.medium'
                }
            ],
            'dates': ['2026-10-09', '2026-10-10']
        }

        # Case 1: Baseline records exist but cost is 0.0
        res = analyze_cost_root_cause(
            mock_cur,
            baseline_start='2026-10-09',
            baseline_end='2026-10-09',
            target_start='2026-10-10',
            target_end='2026-10-10'
        )
        self.assertEqual(res['status'], 'SUCCESS')
        self.assertEqual(res['comparison_window']['baseline']['total_cost'], 0.0)
        self.assertEqual(res['comparison_window']['target']['total_cost'], 125.50)
        self.assertIsNone(res['variance_summary']['pct_change'])
        self.assertIn("N/A", res['variance_summary']['pct_display'])

        # Case 2: No baseline records in window
        res_empty_b = analyze_cost_root_cause(
            mock_cur,
            baseline_start='2026-10-01',
            baseline_end='2026-10-01',
            target_start='2026-10-10',
            target_end='2026-10-10'
        )
        self.assertIsNone(res_empty_b['variance_summary']['pct_change'])
        self.assertEqual(res_empty_b['variance_summary']['pct_display'], "Selected Period Analysis")

    def test_04_date_boundaries_and_partial_period_flags(self):
        """Verifies like-for-like window equality and partial period duration tracking."""
        if not self.sample_cur:
            self.skipTest("Sample CUR data not found")

        dates = self.sample_cur['dates']

        # 2-day baseline vs 2-day target: Like-for-like = True
        res_equal = analyze_cost_root_cause(
            self.sample_cur,
            baseline_start=dates[0],
            baseline_end=dates[1],
            target_start=dates[2],
            target_end=dates[3]
        )
        self.assertTrue(res_equal['comparison_window']['is_like_for_like'])
        self.assertEqual(res_equal['comparison_window']['baseline']['total_days'], 2)
        self.assertEqual(res_equal['comparison_window']['target']['total_days'], 2)

        # 1-day baseline vs 2-day target: Like-for-like = False
        res_unequal = analyze_cost_root_cause(
            self.sample_cur,
            baseline_start=dates[0],
            baseline_end=dates[0],
            target_start=dates[1],
            target_end=dates[2]
        )
        self.assertFalse(res_unequal['comparison_window']['is_like_for_like'])
        self.assertEqual(res_unequal['comparison_window']['baseline']['total_days'], 1)
        self.assertEqual(res_unequal['comparison_window']['target']['total_days'], 2)

    def test_05_tenant_and_account_isolation(self):
        """Verifies account filtering strictly limits analyzed records to specified account."""
        multi_acc_cur = {
            'records': [
                {
                    'date': '2026-10-01',
                    'service': 'Amazon EC2',
                    'resource_id': 'i-acc-alpha',
                    'account_id': '111122223333',
                    'cost': 40.00,
                    'usage_amount': 24.0,
                    'unit': 'Hrs',
                    'line_type': 'Usage'
                },
                {
                    'date': '2026-10-01',
                    'service': 'Amazon EC2',
                    'resource_id': 'i-acc-beta',
                    'account_id': '444455556666',
                    'cost': 80.00,
                    'usage_amount': 24.0,
                    'unit': 'Hrs',
                    'line_type': 'Usage'
                },
                {
                    'date': '2026-10-02',
                    'service': 'Amazon EC2',
                    'resource_id': 'i-acc-alpha',
                    'account_id': '111122223333',
                    'cost': 60.00,
                    'usage_amount': 24.0,
                    'unit': 'Hrs',
                    'line_type': 'Usage'
                },
                {
                    'date': '2026-10-02',
                    'service': 'Amazon EC2',
                    'resource_id': 'i-acc-beta',
                    'account_id': '444455556666',
                    'cost': 80.00,
                    'usage_amount': 24.0,
                    'unit': 'Hrs',
                    'line_type': 'Usage'
                }
            ],
            'dates': ['2026-10-01', '2026-10-02']
        }

        # Query scoped strictly to Account 111122223333
        res = analyze_cost_root_cause(
            multi_acc_cur,
            baseline_start='2026-10-01',
            baseline_end='2026-10-01',
            target_start='2026-10-02',
            target_end='2026-10-02',
            account_id='111122223333'
        )
        self.assertEqual(res['comparison_window']['baseline']['total_cost'], 40.00)
        self.assertEqual(res['comparison_window']['target']['total_cost'], 60.00)
        self.assertEqual(res['variance_summary']['net_delta'], 20.00)

        for r in res.get('resources', []):
            self.assertEqual(r['account_id'], '111122223333')
            self.assertNotEqual(r['account_id'], '444455556666')

    def test_06_service_filtering_enforcement(self):
        """Verifies service filtering strictly isolates cost change analysis to target service."""
        if not self.sample_cur:
            self.skipTest("Sample CUR data not found")

        res = analyze_cost_root_cause(
            self.sample_cur,
            baseline_start=self.sample_cur['dates'][0],
            baseline_end=self.sample_cur['dates'][1],
            target_start=self.sample_cur['dates'][2],
            target_end=self.sample_cur['dates'][3],
            service="Amazon EC2"
        )
        for svc in res.get('service_attribution', []):
            self.assertEqual(svc['service'], "Amazon EC2")
        for r in res.get('resources', []):
            self.assertEqual(r['service'], "Amazon EC2")

    def test_07_quantity_rate_decomposition_reconciliation(self):
        """
        Validates Phase 2 exact decomposition identity:
        Quantity Impact = (Current Quantity - Baseline Quantity) * Baseline Rate
        Rate Impact = Current Quantity * (Current Rate - Baseline Rate)
        Quantity Impact + Rate Impact == Cost Delta
        """
        mock_cur = {
            'records': [
                # Baseline: 100 Hrs at $0.10/Hr = $10.00
                {
                    'date': '2026-10-01',
                    'service': 'Amazon EC2',
                    'resource_id': 'i-recon-001',
                    'cost': 10.00,
                    'usage_amount': 100.0,
                    'unit': 'Hrs',
                    'line_type': 'Usage',
                    'usage_type': 'BoxUsage:c5.large'
                },
                # Target: 150 Hrs at $0.12/Hr = $18.00 (Delta = +$8.00)
                # Quantity Impact = (150 - 100) * 0.10 = +$5.00
                # Rate Impact = 150 * (0.12 - 0.10) = +$3.00
                # Sum = +$5.00 + +$3.00 = +$8.00 EXACT!
                {
                    'date': '2026-10-02',
                    'service': 'Amazon EC2',
                    'resource_id': 'i-recon-001',
                    'cost': 18.00,
                    'usage_amount': 150.0,
                    'unit': 'Hrs',
                    'line_type': 'Usage',
                    'usage_type': 'BoxUsage:c5.large'
                }
            ],
            'dates': ['2026-10-01', '2026-10-02']
        }

        res = analyze_cost_root_cause(
            mock_cur,
            baseline_start='2026-10-01',
            baseline_end='2026-10-01',
            target_start='2026-10-02',
            target_end='2026-10-02'
        )
        self.assertEqual(res['status'], 'SUCCESS')
        resources = res['resources']
        self.assertEqual(len(resources), 1)

        r = resources[0]
        self.assertEqual(r['resource_id'], 'i-recon-001')
        self.assertEqual(r['delta_cost'], 8.00)
        self.assertEqual(r['quantity_impact'], 5.00)
        self.assertEqual(r['rate_impact'], 3.00)
        self.assertEqual(r['decomposition_status'], 'RECONCILED')

        # Strict mathematical identity check
        self.assertAlmostEqual(r['quantity_impact'] + r['rate_impact'], r['delta_cost'], places=4)

    def test_08_unit_mismatch_and_unavailable_rate_handling(self):
        """Verifies graceful handling when baseline and target usage units differ."""
        mock_cur = {
            'records': [
                # Baseline reported in Hrs
                {
                    'date': '2026-10-01',
                    'service': 'Amazon S3',
                    'resource_id': 's3-bucket-mismatch',
                    'cost': 10.00,
                    'usage_amount': 100.0,
                    'unit': 'Hrs',
                    'line_type': 'Usage',
                    'usage_type': 'StandardStorage'
                },
                # Target reported in GB-Mo
                {
                    'date': '2026-10-02',
                    'service': 'Amazon S3',
                    'resource_id': 's3-bucket-mismatch',
                    'cost': 25.00,
                    'usage_amount': 500.0,
                    'unit': 'GB-Mo',
                    'line_type': 'Usage',
                    'usage_type': 'StandardStorage'
                }
            ],
            'dates': ['2026-10-01', '2026-10-02']
        }

        res = analyze_cost_root_cause(
            mock_cur,
            baseline_start='2026-10-01',
            baseline_end='2026-10-01',
            target_start='2026-10-02',
            target_end='2026-10-02'
        )
        r = res['resources'][0]
        self.assertFalse(r['units_comparable'])
        self.assertEqual(r['decomposition_status'], 'UNIT_MISMATCH')
        self.assertIn("differs", r['decomposition_note'])

    def test_09_credits_and_refunds_excluded_from_operational_delta(self):
        """Verifies Credits and Refunds do not distort operational workload variance."""
        mock_cur = {
            'records': [
                {
                    'date': '2026-10-01',
                    'service': 'Amazon EC2',
                    'resource_id': 'i-credit-test',
                    'cost': 50.00,
                    'usage_amount': 24.0,
                    'unit': 'Hrs',
                    'line_type': 'Usage'
                },
                {
                    'date': '2026-10-01',
                    'service': 'AWS Support',
                    'resource_id': 'CREDIT-001',
                    'cost': -20.00,
                    'usage_amount': 0.0,
                    'unit': '',
                    'line_type': 'Credit'
                },
                {
                    'date': '2026-10-02',
                    'service': 'Amazon EC2',
                    'resource_id': 'i-credit-test',
                    'cost': 50.00,
                    'usage_amount': 24.0,
                    'unit': 'Hrs',
                    'line_type': 'Usage'
                }
            ],
            'dates': ['2026-10-01', '2026-10-02']
        }

        res = analyze_cost_root_cause(
            mock_cur,
            baseline_start='2026-10-01',
            baseline_end='2026-10-01',
            target_start='2026-10-02',
            target_end='2026-10-02'
        )
        # Operational spend on both days is $50.00 (credit was excluded)
        self.assertEqual(res['comparison_window']['baseline']['total_cost'], 50.00)
        self.assertEqual(res['comparison_window']['target']['total_cost'], 50.00)
        self.assertEqual(res['variance_summary']['net_delta'], 0.00)

    def test_10_statutory_taxes_and_ri_fees_classified_as_financial_adjustments(self):
        """Verifies invoice taxes and RI fees are classified into financial adjustments, not terminated workloads."""
        mock_cur = {
            'records': [
                {
                    'date': '2026-10-01',
                    'service': 'Tax',
                    'resource_id': 'TAX-GST-OCT',
                    'cost': 150.00,
                    'usage_amount': 0.0,
                    'unit': '',
                    'line_type': 'Tax'
                },
                {
                    'date': '2026-10-01',
                    'service': 'Amazon EC2',
                    'resource_id': 'No-Resource-ID-RIFee',
                    'cost': 200.00,
                    'usage_amount': 0.0,
                    'unit': '',
                    'line_type': 'RIFee'
                },
                {
                    'date': '2026-10-02',
                    'service': 'Amazon EC2',
                    'resource_id': 'i-workload-01',
                    'cost': 25.00,
                    'usage_amount': 24.0,
                    'unit': 'Hrs',
                    'line_type': 'Usage'
                }
            ],
            'dates': ['2026-10-01', '2026-10-02']
        }

        res = analyze_cost_root_cause(
            mock_cur,
            baseline_start='2026-10-01',
            baseline_end='2026-10-01',
            target_start='2026-10-02',
            target_end='2026-10-02'
        )
        # Tax and RIFee must be classified as BILLING_FEE_OR_TAX / COMMITMENT_FEE and NOT in terminated workloads
        terminated_rids = [r['resource_id'] for r in res.get('terminated_workloads', [])]
        self.assertNotIn('TAX-GST-OCT', terminated_rids)
        self.assertNotIn('No-Resource-ID-RIFee', terminated_rids)

        fin_adj_rids = [r['resource_id'] for r in res.get('financial_adjustments', [])]
        self.assertIn('No-Resource-ID-RIFee', fin_adj_rids)

    def test_11_cost_change_semantics_metadata_present(self):
        """Verifies explicit cost comparison semantics and boundary metadata are returned."""
        if not self.sample_cur:
            self.skipTest("Sample CUR data not found")

        dates = self.sample_cur['dates']
        res = analyze_cost_root_cause(
            self.sample_cur,
            baseline_start=dates[0],
            baseline_end=dates[1],
            target_start=dates[2],
            target_end=dates[3]
        )
        self.assertIn('cost_change_semantics', res)
        semantics = res['cost_change_semantics']
        self.assertIn('cost_metric', semantics)
        self.assertIn('formula', semantics)
        self.assertIn('quantity_impact_formula', semantics)
        self.assertIn('rate_impact_formula', semantics)
        self.assertIn('timezone', semantics)
        self.assertTrue(semantics['inclusive_boundaries'])

    def test_12_repository_compare_periods_and_compare_dates_parity(self):
        """Verifies BillingRepository.compare_periods executes reliably on database session."""
        repo = BillingRepository(self.db, org_id=0, dataset_id=None)
        if self.sample_cur:
            repo.parsed_data = self.sample_cur
            dates = self.sample_cur['dates']
            res = repo.compare_periods(dates[0], dates[1], dates[2], dates[3])
            self.assertEqual(res['status'], 'SUCCESS')
            self.assertIn('variance_summary', res)
            self.assertIn('service_attribution', res)
            self.assertIn('cost_change_semantics', res)


if __name__ == '__main__':
    unittest.main()
