"""
Tests for FinOps Commitment Simulator:
- Strict 24/7 continuous baseline filtering
- Excludes start/stop dev workloads
- Compute SP, EC2 Instance SP, EC2 Standard RI, RDS RI, ElastiCache RI, OpenSearch RI, DocumentDB RI
- Portfolio summary across all 7 classes
- Multi-Account & Multi-Region Scoping
- Evidence-based classification & existing commitment double-count prevention
- Currency conversions (USD & INR)
"""

import unittest
import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from app.simulator import simulate_savings_plan, analyze_workload_continuity

class TestSavingsPlanSimulator(unittest.TestCase):

    def setUp(self):
        # 10 days of synthetic data
        # i-continuous runs all 10 days ($10/day = $100 total) in us-east-1, Account 111111111111
        # i-dev-stopped runs only 2 days ($10/day = $20 total) -> intermittent!
        # i-covered has sp_arn active! ($10/day = $100 total) -> ALREADY_COVERED
        # db-prod runs all 10 days ($20/day = $200 total) in us-west-2, Account 222222222222 -> continuous RDS!
        # cache-prod runs all 10 days ($5/day = $50 total) -> continuous ElastiCache!
        # search-prod runs all 10 days ($8/day = $80 total) -> continuous OpenSearch!
        self.dates = [f"2025-10-{i:02d}" for i in range(1, 11)]
        records = []

        for d in self.dates:
            # Continuous EC2 instance
            records.append({
                'cost': 10.0,
                'date': d,
                'service': 'Amazon EC2',
                'account_id': '111111111111',
                'region': 'us-east-1',
                'resource_id': 'i-continuous-prod-01',
                'name': 'prod-api-server'
            })
            # Already Covered EC2 instance with active SavingsPlanARN
            records.append({
                'cost': 10.0,
                'date': d,
                'service': 'Amazon EC2',
                'account_id': '111111111111',
                'region': 'us-east-1',
                'resource_id': 'i-already-covered-01',
                'sp_arn': 'arn:aws:savingsplans::111111111111:savingsplan/sp-active-3yr',
                'name': 'covered-worker'
            })
            # Continuous RDS instance in us-west-2, Account 222222222222
            records.append({
                'cost': 20.0,
                'date': d,
                'service': 'Amazon RDS',
                'account_id': '222222222222',
                'region': 'us-west-2',
                'resource_id': 'db-aurora-cluster-01',
                'name': 'prod-aurora-db'
            })
            # Continuous ElastiCache node
            records.append({
                'cost': 5.0,
                'date': d,
                'service': 'Amazon ElastiCache',
                'account_id': '111111111111',
                'region': 'us-east-1',
                'resource_id': 'cache-redis-cluster-01',
                'name': 'prod-redis-cache'
            })
            # Continuous OpenSearch cluster
            records.append({
                'cost': 8.0,
                'date': d,
                'service': 'Amazon OpenSearch',
                'account_id': '111111111111',
                'region': 'us-east-1',
                'resource_id': 'es-logs-cluster-01',
                'name': 'prod-es-search'
            })

        # Intermittent start/stop dev instances running only on day 1 and 2
        for d in self.dates[:2]:
            records.append({
                'cost': 10.0,
                'date': d,
                'service': 'Amazon EC2',
                'account_id': '111111111111',
                'region': 'us-east-1',
                'resource_id': 'i-dev-stopped-01',
                'name': 'dev-test-instance'
            })

        self.mock_cur = {
            'records': records,
            'dates': self.dates,
            'total_cost': sum(r['cost'] for r in records)
        }

    def test_continuous_filtering_excludes_start_stop(self):
        workload = analyze_workload_continuity(
            self.mock_cur['records'],
            self.dates,
            ['ec2']
        )
        self.assertEqual(workload['continuous_count'], 1)
        self.assertEqual(workload['intermittent_count'], 1)
        self.assertEqual(workload['already_covered_count'], 1)
        self.assertEqual(workload['continuous_spend'], 100.0)

    def test_already_covered_prevents_duplicate_commitment(self):
        res = simulate_savings_plan(self.mock_cur, plan_type="COMPUTE_SP")
        # Check that the already-covered resource is classified as ALREADY_COVERED and not counted as a continuous candidate
        covered_resources = [r for r in res['resources_breakdown'] if r['resource_id'] == 'i-already-covered-01']
        self.assertEqual(len(covered_resources), 1)
        self.assertEqual(covered_resources[0]['status'], 'ALREADY_COVERED')
        self.assertFalse(covered_resources[0]['is_continuous'])

    def test_account_scoping_filter(self):
        res_acc1 = simulate_savings_plan(self.mock_cur, plan_type="RDS_RI", account_id="111111111111")
        # Account 111111111111 has NO RDS instances
        self.assertEqual(res_acc1['continuous_units_count'], 0)
        self.assertEqual(res_acc1['risk_level'], 'NO_WORKLOAD')

        res_acc2 = simulate_savings_plan(self.mock_cur, plan_type="RDS_RI", account_id="222222222222")
        # Account 222222222222 has 1 continuous RDS instance
        self.assertEqual(res_acc2['continuous_units_count'], 1)
        self.assertGreater(res_acc2['monthly_net_savings_usd'], 0.0)

    def test_region_scoping_filter(self):
        res_west = simulate_savings_plan(self.mock_cur, plan_type="COMPUTE_SP", region="us-west-2")
        # us-west-2 only has RDS, no EC2 compute
        self.assertEqual(res_west['continuity_audit']['continuous_instances_count'], 0)

        res_east = simulate_savings_plan(self.mock_cur, plan_type="COMPUTE_SP", region="us-east-1")
        self.assertGreater(res_east['continuity_audit']['continuous_instances_count'], 0)

    def test_compute_sp_simulation(self):
        res = simulate_savings_plan(self.mock_cur, plan_type="COMPUTE_SP", term_years=1)
        self.assertEqual(res['status'], "SUCCESS")
        self.assertEqual(res['plan_type'], "COMPUTE_SP")
        self.assertTrue(res['continuity_audit']['is_continuous_filtered'])
        self.assertEqual(res['continuity_audit']['intermittent_instances_excluded'], 1)
        self.assertGreater(res['monthly_net_savings_usd'], 0.0)
        self.assertGreater(res['annual_net_savings_inr'], 0.0)

    def test_ec2_standard_ri_simulation(self):
        res = simulate_savings_plan(self.mock_cur, plan_type="EC2_STANDARD_RI", term_years=3, payment_option="ALL_UPFRONT")
        self.assertEqual(res['plan_type'], "EC2_STANDARD_RI")
        self.assertEqual(res['discount_rate_pct'], 72.0)
        self.assertGreater(res['annual_net_savings_usd'], 0.0)

    def test_elasticache_ri_simulation(self):
        res = simulate_savings_plan(self.mock_cur, plan_type="ELASTICACHE_RI", term_years=1)
        self.assertEqual(res['plan_type'], "ELASTICACHE_RI")
        self.assertEqual(res['continuity_audit']['continuous_instances_count'], 1)
        self.assertGreater(res['monthly_net_savings_usd'], 0.0)

    def test_opensearch_ri_simulation(self):
        res = simulate_savings_plan(self.mock_cur, plan_type="OPENSEARCH_RI", term_years=1)
        self.assertEqual(res['plan_type'], "OPENSEARCH_RI")
        self.assertEqual(res['continuity_audit']['continuous_instances_count'], 1)
        self.assertGreater(res['monthly_net_savings_usd'], 0.0)

    def test_docdb_handles_zero_gracefully(self):
        res_docdb = simulate_savings_plan(self.mock_cur, plan_type="DOCDB_RI", term_years=1)
        self.assertEqual(res_docdb['plan_type'], "DOCDB_RI")
        self.assertEqual(res_docdb['risk_level'], "NO_WORKLOAD")
        self.assertEqual(res_docdb['continuity_audit']['continuous_instances_count'], 0)

    def test_portfolio_summary_all_7_classes(self):
        res = simulate_savings_plan(self.mock_cur, plan_type="COMPUTE_SP")
        self.assertIn('portfolio_summary', res)
        self.assertEqual(len(res['portfolio_summary']), 7)
        plan_types = [p['plan_type'] for p in res['portfolio_summary']]
        self.assertIn("COMPUTE_SP", plan_types)
        self.assertIn("EC2_INSTANCE_SP", plan_types)
        self.assertIn("EC2_STANDARD_RI", plan_types)
        self.assertIn("RDS_RI", plan_types)
        self.assertIn("ELASTICACHE_RI", plan_types)
        self.assertIn("OPENSEARCH_RI", plan_types)
        self.assertIn("DOCDB_RI", plan_types)
        self.assertGreater(res['portfolio_total_annual_usd'], 0.0)

    def test_math_breakdown_and_overcommitment(self):
        # 1. Normal simulation has authoritative math breakdown
        res = simulate_savings_plan(self.mock_cur, plan_type="COMPUTE_SP", term_years=1)
        self.assertIn('math_breakdown', res)
        mb = res['math_breakdown']
        self.assertEqual(mb['billing_hours_per_month'], 730)
        self.assertFalse(mb['is_overcommitted'])
        self.assertGreater(mb['hourly_ondemand_baseline'], 0.0)
        self.assertGreater(mb['monthly_net_savings_usd'], 0.0)

        # 2. Extreme over-commitment ($50/hr on a small workload) flags is_overcommitted
        res_over = simulate_savings_plan(self.mock_cur, commitment_hourly=50.0, plan_type="COMPUTE_SP", term_years=1)
        self.assertTrue(res_over['math_breakdown']['is_overcommitted'])
        self.assertGreater(res_over['math_breakdown']['monthly_unutilized_waste'], 0.0)

    def test_nat_gateway_and_networking_are_ineligible_for_commitments(self):
        # Create records containing NAT Gateway and Public IPv4 under AmazonEC2
        cur_with_nat = {
            'records': [
                {
                    'cost': 491.83,
                    'date': d,
                    'service': 'Amazon EC2',
                    'resource_id': 'arn:aws:ec2:ap-south-1:825799498078:natgateway/nat-0ef14c47dd73b363a',
                    'usage_type': 'APS3-NatGateway-Hours'
                }
                for d in self.dates
            ],
            'dates': self.dates,
            'total_cost': 491.83
        }
        res = simulate_savings_plan(cur_with_nat, plan_type="COMPUTE_SP")
        # NAT Gateway MUST NOT be counted as continuous compute
        self.assertEqual(res['continuity_audit']['continuous_instances_count'], 0)
        self.assertEqual(res['recommended_commitment'], 0.0)
        nat_item = [r for r in res['resources_breakdown'] if 'nat-' in r['resource_id']][0]
        self.assertEqual(nat_item['status'], 'INELIGIBLE_NETWORKING')
        self.assertFalse(nat_item['is_continuous'])
        self.assertIn('VPC', nat_item['reason'])

    def test_micro_spend_lambda_is_not_committed(self):
        cur_lambda = {
            'records': [
                {
                    'cost': 0.001,
                    'date': d,
                    'service': 'AWSLambda',
                    'resource_id': 'arn:aws:lambda:ap-south-1:825799498078:function:test-lambda',
                    'usage_type': 'APS3-Lambda-GB-Second'
                }
                for d in self.dates
            ],
            'dates': self.dates,
            'total_cost': 0.01
        }
        res = simulate_savings_plan(cur_lambda, plan_type="COMPUTE_SP")
        self.assertEqual(res['continuity_audit']['continuous_instances_count'], 0)
        l_item = res['resources_breakdown'][0]
        self.assertEqual(l_item['status'], 'MICRO_SPEND')
        self.assertFalse(l_item['is_continuous'])

    def test_fully_covered_fleet_reports_zero_commitment_needed(self):
        # Fleet where all instances already have active SP/RI
        cur_covered = {
            'records': [
                {
                    'cost': 100.0,
                    'date': d,
                    'service': 'Amazon EC2',
                    'resource_id': 'i-covered-server-01',
                    'sp_arn': 'arn:aws:savingsplans::111111111111:savingsplan/active-sp',
                    'usage_type': 'APS3-BoxUsage:c6g.4xlarge'
                }
                for d in self.dates
            ],
            'dates': self.dates,
            'total_cost': 1000.0
        }
        res = simulate_savings_plan(cur_covered, plan_type="COMPUTE_SP")
        self.assertEqual(res['risk_level'], 'FULLY_COVERED')
        self.assertEqual(res['recommended_commitment'], 0.0)
        self.assertIn('Fully Covered', res['recommended_display'])

    def test_rds_fully_covered_fleet_what_if_simulation(self):
        # RDS fleet with 2 active instances, both covered by active RI
        cur_rds = {
            'records': [
                {
                    'cost': 50.0,
                    'date': d,
                    'service': 'Amazon RDS',
                    'resource_id': 'arn:aws:rds:ap-south-1:123456789012:db:prod-db-master',
                    'ri_arn': 'arn:aws:rds:ap-south-1:123456789012:ri:active-ri-1',
                    'usage_type': 'APS3-InstanceUsage:db.r7i.4xlarge'
                }
                for d in self.dates
            ] + [
                {
                    'cost': 50.0,
                    'date': d,
                    'service': 'Amazon RDS',
                    'resource_id': 'arn:aws:rds:ap-south-1:123456789012:db:prod-db-replica',
                    'ri_arn': 'arn:aws:rds:ap-south-1:123456789012:ri:active-ri-2',
                    'usage_type': 'APS3-InstanceUsage:db.r7i.4xlarge'
                }
                for d in self.dates
            ],
            'dates': self.dates,
            'total_cost': 1000.0
        }
        # Baseline simulation: 0 units recommended because fleet is 100% covered
        res_default = simulate_savings_plan(cur_rds, plan_type="RDS_RI")
        self.assertEqual(res_default['risk_level'], 'FULLY_COVERED')
        self.assertEqual(res_default['continuous_units_count'], 0)
        self.assertEqual(res_default['fleet_continuous_count'], 2)
        self.assertEqual(res_default['primary_sku'], 'db.r7i.4xlarge')
        self.assertEqual(res_default['monthly_commitment_cost'], 0.0)
        self.assertEqual(res_default['monthly_net_savings_usd'], 0.0)

        # What-if simulation: user models 1 unit for capacity reservation / future DB
        res_whatif = simulate_savings_plan(cur_rds, plan_type="RDS_RI", reserved_units=1)
        self.assertEqual(res_whatif['risk_level'], 'WHAT_IF_EXPANSION')
        self.assertEqual(res_whatif['primary_sku'], 'db.r7i.4xlarge')
        self.assertGreater(res_whatif['monthly_commitment_cost'], 0.0)
        self.assertGreater(res_whatif['monthly_net_savings_usd'], 0.0)
        self.assertEqual(res_whatif['coverage_pct'], 100.0)

    def test_partial_ri_coverage_included_in_sp_continuous_baseline(self):
        """
        P0 Financial Integrity: Verify that 24/7 instances with partial RI coverage
        are classified as PARTIALLY_COVERED, and their uncovered On-Demand usage
        is correctly included in the continuous baseline rather than stripped out.
        """
        records = []
        for d in self.dates:
            # 6 hours On-Demand, 18 hours DiscountedUsage per day = 24 hrs/day
            records.append({
                'cost': 1.50,
                'usage_amount': 6.0,
                'unit': 'Hrs',
                'line_type': 'Usage',
                'date': d,
                'service': 'Amazon EC2',
                'account_id': '111111111111',
                'region': 'us-east-1',
                'resource_id': 'i-partial-ri-01',
                'usage_type': 'BoxUsage:t3a.medium',
                'name': 'partially-covered-worker'
            })
            records.append({
                'cost': 2.70,
                'usage_amount': 18.0,
                'unit': 'Hrs',
                'line_type': 'DiscountedUsage',
                'ri_arn': 'arn:aws:ec2:us-east-1:111111111111:reserved-instances/ri-partial-123',
                'date': d,
                'service': 'Amazon EC2',
                'account_id': '111111111111',
                'region': 'us-east-1',
                'resource_id': 'i-partial-ri-01',
                'usage_type': 'BoxUsage:t3a.medium',
                'name': 'partially-covered-worker'
            })

        cur_data = {
            'records': records,
            'dates': self.dates,
            'total_cost': 42.0
        }

        res = simulate_savings_plan(cur_data, plan_type="COMPUTE_SP")
        # Continuous count should include the partially covered instance
        self.assertEqual(res['continuous_units_count'], 1)
        self.assertGreater(res['recommended_commitment'], 0.0)
        self.assertIn('Spend Commitment', res['recommended_display'])

        # Verify resource breakdown fields
        breakdown = res['resources_breakdown']
        self.assertEqual(len(breakdown), 1)
        part_res = breakdown[0]
        self.assertEqual(part_res['status'], 'PARTIALLY_COVERED')
        self.assertEqual(part_res['total_observed_hours'], 240.0)
        self.assertEqual(part_res['ondemand_hours'], 60.0)
        self.assertEqual(part_res['discounted_hours'], 180.0)
        self.assertEqual(part_res['coverage_pct'], 75.0)
        self.assertEqual(part_res['ondemand_spend'], 15.0)
        self.assertEqual(part_res['discounted_spend'], 27.0)
        self.assertIn("Historical CUR telemetry (Requires live AWS IAM credentials", part_res['current_runtime_state'])

    def test_intermittent_workload_exclusion_and_tag(self):
        """
        Verify intermittent/dev workloads (<40% uptime) are never included in
        continuous baseline and receive explicit FinOps recommendation 'Do NOT Commit'.
        """
        records = []
        # Active only on first 2 days
        for d in self.dates[:2]:
            records.append({
                'cost': 5.0,
                'usage_amount': 12.0,
                'unit': 'Hrs',
                'line_type': 'Usage',
                'date': d,
                'service': 'Amazon EC2',
                'account_id': '111111111111',
                'region': 'us-east-1',
                'resource_id': 'i-intermittent-dev-01',
                'usage_type': 'BoxUsage:t3a.large',
                'name': 'dev-burst-node'
            })

        cur_data = {
            'records': records,
            'dates': self.dates,
            'total_cost': 10.0
        }

        res = simulate_savings_plan(cur_data, plan_type="COMPUTE_SP")
        self.assertEqual(res['continuous_units_count'], 0)
        self.assertEqual(res['recommended_commitment'], 0.0)
        breakdown = res['resources_breakdown']
        self.assertEqual(len(breakdown), 1)
        dev_res = breakdown[0]
        self.assertEqual(dev_res['status'], 'INTERMITTENT')
        self.assertIn('Do NOT Commit', dev_res['finops_action'])

    def test_zero_workload_handling_elasticache_and_docdb(self):
        """
        Verify that ElastiCache and DocumentDB simulator safely handle zero matching records
        without raising errors or producing fake non-zero commitments.
        """
        cur_data = {
            'records': [
                {
                    'cost': 10.0,
                    'date': self.dates[0],
                    'service': 'Amazon EC2',
                    'resource_id': 'i-ec2-only'
                }
            ],
            'dates': self.dates,
            'total_cost': 10.0
        }

        res_ec = simulate_savings_plan(cur_data, plan_type="ELASTICACHE_RI")
        self.assertEqual(res_ec['risk_level'], 'NO_WORKLOAD')
        self.assertEqual(res_ec['recommended_units'], 0)
        self.assertIn('No Uncovered Baseline', res_ec['recommended_display'])

        res_docdb = simulate_savings_plan(cur_data, plan_type="DOCDB_RI")
        self.assertEqual(res_docdb['risk_level'], 'NO_WORKLOAD')
        self.assertEqual(res_docdb['recommended_units'], 0)
        self.assertIn('No Uncovered Baseline', res_docdb['recommended_display'])

if __name__ == '__main__':
    unittest.main()


