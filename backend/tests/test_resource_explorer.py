"""
Unit & Integration Tests for ZORVEX Resource Explorer & Snapshot Cost Intelligence
Verifies:
- Asset classification across EC2, RDS, and other AWS services
- Snapshot and Backup cost intelligence
- Service and Category hierarchies
- Cost aggregation without double counting
- Filters, search, pagination, and sorting
- Resource detail audit breakdown
- Empty states and boundary conditions
"""

import unittest
import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from app.parser import parse_cur_file
from app.resource_explorer import (
    classify_cur_record,
    get_available_hierarchies,
    query_resource_explorer,
    get_resource_detail
)

class TestResourceExplorer(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # Load sample CUR dataset
        samples_dir = os.path.join(backend_dir, 'data', 'samples')
        cur_file = os.path.join(samples_dir, 'CUR-Report-Daily-00001.csv.gz')
        if not os.path.exists(cur_file):
            raise unittest.SkipTest("CUR sample file not found in test environment")
        cls.cur_data = parse_cur_file(cur_file)

    def test_classification_ec2_assets(self):
        # EBS Snapshot
        rec_snap = {
            'service': 'Amazon EC2',
            'resource_id': 'arn:aws:ec2:ap-south-1:123456789012:snapshot/snap-0123456789abcdef0',
            'usage_type': 'APS3-EBS:SnapshotUsage',
            'operation': 'CreateSnapshot'
        }
        cls_snap = classify_cur_record(rec_snap)
        self.assertEqual(cls_snap['category'], 'EBS_SNAPSHOT')
        self.assertTrue(cls_snap['is_snapshot'])
        self.assertEqual(cls_snap['classification_status'], 'CLASSIFIED_RESOURCE')

        # EC2 Instance
        rec_inst = {
            'service': 'Amazon EC2',
            'resource_id': 'i-0123456789abcdef0',
            'usage_type': 'APS3-BoxUsage:c6g.4xlarge',
            'operation': 'RunInstances'
        }
        cls_inst = classify_cur_record(rec_inst)
        self.assertEqual(cls_inst['category'], 'EC2_INSTANCE')
        self.assertEqual(cls_inst['asset_type'], 'Compute')

        # EBS Volume
        rec_vol = {
            'service': 'Amazon EC2',
            'resource_id': 'vol-0123456789abcdef0',
            'usage_type': 'APS3-EBS:VolumeUsage.gp3',
            'operation': 'CreateVolume'
        }
        cls_vol = classify_cur_record(rec_vol)
        self.assertEqual(cls_vol['category'], 'EBS_VOLUME')
        self.assertEqual(cls_vol['asset_type'], 'Storage')

        # NAT Gateway
        rec_nat = {
            'service': 'Amazon EC2',
            'resource_id': 'arn:aws:ec2:ap-south-1:123456789012:natgateway/nat-0123456789abcdef0',
            'usage_type': 'APS3-NatGateway-Bytes'
        }
        cls_nat = classify_cur_record(rec_nat)
        self.assertEqual(cls_nat['category'], 'NAT_GATEWAY')
        self.assertEqual(cls_nat['asset_type'], 'Networking')

        # Elastic IP
        rec_eip = {
            'service': 'Amazon EC2',
            'resource_id': 'eipalloc-0123456789abcdef0',
            'usage_type': 'APS3-PublicIPv4:InUseAddress'
        }
        cls_eip = classify_cur_record(rec_eip)
        self.assertEqual(cls_eip['category'], 'ELASTIC_IP')
        self.assertEqual(cls_eip['asset_type'], 'Networking')

    def test_classification_rds_assets(self):
        # RDS DB Instance
        rec_db = {
            'service': 'Amazon RDS',
            'resource_id': 'arn:aws:rds:ap-south-1:123456789012:db:production-db',
            'usage_type': 'APS3-InstanceUsage:db.r7i.4xl'
        }
        cls_db = classify_cur_record(rec_db)
        self.assertEqual(cls_db['category'], 'RDS_DB_INSTANCE')
        self.assertEqual(cls_db['asset_type'], 'Database')

        # RDS Automated Backup
        rec_bkp = {
            'service': 'Amazon RDS',
            'resource_id': 'arn:aws:rds:ap-south-1:123456789012:db:production-db',
            'usage_type': 'APS3-RDS:ChargedBackupUsage'
        }
        cls_bkp = classify_cur_record(rec_bkp)
        self.assertEqual(cls_bkp['category'], 'RDS_BACKUP')
        self.assertTrue(cls_bkp['is_backup'])

        # RDS Database Storage
        rec_storage = {
            'service': 'Amazon RDS',
            'resource_id': 'arn:aws:rds:ap-south-1:123456789012:db:production-db',
            'usage_type': 'APS3-RDS:GP3-Storage'
        }
        cls_storage = classify_cur_record(rec_storage)
        self.assertEqual(cls_storage['category'], 'RDS_STORAGE')
        self.assertEqual(cls_storage['asset_type'], 'Storage')

    def test_classification_unallocated_line_items(self):
        rec_unalloc = {
            'service': 'Amazon EC2',
            'resource_id': 'No-Resource-ID',
            'usage_type': 'APS3-HeavyUsage:m6a.2xlarge'
        }
        cls_unalloc = classify_cur_record(rec_unalloc)
        self.assertEqual(cls_unalloc['category'], 'USAGE_LEVEL_COST')
        self.assertEqual(cls_unalloc['classification_status'], 'USAGE_LEVEL_COST')

    def test_hierarchies_discovery(self):
        hierarchies = get_available_hierarchies(self.cur_data)
        self.assertIn('services', hierarchies)
        self.assertIn('categories_by_service', hierarchies)
        self.assertIn('snapshots_and_backups', hierarchies)

        services = [s['name'] for s in hierarchies['services']]
        self.assertIn('Amazon EC2', services)
        self.assertIn('Amazon RDS', services)

        ec2_cats = [c['id'] for c in hierarchies['categories_by_service'].get('Amazon EC2', [])]
        self.assertIn('EBS_SNAPSHOT', ec2_cats)
        self.assertIn('EC2_INSTANCE', ec2_cats)

        rds_cats = [c['id'] for c in hierarchies['categories_by_service'].get('Amazon RDS', [])]
        self.assertIn('RDS_BACKUP', rds_cats)
        self.assertIn('RDS_DB_INSTANCE', rds_cats)

    def test_query_all_services(self):
        res = query_resource_explorer(self.cur_data, service='All')
        self.assertEqual(res['status'], 'SUCCESS')
        self.assertAlmostEqual(res['summary']['total_cost'], 7762.43, delta=1.0)
        self.assertAlmostEqual(res['summary']['taxes_total'], 1152.50, delta=1.0)
        self.assertAlmostEqual(res['summary']['net_invoiced_spend'], 8914.93, delta=1.0)
        self.assertGreater(res['summary']['unique_resources_count'], 600)
        self.assertGreater(len(res['resources']), 0)
        self.assertLessEqual(len(res['resources']), 25)

    def test_query_ebs_snapshots(self):
        res = query_resource_explorer(self.cur_data, service='Amazon EC2', category='EBS_SNAPSHOT')
        self.assertEqual(res['status'], 'SUCCESS')
        self.assertGreater(res['pagination']['total_records'], 300)
        self.assertGreater(res['summary']['total_cost'], 0.0)
        first = res['resources'][0]
        self.assertEqual(first['category'], 'EBS_SNAPSHOT')
        self.assertEqual(first['asset_type'], 'Storage')
        self.assertEqual(first['verification_status'], 'Not verified against live AWS state')

    def test_query_global_snapshots_and_backups(self):
        res = query_resource_explorer(self.cur_data, service='SNAPSHOTS_BACKUPS')
        self.assertEqual(res['status'], 'SUCCESS')
        snaps = res['snapshots_summary']
        self.assertTrue(snaps['is_snapshot_view'])
        self.assertGreater(snaps['total_snapshot_cost'], 600.0)
        self.assertGreater(snaps['unique_snapshots_count'], 300)
        self.assertGreater(snaps['ebs_snapshot_count'], 300)
        self.assertGreater(snaps['rds_backup_count'], 3)
        self.assertIn('Not verified against live AWS state', snaps['compliance_disclaimer'])

    def test_account_and_region_filters(self):
        # Real dataset has account 825799498078 and region ap-south-1
        res_acc = query_resource_explorer(self.cur_data, account_id='825799498078')
        self.assertGreater(res_acc['pagination']['total_records'], 0)

        res_wrong_acc = query_resource_explorer(self.cur_data, account_id='999999999999')
        self.assertEqual(res_wrong_acc['pagination']['total_records'], 0)
        self.assertEqual(res_wrong_acc['summary']['total_cost'], 0.0)

    def test_search_filter(self):
        # Search for known instance
        res_search = query_resource_explorer(self.cur_data, query='i-0ee0901f82ebc5d84')
        self.assertEqual(res_search['pagination']['total_records'], 1)
        self.assertEqual(res_search['resources'][0]['short_id'], 'i-0ee0901f82ebc5d84')

    def test_resource_detail(self):
        # Get detail for top resource
        res_all = query_resource_explorer(self.cur_data, service='All')
        top_res_id = res_all['resources'][0]['resource_id']
        detail = get_resource_detail(self.cur_data, top_res_id)
        self.assertIsNotNone(detail)
        self.assertEqual(detail['resource_id'], top_res_id)
        self.assertGreater(len(detail['daily_timeline']), 0)
        self.assertGreater(len(detail['usage_breakdown']), 0)
        self.assertEqual(detail['verification_status'], 'Not verified against live AWS state')

    def test_empty_dataset_handling(self):
        res_empty = query_resource_explorer(None)
        self.assertEqual(res_empty['status'], 'EMPTY')
        self.assertEqual(res_empty['summary']['total_cost'], 0.0)
        self.assertEqual(len(res_empty['resources']), 0)

    def test_ri_contract_commitment_attribution(self):
        """Verify RI contracts are differentiated from physical resources and retain commitment metadata."""
        res_rds = query_resource_explorer(self.cur_data, service='Amazon RDS')
        ri_contract = next((r for r in res_rds['resources'] if r['category'] == 'RI_SUBSCRIPTION_FEE'), None)
        self.assertIsNotNone(ri_contract, "Expected to find RI contract under Amazon RDS")
        self.assertEqual(ri_contract['category'], 'RI_SUBSCRIPTION_FEE')
        self.assertEqual(ri_contract['lifecycle_status'], 'COMMITMENT_CONTRACT')
        self.assertTrue(ri_contract['is_commitment'])
        self.assertEqual(ri_contract['commitment_type'], 'ReservedInstance')
        self.assertTrue(bool(ri_contract['ri_arn']))
        self.assertTrue(bool(ri_contract['subscription_id']))
        self.assertAlmostEqual(ri_contract['total_cost'], 2400.14, delta=1.0)

    def test_ri_contract_detail_and_benefiting_resources(self):
        """Verify get_resource_detail enriches RI contracts with commitment metadata and line items."""
        detail = get_resource_detail(self.cur_data, 'No-Resource-ID (Amazon RDS)')
        self.assertIsNotNone(detail)
        self.assertTrue(detail['is_commitment'])
        self.assertEqual(detail['commitment_type'], 'ReservedInstance')
        self.assertEqual(detail['total_line_items'], 2)
        self.assertEqual(len(detail['line_items']), 2)
        first_li = detail['line_items'][0]
        self.assertIn('date', first_li)
        self.assertIn('line_item_type', first_li)
        self.assertEqual(first_li['line_item_type'], 'RIFee')
        self.assertIn('usage_type', first_li)
        self.assertIn('cost', first_li)
        self.assertIn('ri_arn', first_li)
        self.assertIn('subscription_id', first_li)

    def test_line_item_ledger_schema_preservation(self):
        """Verify line items for physical resources include operations, quantities, units, and descriptions."""
        res_ec2 = query_resource_explorer(self.cur_data, service='Amazon EC2')
        top_ec2_id = res_ec2['resources'][0]['resource_id']
        detail = get_resource_detail(self.cur_data, top_ec2_id)
        self.assertIsNotNone(detail)
        self.assertGreater(detail['total_line_items'], 0)
        first_li = detail['line_items'][0]
        self.assertIn('date', first_li)
        self.assertIn('line_item_type', first_li)
        self.assertIn('usage_type', first_li)
        self.assertIn('operation', first_li)
        self.assertIn('usage_amount', first_li)
        self.assertIn('unit', first_li)
        self.assertIn('cost', first_li)
        self.assertIn('desc', first_li)
        self.assertIn('item_description', first_li)

    def test_ec2_ri_contract_visibility_and_breakdown(self):
        """Verify EC2 RI recurring fee contracts are visible under Amazon EC2 with contract-level breakdown."""
        # 1. Query EC2 with ALL category
        res_ec2 = query_resource_explorer(self.cur_data, service='Amazon EC2', category='ALL')
        ri_contract = next((r for r in res_ec2['resources'] if r['category'] == 'RI_SUBSCRIPTION_FEE'), None)
        self.assertIsNotNone(ri_contract, "Expected to find RI contract under Amazon EC2 with category='ALL'")
        self.assertEqual(ri_contract['category'], 'RI_SUBSCRIPTION_FEE')
        self.assertEqual(ri_contract['lifecycle_status'], 'COMMITMENT_CONTRACT')
        self.assertTrue(ri_contract['is_commitment'])
        self.assertEqual(ri_contract['commitment_type'], 'ReservedInstance')
        self.assertAlmostEqual(ri_contract['total_cost'], 634.80, delta=0.5)

        # 2. Query EC2 with RI_SUBSCRIPTION_FEE category
        res_ri_only = query_resource_explorer(self.cur_data, service='Amazon EC2', category='RI_SUBSCRIPTION_FEE')
        self.assertEqual(len(res_ri_only['resources']), 1)
        self.assertEqual(res_ri_only['resources'][0]['category'], 'RI_SUBSCRIPTION_FEE')
        self.assertAlmostEqual(res_ri_only['resources'][0]['total_cost'], 634.80, delta=0.5)

        # 3. Resource detail for EC2 RI contract portfolio
        detail = get_resource_detail(self.cur_data, 'No-Resource-ID (Amazon EC2)')
        self.assertIsNotNone(detail)
        self.assertTrue(detail['is_commitment'])
        self.assertEqual(detail['commitment_type'], 'ReservedInstance')
        self.assertEqual(detail['total_line_items'], 10)
        self.assertEqual(len(detail['line_items']), 10)
        self.assertIn('contracts', detail)
        self.assertEqual(len(detail['contracts']), 10)

        # 4. Verify each contract has subscription ID, ARN, cost, and matched benefiting instances
        total_contract_cost = 0.0
        all_benefiting = set()
        for contract in detail['contracts']:
            self.assertIn('subscription_id', contract)
            self.assertTrue(bool(contract['subscription_id']))
            self.assertIn('ri_arn', contract)
            self.assertTrue(bool(contract['ri_arn']))
            self.assertIn('cost', contract)
            self.assertGreater(contract['cost'], 0)
            total_contract_cost += contract['cost']
            self.assertIn('benefiting_resources', contract)
            for inst in contract['benefiting_resources']:
                all_benefiting.add(inst)

        self.assertAlmostEqual(total_contract_cost, 634.80, delta=0.5)
        self.assertGreater(len(all_benefiting), 0, "Expected matching benefiting EC2 instances via CUR DiscountedUsage")
        for inst in all_benefiting:
            self.assertTrue(inst.startswith('i-'), f"Benefiting resource {inst} should be an EC2 instance ID")

    def test_ec2_financial_reconciliation_no_double_counting(self):
        """Verify EC2 financial totals reconcile without double-counting between RIFee and DiscountedUsage."""
        from app.resource_explorer import build_materialized_explorer_index
        index = build_materialized_explorer_index(self.cur_data)
        ec2_resources = [r for r in index['all_resources'] if r['service'] == 'Amazon EC2']
        total_ec2_res_cost = sum(r['total_cost'] for r in ec2_resources)
        
        # Verify total of all EC2 resources matches sum of raw CUR EC2 records
        raw_ec2_cost = sum(float(r.get('cost', 0) or 0) for r in self.cur_data['records'] if r.get('service') == 'Amazon EC2')
        self.assertAlmostEqual(total_ec2_res_cost, raw_ec2_cost, places=2)
        self.assertAlmostEqual(total_ec2_res_cost, 1191.05, places=2)

        # Verify component breakdowns
        ri_cost = sum(r['total_cost'] for r in ec2_resources if r['category'] == 'RI_SUBSCRIPTION_FEE')
        compute_cost = sum(r['total_cost'] for r in ec2_resources if r['category'] == 'EC2_INSTANCE')
        nat_cost = sum(r['total_cost'] for r in ec2_resources if r['category'] == 'NAT_GATEWAY')
        ebs_vol_cost = sum(r['total_cost'] for r in ec2_resources if r['category'] == 'EBS_VOLUME')
        ebs_snap_cost = sum(r['total_cost'] for r in ec2_resources if r['category'] == 'EBS_SNAPSHOT')

        self.assertAlmostEqual(ri_cost, 634.80, delta=0.5)
        self.assertAlmostEqual(compute_cost, 28.18, delta=0.5)
        self.assertAlmostEqual(nat_cost, 491.83, delta=0.5)
        self.assertAlmostEqual(ebs_vol_cost, 18.74, delta=0.5)
        self.assertAlmostEqual(ebs_snap_cost, 17.50, delta=0.5)
        self.assertAlmostEqual(ri_cost + compute_cost + nat_cost + ebs_vol_cost + ebs_snap_cost, 1191.05, places=1)

    def test_query_aws_waf_service(self):
        """Verify AWS WAF queries execute safely with waf_traffic_summary and human-readable WebACL names."""
        res_waf = query_resource_explorer(self.cur_data, service='AWS WAF', page_size=25)
        self.assertEqual(res_waf['status'], 'SUCCESS')
        self.assertIn('summary', res_waf)
        self.assertIn('waf_traffic_summary', res_waf['summary'])
        waf_sum = res_waf['summary']['waf_traffic_summary']
        if waf_sum:
            self.assertIn('total_requests', waf_sum)
            self.assertIn('requests_cost', waf_sum)
            self.assertIn('rules_cost', waf_sum)
            self.assertIn('webacl_cost', waf_sum)
            self.assertIn('primary_webacl', waf_sum)

if __name__ == '__main__':
    unittest.main()
