"""
Database configuration using SQLite with SQLAlchemy.
Easily switchable to PostgreSQL by setting DATABASE_URL.
"""

import os
import sys
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, 'data', 'finops.db')

DATABASE_URL = os.getenv('DATABASE_URL', f"sqlite:///{DB_PATH}")

def check_test_database_isolation(db_url: str, is_test: bool = None) -> bool:
    """
    Enforces strict test isolation: fails fast if any test process attempts to bind
    to the production database (finops.db).
    """
    if is_test is None:
        is_test = (
            os.getenv('IS_TEST_ENV') == '1' or
            'pytest' in sys.modules or
            'unittest' in sys.modules or
            any('pytest' in str(arg).lower() for arg in sys.argv) or
            any('unittest' in str(arg).lower() for arg in sys.argv) or
            any(str(arg).endswith('.py') and ('test_' in str(arg) or '_test.py' in str(arg)) for arg in sys.argv)
        )
    if is_test:
        clean_url = (db_url or '').replace('\\', '/').lower()
        if not clean_url or 'finops.db' in clean_url:
            raise RuntimeError(
                f"CRITICAL TEST ISOLATION FAILURE: Test process attempted to bind to production database '{db_url}'. "
                "Tests must strictly run against an isolated temporary or in-memory test database."
            )
    return True

# Enforce fail-fast guard immediately upon module import
check_test_database_isolation(DATABASE_URL)

engine_kwargs = {
    "connect_args": {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
}
if DATABASE_URL.startswith("sqlite"):
    if ":memory:" in DATABASE_URL:
        from sqlalchemy.pool import StaticPool
        engine_kwargs["poolclass"] = StaticPool
    else:
        engine_kwargs.update({
            "pool_size": 25,
            "max_overflow": 25,
            "pool_timeout": 30,
            "pool_pre_ping": True,
        })

engine = create_engine(
    DATABASE_URL,
    **engine_kwargs
)

# Enforce SQLite foreign keys, Write-Ahead Logging (WAL), memory cache, and busy timeouts for reliable concurrency
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if DATABASE_URL.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        if ":memory:" not in DATABASE_URL:
            cursor.execute("PRAGMA journal_mode = WAL")
            cursor.execute("PRAGMA synchronous = NORMAL")
        cursor.execute("PRAGMA foreign_keys = ON")
        cursor.execute("PRAGMA busy_timeout = 15000")
        cursor.execute("PRAGMA cache_size = -64000")
        cursor.execute("PRAGMA temp_store = MEMORY")
        cursor.execute("PRAGMA mmap_size = 268435456")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
