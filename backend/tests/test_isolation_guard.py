"""
Test Suite for Database Hard-Isolation Guard
Verifies that test execution environments are strictly prohibited from binding to
or mutating the production database (backend/data/finops.db).
"""

import os
import sys
import sqlite3
import pytest

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database import engine, DB_PATH, check_test_database_isolation


def test_engine_url_is_strictly_isolated():
    """Assert that the running test suite's engine binds exclusively to isolated test database."""
    url_str = str(engine.url).replace('\\', '/').lower()
    assert "zorvex_isolated_test.db" in url_str, f"Test engine must use isolated test DB, found: {engine.url}"
    assert "finops.db" not in url_str, f"CRITICAL: Test engine bound to production database: {engine.url}"


def test_guard_rejects_production_finops_db():
    """Verify that check_test_database_isolation raises RuntimeError when pointing to finops.db."""
    with pytest.raises(RuntimeError) as exc_info:
        check_test_database_isolation(f"sqlite:///{DB_PATH}", is_test=True)
    assert "CRITICAL TEST ISOLATION FAILURE" in str(exc_info.value)

    with pytest.raises(RuntimeError) as exc_info2:
        check_test_database_isolation("sqlite:///C:/Users/Burhan_Kapasi/Desktop/FinOps_Clay_Platform/backend/data/finops.db", is_test=True)
    assert "CRITICAL TEST ISOLATION FAILURE" in str(exc_info2.value)

    # Empty URL in test mode must also be rejected
    with pytest.raises(RuntimeError) as exc_info3:
        check_test_database_isolation("", is_test=True)
    assert "CRITICAL TEST ISOLATION FAILURE" in str(exc_info3.value)


def test_guard_allows_isolated_test_database():
    """Verify that check_test_database_isolation succeeds for valid isolated URLs."""
    assert check_test_database_isolation("sqlite:///:memory:", is_test=True) is True
    assert check_test_database_isolation("sqlite:///C:/Temp/zorvex_test_123.db", is_test=True) is True
    assert check_test_database_isolation("sqlite:///C:/Users/AppData/Local/Temp/zorvex_isolated_test.db", is_test=True) is True


def test_production_finops_db_remains_unmodified():
    """Verify production database file size and record counts remain completely intact."""
    assert os.path.exists(DB_PATH), f"Production database must exist at {DB_PATH}"
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM billing_records")
    br_cnt = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM datasets")
    ds_cnt = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM users")
    u_cnt = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM organizations")
    org_cnt = cur.fetchone()[0]
    conn.close()

    assert br_cnt == 31885, f"Production billing_records altered! Expected 31885, got {br_cnt}"
    assert ds_cnt == 176, f"Production datasets altered! Expected 176, got {ds_cnt}"
    assert u_cnt == 25, f"Production users altered! Expected 25, got {u_cnt}"
    assert org_cnt == 14, f"Production organizations altered! Expected 14, got {org_cnt}"
