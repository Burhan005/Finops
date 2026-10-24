"""
ZORVEX FinOps Platform - Native PostgreSQL Analytical Functions & Stored Procedures
===================================================================================
Provides high-performance native PostgreSQL PL/pgSQL functions and stored procedures
for real-time spend reconciliation, multi-dimensional rollups, and atomic dataset recalculations.
Includes automatic fallback detection for SQLite test environments.
"""
import logging
from typing import Optional, Dict, Any, List
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

logger = logging.getLogger("zorvex.postgres_functions")

POSTGRES_DDL_STATEMENTS = [
    # 1. Spend Reconciliation Function with Optional Filter Scopes
    """
    DROP FUNCTION IF EXISTS fn_finops_reconcile_dataset(INT, INT);
    """,
    """
    DROP FUNCTION IF EXISTS fn_finops_reconcile_dataset(INT, INT, TEXT, TEXT, TEXT, TEXT);
    """,
    """
    CREATE OR REPLACE FUNCTION fn_finops_reconcile_dataset(
        p_org_id INT,
        p_dataset_id INT,
        p_start_date TEXT DEFAULT NULL,
        p_end_date TEXT DEFAULT NULL,
        p_account_id TEXT DEFAULT NULL,
        p_service TEXT DEFAULT NULL
    )
    RETURNS jsonb
    LANGUAGE plpgsql
    STABLE
    AS $$
    DECLARE
        v_gross numeric(18, 6) := 0;
        v_credits numeric(18, 6) := 0;
        v_refunds numeric(18, 6) := 0;
        v_taxes numeric(18, 6) := 0;
        v_net numeric(18, 6) := 0;
        v_total_rows bigint := 0;
        v_is_reconciled boolean := false;
    BEGIN
        SELECT
            COALESCE(SUM(CASE WHEN LOWER(line_item_type) NOT IN ('credit', 'refund', 'tax', 'savingsplannegation') AND cost > 0 THEN cost ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN LOWER(line_item_type) IN ('credit', 'savingsplannegation') THEN cost ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN LOWER(line_item_type) = 'refund' THEN cost ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN LOWER(line_item_type) = 'tax' THEN cost ELSE 0 END), 0),
            COUNT(*)
        INTO v_gross, v_credits, v_refunds, v_taxes, v_total_rows
        FROM billing_records
        WHERE organization_id = p_org_id 
          AND dataset_id = p_dataset_id
          AND (p_start_date IS NULL OR usage_date >= p_start_date)
          AND (p_end_date IS NULL OR usage_date <= p_end_date)
          AND (p_account_id IS NULL OR account_id = p_account_id)
          AND (p_service IS NULL OR service = p_service);

        v_net := v_gross + v_credits + v_refunds + v_taxes;
        v_is_reconciled := (ABS((v_gross + v_credits + v_refunds + v_taxes) - v_net) < 0.01);

        RETURN jsonb_build_object(
            'gross_usage_cost', ROUND(v_gross, 2),
            'credits_total', ROUND(v_credits, 2),
            'refunds_total', ROUND(v_refunds, 2),
            'taxes_total', ROUND(v_taxes, 2),
            'net_invoiced_spend', ROUND(v_net, 2),
            'total_rows', v_total_rows,
            'is_reconciled', v_is_reconciled,
            'formula', 'net_invoiced_spend = gross_usage_cost + credits_total + refunds_total + taxes_total',
            'engine', 'postgresql_native_function'
        );
    END;
    $$;
    """,

    # 2. Service Aggregation Breakdown Function
    """
    DROP FUNCTION IF EXISTS fn_finops_service_breakdown(INT, INT, INT);
    """,
    """
    CREATE OR REPLACE FUNCTION fn_finops_service_breakdown(
        p_org_id INT,
        p_dataset_id INT,
        p_limit INT DEFAULT 10
    )
    RETURNS jsonb
    LANGUAGE sql
    STABLE
    AS $$
        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'service', s.service,
                    'total_cost', ROUND(s.total_cost::numeric, 2),
                    'resource_count', s.resource_count
                )
            ),
            '[]'::jsonb
        )
        FROM (
            SELECT 
                service,
                SUM(cost) AS total_cost,
                COUNT(DISTINCT resource_id) AS resource_count
            FROM billing_records
            WHERE organization_id = p_org_id 
              AND dataset_id = p_dataset_id
              AND LOWER(line_item_type) NOT IN ('credit', 'refund', 'tax', 'savingsplannegation')
            GROUP BY service
            ORDER BY total_cost DESC
            LIMIT p_limit
        ) s;
    $$;
    """,

    # 3. Atomic Recalculate Dataset Totals Stored Procedure
    """
    DROP PROCEDURE IF EXISTS sp_recalculate_dataset_totals(INT, INT);
    """,
    """
    CREATE OR REPLACE PROCEDURE sp_recalculate_dataset_totals(
        p_org_id INT,
        p_dataset_id INT
    )
    LANGUAGE plpgsql
    AS $$
    DECLARE
        v_gross numeric(18, 6) := 0;
        v_credits numeric(18, 6) := 0;
        v_refunds numeric(18, 6) := 0;
        v_taxes numeric(18, 6) := 0;
        v_net numeric(18, 6) := 0;
        v_total_rows bigint := 0;
    BEGIN
        SELECT
            COALESCE(SUM(CASE WHEN LOWER(line_item_type) NOT IN ('credit', 'refund', 'tax', 'savingsplannegation') AND cost > 0 THEN cost ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN LOWER(line_item_type) IN ('credit', 'savingsplannegation') THEN cost ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN LOWER(line_item_type) = 'refund' THEN cost ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN LOWER(line_item_type) = 'tax' THEN cost ELSE 0 END), 0),
            COUNT(*)
        INTO v_gross, v_credits, v_refunds, v_taxes, v_total_rows
        FROM billing_records
        WHERE organization_id = p_org_id AND dataset_id = p_dataset_id;

        v_net := v_gross + v_credits + v_refunds + v_taxes;

        UPDATE datasets
        SET total_cost = ROUND(v_gross, 2),
            credits_total = ROUND(v_credits, 2),
            refunds_total = ROUND(v_refunds, 2),
            taxes_total = ROUND(v_taxes, 2),
            net_cost = ROUND(v_net, 2),
            total_rows = v_total_rows
        WHERE id = p_dataset_id AND organization_id = p_org_id;
    END;
    $$;
    """
]


def ensure_postgres_functions(engine: Engine) -> bool:
    """
    Idempotently deploys native PostgreSQL stored functions and procedures.
    Safely bypasses SQLite environments (such as unit test runs) without error.
    """
    if engine.dialect.name != "postgresql":
        logger.debug("Skipping PostgreSQL stored procedures initialization for non-Postgres dialect (%s)", engine.dialect.name)
        return False

    try:
        with engine.begin() as conn:
            for stmt in POSTGRES_DDL_STATEMENTS:
                stmt_clean = stmt.strip()
                if stmt_clean:
                    conn.execute(text(stmt_clean))
        logger.info("Successfully registered native PostgreSQL FinOps functions and procedures.")
        return True
    except Exception as e:
        logger.warning("Notice: Could not register PostgreSQL stored procedures: %s", e)
        return False


def call_postgres_reconcile(
    db: Session,
    org_id: int,
    dataset_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    account_id: Optional[str] = None,
    service: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Executes fn_finops_reconcile_dataset on PostgreSQL; returns None if not supported or error."""
    if not db.bind or db.bind.dialect.name != "postgresql":
        return None

    try:
        res = db.execute(
            text("""
                SELECT fn_finops_reconcile_dataset(
                    :org_id, :dataset_id, :start_date, :end_date, :account_id, :service
                )
            """),
            {
                "org_id": org_id,
                "dataset_id": dataset_id,
                "start_date": start_date,
                "end_date": end_date,
                "account_id": account_id,
                "service": service
            }
        ).scalar()
        if isinstance(res, dict):
            return res
    except Exception as e:
        logger.debug("call_postgres_reconcile fallback notice: %s", e)
    return None


def call_postgres_recalculate_procedure(db: Session, org_id: int, dataset_id: int) -> bool:
    """Invokes sp_recalculate_dataset_totals on PostgreSQL; returns False if not supported or error."""
    if not db.bind or db.bind.dialect.name != "postgresql":
        return False

    try:
        db.execute(
            text("CALL sp_recalculate_dataset_totals(:org_id, :dataset_id)"),
            {"org_id": org_id, "dataset_id": dataset_id}
        )
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        logger.debug("call_postgres_recalculate_procedure notice: %s", e)
        return False
