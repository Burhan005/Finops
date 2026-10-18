"""
Phase 1 Multi-CUR Ingestion Safety & Integrity Test Suite
========================================================================================
Comprehensive validation covering:
1. Multi-part valid CUR merge & exact reconciliation
2. Column count & sequence mismatch rejection
3. Unrelated billing period mismatch rejection
4. Payer account ID mismatch rejection
5. Duplicate upload replay protection (idempotency without double counting)
6. Overlapping chunk line-item deduplication within delivery bundle
7. Revised report superseding & lineage tracking (revision_version & superseded_dataset_id)
8. Unsupported format rejection (.parquet and .zip)
9. Manifest JSON parsing and validation
10. Transactional rollback on persistence failure
11. Multi-tenant isolation verification
12. Bounded memory execution during streaming/batch processing
"""

import os
import io
import gzip
import json
import tempfile
import tracemalloc
from decimal import Decimal
import pytest

from app.database import engine, SessionLocal
from app.models import DatasetRecord, BillingRecord, AuditEvent, Organization, User
from app.parser import (
    parse_cur_manifest,
    validate_multipart_cur_export,
    merge_cur_files,
    parse_cur_file,
    parse_cur_files
)
from app.main import _ingest_dataset_sync


CUR_HEADER = [
    "identity/LineItemId",
    "bill/BillingPeriodStartDate",
    "bill/BillingPeriodEndDate",
    "bill/PayerAccountId",
    "lineItem/UsageStartDate",
    "lineItem/ProductCode",
    "lineItem/ResourceId",
    "lineItem/UsageAccountId",
    "lineItem/AvailabilityZone",
    "lineItem/UnblendedCost",
    "lineItem/LineItemType",
    "lineItem/UsageType",
    "pricing/term",
    "resourceTags/user:Name"
]


def create_cur_csv_gz(rows, header=None, filepath=None):
    """Utility to create a gzip-compressed CSV CUR file."""
    if header is None:
        header = CUR_HEADER
    if filepath is None:
        fd, filepath = tempfile.mkstemp(suffix=".csv.gz")
        os.close(fd)

    with gzip.open(filepath, "wt", newline="", encoding="utf-8") as f:
        f.write(",".join(header) + "\n")
        for row in rows:
            f.write(",".join(str(c) for c in row) + "\n")
    return filepath


@pytest.fixture(scope="module")
def setup_test_orgs():
    """Ensure test organizations and users exist in the isolated test database."""
    db = SessionLocal()
    org1 = db.query(Organization).filter(Organization.id == 101).first()
    if not org1:
        org1 = Organization(id=101, name="Safety Test Org 101")
        db.add(org1)
    org2 = db.query(Organization).filter(Organization.id == 102).first()
    if not org2:
        org2 = Organization(id=102, name="Safety Test Org 102")
        db.add(org2)

    u1 = db.query(User).filter(User.id == 201).first()
    if not u1:
        u1 = User(id=201, email="safety1@zorvex.test", password_hash="hash", organization_id=101, name="Safety User 1", company="Zorvex")
        db.add(u1)
    u2 = db.query(User).filter(User.id == 202).first()
    if not u2:
        u2 = User(id=202, email="safety2@zorvex.test", password_hash="hash", organization_id=102, name="Safety User 2", company="Zorvex")
        db.add(u2)

    db.commit()
    db.close()
    return {"org1_id": 101, "org2_id": 102, "u1_id": 201, "u2_id": 202}


# ====================================================================================
# TEST 1: MULTI-PART VALID EXPORT MERGE & FINANCIAL RECONCILIATION
# ====================================================================================
def test_valid_multipart_merge_and_reconciliation():
    """Verify that multiple parts of the same CUR export merge cleanly and reconcile."""
    rows_part1 = [
        ["item-1", "2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z", "123456789012", "2026-09-01T01:00:00Z", "AmazonEC2", "i-001", "123456789012", "us-east-1a", "10.50", "Usage", "BoxUsage:t3.medium", "OnDemand", "web-server"],
        ["item-2", "2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z", "123456789012", "2026-09-01T02:00:00Z", "AmazonS3", "bucket-01", "123456789012", "", "5.25", "Usage", "TimedStorage-ByteHrs", "OnDemand", "backup-bucket"]
    ]
    rows_part2 = [
        ["item-3", "2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z", "123456789012", "2026-09-02T01:00:00Z", "AmazonRDS", "db-prod", "123456789012", "us-east-1b", "25.00", "Usage", "InstanceUsage:db.m5.large", "OnDemand", "prod-db"],
        ["item-4", "2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z", "123456789012", "2026-09-02T02:00:00Z", "AmazonEC2", "i-001", "123456789012", "us-east-1a", "-2.00", "Credit", "Credit", "OnDemand", ""]
    ]

    p1 = create_cur_csv_gz(rows_part1)
    p2 = create_cur_csv_gz(rows_part2)
    merged_path = tempfile.mktemp(suffix=".csv.gz")

    try:
        # 1. Validation must succeed
        validate_multipart_cur_export([p1, p2])

        # 2. Merge must succeed
        merge_cur_files([p1, p2], merged_path)
        assert os.path.exists(merged_path)

        # 3. Parse merged file
        parsed = parse_cur_file(merged_path)
        assert parsed["total_rows"] == 4
        # Gross = 10.50 + 5.25 + 25.00 = 40.75
        assert parsed["gross_cost"] == 40.75
        # Credit = -2.00
        assert parsed["credits_total"] == -2.00
        # Net = 40.75 - 2.00 = 38.75
        assert parsed["net_cost"] == 38.75
        assert parsed["billing_period_start"] == "2026-09-01"
        assert parsed["billing_period_end"] == "2026-10-01"
        assert parsed["payer_account_id"] == "123456789012"
        assert parsed["accounting_reconciliation"]["is_reconciled"] is True
    finally:
        for f in [p1, p2, merged_path]:
            if os.path.exists(f):
                os.remove(f)


# ====================================================================================
# TEST 2: COLUMN COUNT & SEQUENCE MISMATCH REJECTION
# ====================================================================================
def test_column_count_and_sequence_mismatch_rejection():
    """Verify that multi-part validation rejects files with mismatched column structures."""
    p1 = create_cur_csv_gz([["item-1", "2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z", "123456789012", "2026-09-01T01:00:00Z", "AmazonEC2", "i-1", "123", "us-east-1", "10", "Usage", "Box", "OnDemand", "vm"]])
    
    # Header missing 2 columns
    short_header = CUR_HEADER[:-2]
    p_short = create_cur_csv_gz([["item-2", "2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z", "123456789012", "2026-09-01T01:00:00Z", "AmazonEC2", "i-2", "123", "us-east-1", "10", "Usage", "Box"]], header=short_header)

    # Sequence mismatch (swapped columns)
    swapped_header = list(CUR_HEADER)
    swapped_header[0], swapped_header[1] = swapped_header[1], swapped_header[0]
    p_swapped = create_cur_csv_gz([["2026-09-01T00:00:00Z", "item-2", "2026-10-01T00:00:00Z", "123456789012", "2026-09-01T01:00:00Z", "AmazonEC2", "i-2", "123", "us-east-1", "10", "Usage", "Box", "OnDemand", "vm"]], header=swapped_header)

    try:
        with pytest.raises(ValueError, match="columns"):
            validate_multipart_cur_export([p1, p_short])

        with pytest.raises(ValueError, match="column sequence mismatch"):
            validate_multipart_cur_export([p1, p_swapped])
    finally:
        for f in [p1, p_short, p_swapped]:
            if os.path.exists(f):
                os.remove(f)


# ====================================================================================
# TEST 3: UNRELATED BILLING PERIODS REJECTION
# ====================================================================================
def test_unrelated_billing_period_rejection():
    """Verify that parts from different billing periods (e.g. Sept vs Oct) cannot be combined."""
    p_sep = create_cur_csv_gz([["item-1", "2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z", "123456789012", "2026-09-01T01:00:00Z", "AmazonEC2", "i-1", "123", "us-east-1", "10", "Usage", "Box", "OnDemand", "vm"]])
    p_oct = create_cur_csv_gz([["item-2", "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z", "123456789012", "2026-10-01T01:00:00Z", "AmazonEC2", "i-2", "123", "us-east-1", "15", "Usage", "Box", "OnDemand", "vm"]])

    try:
        with pytest.raises(ValueError, match="different billing periods"):
            validate_multipart_cur_export([p_sep, p_oct])
    finally:
        for f in [p_sep, p_oct]:
            if os.path.exists(f):
                os.remove(f)


# ====================================================================================
# TEST 4: PAYER ACCOUNT MISMATCH REJECTION
# ====================================================================================
def test_payer_account_mismatch_rejection():
    """Verify that parts belonging to different payer accounts cannot be combined."""
    p_payer1 = create_cur_csv_gz([["item-1", "2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z", "111111111111", "2026-09-01T01:00:00Z", "AmazonEC2", "i-1", "111111111111", "us-east-1", "10", "Usage", "Box", "OnDemand", "vm"]])
    p_payer2 = create_cur_csv_gz([["item-2", "2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z", "222222222222", "2026-09-01T01:00:00Z", "AmazonEC2", "i-2", "222222222222", "us-east-1", "15", "Usage", "Box", "OnDemand", "vm"]])

    try:
        with pytest.raises(ValueError, match="Payer account mismatch"):
            validate_multipart_cur_export([p_payer1, p_payer2])
    finally:
        for f in [p_payer1, p_payer2]:
            if os.path.exists(f):
                os.remove(f)


# ====================================================================================
# TEST 5: OVERLAPPING CHUNK LINE-ITEM DEDUPLICATION
# ====================================================================================
def test_overlapping_chunk_lineitem_deduplication():
    """Verify that replayed/overlapping identical line items across chunks are deduplicated."""
    shared_row = ["item-dup", "2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z", "123456789012", "2026-09-01T01:00:00Z", "AmazonEC2", "i-dup", "123456789012", "us-east-1a", "20.00", "Usage", "BoxUsage", "OnDemand", "app-srv"]
    row_unique1 = ["item-u1", "2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z", "123456789012", "2026-09-01T02:00:00Z", "AmazonEC2", "i-u1", "123456789012", "us-east-1a", "10.00", "Usage", "BoxUsage", "OnDemand", "app-srv1"]
    row_unique2 = ["item-u2", "2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z", "123456789012", "2026-09-01T03:00:00Z", "AmazonEC2", "i-u2", "123456789012", "us-east-1a", "30.00", "Usage", "BoxUsage", "OnDemand", "app-srv2"]

    p1 = create_cur_csv_gz([shared_row, row_unique1])
    p2 = create_cur_csv_gz([shared_row, row_unique2])
    merged_path = tempfile.mktemp(suffix=".csv.gz")

    try:
        merge_cur_files([p1, p2], merged_path)
        parsed = parse_cur_file(merged_path)
        # Should contain 3 distinct records (not 4):
        # 20.00 (shared) + 10.00 + 30.00 = 60.00 (NOT 80.00)
        assert parsed["total_rows"] == 3
        assert parsed["gross_cost"] == 60.00
    finally:
        for f in [p1, p2, merged_path]:
            if os.path.exists(f):
                os.remove(f)


# ====================================================================================
# TEST 6: DUPLICATE UPLOAD REPLAY PROTECTION (NO DOUBLE COUNTING)
# ====================================================================================
def test_replay_idempotency_prevents_duplicate_billing_records(setup_test_orgs):
    """
    Verify that repeatedly uploading the exact same CUR export:
    1. Does NOT insert duplicate records into billing_records
    2. Does NOT increase total cost or double count spend
    3. Re-activates the existing dataset and logs REPLAY_ACTIVATE
    """
    org_id = setup_test_orgs["org1_id"]
    user_id = setup_test_orgs["u1_id"]

    rows = [
        ["replay-1", "2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z", "123456789012", "2026-09-01T01:00:00Z", "AmazonEC2", "i-rep", "123456789012", "us-east-1a", "50.00", "Usage", "BoxUsage", "OnDemand", "srv"],
        ["replay-2", "2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z", "123456789012", "2026-09-01T02:00:00Z", "AmazonS3", "bucket-rep", "123456789012", "", "25.00", "Usage", "Storage", "OnDemand", "bkt"]
    ]
    p = create_cur_csv_gz(rows)

    try:
        parsed = parse_cur_file(p)
        checksum = "checksum_replay_test_fixed_12345"

        # Ingestion 1
        ds1_id = _ingest_dataset_sync(org_id, user_id, "replay_test.csv.gz", p, checksum, parsed)
        
        db = SessionLocal()
        records_after_ingest1 = db.query(BillingRecord).filter(
            BillingRecord.organization_id == org_id,
            BillingRecord.dataset_id == ds1_id
        ).count()
        assert records_after_ingest1 == 2

        # Ingestion 2: Identical file / checksum
        ds2_id = _ingest_dataset_sync(org_id, user_id, "replay_test.csv.gz", p, checksum, parsed)
        
        # Verify it re-activated the existing dataset rather than creating a duplicate
        assert ds2_id == ds1_id

        # Total billing records must remain exactly 2, never duplicated to 4
        records_after_ingest2 = db.query(BillingRecord).filter(
            BillingRecord.organization_id == org_id,
            BillingRecord.dataset_id == ds1_id
        ).count()
        assert records_after_ingest2 == 2

        # Verify audit event logged REPLAY_ACTIVATE
        audit = db.query(AuditEvent).filter(
            AuditEvent.organization_id == org_id,
            AuditEvent.action == "REPLAY_ACTIVATE"
        ).first()
        assert audit is not None
        assert "without inserting duplicate records" in audit.details

        db.close()
    finally:
        if os.path.exists(p):
            os.remove(p)


# ====================================================================================
# TEST 7: REVISED REPORT SUPERSEDING & LINEAGE TRACKING
# ====================================================================================
def test_revised_report_lineage_and_superseding(setup_test_orgs):
    """
    Verify that an updated revision of the same billing period:
    1. Creates a new DatasetRecord with incremented revision_version
    2. References the superseded_dataset_id
    3. Atomically deactivates the previous dataset without deleting or mixing records
    4. Preserves legitimate revised line items (e.g. rate or usage changes)
    """
    org_id = setup_test_orgs["org1_id"]
    user_id = setup_test_orgs["u1_id"]

    # Initial revision: 2026-08, $100
    rows_v1 = [
        ["rev-item-1", "2026-08-01T00:00:00Z", "2026-09-01T00:00:00Z", "123456789012", "2026-08-01T01:00:00Z", "AmazonEC2", "i-rev", "123456789012", "us-east-1a", "100.00", "Usage", "BoxUsage", "OnDemand", "srv"]
    ]
    p_v1 = create_cur_csv_gz(rows_v1)

    # Revised report: 2026-08, $115 (legitimate revision of the same line item)
    rows_v2 = [
        ["rev-item-1", "2026-08-01T00:00:00Z", "2026-09-01T00:00:00Z", "123456789012", "2026-08-01T01:00:00Z", "AmazonEC2", "i-rev", "123456789012", "us-east-1a", "115.00", "Usage", "BoxUsage", "OnDemand", "srv"]
    ]
    p_v2 = create_cur_csv_gz(rows_v2)

    try:
        parsed_v1 = parse_cur_file(p_v1)
        ds1_id = _ingest_dataset_sync(org_id, user_id, "cur_202608_v1.csv.gz", p_v1, "chk_v1_0001", parsed_v1)

        db = SessionLocal()
        ds1 = db.query(DatasetRecord).filter(DatasetRecord.id == ds1_id).first()
        assert ds1.revision_version == 1
        assert ds1.superseded_dataset_id is None
        assert ds1.is_active == 1

        # Now ingest revision v2
        parsed_v2 = parse_cur_file(p_v2)
        ds2_id = _ingest_dataset_sync(org_id, user_id, "cur_202608_v2.csv.gz", p_v2, "chk_v2_0002", parsed_v2)

        ds2 = db.query(DatasetRecord).filter(DatasetRecord.id == ds2_id).first()
        db.refresh(ds1)

        assert ds2_id != ds1_id
        assert ds2.revision_version == 2
        assert ds2.superseded_dataset_id == ds1_id
        assert ds2.is_active == 1
        # v1 is now deactivated
        assert ds1.is_active == 0

        # Legitimate revised line item is preserved in dataset 2 with $115
        rec_v2 = db.query(BillingRecord).filter(
            BillingRecord.organization_id == org_id,
            BillingRecord.dataset_id == ds2_id
        ).first()
        assert rec_v2.line_item_id == "rev-item-1"
        assert rec_v2.cost == 115.00

        db.close()
    finally:
        for f in [p_v1, p_v2]:
            if os.path.exists(f):
                os.remove(f)


# ====================================================================================
# TEST 8: UNSUPPORTED FORMAT REJECTION (.PARQUET & .ZIP)
# ====================================================================================
def test_unsupported_format_manifest_rejection():
    """Verify that manifests or files claiming Parquet or ZIP formats are explicitly rejected."""
    # Parquet manifest
    parquet_manifest = {
        "assemblyId": "20260901-assembly-parquet",
        "billingPeriod": {"start": "20260901T000000.000Z", "end": "20261001T000000.000Z"},
        "format": "Parquet",
        "compression": "GZIP",
        "reportKeys": ["report/data.parquet"]
    }
    with pytest.raises(ValueError, match="Parquet CUR format is not supported"):
        parse_cur_manifest(parquet_manifest)

    # ZIP compression manifest
    zip_manifest = {
        "assemblyId": "20260901-assembly-zip",
        "billingPeriod": {"start": "20260901T000000.000Z", "end": "20261001T000000.000Z"},
        "format": "text/csv",
        "compression": "ZIP",
        "reportKeys": ["report/data.csv.zip"]
    }
    with pytest.raises(ValueError, match="ZIP compression is not supported"):
        parse_cur_manifest(zip_manifest)


# ====================================================================================
# TEST 9: MANIFEST JSON PARSING AND METADATA EXTRACT
# ====================================================================================
def test_valid_manifest_parsing():
    """Verify that a standard AWS CUR Manifest JSON is parsed accurately."""
    valid_manifest = {
        "assemblyId": "20260901-11223344",
        "billingPeriod": {
            "start": "20260901T000000.000Z",
            "end": "20261001T000000.000Z"
        },
        "format": "text/csv",
        "compression": "GZIP",
        "reportKeys": [
            "AWS_CUR/20260901-20261001/report-1.csv.gz",
            "AWS_CUR/20260901-20261001/report-2.csv.gz"
        ],
        "columns": [
            {"category": "identity", "name": "LineItemId"},
            {"category": "bill", "name": "PayerAccountId"}
        ]
    }
    manifest_info = parse_cur_manifest(valid_manifest)
    assert manifest_info["assembly_id"] == "20260901-11223344"
    assert manifest_info["billing_period_start"] == "2026-09-01"
    assert manifest_info["billing_period_end"] == "2026-10-01"
    assert manifest_info["format"] == "text/csv"
    assert manifest_info["compression"] == "GZIP"
    assert len(manifest_info["report_keys"]) == 2


# ====================================================================================
# TEST 10: TRANSACTION ROLLBACK ON INGESTION FAILURE
# ====================================================================================
def test_transactional_rollback_on_persistence_failure(setup_test_orgs):
    """Verify that any exception during persistence cleanly rolls back without orphan records."""
    org_id = setup_test_orgs["org1_id"]
    user_id = setup_test_orgs["u1_id"]

    db = SessionLocal()
    initial_ds_count = db.query(DatasetRecord).filter(DatasetRecord.organization_id == org_id).count()
    initial_rec_count = db.query(BillingRecord).filter(BillingRecord.organization_id == org_id).count()

    # Create malformed parsed data that triggers an error during ingestion
    bad_parsed = {
        "gross_cost": 50.0,
        "net_cost": 50.0,
        "credits_total": 0.0,
        "refunds_total": 0.0,
        "taxes_total": 0.0,
        "total_rows": 1,
        "records": [
            {
                # Intentionally passing a non-floatable object to crash bulk insert
                "cost": object(),
                "date": "2026-09-01"
            }
        ]
    }

    with pytest.raises(Exception):
        _ingest_dataset_sync(org_id, user_id, "fail.csv", "path/fail.csv", "fail_chk_123", bad_parsed)

    # Verify rollback: no new dataset record or billing records inserted
    final_ds_count = db.query(DatasetRecord).filter(DatasetRecord.organization_id == org_id).count()
    final_rec_count = db.query(BillingRecord).filter(BillingRecord.organization_id == org_id).count()

    assert final_ds_count == initial_ds_count
    assert final_rec_count == initial_rec_count
    db.close()


# ====================================================================================
# TEST 11: MULTI-TENANT ISOLATION
# ====================================================================================
def test_multitenant_isolation(setup_test_orgs):
    """Verify that identical uploads for Org 101 and Org 102 are completely isolated."""
    org1_id = setup_test_orgs["org1_id"]
    org2_id = setup_test_orgs["org2_id"]
    u1_id = setup_test_orgs["u1_id"]
    u2_id = setup_test_orgs["u2_id"]

    rows = [
        ["iso-1", "2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z", "123456789012", "2026-09-01T01:00:00Z", "AmazonEC2", "i-iso", "123456789012", "us-east-1a", "75.00", "Usage", "BoxUsage", "OnDemand", "srv"]
    ]
    p = create_cur_csv_gz(rows)

    try:
        parsed = parse_cur_file(p)
        checksum = "shared_checksum_test_789"

        ds1 = _ingest_dataset_sync(org1_id, u1_id, "iso.csv.gz", p, checksum, parsed)
        ds2 = _ingest_dataset_sync(org2_id, u2_id, "iso.csv.gz", p, checksum, parsed)

        assert ds1 != ds2

        db = SessionLocal()
        # Verify Org 1 records for ds1 only belong to Org 1
        ds1_records = db.query(BillingRecord).filter(BillingRecord.dataset_id == ds1).all()
        assert len(ds1_records) > 0
        for r in ds1_records:
            assert r.organization_id == org1_id

        # Verify Org 2 records for ds2 only belong to Org 2
        ds2_records = db.query(BillingRecord).filter(BillingRecord.dataset_id == ds2).all()
        assert len(ds2_records) > 0
        for r in ds2_records:
            assert r.organization_id == org2_id
            assert r.organization_id != org1_id

        # Verify cross-tenant isolation: querying dataset 1 with org 2 returns 0 rows
        cross_tenant_leak = db.query(BillingRecord).filter(
            BillingRecord.organization_id == org2_id,
            BillingRecord.dataset_id == ds1
        ).all()
        assert len(cross_tenant_leak) == 0

        db.close()
    finally:
        if os.path.exists(p):
            os.remove(p)


# ====================================================================================
# TEST 12: BOUNDED MEMORY MEASUREMENT
# ====================================================================================
def test_bounded_memory_during_processing():
    """Verify memory growth remains bounded during chunked processing."""
    # Generate 5,000 rows split across 2 part files
    rows_part = [
        [f"item-mem-{i}", "2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z", "123456789012", "2026-09-01T01:00:00Z", "AmazonEC2", f"i-mem-{i % 50}", "123456789012", "us-east-1a", "1.25", "Usage", "BoxUsage", "OnDemand", "node"]
        for i in range(2500)
    ]
    p1 = create_cur_csv_gz(rows_part)
    p2 = create_cur_csv_gz(rows_part)
    merged = tempfile.mktemp(suffix=".csv.gz")

    try:
        tracemalloc.start()
        start_mem, _ = tracemalloc.get_traced_memory()

        merge_cur_files([p1, p2], merged)
        parsed = parse_cur_file(merged)

        _, peak_mem = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        mem_delta_mb = (peak_mem - start_mem) / (1024 * 1024)
        # Peak memory delta for merging and parsing 5k rows should be well under 40MB
        assert mem_delta_mb < 40.0, f"Memory usage excessive: {mem_delta_mb:.2f} MB"
        assert parsed["total_rows"] == 2500  # Duplicate rows between p1 and p2 deduplicated
    finally:
        for f in [p1, p2, merged]:
            if os.path.exists(f):
                os.remove(f)


# ====================================================================================
# TEST 13: USAGE ACCOUNT & ALIAS PERSISTENCE RECONCILIATION
# ====================================================================================
def test_account_alias_and_usage_account_attribution():
    """Verify that UsageAccountId is distinguished from PayerAccountId and account_name is persisted."""
    rows = [
        ["item-acc-1", "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z", "668789584005", "2026-10-01T01:00:00Z", "AmazonEC2", "i-01a2b3", "825799498078", "ap-south-1a", "15.50", "Usage", "BoxUsage", "OnDemand", "evital-api"],
        ["item-acc-2", "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z", "668789584005", "2026-10-01T02:00:00Z", "AmazonS3", "bucket-evital", "825799498078", "ap-south-1", "4.20", "Usage", "TimedStorage", "OnDemand", "evital-storage"]
    ]
    p = create_cur_csv_gz(rows)
    try:
        parsed = parse_cur_file(p)
        assert parsed["usage_account_id"] == "825799498078"
        assert parsed["payer_account_id"] == "668789584005"

        db = SessionLocal()
        org = db.query(Organization).first()
        org_id = org.id if org else 1
        user = db.query(User).filter(User.organization_id == org_id).first()
        user_id = user.id if user else 1

        formatted_name = f"evital-prod ({parsed['usage_account_id']}) — cur_export.csv.gz"

        ds_id = _ingest_dataset_sync(
            org_id=org_id,
            user_id=user_id,
            final_filename=formatted_name,
            final_filepath=p,
            checksum_sha256="sha256-test-acc-alias-unique",
            parsed=parsed,
            account_name="evital-prod"
        )

        rec = db.query(DatasetRecord).filter(DatasetRecord.id == ds_id).first()
        assert rec is not None
        assert rec.account_name == "evital-prod"
        assert rec.usage_account_id == "825799498078"
        assert rec.payer_account_id == "668789584005"
        assert "evital-prod (825799498078)" in rec.filename

        db.close()
    finally:
        if os.path.exists(p):
            os.remove(p)
