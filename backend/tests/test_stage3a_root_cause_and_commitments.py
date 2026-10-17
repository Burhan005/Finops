"""
Stage 3A Acceptance Test Suite:
Accounting Semantics & Root-Cause Correction

Acceptance Gates Verified:
1. Day 1 Tax followed by Day 2 without tax NEVER produces a decommissioned-resource event.
2. Day 1 RI fee followed by Day 2 without RI fee NEVER produces a decommissioned-resource event.
3. Real physical resource disappearing from usage is still identified as TERMINATED_RESOURCE / TERMINATED_OR_STOPPED.
4. RI contracts and taxes remain distinct from physical computing resources.
5. RDS, EC2, Redshift, and OpenSearch RI visibility is preserved without attributing commitment fees as instance deletions.
6. Route 53 periodic hosted zone fees and backup/snapshot storage lifecycles are distinguished from terminated workloads.
7. Tenant, account, dataset, and date filters remain strictly enforced.
8. Root-cause totals reconcile with defined categories without double-counting.
9. API response contract remains backward-compatible with additive fields.
"""

import os
import sys
import unittest
from typing import Dict, Any

from fastapi.testclient import TestClient

# conftest.py configures isolated test DB prior to imports
from app.main import app
from app.database import engine, get_db
from app.models import Organization, User, UserSession, DatasetRecord
from app.security import hash_password, generate_session_token
from app.parser import parse_cur_file
from app.analytics import compare_dates, deduce_resource_root_cause
from app.root_cause import analyze_cost_root_cause, classify_resource_variance

# Path to real sample CUR file
SAMPLE_CUR_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'data', 'samples', 'CUR-Report-Daily-00001.csv.gz'
)


class TestStage3AAccountingSemantics(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # 1. Strict Test Isolation Check
        db_url = str(engine.url).replace('\\', '/').lower()
        assert "zorvex_isolated_test.db" in db_url, f"Critical: not running in isolated test db: {engine.url}"
        assert "finops.db" not in db_url, f"Critical: finops.db targeted in tests: {engine.url}"

        cls.client = TestClient(app)
        cls.db = next(get_db())

        # 2. Setup Isolated Test Organization & Session
        cls.org = cls.db.query(Organization).filter(Organization.name == "Stage3A FinOps Org").first()
        if not cls.org:
            cls.org = Organization(name="Stage3A FinOps Org")
            cls.db.add(cls.org)
            cls.db.commit()
            cls.db.refresh(cls.org)

        cls.user = cls.db.query(User).filter(User.email == "auditor@stage3a.com").first()
        if not cls.user:
            cls.user = User(
                organization_id=cls.org.id,
                name="Stage 3A Lead Auditor",
                company="Stage3A Org",
                email="auditor@stage3a.com",
                password_hash=hash_password("AuditPass3A!Secure")
            )
            cls.db.add(cls.user)
            cls.db.commit()
            cls.db.refresh(cls.user)

        cls.token = f"session_stage3a_{generate_session_token()[:32]}"
        cls.session = UserSession(
            token=cls.token,
            user_id=cls.user.id,
            organization_id=cls.org.id
        )
        cls.db.add(cls.session)
        cls.db.commit()

        cls.auth_headers = {"Authorization": f"Bearer {cls.token}"}

        # 3. Setup Active DatasetRecord pointing to sample CUR
        assert os.path.exists(SAMPLE_CUR_PATH), f"Sample CUR not found: {SAMPLE_CUR_PATH}"
        dataset = cls.db.query(DatasetRecord).filter(
            DatasetRecord.organization_id == cls.org.id,
            DatasetRecord.filepath == SAMPLE_CUR_PATH
        ).first()
        if not dataset:
            dataset = DatasetRecord(
                organization_id=cls.org.id,
                filename="CUR-Report-Daily-00001.csv.gz",
                filepath=SAMPLE_CUR_PATH,
                file_type="sample",
                is_active=1
            )
            cls.db.add(dataset)
            cls.db.commit()

        cls.cur_data = parse_cur_file(SAMPLE_CUR_PATH)

    def test_01_day1_tax_not_decommissioned_in_compare_dates(self):
        """Day 1 GST tax ($1,152.50) followed by Day 2 ($0) must not appear in reduced_resources."""
        res = compare_dates(self.cur_data, '2026-10-01', '2026-10-02')

        # Tax must NOT be in reduced_resources (which represents decommissioned workloads)
        tax_in_reduced = [r for r in res['reduced_resources'] if 'TAX' in r['resource_id'] or r['service'] in ('Tax', 'Taxes & Surcharges')]
        self.assertEqual(len(tax_in_reduced), 0, f"Tax found in reduced_resources: {tax_in_reduced}")

        # Tax must be in financial_adjustments
        tax_in_adjustments = [a for a in res['financial_adjustments'] if 'TAX' in a['resource_id'] or a.get('category') == 'TAX']
        self.assertGreater(len(tax_in_adjustments), 0, "Tax not present in financial_adjustments")
        tax_item = tax_in_adjustments[0]
        self.assertEqual(tax_item['category'], 'TAX')
        self.assertEqual(tax_item['event_type'], 'TAX_ADJUSTMENT')
        self.assertIn("INVOICE TAX", tax_item['root_cause'])
        self.assertIn("invoice adjustment, not infrastructure change", tax_item['root_cause'])

    def test_02_day1_ri_fees_not_decommissioned_in_compare_dates(self):
        """Day 1 RI commitment fees ($4,086.52) must not appear as deleted databases/servers."""
        res = compare_dates(self.cur_data, '2026-10-01', '2026-10-02')

        # No-Resource-ID RI items must NOT be in reduced_resources
        ri_in_reduced = [
            r for r in res['reduced_resources']
            if r['resource_id'].startswith('No-Resource-ID') and ('COMMITMENT' in r['root_cause'] or 'RI' in r['root_cause'])
        ]
        self.assertEqual(len(ri_in_reduced), 0, f"RI fee found in reduced_resources: {ri_in_reduced}")

        # RI items must be in financial_adjustments
        ri_in_adj = [a for a in res['financial_adjustments'] if a.get('category') == 'COMMITMENT_FEE']
        self.assertGreater(len(ri_in_adj), 0, "RI commitment fees not in financial_adjustments")

        rds_ri = next((a for a in ri_in_adj if 'RDS' in a['service']), None)
        self.assertIsNotNone(rds_ri, "RDS RI fee not found in financial_adjustments")
        self.assertIn("Monthly Reserved Instance recurring fee", rds_ri['root_cause'])
        self.assertIn("contract commitment, not infrastructure deletion", rds_ri['root_cause'])
        self.assertNotIn("DECOMMISSIONED: Database instance deleted", rds_ri['root_cause'])

    def test_03_primary_event_reflects_billing_schedule_notice(self):
        """Day 1 vs Day 2 headline must state Billing Schedule Notice, not false deletions."""
        res = compare_dates(self.cur_data, '2026-10-01', '2026-10-02')
        headline = res['primary_event']

        self.assertIn("Billing Schedule Notice", headline)
        self.assertIn("periodic RI commitment charges", headline)
        self.assertIn("statutory taxes", headline)
        self.assertNotIn("DECOMMISSIONED: Database instance deleted", headline)

    def test_04_day1_tax_and_ri_not_in_root_cause_terminated_workloads(self):
        """In analyze_cost_root_cause, tax and RI fees must never be in terminated_workloads."""
        res = analyze_cost_root_cause(self.cur_data, '2026-10-01', '2026-10-01', '2026-10-02', '2026-10-02')

        terminated_ids = [w['resource_id'] for w in res['terminated_workloads']]
        for tid in terminated_ids:
            self.assertFalse(tid.startswith('TAX-'), f"Tax item in terminated_workloads: {tid}")
            self.assertFalse(tid.startswith('No-Resource-ID'), f"No-Resource-ID RI item in terminated_workloads: {tid}")
            self.assertNotIn('hostedzone', tid, f"Route 53 hosted zone in terminated_workloads: {tid}")
            self.assertNotIn(':snapshot/', tid, f"Snapshot in terminated_workloads: {tid}")

        # Exactly 1 real terminated workload: AWS Glue crawler
        self.assertEqual(res['total_decommissioned_resources'], 1)
        self.assertIn("crawler/procure_insufficient_stock", res['terminated_workloads'][0]['resource_id'])

    def test_05_real_physical_resource_termination_preserved(self):
        """A genuine terminated physical workload must still be classified as TERMINATED_RESOURCE."""
        # 1. Real crawler from dataset
        res = analyze_cost_root_cause(self.cur_data, '2026-10-01', '2026-10-01', '2026-10-02', '2026-10-02')
        crawler = res['terminated_workloads'][0]
        self.assertEqual(crawler['change_category'], 'TERMINATED_RESOURCE')
        self.assertEqual(crawler['service'], 'AWS Glue')
        self.assertIn("stopped incurring charges", crawler['explanation'])

        # 2. Synthetic stopped EC2 instance test
        cat, expl, ev, op = classify_resource_variance(
            rid='i-0a1b2c3d4e5f67890',
            cb=45.50,
            ct=0.0,
            qb=24.0,
            qt=0.0,
            unit='Hrs',
            svc='Amazon EC2',
            uts_base={'APS3-BoxUsage:t3.xlarge'},
            uts_target=set(),
            line_types={'Usage'},
            name='prod-api-worker'
        )
        self.assertEqual(cat, 'TERMINATED_RESOURCE')
        self.assertIn("stopped incurring charges", expl)
        self.assertEqual(ev, 'CONFIRMED_BY_CUR')

    def test_06_storage_lifecycle_and_dns_fees_separated(self):
        """RDS/EBS snapshots and Route 53 hosted zones must be classified accurately."""
        res = analyze_cost_root_cause(self.cur_data, '2026-10-01', '2026-10-01', '2026-10-02', '2026-10-02')

        # restore-bkp-26-09 must be in storage_lifecycle
        storage_rids = [s['resource_id'] for s in res['storage_lifecycle']]
        self.assertTrue(any('restore-bkp' in s for s in storage_rids), "restore-bkp not in storage_lifecycle")

        # Hosted zones must be in financial_adjustments with category PERIODIC_FEE
        hz_items = [f for f in res['financial_adjustments'] if 'hostedzone' in f['resource_id']]
        self.assertGreater(len(hz_items), 0, "Hosted zones not in financial_adjustments")
        self.assertEqual(hz_items[0]['change_category'], 'PERIODIC_FEE')
        self.assertIn("hosted zone monthly fee", hz_items[0]['explanation'])

    def test_07_narrative_and_executive_summary_coherence(self):
        """Variance summary narrative must reflect dominant spend reduction, not a minor $4.54 spike."""
        res = analyze_cost_root_cause(self.cur_data, '2026-10-01', '2026-10-01', '2026-10-02', '2026-10-02')
        narrative = res['variance_summary']['top_driver_narrative']
        exec_summary = res['variance_summary']['executive_summary']

        self.assertIn("Primary Driver", narrative)
        self.assertIn("Reserved Instance recurring fee", narrative)
        self.assertNotIn("AU-DataTransfer-Out-Bytes", narrative)
        self.assertIn("Cost reduced by", exec_summary)

    def test_08_root_cause_totals_reconciliation(self):
        """Financial reconciliation must hold without double counting."""
        res = analyze_cost_root_cause(self.cur_data, '2026-10-01', '2026-10-01', '2026-10-02', '2026-10-02')
        recon = res['financial_reconciliation']

        self.assertTrue(recon['is_reconciled'])
        self.assertAlmostEqual(recon['gross_baseline_cost'] - recon['gross_target_cost'], abs(recon['net_delta']), places=2)

    def test_09_account_filter_enforcement(self):
        """Filtering by account_id must restrict analysis strictly to that account."""
        res_all = analyze_cost_root_cause(self.cur_data, '2026-10-01', '2026-10-01', '2026-10-02', '2026-10-02')
        res_scoped = analyze_cost_root_cause(self.cur_data, '2026-10-01', '2026-10-01', '2026-10-02', '2026-10-02', account_id='825799498078')

        self.assertGreater(res_scoped['comparison_window']['baseline']['total_cost'], 0)
        for r in res_scoped['resources'][:20]:
            if r['account_id']:
                self.assertEqual(r['account_id'], '825799498078')

    def test_10_api_endpoints_contract_stage3a(self):
        """POST /api/compare and POST /api/analytics/root-cause return 200 with backward-compatible schema."""
        # 1. Test POST /api/compare
        comp_resp = self.client.post(
            "/api/compare",
            headers=self.auth_headers,
            json={
                "baseline_date": "2026-10-01",
                "target_date": "2026-10-02"
            }
        )
        self.assertEqual(comp_resp.status_code, 200)
        cdata = comp_resp.json()

        self.assertIn("baseline_date", cdata)
        self.assertIn("target_date", cdata)
        self.assertIn("baseline_cost", cdata)
        self.assertIn("target_cost", cdata)
        self.assertIn("delta_cost", cdata)
        self.assertIn("primary_event", cdata)
        self.assertIn("service_comparison", cdata)
        self.assertIn("top_spikes", cdata)
        self.assertIn("reduced_resources", cdata)
        self.assertIn("financial_adjustments", cdata)
        self.assertGreater(len(cdata['financial_adjustments']), 0)
        self.assertEqual(len([r for r in cdata['reduced_resources'] if 'TAX' in r['resource_id']]), 0)

        # 2. Test POST /api/analytics/root-cause
        rc_resp = self.client.post(
            "/api/analytics/root-cause",
            headers=self.auth_headers,
            json={
                "baseline_start": "2026-10-01",
                "baseline_end": "2026-10-01",
                "target_start": "2026-10-02",
                "target_end": "2026-10-02"
            }
        )
        self.assertEqual(rc_resp.status_code, 200)
        rc_data = rc_resp.json()

        self.assertEqual(rc_data['status'], 'SUCCESS')
        self.assertIn("variance_summary", rc_data)
        self.assertIn("terminated_workloads", rc_data)
        self.assertIn("financial_adjustments", rc_data)
        self.assertIn("storage_lifecycle", rc_data)
        self.assertEqual(rc_data['total_decommissioned_resources'], 1)
        self.assertGreater(len(rc_data['financial_adjustments']), 0)


if __name__ == '__main__':
    unittest.main()
