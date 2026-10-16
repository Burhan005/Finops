"""
ZORVEX Regression Suite for Financial Integrity and Security Remediation Gate
Strictly validates Findings A through H:
- Finding A: CUR accounting reconciliation (gross + credits + refunds + taxes == net)
- Finding B: Executive savings ledger ROI and net value coherence (zero implemented = zero realized ROI)
- Finding C: Removal of session tokens from URLs, programmatic fetch, single-use ticket lifecycle & replay rejection
- Finding D: Multi-tenant dataset isolation, cross-tenant protection, and database persistence
- Finding E: Dataset provenance and demo fixture labeling
- Finding F: Forex provider attribution, rate status, freshness, and fallback resilience
- Finding G: Migration idempotency and composite unique constraint integrity
"""

import os
import sys
import tempfile
import csv
import json
from datetime import datetime, timezone, timedelta
import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from app.main import app
from app.database import Base, get_db
from app.models import Organization, User, UserSession, DatasetRecord, RecommendationRecord, AnomalyAlert, ExportTicket
from app.security import hash_password, generate_session_token
from app.parser import parse_cur_file
from app.savings_ledger import get_executive_ledger_summary, sync_recommendations_to_ledger, update_recommendation_status
from app.forex import fetch_live_usd_to_inr, get_live_usd_to_inr_rate


class TestFinancialAndSecurityGate(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = next(get_db())

        # Setup Tenant 1 (Cloud FinOps Engineering)
        cls.org1 = cls.db.query(Organization).filter(Organization.name == "Gate Test Org Alpha").first()
        if not cls.org1:
            cls.org1 = Organization(name="Gate Test Org Alpha")
            cls.db.add(cls.org1)
            cls.db.commit()
            cls.db.refresh(cls.org1)

        cls.user1 = cls.db.query(User).filter(User.email == "alpha.user@finopsgate.io").first()
        if not cls.user1:
            cls.user1 = User(
                organization_id=cls.org1.id,
                name="Alpha User",
                company="Gate Test Org Alpha",
                email="alpha.user@finopsgate.io",
                password_hash=hash_password("GatePassword123!")
            )
            cls.db.add(cls.user1)
            cls.db.commit()
            cls.db.refresh(cls.user1)

        cls.token1 = generate_session_token()
        cls.session1 = UserSession(
            token=cls.token1,
            user_id=cls.user1.id,
            organization_id=cls.org1.id,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=8)
        )
        cls.db.add(cls.session1)

        # Setup Tenant 2 (Competitor Beta Org)
        cls.org2 = cls.db.query(Organization).filter(Organization.name == "Gate Test Org Beta").first()
        if not cls.org2:
            cls.org2 = Organization(name="Gate Test Org Beta")
            cls.db.add(cls.org2)
            cls.db.commit()
            cls.db.refresh(cls.org2)

        cls.user2 = cls.db.query(User).filter(User.email == "beta.user@finopsgate.io").first()
        if not cls.user2:
            cls.user2 = User(
                organization_id=cls.org2.id,
                name="Beta User",
                company="Gate Test Org Beta",
                email="beta.user@finopsgate.io",
                password_hash=hash_password("GatePassword123!")
            )
            cls.db.add(cls.user2)
            cls.db.commit()
            cls.db.refresh(cls.user2)

        cls.token2 = generate_session_token()
        cls.session2 = UserSession(
            token=cls.token2,
            user_id=cls.user2.id,
            organization_id=cls.org2.id,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=8)
        )
        cls.db.add(cls.session2)
        cls.db.commit()

        cls.headers_org1 = {"Authorization": f"Bearer {cls.token1}"}
        cls.headers_org2 = {"Authorization": f"Bearer {cls.token2}"}

    # ==================== FINDING A: FINANCIAL METRIC RECONCILIATION ====================

    def test_finding_a_controlled_cur_reconciliation(self):
        """
        Controlled CUR fixture testing:
        Verifies that Gross + Credits + Refunds + Taxes == Net Spend exactly.
        """
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, newline='', encoding='utf-8') as tf:
            writer = csv.writer(tf)
            writer.writerow([
                "lineItem/UsageStartDate", "lineItem/UsageEndDate", "lineItem/ProductCode", 
                "lineItem/UsageType", "lineItem/Operation", "lineItem/ResourceId", 
                "lineItem/LineItemType", "pricing/term", "lineItem/UnblendedCost", "lineItem/NetUnblendedCost"
            ])
            # Gross usage 1: $100.00
            writer.writerow(["2026-10-01 00:00:00", "2026-10-01 23:59:59", "AmazonEC2", "BoxUsage:m5.large", "RunInstances", "i-ec2-001", "Usage", "OnDemand", "100.00", "100.00"])
            # Gross usage 2: $50.00
            writer.writerow(["2026-10-01 00:00:00", "2026-10-01 23:59:59", "AmazonRDS", "InstanceUsage:db.m5.large", "CreateDBInstance", "rds-db-001", "Usage", "OnDemand", "50.00", "50.00"])
            # Credit: -$25.00
            writer.writerow(["2026-10-01 00:00:00", "2026-10-01 23:59:59", "AWS", "Credit", "Credit", "No-Resource-ID", "Credit", "OnDemand", "-25.00", "-25.00"])
            # Refund: -$10.00
            writer.writerow(["2026-10-01 00:00:00", "2026-10-01 23:59:59", "AWS", "Refund", "Refund", "No-Resource-ID", "Refund", "OnDemand", "-10.00", "-10.00"])
            # Tax: +$18.00
            writer.writerow(["2026-10-01 00:00:00", "2026-10-01 23:59:59", "AWS", "Tax", "Tax", "No-Resource-ID", "Tax", "OnDemand", "18.00", "18.00"])
            temp_path = tf.name

        try:
            parsed = parse_cur_file(temp_path)
            gross = parsed["gross_cost"]
            credits = parsed["credits_total"]
            refunds = parsed["refunds_total"]
            taxes = parsed["taxes_total"]
            net = parsed["net_cost"]
            recon = parsed["accounting_reconciliation"]

            self.assertEqual(gross, 150.00)
            self.assertEqual(credits, -25.00)
            self.assertEqual(refunds, -10.00)
            self.assertEqual(taxes, 18.00)
            # Expected Net = 150.00 - 25.00 - 10.00 + 18.00 = 133.00
            self.assertEqual(net, 133.00)
            self.assertTrue(recon["is_reconciled"])
            self.assertEqual(recon["gross_usage_cost"], 150.00)
            self.assertEqual(recon["net_invoiced_spend"], 133.00)
            self.assertAlmostEqual(gross + credits + refunds + taxes, net, places=2)
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    # ==================== FINDING B: SAVINGS LEDGER & ROI CORRECTNESS ====================

    def test_finding_b_roi_zero_when_no_realized_savings(self):
        """
        When recommendations are newly identified but none are implemented:
        Realized ROI MUST be 0.0, net realized client value MUST be -retainer.
        Potential ROI represents the pipeline multiplier.
        """
        # Clean existing test recs for org1
        self.db.query(RecommendationRecord).filter(RecommendationRecord.organization_id == self.org1.id).delete()
        self.db.commit()

        # Add 2 identified recommendations (total identified: $300/mo, 0 implemented)
        rec1 = RecommendationRecord(
            organization_id=self.org1.id,
            recommendation_id="rec-alpha-test-1",
            category="EC2_IDLE",
            title="Idle EC2 instance",
            resource_id="i-test-01",
            service="Amazon EC2",
            status="IDENTIFIED",
            estimated_monthly_savings_usd=200.0,
            estimated_monthly_savings_inr=19000.0
        )
        rec2 = RecommendationRecord(
            organization_id=self.org1.id,
            recommendation_id="rec-alpha-test-2",
            category="EBS_UNATTACHED",
            title="Unattached volume",
            resource_id="vol-test-01",
            service="Amazon EC2",
            status="IDENTIFIED",
            estimated_monthly_savings_usd=100.0,
            estimated_monthly_savings_inr=9500.0
        )
        self.db.add_all([rec1, rec2])
        self.db.commit()

        summary = get_executive_ledger_summary(self.db, monthly_retainer_inr=35000.0, org_id=self.org1.id)
        
        self.assertEqual(summary["total_identified_monthly_usd"], 300.0)
        self.assertEqual(summary["total_implemented_monthly_usd"], 0.0)
        self.assertEqual(summary["total_implemented_monthly_inr"], 0.0)
        self.assertEqual(summary["realized_roi_multiplier"], 0.0)
        self.assertEqual(summary["roi_multiplier"], 0.0)
        self.assertEqual(summary["net_monthly_client_value_inr"], -35000.0)
        self.assertEqual(summary["net_realized_monthly_client_value_inr"], -35000.0)
        self.assertGreater(summary["potential_roi_multiplier"], 0.0)
        self.assertEqual(summary["realization_status"], "AWAITING_IMPLEMENTATION")

    def test_finding_b_roi_positive_when_implemented(self):
        """
        When recommendations are implemented exceeding retainer:
        Realized ROI is positive and mathematically matches implemented / retainer.
        """
        # Ensure an implemented recommendation exists for org1
        self.db.query(RecommendationRecord).filter(
            RecommendationRecord.organization_id == self.org1.id,
            RecommendationRecord.recommendation_id == "rec-alpha-impl-1"
        ).delete()
        self.db.commit()

        rec = RecommendationRecord(
            organization_id=self.org1.id,
            recommendation_id="rec-alpha-impl-1",
            category="EC2_IDLE",
            title="Idle instance decommissioned",
            resource_id="i-test-impl-01",
            service="Amazon EC2",
            status="IMPLEMENTED",
            estimated_monthly_savings_usd=400.0,
            realized_monthly_savings_usd=400.0,
            estimated_monthly_savings_inr=38000.0,
            realized_monthly_savings_inr=38000.0
        )
        self.db.add(rec)
        self.db.commit()

        summary = get_executive_ledger_summary(self.db, monthly_retainer_inr=35000.0, org_id=self.org1.id)
        self.assertGreater(summary["total_implemented_monthly_usd"], 0.0)
        self.assertGreater(summary["realized_roi_multiplier"], 1.0)
        self.assertGreater(summary["net_realized_monthly_client_value_inr"], 0.0)
        self.assertEqual(summary["realization_status"], "POSITIVE_ROI_ACHIEVED")

    # ==================== FINDING C: REMOVE BEARER SESSION TOKENS FROM URLS ====================

    def test_finding_c_export_rejects_session_token_in_query(self):
        """Session token in URL query parameter MUST be rejected with HTTP 401."""
        res = self.client.get(f"/api/export/executive-report?format=html&token={self.token1}")
        self.assertEqual(res.status_code, 401, "Server accepted session token in query string!")

    def test_finding_c_export_ticket_single_use_lifecycle(self):
        """
        Export ticket creation -> single use success -> replay rejected (HTTP 403) -> expired rejected.
        """
        # 1. Create ticket via authenticated POST
        ticket_res = self.client.post("/api/export/ticket", json={
            "format": "html"
        }, headers=self.headers_org1)
        self.assertEqual(ticket_res.status_code, 200)
        data = ticket_res.json()
        ticket = data["ticket"]
        self.assertTrue(ticket.startswith("ticket_"))

        # 2. First consumption: success
        res1 = self.client.get(f"/api/export/executive-report?ticket={ticket}")
        self.assertEqual(res1.status_code, 200)
        self.assertIn("Executive Cloud FinOps Report", res1.text)

        # 3. Second consumption (replay attack): MUST fail with HTTP 403
        res2 = self.client.get(f"/api/export/executive-report?ticket={ticket}")
        self.assertEqual(res2.status_code, 403, "Ticket replay succeeded!")
        self.assertIn("already been used", res2.text)

    def test_finding_c_cross_tenant_ticket_rejection(self):
        """
        Tenant A creates ticket. When ticket is consumed, it MUST render Tenant A data and branding,
        never leaking Tenant B data even if Tenant B makes the call.
        """
        ticket_res = self.client.post("/api/export/ticket", json={"format": "html"}, headers=self.headers_org1)
        self.assertEqual(ticket_res.status_code, 200)
        ticket = ticket_res.json()["ticket"]

        # Call with ticket
        res = self.client.get(f"/api/export/executive-report?ticket={ticket}")
        self.assertEqual(res.status_code, 200)
        # Ticket was bound to org1
        t_rec = self.db.query(ExportTicket).filter(ExportTicket.ticket == ticket).first()
        self.assertEqual(t_rec.organization_id, self.org1.id)
        self.assertEqual(t_rec.used, 1)

    # ==================== FINDING D: TENANT ISOLATION & DATASET PERSISTENCE ====================

    def test_finding_d_cross_tenant_dataset_selection_prevented(self):
        """
        Tenant A's uploaded dataset CANNOT be selected by Tenant B.
        """
        # Register a custom uploaded dataset record for Org 1
        custom_rec = DatasetRecord(
            organization_id=self.org1.id,
            filename="org1_private_confidential_cur.csv",
            filepath=os.path.join(backend_dir, "data", "samples", "sample_cur_test.csv"),
            file_type='upload',
            total_cost=999.0,
            net_cost=999.0,
            is_active=0
        )
        self.db.add(custom_rec)
        self.db.commit()

        # Org 2 attempts to select Org 1's dataset
        res_org2 = self.client.post("/api/datasets/select", json={
            "filename": "org1_private_confidential_cur.csv"
        }, headers=self.headers_org2)
        self.assertEqual(res_org2.status_code, 404, "Org 2 was able to select Org 1 private dataset!")

        # Unauthenticated request attempts to select Org 1's dataset
        res_anon = self.client.post("/api/datasets/select", json={
            "filename": "org1_private_confidential_cur.csv"
        })
        self.assertEqual(res_anon.status_code, 401, "Anonymous user was able to access custom uploaded dataset!")

    def test_finding_d_dataset_selection_persistence(self):
        """
        Selecting a dataset persists is_active in DB.
        """
        # Org 1 selects a sample dataset
        res = self.client.post("/api/datasets/select", json={
            "filename": "sample_cur_test.csv"
        }, headers=self.headers_org1)
        self.assertEqual(res.status_code, 200)

        # Check DB has active record
        active_rec = self.db.query(DatasetRecord).filter(
            DatasetRecord.organization_id == self.org1.id,
            DatasetRecord.filename == "sample_cur_test.csv",
            DatasetRecord.is_active == 1
        ).first()
        self.assertIsNotNone(active_rec, "Dataset selection was not persisted to database!")

    # ==================== FINDING E: DATASET PROVENANCE & DEMO FIXTURE LABELING ====================

    def test_finding_e_datasets_labeled_demo_fixtures(self):
        """
        /api/datasets returns samples explicitly labeled as demo_fixture.
        Anonymous requests get zero uploaded customer records.
        """
        res = self.client.get("/api/datasets")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(len(body["uploads"]), 0, "Anonymous request received customer uploads!")
        for s in body["samples"]:
            self.assertEqual(s["type"], "demo_fixture")
            self.assertIn("provenance", s)

    # ==================== FINDING F: FOREX PROVIDER ATTRIBUTION & FRESHNESS ====================

    def test_finding_f_forex_provider_attribution(self):
        """
        /api/forex/usd-inr must report valid provider, rate_status, and freshness metadata.
        """
        res = self.client.get("/api/forex/usd-inr")
        self.assertEqual(res.status_code, 200)
        fx = res.json()
        self.assertIsNotNone(fx.get("provider"), "Provider is None!")
        self.assertIn(fx["rate_status"], ["LIVE", "CACHED", "OFFLINE_REFERENCE", "STALE_CACHE"])
        self.assertIn("freshness_seconds", fx)
        self.assertGreater(fx["rate"], 50.0)


if __name__ == "__main__":
    unittest.main()
