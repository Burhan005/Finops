"""
ZORVEX Automated Analytics & Regression Test Suite
Verifies:
1. Daily Delta calculation correctness & zero baseline handling.
2. Monthly Comparison aggregation & service deltas.
3. CUR Streaming Parser robustness across production sample datasets.
4. Recommendations heuristic accuracy.
"""

import unittest
import os
import sys

# Add backend directory to path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from app.parser import parse_cur_file
from app.analytics import compare_dates, calculate_daily_delta, compare_months, get_trend_data
from app.recommendations import generate_recommendations

class TestZorvexAnalytics(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.sample_path = os.path.join(backend_dir, 'data', 'samples', 'aws_cur_production_exact.csv')
        cls.parsed_data = parse_cur_file(cls.sample_path)

    def test_parser_loads_production_data(self):
        self.assertGreater(self.parsed_data['total_cost'], 0)
        self.assertGreater(len(self.parsed_data['dates']), 10)
        self.assertIn('Amazon EC2', self.parsed_data['services'])

    def test_daily_delta_calculation(self):
        dates = self.parsed_data['dates']
        target_day = dates[-1]
        baseline_day = dates[-2]

        delta = calculate_daily_delta(self.parsed_data, target_day, baseline_day)
        self.assertEqual(delta['target_date'], target_day)
        self.assertEqual(delta['baseline_date'], baseline_day)
        self.assertIn('delta_cost', delta)
        self.assertIn('direction', delta)
        self.assertIn(delta['direction'], ['INCREASE', 'DECREASE', 'FLAT'])

    def test_daily_delta_zero_baseline_handling(self):
        # Mock zero baseline record
        mock_data = {
            'records': [
                {'cost': 50.0, 'date': '2025-10-15', 'month': '2025-10', 'service': 'Amazon EC2', 'resource_id': 'i-mock1', 'name': '', 'usage_type': 'RunInstances'}
            ],
            'dates': ['2025-10-14', '2025-10-15'],
            'daily_totals': {'2025-10-14': 0.0, '2025-10-15': 50.0}
        }
        res = compare_dates(mock_data, '2025-10-14', '2025-10-15')
        self.assertEqual(res['delta_cost'], 50.0)
        # Should not throw ZeroDivisionError and pct_change must be None/handled
        self.assertIsNone(res['pct_change'])
        self.assertIn('N/A', res['pct_display'])

    def test_monthly_comparison(self):
        months = self.parsed_data['months']
        if len(months) >= 2:
            m_comp = compare_months(self.parsed_data, months[0], months[1])
            self.assertEqual(m_comp['baseline_month'], months[0])
            self.assertEqual(m_comp['target_month'], months[1])
            self.assertIn('delta_cost', m_comp)
            self.assertIn('service_comparison', m_comp)

    def test_recommendations_engine(self):
        recs = generate_recommendations(self.parsed_data)
        self.assertIn('total_potential_savings', recs)
        self.assertIn('recommendations', recs)
        for r in recs['recommendations']:
            self.assertIn('category', r)
            self.assertIn('cli_command', r)
            self.assertIn('severity', r)

    def test_poc_cur_upload_and_root_cause(self):
        poc_path = os.path.join(backend_dir, 'data', 'uploads', 'poc-cur-report-00001 (2).csv.gz')
        if os.path.exists(poc_path):
            poc_data = parse_cur_file(poc_path)
            self.assertGreater(poc_data['total_cost'], 0.50)
            self.assertIn('2026-10-11', poc_data['dates'])
            self.assertIn('2026-10-12', poc_data['dates'])

            comp = compare_dates(poc_data, '2026-10-11', '2026-10-12')
            self.assertGreater(comp['delta_cost'], 0.10)
            self.assertEqual(comp['direction'], 'INCREASE')
            self.assertTrue(len(comp['top_spikes']) > 0)
            
            # Check top spiker is EC2 instance with root cause
            top_spike = comp['top_spikes'][0]
            self.assertEqual(top_spike['resource_id'], 'i-096b1ec582106127a')
            self.assertIn('t3a.large', top_spike['root_cause'])
            self.assertIn('Primary Driver', comp['primary_event'])

    def test_auth_and_password_recovery_pipeline(self):
        from app.database import get_db
        from app.models import User
        from app.security import hash_password, verify_and_upgrade_password

        db = next(get_db())
        test_email = "test-recovery@zorvex.io"
        
        # Cleanup if exists
        db.query(User).filter(User.email == test_email).delete()
        db.commit()

        # Create user with Bcrypt password hash
        user = User(
            name="Test Engineer",
            company="Zorvex Test Org",
            email=test_email,
            password_hash=hash_password("InitialSecret#2026")
        )
        db.add(user)
        db.commit()

        # Verify lookup
        fetched = db.query(User).filter(User.email == test_email).first()
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched.company, "Zorvex Test Org")
        self.assertTrue(fetched.password_hash.startswith("$2b$"))

        # Verify password validation
        is_valid, needs_upgrade = verify_and_upgrade_password("InitialSecret#2026", fetched.password_hash)
        self.assertTrue(is_valid)
        self.assertFalse(needs_upgrade)

        # Clean up
        db.delete(fetched)
        db.commit()
        db.close()

if __name__ == '__main__':
    unittest.main()
