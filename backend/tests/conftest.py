import os
import sys
import tempfile
import pytest

# Ensure isolated test database is configured BEFORE application/database modules are imported
_TEST_DB_PATH = os.path.join(tempfile.gettempdir(), 'zorvex_isolated_test.db')
if os.path.exists(_TEST_DB_PATH):
    try:
        os.remove(_TEST_DB_PATH)
    except Exception:
        pass

os.environ['DATABASE_URL'] = f"sqlite:///{_TEST_DB_PATH}"
os.environ['IS_TEST_ENV'] = "1"

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database import engine, Base, SessionLocal, get_db
from app.models import (
    Organization, User, UserSession, PasswordResetToken,
    BudgetConfig, DatasetRecord, BillingRecord, S3SyncConfig,
    AuditEvent, AiAnalystQuery, RecommendationRecord, AnomalyAlert,
    ExportTicket, AgencyBrandingConfig, UnitEconomicsConfig
)

# Initialize database schema in isolated test DB
Base.metadata.create_all(bind=engine)

@pytest.fixture(scope="session", autouse=True)
def verify_test_isolation():
    """Guarantees that test suite is strictly running against isolated test database."""
    db_url = str(engine.url).replace('\\', '/').lower()
    assert "zorvex_isolated_test.db" in db_url, f"CRITICAL: Tests running against non-isolated DB: {engine.url}"
    assert "finops.db" not in db_url, f"CRITICAL: Tests bound to production database: {engine.url}"
    
    # Also enforce FastAPI app dependency override if app is imported
    try:
        from app.main import app
        def override_get_db():
            db = SessionLocal()
            try:
                yield db
            finally:
                db.close()
        app.dependency_overrides[get_db] = override_get_db
    except Exception:
        pass

    yield
