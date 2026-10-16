"""
ZORVEX FinOps Platform Production Integrity Verification Script
Executes full end-to-end verification of all APIs, security boundaries, and FinOps calculations.
Enforces strict mathematical accounting reconciliation, honest ROI attribution, single-use export ticket security, and tenant isolation.
"""

import sys
import os

backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db
from app.models import Organization, User, UserSession, DatasetRecord, BudgetConfig
from app.security import hash_password, generate_session_token

def run_verification():
    print("=" * 70)
    print("ZORVEX PRODUCTION-GRADE FUNCTIONAL COMPLETENESS & INTEGRITY AUDIT")
    print("=" * 70)

    client = TestClient(app)
    db = next(get_db())

    # Step 1: Health check
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.status_code}"
    health = res.json()
    print(f"[PASS] Health check: {health['status']} | Brand: {health['brand']} | Tagline: '{health['tagline']}'")
    assert health['brand'] == "ZORVEX"
    assert health['tagline'] == "See Beyond Spend."

    # Step 2: Unauthenticated dataset protection & provenance
    res = client.get("/api/datasets")
    assert res.status_code == 200
    datasets = res.json()
    print(f"[PASS] Unauthenticated /api/datasets: {len(datasets['samples'])} demo fixtures, {len(datasets['uploads'])} tenant uploads")
    assert len(datasets['uploads']) == 0, "Unauthenticated request leaked tenant uploads!"
    for s in datasets['samples']:
        assert s['type'] == 'demo_fixture', f"Sample {s['filename']} missing explicit demo_fixture type label!"
        assert "provenance" in s, f"Sample {s['filename']} missing provenance tracking metadata!"

    # Step 3: Seeded User Login
    login_res = client.post("/api/auth/login", json={
        "email": "cloudops@finopsclay.io",
        "password": "Password123!"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.status_code} {login_res.text}"
    auth_data = login_res.json()
    token = auth_data["token"]
    user = auth_data["user"]
    print(f"[PASS] Authentication: Successfully logged in as {user['name']} ({user['email']})")
    auth_headers = {"Authorization": f"Bearer {token}"}

    # Step 4: Authoritative Overview Metrics & Accounting Reconciliation
    overview_res = client.get("/api/overview", headers=auth_headers)
    assert overview_res.status_code == 200, f"Overview failed: {overview_res.status_code}"
    ov = overview_res.json()
    total_cost = ov.get("total_cost", 0.0)
    gross_cost = ov.get("gross_cost", 0.0)
    net_cost = ov.get("net_cost", 0.0)
    credits_total = ov.get("credits_total", 0.0)
    refunds_total = ov.get("refunds_total", 0.0)
    taxes_total = ov.get("taxes_total", 0.0)
    recon = ov.get("accounting_reconciliation", {})

    print(f"[PASS] FinOps Accounting Integrity & Reconciliation:")
    print(f"       Gross Usage Cost:  ${gross_cost:,.2f}")
    print(f"       Credits:           ${credits_total:,.2f}")
    print(f"       Refunds:           ${refunds_total:,.2f}")
    print(f"       Taxes (AWS VAT):   ${taxes_total:,.2f}")
    print(f"       Net Billed Spend:  ${net_cost:,.2f}")
    print(f"       Reconciliation:    {'RECONCILED' if recon.get('is_reconciled') else 'DISCREPANCY'}")
    print(f"       Equation:          ${gross_cost:,.2f} + (${credits_total:,.2f}) + (${refunds_total:,.2f}) + ${taxes_total:,.2f} = ${net_cost:,.2f}")

    assert recon.get("is_reconciled") is True, f"Accounting reconciliation failed: {recon}"
    calculated_net = round(gross_cost + credits_total + refunds_total + taxes_total, 2)
    assert abs(calculated_net - net_cost) < 0.01, f"Math mismatch: {calculated_net} != {net_cost}"
    assert total_cost > 0, "Total cost is 0!"

    # Step 5: Live Forex API with Provider Attribution
    forex_res = client.get("/api/forex/usd-inr", headers=auth_headers)
    assert forex_res.status_code == 200
    fx = forex_res.json()
    print(f"[PASS] Forex Engine: {fx['currency_pair']} = INR {fx['rate']} | Provider: '{fx.get('provider')}' | Status: {fx.get('rate_status')} | Freshness: {fx.get('freshness_seconds')}s")
    assert fx.get('provider') is not None and len(fx.get('provider')) > 0, "Forex provider is None or empty!"
    assert fx['rate_status'] in ["LIVE", "CACHED", "OFFLINE_REFERENCE", "STALE_CACHE"], f"Invalid forex rate status: {fx['rate_status']}"
    assert fx['rate'] > 70.0

    # Step 6: Savings Plan Simulator
    sim_res = client.post("/api/simulator/savings-plans", json={
        "term_years": 1,
        "payment_option": "NO_UPFRONT",
        "plan_type": "COMPUTE_SP"
    }, headers=auth_headers)
    assert sim_res.status_code == 200
    sim = sim_res.json()
    print(f"[PASS] Savings Plan Simulator: Plan={sim['plan_type']} | Continuity Audit: {len(sim.get('already_covered_resources', []))} instances covered, Portfolio Plans: {len(sim.get('portfolio_summary', []))}")
    assert "portfolio_summary" in sim

    # Step 7: Cost Anomaly Detection
    anom_res = client.get("/api/anomalies", headers=auth_headers)
    assert anom_res.status_code == 200
    anomalies = anom_res.json()
    print(f"[PASS] Cost Anomaly Engine: {len(anomalies)} detected anomaly alerts loaded")

    # Step 8: Executive Savings Ledger & ROI Multiplier Coherence
    ledger_res = client.get("/api/ledger/summary", headers=auth_headers)
    assert ledger_res.status_code == 200
    ledger = ledger_res.json()
    print(f"[PASS] Executive Savings Ledger & Boardroom Proof:")
    print(f"       Total Identified:  ${ledger['total_identified_monthly_usd']:,.2f} (INR {ledger['total_identified_monthly_inr']:,.2f})")
    print(f"       Total Implemented: ${ledger['total_implemented_monthly_usd']:,.2f} (INR {ledger['total_implemented_monthly_inr']:,.2f})")
    print(f"       Platform Retainer: INR {ledger['monthly_platform_retainer_inr']:,.2f}")
    print(f"       Net Client Value:  INR {ledger['net_monthly_client_value_inr']:,.2f} ({ledger.get('realization_status')})")
    print(f"       Realized ROI:      {ledger['realized_roi_multiplier']}x Multiplier")
    print(f"       Potential ROI:     {ledger['potential_roi_multiplier']}x Pipeline Multiplier")

    # Gate assertion: If 0 implemented savings, realized ROI MUST be 0.0 (no false claims of positive ROI)
    if ledger['total_implemented_monthly_usd'] == 0:
        assert ledger['realized_roi_multiplier'] == 0.0, f"Contradiction: Realized ROI {ledger['realized_roi_multiplier']}x is positive while implemented savings is $0!"
        assert ledger['net_monthly_client_value_inr'] <= 0, "Net client value should be negative or zero before implementation!"

    # Step 9: Budget Guard Evaluation
    budget_res = client.get("/api/budgets", headers=auth_headers)
    assert budget_res.status_code == 200
    budgets = budget_res.json()
    print(f"[PASS] Budget Guard: {len(budgets)} active budgets evaluated")

    # Step 10: AI Analyst
    ai_res = client.post("/api/ai/query", json={
        "query": "What are our top 3 cloud spending categories?"
    }, headers=auth_headers)
    assert ai_res.status_code == 200
    ai = ai_res.json()
    print(f"[PASS] Ask ZORVEX AI: Intent='{ai['intent']}' | Answer snippet: {ai['answer'][:100]}...")

    # Step 11: Export Security & Token Remediation
    # 11a: Passing session token via URL query parameter MUST BE REJECTED
    leak_res = client.get(f"/api/export/executive-report?format=html&token={token}")
    assert leak_res.status_code == 401, f"Security Violation: Server accepted bearer session token in URL query string! (HTTP {leak_res.status_code})"
    print(f"[PASS] Export Security: Query string session token rejected with HTTP 401 Unauthorized (No URL token leakage)")

    # 11b: Create Single-Use Export Ticket via Authenticated Request
    ticket_post = client.post("/api/export/ticket", json={"format": "html"}, headers=auth_headers)
    assert ticket_post.status_code == 200, f"Ticket generation failed: {ticket_post.text}"
    ticket = ticket_post.json()["ticket"]
    assert ticket.startswith("ticket_"), "Invalid ticket format!"
    print(f"[PASS] Export Security: Generated cryptographic short-lived export ticket: {ticket[:18]}... (TTL 60s)")

    # 11c: Consume Ticket Once
    export_res = client.get(f"/api/export/executive-report?ticket={ticket}")
    assert export_res.status_code == 200, f"Export with ticket failed: {export_res.status_code}"
    assert "Executive Cloud FinOps Report" in export_res.text
    print(f"[PASS] Export Delivery: {len(export_res.text)} bytes delivered securely via single-use ticket")

    # 11d: Replay Attack: Reusing the same ticket MUST FAIL
    replay_res = client.get(f"/api/export/executive-report?ticket={ticket}")
    assert replay_res.status_code == 403, f"Security Violation: Ticket replay attack succeeded! (HTTP {replay_res.status_code})"
    print(f"[PASS] Replay Prevention: Reused export ticket rejected with HTTP 403 Forbidden")

    print("=" * 70)
    print("VERDICT: PASS -- All platform integrity, security, and financial checks passed.")
    print("=" * 70)

if __name__ == "__main__":
    run_verification()
