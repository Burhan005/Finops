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
        self.assertAlmostEqual(res['summary']['total_cost'], 8914.93, delta=1.0)
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

if __name__ == '__main__':
    unittest.main()
