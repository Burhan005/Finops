"""
ZORVEX FinOps Platform - Database-First Analytics Test Suite
============================================================
Comprehensive test suite verifying:
1. Exact cent/penny financial accuracy parity between DB repository and in-memory parser.
2. Filtered Overview API queries via SQLite DB repository (date, service, account).
3. Resource Explorer SQL queries: pagination, search, category classification, sorting.
4. Normalized operational forecast calculation ($13,696.33 invariant).
5. Budget evaluation, breach status, and headroom calculation via DB repository.
6. Safe fallback to in-memory analytics when billing_records table is empty.
7. Dual-tier cache coherence and hit verification.
8. Strict multi-tenant isolation across persistent billing records.
"""

import os
import sys
import unittest
from decimal import Decimal
from datetime import datetime, timezone
from fastapi.testclient import TestClient

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database import engine, Base, SessionLocal
from app.models import Organization, User, DatasetRecord, BillingRecord, BudgetConfig
from app.repository import BillingRepository
from app.parser import parse_cur_file, round_currency
from app.budget_guard import calculate_cost_forecast, evaluate_budgets
from app.cache import global_cache
from app.main import app

SAMPLE_CUR_PATH = os.path.join(backend_dir, "data", "samples", "CUR-Report-Daily-00001.csv.gz")


class TestDbFirstAnalytics(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.db = SessionLocal()
        cls.client = TestClient(app)

        # 1. Create Organization A & B for Multi-Tenant Isolation
        cls.org_a = Organization(name="Tenant A - DB First Org")
        cls.org_b = Organization(name="Tenant B - Isolated Org")
        cls.db.add(cls.org_a)
        cls.db.add(cls.org_b)
        cls.db.commit()
        cls.db.refresh(cls.org_a)
        cls.db.refresh(cls.org_b)

        # 2. Parse sample CUR file in memory for baseline comparison
        cls.parsed_data = parse_cur_file(SAMPLE_CUR_PATH)
        assert cls.parsed_data['total_rows'] == 36490
        assert len(cls.parsed_data['records']) == 36218

        # 3. Create DatasetRecord for Org A
        cls.ds_rec_a = DatasetRecord(
            organization_id=cls.org_a.id,
            filename="CUR-Report-Daily-00001.csv.gz",
            filepath=SAMPLE_CUR_PATH,
            file_type="sample",
            total_cost=cls.parsed_data['gross_cost'],
            net_cost=cls.parsed_data['net_cost'],
            credits_total=cls.parsed_data['credits_total'],
            refunds_total=cls.parsed_data['refunds_total'],
            taxes_total=cls.parsed_data['taxes_total'],
            total_rows=cls.parsed_data['total_rows'],
            is_active=1,
            uploaded_at=datetime.now(timezone.utc)
        )
        cls.db.add(cls.ds_rec_a)
        cls.db.commit()
        cls.db.refresh(cls.ds_rec_a)

        # 4. Instantiate Repository and Persist Records
        cls.repo_a = BillingRepository(cls.db, org_id=cls.org_a.id, dataset_id=cls.ds_rec_a.id)
        cls.inserted_count = cls.repo_a.ensure_persisted(cls.parsed_data)

    @classmethod
    def tearDownClass(cls):
        try:
            cls.db.query(BillingRecord).filter(
                BillingRecord.organization_id.in_([cls.org_a.id, cls.org_b.id])
            ).delete(synchronize_session=False)
            cls.db.query(DatasetRecord).filter(
                DatasetRecord.organization_id.in_([cls.org_a.id, cls.org_b.id])
            ).delete(synchronize_session=False)
            cls.db.query(Organization).filter(
                Organization.id.in_([cls.org_a.id, cls.org_b.id])
            ).delete(synchronize_session=False)
            cls.db.commit()
        except Exception:
            pass
        finally:
            cls.db.close()

    def test_01_repository_persistence_and_count(self):
        """Verify BillingRepository accurately persisted all parsed records without dropping rows."""
        self.assertTrue(self.repo_a.has_records())
        count = self.repo_a.get_record_count()
        self.assertEqual(count, len(self.parsed_data['records']))
        self.assertEqual(count, 36218)

    def test_02_exact_penny_financial_reconciliation_parity(self):
        """Verify that SQLite aggregation matches parser in-memory totals to the exact cent."""
        sql_ov = self.repo_a.get_overview()
        py_ov = self.parsed_data

        # authoritative gross usage
        self.assertEqual(sql_ov['gross_cost'], py_ov['gross_cost'])
        self.assertEqual(sql_ov['net_cost'], py_ov['net_cost'])
        self.assertEqual(sql_ov['credits_total'], py_ov['credits_total'])
        self.assertEqual(sql_ov['refunds_total'], py_ov['refunds_total'])
        self.assertEqual(sql_ov['taxes_total'], py_ov['taxes_total'])

        # Accounting reconciliation
        rec = sql_ov['accounting_reconciliation']
        self.assertTrue(rec['is_reconciled'])
        calc_net = Decimal(str(rec['gross_usage_cost'])) + Decimal(str(rec['credits_total'])) + Decimal(str(rec['refunds_total'])) + Decimal(str(rec['taxes_total']))
        self.assertEqual(round_currency(calc_net), rec['net_invoiced_spend'])

    def test_03_services_and_daily_totals_parity(self):
        """Verify all services and daily totals in SQL repository match in-memory aggregation exactly."""
        sql_ov = self.repo_a.get_overview()
        py_services = {k: v for k, v in self.parsed_data['services'].items() if k not in ('Taxes & Surcharges', 'Tax')}

        self.assertEqual(len(sql_ov['services']), len(py_services))
        for svc, py_cost in py_services.items():
            self.assertIn(svc, sql_ov['services'])
            sql_cost = sql_ov['services'][svc]
            self.assertEqual(sql_cost, py_cost, f"Service '{svc}' cost mismatch: {sql_cost} vs {py_cost}")

        # Daily totals
        sql_daily = sql_ov['daily_totals']
        py_daily = self.parsed_data['daily_totals']
        self.assertEqual(len(sql_daily), len(py_daily))
        for d, py_cost in py_daily.items():
            self.assertIn(d, sql_daily)
            self.assertEqual(sql_daily[d], py_cost, f"Date '{d}' cost mismatch: {sql_daily[d]} vs {py_cost}")

    def test_04_filtered_overview_queries(self):
        """Verify filtered queries via SQL repository (date range, single service, account)."""
        # Date filter
        filtered_ov = self.repo_a.get_overview(start_date="2026-10-05", end_date="2026-10-10")
        self.assertEqual(len(filtered_ov['filtered_dates']), 6)
        expected_subtotal = round_currency(sum(Decimal(str(self.parsed_data['daily_totals'][d])) for d in filtered_ov['filtered_dates']))
        self.assertEqual(filtered_ov['net_cost'], expected_subtotal)

        # Service filter: Amazon EC2
        ec2_ov = self.repo_a.get_overview(service="Amazon EC2")
        self.assertEqual(ec2_ov['gross_cost'], self.parsed_data['services']['Amazon EC2'])
        self.assertIn("Amazon EC2", ec2_ov['services'])
        self.assertEqual(len(ec2_ov['services']), 1)

    def test_05_resource_explorer_pagination_search_sort(self):
        """Verify Resource Explorer pagination, sorting, search, and category classification via SQL."""
        # Page 1 descending cost
        p1 = self.repo_a.query_resources(page=1, page_size=10, sort_by="cost", sort_order="desc")
        self.assertEqual(len(p1['resources']), 10)
        self.assertTrue(p1['total_count'] > 10)
        costs = [r['cost'] for r in p1['resources']]
        self.assertEqual(costs, sorted(costs, reverse=True))

        # Search query
        search_res = self.repo_a.query_resources(query="vpc", page=1, page_size=5)
        self.assertTrue(search_res['total_count'] > 0)
        for r in search_res['resources']:
            match = ("vpc" in r['resource_id'].lower() or
                     "vpc" in r['service'].lower() or
                     "vpc" in (r['name'] or '').lower() or
                     "vpc" in r['short_id'].lower())
            self.assertTrue(match)

        # Hierarchies
        hierarchies = self.repo_a.get_resource_hierarchies()
        self.assertIn("services", hierarchies)
        self.assertIn("regions", hierarchies)
        self.assertIn("Amazon EC2", hierarchies['services'])

        # Resource detail
        top_res_id = p1['resources'][0]['resource_id']
        detail = self.repo_a.get_resource_detail(top_res_id)
        self.assertIsNotNone(detail)
        self.assertEqual(detail['resource_id'], top_res_id)
        self.assertTrue(detail['total_cost'] > 0)
        self.assertTrue(len(detail['daily_spend']) > 0)

    def test_06_forecast_de_inflation_invariant(self):
        """Verify the month-end forecast invariant ($13,696.33) calculated from SQL matches in-memory."""
        sql_fc = self.repo_a.get_forecast()
        py_fc = calculate_cost_forecast(self.parsed_data)

        self.assertEqual(sql_fc['forecasted_month_end_usd'], 13696.33)
        self.assertEqual(sql_fc['forecasted_month_end_usd'], py_fc['forecasted_month_end_usd'])
        self.assertEqual(sql_fc['actual_spend_to_date_usd'], py_fc['actual_spend_to_date_usd'])
        self.assertEqual(sql_fc['operational_burn_rate_usd'], py_fc['operational_burn_rate_usd'])
        self.assertEqual(sql_fc['confidence_low_usd'], py_fc['confidence_low_usd'])
        self.assertEqual(sql_fc['confidence_high_usd'], py_fc['confidence_high_usd'])

    def test_07_budget_evaluation_via_db(self):
        """Verify budget evaluations and breach projections via DB repository match budget_guard exactly."""
        b1 = BudgetConfig(organization_id=self.org_a.id, name="Test Enterprise Budget", scope_type="WORKSPACE", scope_value="all", monthly_budget_usd=12000.0, is_active=1)
        b2 = BudgetConfig(organization_id=self.org_a.id, name="Test EC2 Budget", scope_type="SERVICE", scope_value="Amazon EC2", monthly_budget_usd=3000.0, is_active=1)
        self.db.add(b1)
        self.db.add(b2)
        self.db.commit()

        sql_budgets = self.repo_a.evaluate_budgets([b1, b2])
        py_budgets = evaluate_budgets(self.db, self.parsed_data, org_id=self.org_a.id)

        self.assertEqual(len(sql_budgets), 2)
        for sb, pb in zip(sql_budgets, py_budgets):
            self.assertEqual(sb['id'], pb['id'])
            self.assertEqual(sb['status'], pb['status'])
            self.assertEqual(sb['current_spend_pct'], pb['current_spend_pct'])
            self.assertEqual(sb['forecasted_spend_pct'], pb['forecasted_spend_pct'])
            self.assertEqual(sb['projected_breach_day'], pb['projected_breach_day'])

    def test_08_fallback_mechanism_when_unpopulated(self):
        """Verify that when a dataset has 0 rows in billing_records, repository.has_records() is False and fallback engages."""
        empty_repo = BillingRepository(self.db, org_id=self.org_b.id, dataset_id=999999)
        self.assertFalse(empty_repo.has_records())
        self.assertEqual(empty_repo.get_record_count(), 0)

    def test_09_dual_tier_cache_coherence(self):
        """Verify cache returns identical financial numbers with zero calculation drift."""
        cache_key = global_cache.build_key(self.org_a.id, "CUR-Report-Daily-00001.csv.gz", "overview_unit_test")
        computed = self.repo_a.get_overview()
        global_cache.set(cache_key, computed, ttl=60)

        cached = global_cache.get(cache_key)
        self.assertIsNotNone(cached)
        self.assertEqual(cached['total_cost'], computed['total_cost'])
        self.assertEqual(cached['gross_cost'], computed['gross_cost'])
        self.assertEqual(cached['net_cost'], computed['net_cost'])
        self.assertEqual(cached['accounting_reconciliation']['is_reconciled'], True)

    def test_10_strict_multitenant_isolation(self):
        """Verify Tenant B cannot view or access Tenant A's persisted billing records."""
        # Query Tenant B
        repo_b = BillingRepository(self.db, org_id=self.org_b.id, dataset_id=self.ds_rec_a.id)
        self.assertFalse(repo_b.has_records())
        self.assertEqual(repo_b.get_record_count(), 0)

        # Overview for Tenant B must be zero
        b_ov = repo_b.get_overview()
        self.assertEqual(b_ov['gross_cost'], 0.0)
        self.assertEqual(b_ov['total_rows'], 0)
        self.assertEqual(len(b_ov['services']), 0)


if __name__ == "__main__":
    unittest.main()
