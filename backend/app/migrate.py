"""
Database Migration Script for ZORVEX Phase 2
Adds organizations, password reset tokens, billing records, and organization scoping.
"""

import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "..", "data", "finops.db")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# 1. Create organizations table if not exists
cursor.execute("""
CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(128) UNIQUE NOT NULL,
    created_at DATETIME
)""")

# 2. Insert default organization for existing users
cursor.execute("INSERT OR IGNORE INTO organizations (id, name, created_at) VALUES (1, 'Cloud FinOps Engineering', datetime('now'))")

# 3. Create password_reset_tokens table if not exists
cursor.execute("""
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    used INTEGER DEFAULT 0,
    created_at DATETIME
)""")

# 4. Create billing_records table if not exists
cursor.execute("""
CREATE TABLE IF NOT EXISTS billing_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    usage_date VARCHAR(16) NOT NULL,
    usage_month VARCHAR(16) NOT NULL,
    usage_hour VARCHAR(8) DEFAULT '00:00',
    service VARCHAR(64) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    short_id VARCHAR(128) DEFAULT '',
    account_id VARCHAR(64) NOT NULL,
    region VARCHAR(64) NOT NULL,
    cost FLOAT NOT NULL DEFAULT 0.0,
    unblended_cost FLOAT NOT NULL DEFAULT 0.0,
    line_item_type VARCHAR(32) NOT NULL,
    usage_type VARCHAR(128) DEFAULT '',
    pricing_term VARCHAR(32) DEFAULT 'OnDemand',
    resource_name VARCHAR(255) DEFAULT '',
    sp_arn VARCHAR(255) DEFAULT '',
    ri_arn VARCHAR(255) DEFAULT '',
    created_at DATETIME
)""")

# Add indexes on billing_records
cursor.execute("CREATE INDEX IF NOT EXISTS ix_billing_records_org ON billing_records(organization_id)")
cursor.execute("CREATE INDEX IF NOT EXISTS ix_billing_records_dataset ON billing_records(dataset_id)")
cursor.execute("CREATE INDEX IF NOT EXISTS ix_billing_records_date ON billing_records(usage_date)")
cursor.execute("CREATE INDEX IF NOT EXISTS ix_billing_records_service ON billing_records(service)")
cursor.execute("CREATE INDEX IF NOT EXISTS ix_billing_records_resource ON billing_records(resource_id)")

# Function to safely add a column if missing
def add_column(table, column, col_type):
    cursor.execute(f"PRAGMA table_info({table})")
    columns = [row[1] for row in cursor.fetchall()]
    if column not in columns:
        print(f"Adding {column} to {table}...")
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")

add_column("users", "organization_id", "INTEGER REFERENCES organizations(id)")
add_column("user_sessions", "organization_id", "INTEGER REFERENCES organizations(id)")
add_column("user_sessions", "expires_at", "DATETIME")
add_column("datasets", "organization_id", "INTEGER REFERENCES organizations(id)")
add_column("datasets", "checksum_sha256", "VARCHAR(64)")
add_column("datasets", "net_cost", "FLOAT DEFAULT 0.0")
add_column("datasets", "credits_total", "FLOAT DEFAULT 0.0")
add_column("datasets", "refunds_total", "FLOAT DEFAULT 0.0")
add_column("datasets", "taxes_total", "FLOAT DEFAULT 0.0")
add_column("datasets", "is_active", "INTEGER DEFAULT 0")
add_column("datasets", "billing_period_start", "VARCHAR(32)")
add_column("datasets", "billing_period_end", "VARCHAR(32)")
add_column("datasets", "payer_account_id", "VARCHAR(64)")
add_column("datasets", "assembly_id", "VARCHAR(128)")
add_column("datasets", "manifest_metadata", "TEXT")
add_column("datasets", "revision_version", "INTEGER DEFAULT 1")
add_column("datasets", "superseded_dataset_id", "INTEGER REFERENCES datasets(id)")
add_column("billing_records", "line_item_id", "VARCHAR(255)")
add_column("audit_events", "organization_id", "INTEGER REFERENCES organizations(id)")
add_column("audit_events", "user_id", "INTEGER REFERENCES users(id)")
add_column("audit_events", "ip_address", "VARCHAR(64)")
add_column("s3_sync_configs", "organization_id", "INTEGER REFERENCES organizations(id)")
add_column("agency_branding_configs", "organization_id", "INTEGER REFERENCES organizations(id)")
add_column("unit_economics_configs", "organization_id", "INTEGER REFERENCES organizations(id)")
add_column("recommendations", "organization_id", "INTEGER REFERENCES organizations(id)")
add_column("anomaly_alerts", "organization_id", "INTEGER REFERENCES organizations(id)")
add_column("budget_configs", "organization_id", "INTEGER REFERENCES organizations(id)")
add_column("forecast_runs", "organization_id", "INTEGER REFERENCES organizations(id)")
add_column("ai_analyst_queries", "organization_id", "INTEGER REFERENCES organizations(id)")
add_column("s3_sync_execution_history", "organization_id", "INTEGER REFERENCES organizations(id)")

cursor.execute("CREATE INDEX IF NOT EXISTS ix_billing_records_line_item ON billing_records(line_item_id)")
cursor.execute("CREATE INDEX IF NOT EXISTS ix_datasets_org_period ON datasets(organization_id, billing_period_start, billing_period_end)")


def ensure_schema_compatibility(target_engine):
    """
    Safely adds missing Phase 1 columns to existing SQLite tables if not present.
    Executes in a safe inspection pass without resetting or vacuuming database.
    """
    with target_engine.connect() as conn:
        def _get_cols(tbl):
            res = conn.exec_driver_sql(f"PRAGMA table_info({tbl})").fetchall()
            return [r[1] for r in res]

        ds_cols = _get_cols("datasets")
        phase1_ds_cols = [
            ("billing_period_start", "VARCHAR(32)"),
            ("billing_period_end", "VARCHAR(32)"),
            ("payer_account_id", "VARCHAR(64)"),
            ("usage_account_id", "VARCHAR(64)"),
            ("account_name", "VARCHAR(128)"),
            ("assembly_id", "VARCHAR(128)"),
            ("manifest_metadata", "TEXT"),
            ("revision_version", "INTEGER DEFAULT 1"),
            ("superseded_dataset_id", "INTEGER REFERENCES datasets(id)")
        ]
        for col_name, col_def in phase1_ds_cols:
            if col_name not in ds_cols:
                conn.exec_driver_sql(f"ALTER TABLE datasets ADD COLUMN {col_name} {col_def}")

        # Safe backfill of usage_account_id for datasets where it is NULL
        try:
            conn.exec_driver_sql("""
                UPDATE datasets
                SET usage_account_id = (
                    SELECT account_id FROM billing_records
                    WHERE billing_records.dataset_id = datasets.id
                      AND account_id IS NOT NULL AND account_id != 'Unknown'
                    LIMIT 1
                )
                WHERE usage_account_id IS NULL
            """)
        except Exception:
            pass

        br_cols = _get_cols("billing_records")
        if "line_item_id" not in br_cols:
            conn.exec_driver_sql("ALTER TABLE billing_records ADD COLUMN line_item_id VARCHAR(255)")

        s3_cols = _get_cols("s3_sync_configs")
        if "account_name" not in s3_cols:
            conn.exec_driver_sql("ALTER TABLE s3_sync_configs ADD COLUMN account_name VARCHAR(255)")

        conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_billing_records_line_item ON billing_records(line_item_id)")
        conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_datasets_org_period ON datasets(organization_id, billing_period_start, billing_period_end)")
        conn.commit()

# 5. Create export_tickets table if not exists
cursor.execute("""
CREATE TABLE IF NOT EXISTS export_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket VARCHAR(64) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    export_format VARCHAR(16) NOT NULL DEFAULT 'html',
    params_json TEXT,
    expires_at DATETIME NOT NULL,
    used INTEGER DEFAULT 0,
    created_at DATETIME
)""")
cursor.execute("CREATE INDEX IF NOT EXISTS ix_export_tickets_ticket ON export_tickets(ticket)")
cursor.execute("CREATE INDEX IF NOT EXISTS ix_export_tickets_expires_at ON export_tickets(expires_at)")

# 6. Pre-migration deduplication: resolve NULL collisions before scoping to org 1
cursor.execute("""
DELETE FROM recommendations 
WHERE organization_id IS NULL 
  AND recommendation_id IN (SELECT recommendation_id FROM recommendations WHERE organization_id = 1)
""")

cursor.execute("""
DELETE FROM recommendations 
WHERE organization_id IS NULL 
  AND id NOT IN (SELECT MAX(id) FROM recommendations WHERE organization_id IS NULL GROUP BY recommendation_id)
""")

cursor.execute("""
DELETE FROM anomaly_alerts 
WHERE organization_id IS NULL 
  AND alert_key IN (SELECT alert_key FROM anomaly_alerts WHERE organization_id = 1)
""")

cursor.execute("""
DELETE FROM anomaly_alerts 
WHERE organization_id IS NULL 
  AND id NOT IN (SELECT MAX(id) FROM anomaly_alerts WHERE organization_id IS NULL GROUP BY alert_key)
""")

# Link existing un-scoped records to organization 1
cursor.execute("UPDATE users SET organization_id = 1 WHERE organization_id IS NULL")
cursor.execute("UPDATE user_sessions SET organization_id = 1 WHERE organization_id IS NULL")
cursor.execute("UPDATE datasets SET organization_id = 1 WHERE organization_id IS NULL")
cursor.execute("UPDATE recommendations SET organization_id = 1 WHERE organization_id IS NULL")
cursor.execute("UPDATE anomaly_alerts SET organization_id = 1 WHERE organization_id IS NULL")
cursor.execute("UPDATE budget_configs SET organization_id = 1 WHERE organization_id IS NULL")
cursor.execute("UPDATE s3_sync_configs SET organization_id = 1 WHERE organization_id IS NULL")
cursor.execute("UPDATE agency_branding_configs SET organization_id = 1 WHERE organization_id IS NULL")
cursor.execute("UPDATE unit_economics_configs SET organization_id = 1 WHERE organization_id IS NULL")

# 7. Post-migration unique index validation (guarantee exactly 1 record per org + recommendation/alert)
cursor.execute("""
DELETE FROM recommendations 
WHERE id NOT IN (
    SELECT MAX(id) FROM recommendations GROUP BY organization_id, recommendation_id
)
""")
cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS uix_recommendations_org_rec ON recommendations(organization_id, recommendation_id)")

cursor.execute("""
DELETE FROM anomaly_alerts 
WHERE id NOT IN (
    SELECT MAX(id) FROM anomaly_alerts GROUP BY organization_id, alert_key
)
""")
cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS uix_anomaly_alerts_org_alert ON anomaly_alerts(organization_id, alert_key)")

conn.commit()
conn.close()
print("Migration completed successfully!")
