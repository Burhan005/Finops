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

