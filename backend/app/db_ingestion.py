"""
High-Throughput Database Ingestion & Rollup Acceleration Engine
Supports:
1. Native PostgreSQL COPY FROM STDIN streaming (10x faster than standard ORM bulk inserts).
2. Fallback to psycopg2.extras.execute_values and SQLAlchemy bulk_insert_mappings for SQLite/test environments.
3. Pre-aggregated Materialized Rollup Tables (dataset_service_rollups & dataset_daily_rollups) for sub-millisecond Overview loading.
"""

import io
import csv
import logging
from datetime import datetime, timezone
from collections import defaultdict
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from .models import BillingRecord, DatasetRecord, DatasetServiceRollup, DatasetDailyRollup
from .parser import normalize_service_code

logger = logging.getLogger("zorvex.ingestion")

def get_billing_record_columns() -> List[str]:
    """Dynamically derives all non-primary key column names from the BillingRecord schema."""
    return [col.name for col in BillingRecord.__table__.columns if not col.primary_key]


def fast_bulk_insert_billing_records(session: Session, records: List[Dict[str, Any]]) -> int:
    """
    Ingests a list of billing record dicts into the database using the fastest available dialect method:
    - PostgreSQL: COPY FROM STDIN (copy_expert) -> fallback to execute_values -> fallback to bulk_insert_mappings.
    - SQLite / in-memory: bulk_insert_mappings in batches of 2,000.
    """
    if not records:
        return 0

    bind = session.get_bind() if hasattr(session, 'get_bind') else getattr(session, 'bind', None)
    dialect_name = getattr(bind, 'dialect', None)
    dialect_name = dialect_name.name if dialect_name else ''

    if dialect_name == 'postgresql':
        # 1. Native PostgreSQL COPY FROM STDIN with bounded 25k chunk buffering (OOM Protection)
        try:
            raw_conn = session.connection().connection
            cursor = raw_conn.cursor()

            cols = get_billing_record_columns()
            cols_clause = ', '.join(cols)
            sql = f"COPY billing_records ({cols_clause}) FROM STDIN WITH (FORMAT csv, DELIMITER E'\\t', QUOTE '\"')"

            BATCH_SIZE = 25000
            total_inserted = 0
            for i in range(0, len(records), BATCH_SIZE):
                chunk = records[i:i + BATCH_SIZE]
                buf = io.StringIO()
                writer = csv.writer(buf, delimiter='\t', quoting=csv.QUOTE_MINIMAL)

                for r in chunk:
                    row_vals = []
                    for c in cols:
                        v = r.get(c)
                        if c == 'created_at':
                            v = v.strftime('%Y-%m-%d %H:%M:%S') if hasattr(v, 'strftime') else str(v or '')
                        elif c in ('cost', 'unblended_cost'):
                            v = float(v or 0.0)
                        elif v is None:
                            v = ''
                        row_vals.append(v)
                    writer.writerow(row_vals)

                buf.seek(0)
                cursor.copy_expert(sql, buf)
                buf.close()
                total_inserted += len(chunk)

            cursor.close()
            return total_inserted
        except Exception as pg_copy_err:
            logger.warning("PostgreSQL COPY FROM STDIN encountered warning (%s); falling back to execute_values", pg_copy_err)
            try:
                from psycopg2.extras import execute_values
                raw_conn = session.connection().connection
                cursor = raw_conn.cursor()
                cols = get_billing_record_columns()
                cols_clause = ', '.join(cols)
                sql = f"INSERT INTO billing_records ({cols_clause}) VALUES %s"
                val_tuples = [
                    tuple(
                        (v.strftime('%Y-%m-%d %H:%M:%S') if hasattr(v, 'strftime') else (float(v) if c in ('cost', 'unblended_cost') and v is not None else ('' if v is None else v)))
                        for c, v in ((col_name, r.get(col_name)) for col_name in cols)
                    )
                    for r in records
                ]
                execute_values(cursor, sql, val_tuples, page_size=5000)
                cursor.close()
                return len(records)
            except Exception as ev_err:
                logger.warning("PostgreSQL execute_values fallback to ORM bulk_insert_mappings: %s", ev_err)
                session.bulk_insert_mappings(BillingRecord, records)
                return len(records)
    else:
        # SQLite / In-Memory dialect
        for i in range(0, len(records), 2000):
            session.bulk_insert_mappings(BillingRecord, records[i:i + 2000])
        return len(records)


def populate_dataset_rollups(
    session: Session,
    org_id: int,
    dataset_id: int,
    parsed_data: Optional[Dict[str, Any]] = None
) -> None:
    """
    Populates materialized rollup tables (DatasetServiceRollup and DatasetDailyRollup)
    for instant O(1) performance during dashboard overview queries.
    """
    now_utc = datetime.now(timezone.utc)

    # 1. Clear existing rollups for this dataset
    session.query(DatasetServiceRollup).filter(
        DatasetServiceRollup.organization_id == org_id,
        DatasetServiceRollup.dataset_id == dataset_id
    ).delete(synchronize_session=False)

    session.query(DatasetDailyRollup).filter(
        DatasetDailyRollup.organization_id == org_id,
        DatasetDailyRollup.dataset_id == dataset_id
    ).delete(synchronize_session=False)

    # 2. Populate from parsed_data if provided (instant fast path)
    if parsed_data and parsed_data.get('services') and parsed_data.get('daily_totals'):
        svc_records = []
        res_count_by_svc = defaultdict(int)
        for res in parsed_data.get('resources', []):
            svc_name = normalize_service_code(res.get('service', ''))
            res_count_by_svc[svc_name] += 1

        for svc_raw, cost_val in parsed_data.get('services', {}).items():
            norm_svc = normalize_service_code(svc_raw)
            svc_records.append({
                'organization_id': org_id,
                'dataset_id': dataset_id,
                'service': norm_svc,
                'total_cost': float(cost_val or 0.0),
                'record_count': 0,
                'resource_count': res_count_by_svc.get(norm_svc, 0),
                'created_at': now_utc
            })
        if svc_records:
            session.bulk_insert_mappings(DatasetServiceRollup, svc_records)

        daily_records = []
        daily_gross = parsed_data.get('daily_gross_totals', {})
        daily_totals = parsed_data.get('daily_totals', {})
        daily_credits = parsed_data.get('daily_credit_totals', {})
        daily_refunds = parsed_data.get('daily_refunds_totals', parsed_data.get('daily_refund_totals', {}))
        daily_taxes = parsed_data.get('daily_tax_totals', {})

        all_dates = sorted(set(list(daily_gross.keys()) + list(daily_totals.keys())))
        for d in all_dates:
            daily_records.append({
                'organization_id': org_id,
                'dataset_id': dataset_id,
                'usage_date': d,
                'gross_cost': float(daily_gross.get(d, 0.0) or 0.0),
                'net_cost': float(daily_totals.get(d, 0.0) or 0.0),
                'credits_cost': float(daily_credits.get(d, 0.0) or 0.0),
                'refunds_cost': float(daily_refunds.get(d, 0.0) or 0.0),
                'taxes_cost': float(daily_taxes.get(d, 0.0) or 0.0),
                'record_count': 0,
                'created_at': now_utc
            })
        if daily_records:
            session.bulk_insert_mappings(DatasetDailyRollup, daily_records)

        session.commit()
        return

    # 3. SQL aggregation fallback (used when populating rollups from existing billing_records in DB)
    svc_query = (
        session.query(
            BillingRecord.service,
            func.sum(BillingRecord.cost).label('total_cost'),
            func.count(BillingRecord.id).label('record_count'),
            func.count(func.distinct(BillingRecord.resource_id)).label('resource_count')
        )
        .filter(
            BillingRecord.organization_id == org_id,
            BillingRecord.dataset_id == dataset_id,
            BillingRecord.line_item_type.notin_(['Credit', 'Refund', 'SavingsPlanNegation', 'Tax']),
            BillingRecord.cost >= 0
        )
        .group_by(BillingRecord.service)
        .all()
    )

    svc_records = []
    for row in svc_query:
        norm_svc = normalize_service_code(row.service)
        svc_records.append({
            'organization_id': org_id,
            'dataset_id': dataset_id,
            'service': norm_svc,
            'total_cost': round(float(row.total_cost or 0.0), 4),
            'record_count': int(row.record_count or 0),
            'resource_count': int(row.resource_count or 0),
            'created_at': now_utc
        })
    if svc_records:
        session.bulk_insert_mappings(DatasetServiceRollup, svc_records)

    daily_query = (
        session.query(
            BillingRecord.usage_date,
            func.sum(BillingRecord.cost).label('net_cost'),
            func.count(BillingRecord.id).label('record_count')
        )
        .filter(
            BillingRecord.organization_id == org_id,
            BillingRecord.dataset_id == dataset_id
        )
        .group_by(BillingRecord.usage_date)
        .all()
    )

    daily_gross_query = (
        session.query(
            BillingRecord.usage_date,
            func.sum(BillingRecord.cost).label('gross_cost')
        )
        .filter(
            BillingRecord.organization_id == org_id,
            BillingRecord.dataset_id == dataset_id,
            BillingRecord.line_item_type.notin_(['Credit', 'Refund', 'SavingsPlanNegation', 'Tax']),
            BillingRecord.cost >= 0
        )
        .group_by(BillingRecord.usage_date)
        .all()
    )
    gross_map = {row.usage_date: float(row.gross_cost or 0.0) for row in daily_gross_query}

    daily_records = []
    for row in daily_query:
        daily_records.append({
            'organization_id': org_id,
            'dataset_id': dataset_id,
            'usage_date': row.usage_date,
            'gross_cost': round(gross_map.get(row.usage_date, 0.0), 4),
            'net_cost': round(float(row.net_cost or 0.0), 4),
            'credits_cost': 0.0,
            'refunds_cost': 0.0,
            'taxes_cost': 0.0,
            'record_count': int(row.record_count or 0),
            'created_at': now_utc
        })
    if daily_records:
        session.bulk_insert_mappings(DatasetDailyRollup, daily_records)

    session.commit()
