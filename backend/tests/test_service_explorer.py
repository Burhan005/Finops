import pytest
from fastapi.testclient import TestClient
from app.main import app

class TestPhase6ServiceExplorerAndDashboard:
    """
    Verification suite for Phase 6 UI/UX Redesign & Real CUR Data Integration:
    - Executive Spend Reconciliation & Accounting Verification
    - Service Explorer queries for EC2, EBS, RDS, S3, Lambda, VPC
    - Resource Details & Relationship Data
    - Recommendations API fix verification
    - Trends service_series verification
    """

    @classmethod
    def setup_class(cls):
        import os
        from app.core.config import SAMPLES_DIR
        from app.core.state import CURRENT_DATASET
        from app.parser import parse_cur_file

        sample_file = os.path.join(SAMPLES_DIR, "CUR-Report-Daily-00001.csv.gz")
        if os.path.exists(sample_file):
            parsed = parse_cur_file(sample_file)
            CURRENT_DATASET['filename'] = "CUR-Report-Daily-00001.csv.gz"
            CURRENT_DATASET['filepath'] = sample_file
            CURRENT_DATASET['data'] = parsed

    @pytest.fixture(autouse=True)
    def setup_client(self):
        self.client = TestClient(app)

    def test_executive_overview_reconciliation_fields(self):
        res = self.client.get('/api/overview')
        assert res.status_code == 200
        data = res.json()
        assert 'total_cost' in data
        assert 'gross_cost' in data
        assert 'net_cost' in data
        assert 'taxes_total' in data
        assert 'accounts' in data
        assert 'services' in data
        assert 'daily_totals' in data
        assert 'accounting_reconciliation' in data

        rec = data['accounting_reconciliation']
        assert rec['is_reconciled'] is True
        assert rec['gross_usage_cost'] == data['gross_cost']
        assert rec['net_invoiced_spend'] == data['net_cost']
        assert rec['taxes_total'] == data['taxes_total']

    def test_service_explorer_ec2_instances_query(self):
        res = self.client.get('/api/resources', params={'service': 'Amazon EC2', 'category': 'EC2_INSTANCE'})
        assert res.status_code == 200
        data = res.json()
        assert 'resources' in data
        assert 'pagination' in data
        assert data['pagination']['total_records'] > 0
        for r in data['resources']:
            assert r['service'] == 'Amazon EC2'
            assert r['category'] in ('EC2_INSTANCE', 'NAT_GATEWAY')

    def test_service_explorer_ebs_volume_isolation(self):
        """Verifies EBS volumes are distinctly queried and categorized."""
        res = self.client.get('/api/resources', params={'service': 'Amazon EC2', 'category': 'EBS_VOLUME'})
        assert res.status_code == 200
        data = res.json()
        assert data['pagination']['total_records'] > 0
        for r in data['resources']:
            assert r['resource_id'].startswith('vol-') or 'volume' in r['primary_usage_type'].lower()

    def test_service_explorer_rds_query(self):
        res = self.client.get('/api/resources', params={'service': 'Amazon RDS'})
        assert res.status_code == 200
        data = res.json()
        assert data['pagination']['total_records'] > 0

    def test_service_explorer_s3_query(self):
        res = self.client.get('/api/resources', params={'service': 'Amazon S3'})
        assert res.status_code == 200
        data = res.json()
        assert data['pagination']['total_records'] > 0

    def test_service_explorer_lambda_query(self):
        res = self.client.get('/api/resources', params={'service': 'AWS Lambda'})
        assert res.status_code == 200
        data = res.json()
        assert data['pagination']['total_records'] > 0

    def test_recommendations_endpoint_healthy(self):
        """Verifies recommendations endpoint returns without NameError."""
        res = self.client.get('/api/recommendations')
        assert res.status_code == 200
        data = res.json()
        assert 'total_potential_savings' in data
        assert 'recommendations' in data
        assert isinstance(data['recommendations'], list)

    def test_trends_service_series(self):
        res = self.client.get('/api/trends')
        assert res.status_code == 200
        data = res.json()
        assert 'dates' in data
        assert 'service_series' in data
        assert isinstance(data['service_series'], dict)
        assert len(data['service_series']) > 0

    def test_opensearch_cluster_nodes_and_unit_accuracy(self):
        """Verifies OpenSearch cluster separates Data Nodes from Master Nodes and does not mix units."""
        res = self.client.get('/api/resources', params={'query': 'evital-opensearch'})
        assert res.status_code == 200
        data = res.json()
        assert data['pagination']['total_records'] > 0
        os_res = [r for r in data['resources'] if 'evital-opensearch' in r['resource_id']][0]

        # Financial & unit verification: usage amount must be compute hours, NOT 8500.21 GB!
        assert os_res['usage_unit'] == 'Hrs'
        assert os_res['usage_amount'] == 2163.0
        assert '2,163.00 Hrs' in os_res['usage_display']

        # Cluster topology verification
        cn = os_res.get('cluster_nodes')
        assert cn is not None
        assert cn['is_cluster'] is True
        assert cn['cluster_type'] == 'OpenSearch Domain'
        assert cn['node_count'] == 7

        # 4 Data Nodes (m7g.2xlarge)
        data_nodes = cn['data_nodes']
        assert data_nodes['instance_type'] == 'm7g.2xlarge'
        assert data_nodes['estimated_count'] == 4
        assert data_nodes['hours'] == 1236.0
        assert data_nodes['is_ri_covered'] is True

        # 3 Dedicated Master Nodes (m7g.large)
        master_nodes = cn['master_nodes']
        assert master_nodes['instance_type'] == 'm7g.large'
        assert master_nodes['estimated_count'] == 3
        assert master_nodes['hours'] == 927.0
        assert master_nodes['is_ri_covered'] is True

        # Provisioned GP3 storage & Data Transfer isolated
        assert cn['storage']['amount'] > 400.0
        assert cn['storage']['unit'] == 'GB-Mo'
        assert cn['storage']['type'] == 'GP3'
        assert cn['network_transfer_gb'] > 5000.0

    def test_redshift_cluster_nodes_and_unit_accuracy(self):
        """Verifies Redshift cluster topology distinguishes compute nodes from managed storage."""
        res = self.client.get('/api/resources', params={'query': 'internal-evital-redshift'})
        assert res.status_code == 200
        data = res.json()
        assert data['pagination']['total_records'] > 0
        rs_res = [r for r in data['resources'] if 'internal-evital-redshift' in r['resource_id']][0]

        assert rs_res['usage_unit'] == 'Hrs'
        assert rs_res['usage_amount'] > 300.0
        cn = rs_res.get('cluster_nodes')
        assert cn is not None
        assert cn['is_cluster'] is True
        assert cn['compute_nodes']['instance_type'] == 'ra3.xlplus'
        assert cn['storage']['unit'] == 'GB-Mo'



    def test_cluster_telemetry_live_cur_data(self):
        """Verifies 100% dynamic, non-hardcoded EKS/EC2 cluster lifecycle telemetry from actual CUR records."""
        from app.database import SessionLocal
        from app.models import User, UserSession, DatasetRecord, BillingRecord
        import secrets
        from datetime import datetime, timezone, timedelta

        db = SessionLocal()
        user = db.query(User).filter(User.email == 'cloudops@finopsclay.io').first()
        if not user:
            from app.models import Organization
            org = Organization(name="Test Org")
            db.add(org)
            db.commit()
            user = User(email="cloudops@finopsclay.io", hashed_password="pw", organization_id=org.id)
            db.add(user)
            db.commit()

        tok = 'test_token_' + secrets.token_hex(16)
        session = UserSession(
            token=tok,
            user_id=user.id,
            organization_id=user.organization_id,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1)
        )
        db.add(session)

        # Seed realistic CUR records into test DB
        ds = DatasetRecord(organization_id=user.organization_id, filename="test_cur.csv.gz", is_active=0)
        db.add(ds)
        db.commit()

        rec1 = BillingRecord(
            organization_id=user.organization_id,
            dataset_id=ds.id,
            service='Amazon EC2',
            resource_id='i-0123456789abcdef0',
            resource_name='Prod-Master-Node',
            usage_date='2026-10-15',
            usage_month='2026-10',
            usage_hour='00:00',
            account_id='123456789012',
            region='ap-south-1',
            line_item_type='Usage',
            cost=1.5,
            unblended_cost=1.5
        )
        rec2 = BillingRecord(
            organization_id=user.organization_id,
            dataset_id=ds.id,
            service='Amazon EC2',
            resource_id='i-0123456789abcdef1',
            resource_name='Worker-Node-Overtime',
            usage_date='2026-10-15',
            usage_month='2026-10',
            usage_hour='19:00',
            account_id='123456789012',
            region='ap-south-1',
            line_item_type='Usage',
            cost=2.0,
            unblended_cost=2.0
        )
        db.add_all([rec1, rec2])
        db.commit()

        try:
            res = self.client.get(
                '/api/analytics/clusters/telemetry',
                params={'service': 'Amazon EC2', 'target_date': '2026-10-15', 'cutoff_hour': '18:00', 'dataset_id': ds.id},
                headers={'Authorization': f'Bearer {tok}'}
            )
            assert res.status_code == 200
            data = res.json()

            # Schema & contract validation
            assert 'kpis' in data
            assert 'hourly_timeline' in data
            assert 'nodes' in data
            assert 'orchestrator' in data
            assert 'available_dates' in data

            # Verify actual dynamic calculation
            kpis = data['kpis']
            assert kpis['total_cluster_nodes'] == 2
            assert kpis['nodes_active_today'] == 2
            assert kpis['peak_hourly_nodes'] == 1
            assert kpis['spend_today'] == 3.5
            assert kpis['overtime_spend_today'] == 2.0
            assert kpis['overtime_hours_detected'] == 1
            assert kpis['overtime_leakage_percentage'] == 57.1

            # 24-hour timeline verification
            assert len(data['hourly_timeline']) == 24
            assert data['hourly_timeline'][0]['node_count'] == 1
            assert data['hourly_timeline'][0]['cost'] == 1.5
            assert data['hourly_timeline'][0]['is_overtime'] is False

            assert data['hourly_timeline'][19]['node_count'] == 1
            assert data['hourly_timeline'][19]['cost'] == 2.0
            assert data['hourly_timeline'][19]['is_overtime'] is True

            # Nodes verification
            assert len(data['nodes']) == 2
            top_node = data['nodes'][0]
            assert top_node['resource_id'] == 'i-0123456789abcdef1'
            assert top_node['spend_today'] == 2.0
            assert top_node['overtime_spend_today'] == 2.0
        finally:
            db.delete(rec1)
            db.delete(rec2)
            db.delete(ds)
            db.delete(session)
            db.commit()
            db.close()
