"""
Comprehensive End-to-End Live Feature Verification Test
Verifies all 8 main views and workflows against the live running backend on port 8050.
"""

import requests
import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8050"
HEADERS = {"Content-Type": "application/json"}

def log_test(name, passed, details=""):
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {name}{': ' + details if details else ''}")
    if not passed:
        sys.exit(1)

def run_e2e_tests():
    print("=== STARTING FULL PRODUCT END-TO-END VERIFICATION ===")

    # 1. Overview & Telemetry
    r = requests.get(f"{BASE_URL}/api/overview")
    log_test("GET /api/overview", r.status_code == 200, f"Total Cost: ${r.json().get('total_cost', 0):,.2f}")
    data = r.json()
    assert "gross_cost" in data or "total_cost" in data
    assert "dates" in data and len(data["dates"]) > 0

    # 2. Trends
    r = requests.get(f"{BASE_URL}/api/trends")
    log_test("GET /api/trends", r.status_code == 200, f"Daily points: {len(r.json().get('daily', []))}")

    # 3. Forex Rate
    r = requests.get(f"{BASE_URL}/api/forex/usd-inr")
    log_test("GET /api/forex/usd-inr", r.status_code == 200, f"Rate: {r.json().get('formatted')} (Live: {r.json().get('is_live')})")

    # 4. Datasets
    r = requests.get(f"{BASE_URL}/api/datasets")
    log_test("GET /api/datasets", r.status_code == 200, f"Active: {r.json().get('active')}")

    # 5. Unit Economics
    r = requests.get(f"{BASE_URL}/api/settings/unit-economics")
    log_test("GET /api/settings/unit-economics", r.status_code == 200)

    # 6. Cost Comparison & Daily Delta
    days = data.get("dates", [])
    if len(days) >= 2:
        m_start, m_end = days[0], days[-1]
        r_comp = requests.post(f"{BASE_URL}/api/compare", json={"baseline_date": m_start, "target_date": m_end}, headers=HEADERS)
        log_test(f"POST /api/compare ({m_start} vs {m_end})", r_comp.status_code == 200, f"Cost Start: ${r_comp.json().get('cost_start', 0):,.2f}, End: ${r_comp.json().get('cost_end', 0):,.2f}, Diff: ${r_comp.json().get('diff', 0):,.2f}")

        r_delta = requests.post(f"{BASE_URL}/api/analytics/daily-delta", json={"target_date": m_end, "baseline_date": m_start}, headers=HEADERS)
        log_test(f"POST /api/analytics/daily-delta ({m_start} -> {m_end})", r_delta.status_code == 200, f"Delta: ${r_delta.json().get('diff', 0):,.2f}")

    # 7. Recommendations & Waste Hunter
    r_recs = requests.get(f"{BASE_URL}/api/recommendations")
    log_test("GET /api/recommendations", r_recs.status_code == 200)
    recs = r_recs.json()
    rec_list = recs.get("recommendations", [])
    log_test("Recommendations items check", isinstance(rec_list, list), f"Found {len(rec_list)} recommendations")

    # 8. Savings Plan Simulator (All 7 classes)
    for p in ['COMPUTE_SP', 'EC2_INSTANCE_SP', 'EC2_STANDARD_RI', 'RDS_RI', 'OPENSEARCH_RI', 'ELASTICACHE_RI', 'DOCDB_RI']:
        r_sim = requests.post(f"{BASE_URL}/api/simulator/savings-plans", json={"plan_type": p}, headers=HEADERS)
        log_test(f"POST /api/simulator/savings-plans ({p})", r_sim.status_code == 200, f"Display: {r_sim.json().get('recommended_display')}")

    # Test RDS what-if capacity simulation
    r_rds_whatif = requests.post(f"{BASE_URL}/api/simulator/savings-plans", json={"plan_type": "RDS_RI", "reserved_units": 1}, headers=HEADERS)
    log_test("POST /api/simulator/savings-plans (RDS what-if 1 unit)", r_rds_whatif.status_code == 200 and r_rds_whatif.json().get("risk_level") == "WHAT_IF_EXPANSION", f"Savings: ${r_rds_whatif.json().get('monthly_net_savings_usd')}/mo")

    # 9. Savings Ledger
    r_ledger_rec = requests.get(f"{BASE_URL}/api/ledger/records")
    log_test("GET /api/ledger/records", r_ledger_rec.status_code == 200, f"Records: {len(r_ledger_rec.json())}")

    r_ledger_sum = requests.get(f"{BASE_URL}/api/ledger/summary")
    log_test("GET /api/ledger/summary", r_ledger_sum.status_code == 200, f"Realized Savings: ${r_ledger_sum.json().get('realized_monthly_savings_usd', 0):,.2f}")

    # 10. Resource Explorer & Snapshot Intelligence
    r_hier = requests.get(f"{BASE_URL}/api/resources/hierarchies")
    log_test("GET /api/resources/hierarchies", r_hier.status_code == 200, f"Discovered {len(r_hier.json().get('services', []))} services")
    hier_json = r_hier.json()
    assert "services" in hier_json and "snapshots_and_backups" in hier_json
    service_names = [s['name'] for s in hier_json.get('services', [])]
    assert "Amazon EC2" in service_names
    assert "Amazon RDS" in service_names
    
    r_res = requests.get(f"{BASE_URL}/api/resources?page=1&limit=25")
    log_test("GET /api/resources (Page 1)", r_res.status_code == 200, f"Total matched resources: {r_res.json().get('total_matches', 0)}, Pages: {r_res.json().get('pagination', {}).get('total_pages', 0)}")
    res_data = r_res.json()
    assert "resources" in res_data and len(res_data["resources"]) > 0
    assert "summary" in res_data
    assert "pagination" in res_data
    
    # Test Snapshots & Backups scope
    r_snap = requests.get(f"{BASE_URL}/api/resources?service=SNAPSHOTS_BACKUPS")
    log_test("GET /api/resources (Snapshots & Backups)", r_snap.status_code == 200, f"Snapshots & Backups: {r_snap.json().get('total_matches', 0)} items")
    snap_data = r_snap.json()
    assert "snapshots_summary" in snap_data
    snap_intel = snap_data["snapshots_summary"]
    log_test("Snapshot Intelligence Metrics", snap_intel.get("total_snapshot_cost", 0) > 0, f"Total Snapshot Spend: ${snap_intel.get('total_snapshot_cost', 0):,.2f} across {snap_intel.get('unique_snapshots_count', 0)} assets")

    # Test Resource Detail Endpoint
    real_res = next((r for r in res_data["resources"] if not r["resource_id"].startswith("No-Resource-ID")), res_data["resources"][0])
    r_det = requests.get(f"{BASE_URL}/api/resources/detail", params={"resource_id": real_res["resource_id"]})
    log_test(f"GET /api/resources/detail ({real_res['resource_id'][:30]}...)", r_det.status_code == 200 and len(r_det.json().get('line_items', [])) > 0, f"Found {len(r_det.json().get('line_items', []))} audit line items")

    # 11. Anomalies & Budgets
    r_anom = requests.get(f"{BASE_URL}/api/anomalies")
    log_test("GET /api/anomalies", r_anom.status_code == 200, f"Anomalies count: {len(r_anom.json())}")

    r_forecast = requests.get(f"{BASE_URL}/api/forecast")
    log_test("GET /api/forecast", r_forecast.status_code == 200, f"Projected Month End: ${r_forecast.json().get('projected_month_end_cost', 0):,.2f}")

    r_budgets = requests.get(f"{BASE_URL}/api/budgets")
    log_test("GET /api/budgets", r_budgets.status_code == 200, f"Budgets count: {len(r_budgets.json())}")

    # 12. Ask ZORVEX AI
    r_ai = requests.post(f"{BASE_URL}/api/ai/query", json={"query": "What are my top cloud cost drivers?"}, headers=HEADERS)
    log_test("POST /api/ai/query", r_ai.status_code == 200, f"Response preview: {r_ai.json().get('response', '')[:80]}...")

    # 13. Settings (S3, Branding, Unit Economics)
    r_s3 = requests.get(f"{BASE_URL}/api/s3/config")
    log_test("GET /api/s3/config", r_s3.status_code == 200, f"Configured: {r_s3.json().get('configured')}")

    r_brand = requests.get(f"{BASE_URL}/api/branding")
    log_test("GET /api/branding", r_brand.status_code == 200, f"Agency: {r_brand.json().get('agency_name')}")

    print("\n=== ALL 13 END-TO-END FEATURE VERIFICATIONS PASSED (VERDICT: PASS) ===")

if __name__ == "__main__":
    run_e2e_tests()
