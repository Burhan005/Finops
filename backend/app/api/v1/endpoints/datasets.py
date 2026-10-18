"""
Dataset Ingestion, Selection, Listing, and Account Alias Management Router.
"""

import os
import glob
import json
import secrets
import hashlib
import asyncio
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session

from ....core.config import SAMPLES_DIR, UPLOADS_DIR, MAX_UPLOAD_BYTES
from ....core.state import (
    CURRENT_DATASET,
    org_dataset_put,
    cache_put_parsed,
    get_upload_semaphore
)
from ....cache import global_cache
from ....database import get_db, SessionLocal
from ....models import User, Organization, DatasetRecord, BillingRecord, AuditEvent
from ....parser import (
    parse_cur_file,
    parse_cur_manifest,
    validate_multipart_cur_export,
    merge_cur_files
)
from ....security import sanitize_upload_filename
from ....anomalies import sync_anomalies_to_db
from ....recommendations import generate_recommendations
from ....savings_ledger import sync_recommendations_to_ledger
from ....repository import BillingRepository
from ....schemas.dataset import SelectDatasetRequest, RenameDatasetRequest
from ...deps import get_current_user_and_org, require_auth, get_active_dataset_for_org

import logging
logger = logging.getLogger("zorvex.datasets")

router = APIRouter(prefix="", tags=["datasets"])


def _ingest_dataset_sync(
    org_id: int,
    user_id: int,
    final_filename: str,
    final_filepath: str,
    checksum_sha256: str,
    parsed: Dict[str, Any],
    manifest_metadata: Optional[Dict[str, Any]] = None,
    account_name: Optional[str] = None
) -> int:
    """
    Executes database persistence transaction in worker thread off the event loop.
    Creates and owns its dedicated SessionLocal() to ensure thread safety.
    Guarantees atomic rollback on exception.
    Implements idempotent replay detection and revision lineage tracking.
    """
    sync_db = SessionLocal()
    try:
        # 1. IDEMPOTENT REPLAY DETECTION
        existing_dataset = sync_db.query(DatasetRecord).filter(
            DatasetRecord.organization_id == org_id,
            DatasetRecord.checksum_sha256 == checksum_sha256
        ).first()

        if existing_dataset:
            has_records = sync_db.query(BillingRecord.id).filter(
                BillingRecord.organization_id == org_id,
                BillingRecord.dataset_id == existing_dataset.id
            ).first() is not None

            if has_records:
                sync_db.query(DatasetRecord).filter(
                    DatasetRecord.organization_id == org_id
                ).update({DatasetRecord.is_active: 0})

                existing_dataset.is_active = 1
                if account_name:
                    existing_dataset.account_name = account_name
                sync_db.add(AuditEvent(
                    organization_id=org_id,
                    user_id=user_id,
                    action="REPLAY_ACTIVATE",
                    details=f"Re-activated existing dataset {existing_dataset.filename} (id={existing_dataset.id}, checksum={checksum_sha256[:12]}...) without inserting duplicate records."
                ))
                sync_db.commit()
                logger.info("Replay detected for org %s: re-activated dataset %s without inserting duplicate rows", org_id, existing_dataset.id)
                return existing_dataset.id

        # 2. REVISION LINEAGE TRACKING
        billing_period_start = parsed.get('billing_period_start')
        billing_period_end = parsed.get('billing_period_end')
        payer_account_id = parsed.get('payer_account_id')
        usage_account_id = parsed.get('usage_account_id')
        assembly_id = parsed.get('assembly_id') or (manifest_metadata.get('assembly_id') if manifest_metadata else None)

        revision_version = 1
        superseded_dataset_id = None

        if billing_period_start and billing_period_end:
            prev_rev = sync_db.query(DatasetRecord).filter(
                DatasetRecord.organization_id == org_id,
                DatasetRecord.billing_period_start == billing_period_start,
                DatasetRecord.billing_period_end == billing_period_end
            ).order_by(DatasetRecord.revision_version.desc()).first()

            if prev_rev:
                revision_version = (prev_rev.revision_version or 1) + 1
                superseded_dataset_id = prev_rev.id

        sync_db.query(DatasetRecord).filter(
            DatasetRecord.organization_id == org_id
        ).update({DatasetRecord.is_active: 0})

        dataset_rec = DatasetRecord(
            organization_id=org_id,
            filename=final_filename,
            filepath=final_filepath,
            file_type='upload',
            checksum_sha256=checksum_sha256,
            billing_period_start=billing_period_start,
            billing_period_end=billing_period_end,
            payer_account_id=payer_account_id,
            usage_account_id=usage_account_id,
            account_name=account_name,
            assembly_id=assembly_id,
            manifest_metadata=json.dumps(manifest_metadata) if manifest_metadata else None,
            revision_version=revision_version,
            superseded_dataset_id=superseded_dataset_id,
            total_cost=parsed['gross_cost'],
            net_cost=parsed['net_cost'],
            credits_total=parsed['credits_total'],
            refunds_total=parsed['refunds_total'],
            taxes_total=parsed['taxes_total'],
            total_rows=parsed['total_rows'],
            is_active=1,
            uploaded_at=datetime.now(timezone.utc)
        )
        sync_db.add(dataset_rec)
        sync_db.flush()

        now_utc = datetime.now(timezone.utc)
        ds_id = dataset_rec.id
        billing_dicts = []
        for r in parsed.get('records', []):
            cost_val = float(r.get('cost', 0.0) or 0.0)
            unblended_val = float(r.get('unblended_cost', cost_val) or 0.0)
            billing_dicts.append({
                'organization_id': org_id,
                'dataset_id': ds_id,
                'line_item_id': r.get('line_item_id', ''),
                'usage_date': r.get('date', 'Unknown'),
                'usage_month': r.get('month', 'Unknown'),
                'usage_hour': r.get('hour', '00:00'),
                'service': r.get('service', 'Unknown'),
                'resource_id': r.get('resource_id', 'Unassigned'),
                'short_id': r.get('short_id', ''),
                'account_id': r.get('account_id', 'Unknown'),
                'region': r.get('region', 'us-east-1'),
                'cost': cost_val,
                'unblended_cost': unblended_val,
                'line_item_type': r.get('line_type', 'Usage'),
                'usage_type': r.get('usage_type', ''),
                'pricing_term': r.get('term', 'OnDemand'),
                'resource_name': r.get('name', ''),
                'sp_arn': r.get('sp_arn', ''),
                'ri_arn': r.get('ri_arn', ''),
                'created_at': now_utc
            })
            if len(billing_dicts) >= 2000:
                sync_db.bulk_insert_mappings(BillingRecord, billing_dicts)
                billing_dicts = []
        if billing_dicts:
            sync_db.bulk_insert_mappings(BillingRecord, billing_dicts)

        audit_msg = f"Uploaded and ingested {final_filename} ({parsed['total_rows']} rows, gross ${parsed['gross_cost']}, net ${parsed['net_cost']})"
        if revision_version > 1:
            audit_msg += f" [Revision v{revision_version}, superseded dataset id={superseded_dataset_id}]"

        sync_db.add(AuditEvent(
            organization_id=org_id,
            user_id=user_id,
            action="UPLOAD",
            details=audit_msg
        ))

        try:
            sync_anomalies_to_db(sync_db, parsed, org_id=org_id)
            recs_result = generate_recommendations(parsed)
            sync_recommendations_to_ledger(sync_db, recs_result.get('recommendations', []), org_id=org_id)
        except Exception as e:
            logger.warning("Ingestion anomaly/ledger synchronization warning for org %s: %s", org_id, e)

        if account_name and usage_account_id:
            try:
                sync_db.query(DatasetRecord).filter(
                    DatasetRecord.organization_id == org_id,
                    DatasetRecord.usage_account_id == usage_account_id,
                    (DatasetRecord.account_name.is_(None) | (DatasetRecord.account_name == ''))
                ).update({DatasetRecord.account_name: account_name}, synchronize_session=False)
            except Exception as e:
                logger.debug("Sibling account alias propagation notice: %s", e)

        sync_db.commit()
        return dataset_rec.id
    except Exception:
        sync_db.rollback()
        raise
    finally:
        sync_db.close()


@router.get("/datasets")
def list_datasets(
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    active_ds = get_active_dataset_for_org(org, db)
    active_filename = active_ds.get('filename')
    active_is_upload = bool(active_ds.get('id') is not None)

    uploads = []
    uploaded_filenames = set()
    if org:
        records = db.query(DatasetRecord).filter(
            DatasetRecord.organization_id == org.id,
            DatasetRecord.file_type == 'upload'
        ).order_by(DatasetRecord.id.desc()).all()
        for rec in records:
            size_kb = round(os.path.getsize(rec.filepath) / 1024, 1) if os.path.exists(rec.filepath) else 0.0
            uploads.append({
                "id": rec.id,
                "filename": rec.filename,
                "account_name": getattr(rec, 'account_name', None),
                "usage_account_id": getattr(rec, 'usage_account_id', None),
                "payer_account_id": getattr(rec, 'payer_account_id', None),
                "billing_period_start": getattr(rec, 'billing_period_start', None),
                "billing_period_end": getattr(rec, 'billing_period_end', None),
                "type": "upload",
                "size_kb": size_kb,
                "total_cost": rec.total_cost,
                "net_cost": rec.net_cost,
                "is_active": bool(rec.is_active)
            })
            uploaded_filenames.add(rec.filename)

    samples = []
    for fp in glob.glob(os.path.join(SAMPLES_DIR, '*.*')):
        if fp.endswith(('.csv', '.gz')):
            bname = os.path.basename(fp)
            if bname in uploaded_filenames:
                continue
            size_kb = round(os.path.getsize(fp) / 1024, 1)
            samples.append({
                "filename": bname,
                "type": "demo_fixture",
                "provenance": "synthetic" if not bname.startswith("CUR-Report-Daily") else "demo_internal_telemetry",
                "size_kb": size_kb,
                "is_active": (bname == active_filename and not active_is_upload)
            })

    return {
        "active_dataset": active_filename,
        "active": active_filename,
        "samples": samples,
        "uploads": uploads
    }


@router.post("/datasets/select")
def select_dataset(
    req: SelectDatasetRequest,
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    fname = req.filename

    if not fname or not isinstance(fname, str):
        raise HTTPException(status_code=400, detail="Invalid dataset filename.")

    clean_fname = os.path.normpath(fname).lstrip("\\/")
    if ".." in clean_fname.split(os.sep) or ".." in fname or os.path.isabs(fname) or ":" in fname:
        raise HTTPException(status_code=400, detail="Path traversal or absolute path injection rejected.")

    upload_rec = None
    if org:
        upload_rec = db.query(DatasetRecord).filter(
            DatasetRecord.organization_id == org.id,
            DatasetRecord.filename == clean_fname,
            DatasetRecord.file_type == 'upload'
        ).order_by(DatasetRecord.id.desc()).first()

    rec = None
    if upload_rec and upload_rec.filepath and os.path.exists(upload_rec.filepath):
        canonical_uploads_dir = os.path.realpath(UPLOADS_DIR)
        canonical_rec_path = os.path.realpath(upload_rec.filepath)
        try:
            upload_common = os.path.commonpath([canonical_uploads_dir, canonical_rec_path])
            if upload_common != canonical_uploads_dir or not os.path.isfile(canonical_rec_path):
                raise HTTPException(status_code=403, detail="Dataset file location is invalid.")
        except ValueError:
            raise HTTPException(status_code=403, detail="Dataset file location is invalid.")

        target_path = canonical_rec_path
        fname = upload_rec.filename
        is_sample = False
        rec = upload_rec
    else:
        canonical_samples_dir = os.path.realpath(SAMPLES_DIR)
        candidate_sample_path = os.path.realpath(os.path.join(canonical_samples_dir, clean_fname))

        try:
            common_sample = os.path.commonpath([canonical_samples_dir, candidate_sample_path])
            is_strictly_in_samples = (common_sample == canonical_samples_dir and candidate_sample_path != canonical_samples_dir)
        except ValueError:
            is_strictly_in_samples = False

        is_sample = is_strictly_in_samples and os.path.isfile(candidate_sample_path)
        if is_sample:
            target_path = candidate_sample_path
            fname = os.path.basename(candidate_sample_path)
        else:
            if not org:
                raise HTTPException(status_code=401, detail="Authentication required to select uploaded datasets.")
            raise HTTPException(status_code=404, detail=f"Dataset '{fname}' not found or does not belong to your organization.")

    try:
        parsed = parse_cur_file(target_path)
        cache_put_parsed(target_path, parsed)
        target_org = org or db.query(Organization).first()
        if target_org:
            org_dataset_put(target_org.id, {
                'filename': fname,
                'filepath': target_path,
                'data': parsed
            })
            global_cache.invalidate_org(target_org.id)
            db.query(DatasetRecord).filter(DatasetRecord.organization_id == target_org.id).update({DatasetRecord.is_active: 0})

            target_rec = None
            if not is_sample:
                if rec:
                    rec.is_active = 1
                    target_rec = rec
            else:
                sample_rec = db.query(DatasetRecord).filter(
                    DatasetRecord.organization_id == target_org.id,
                    DatasetRecord.filename == fname,
                    DatasetRecord.file_type == 'sample'
                ).first()
                if sample_rec:
                    sample_rec.is_active = 1
                    target_rec = sample_rec
                else:
                    sample_rec = DatasetRecord(
                        organization_id=target_org.id,
                        filename=fname,
                        filepath=target_path,
                        file_type='sample',
                        total_cost=parsed['gross_cost'],
                        net_cost=parsed['net_cost'],
                        credits_total=parsed['credits_total'],
                        refunds_total=parsed['refunds_total'],
                        taxes_total=parsed['taxes_total'],
                        total_rows=parsed['total_rows'],
                        is_active=1,
                        uploaded_at=datetime.now(timezone.utc)
                    )
                    db.add(sample_rec)
                    db.flush()
                    target_rec = sample_rec
            db.commit()

            if target_rec:
                repo = BillingRepository(db, org_id=target_org.id, dataset_id=target_rec.id)
                if not repo.has_records():
                    repo.ensure_persisted(parsed)

            try:
                sync_anomalies_to_db(db, parsed, org_id=target_org.id)
                recs_result = generate_recommendations(parsed)
                sync_recommendations_to_ledger(db, recs_result.get('recommendations', []), org_id=target_org.id)
            except Exception as e:
                logger.warning("Dataset selection synchronization warning for org %s: %s", target_org.id, e)

        if is_sample:
            CURRENT_DATASET['filename'] = fname
            CURRENT_DATASET['filepath'] = target_path
            CURRENT_DATASET['data'] = parsed

        return {
            "success": True,
            "filename": fname,
            "total_cost": parsed['total_cost'],
            "gross_cost": parsed['gross_cost'],
            "net_cost": parsed['net_cost'],
            "total_rows": parsed['total_rows'],
            "dates_count": len(parsed['dates'])
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing file {fname}: {str(e)}")


@router.post("/datasets/rename")
def rename_dataset_account(
    req: RenameDatasetRequest,
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    user, org = auth
    clean_name = req.account_name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Account friendly name cannot be blank.")

    query = db.query(DatasetRecord).filter(DatasetRecord.organization_id == org.id)
    rec = None
    if req.dataset_id_or_filename:
        raw_ident = req.dataset_id_or_filename.strip()
        if raw_ident.isdigit():
            rec = query.filter(DatasetRecord.id == int(raw_ident)).first()
        if not rec:
            rec = query.filter(DatasetRecord.filename == raw_ident).first()

    if not rec:
        rec = query.filter(DatasetRecord.is_active == 1).first()

    if not rec:
        raise HTTPException(status_code=404, detail="Dataset not found to rename.")

    rec.account_name = clean_name
    updated_count = 1
    if req.propagate_to_account and rec.usage_account_id:
        others = query.filter(
            DatasetRecord.usage_account_id == rec.usage_account_id,
            DatasetRecord.id != rec.id
        ).all()
        for o in others:
            o.account_name = clean_name
            updated_count += 1

    db.add(AuditEvent(
        organization_id=org.id,
        user_id=user.id,
        action="DATASET_RENAME",
        details=f"Renamed dataset {rec.filename} account alias to '{clean_name}' (propagated to {updated_count} datasets)."
    ))
    db.commit()

    return {
        "status": "success",
        "dataset_id": rec.id,
        "filename": rec.filename,
        "account_name": clean_name,
        "usage_account_id": rec.usage_account_id,
        "updated_count": updated_count
    }


@router.post("/upload")
async def upload_cur_file(
    file: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None),
    account_name: Optional[str] = Form(None),
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    user, org = auth
    incoming_files: List[UploadFile] = []
    if files:
        incoming_files.extend(files)
    if file and file not in incoming_files:
        incoming_files.append(file)
    if not incoming_files:
        raise HTTPException(status_code=400, detail="No file provided for upload.")

    for f in incoming_files:
        raw_name = (f.filename or "upload.csv").lower()
        if raw_name.endswith('.parquet') or raw_name.endswith('.zip'):
            raise HTTPException(
                status_code=400,
                detail=f"File '{f.filename}' format is not supported in this phase. Parquet and ZIP CUR exports are unsupported; please use CSV (.csv or .csv.gz) with optional Manifest JSON."
            )
        if not (raw_name.endswith('.csv') or raw_name.endswith('.csv.gz') or raw_name.endswith('.gz') or raw_name.endswith('.json')):
            raise HTTPException(
                status_code=400,
                detail=f"File '{f.filename}' is not supported. Only .csv, .csv.gz, and Manifest .json files are allowed."
            )

    file_id = secrets.token_hex(8)
    saved_paths: List[str] = []
    saved_filenames: List[str] = []
    manifest_paths: List[str] = []
    data_paths: List[str] = []
    data_filenames: List[str] = []
    hasher = hashlib.sha256()

    try:
        for idx, f in enumerate(incoming_files):
            raw_fn = f.filename or f"upload_{idx}.csv"
            safe_fn = sanitize_upload_filename(raw_fn)
            is_json = safe_fn.lower().endswith('.json')
            prefix = "manifest" if is_json else f"part{idx}"
            storage_name = f"cur_org_{org.id}_{file_id}_{prefix}_{safe_fn}"
            part_path = os.path.join(UPLOADS_DIR, storage_name)

            bytes_written = 0
            with open(part_path, "wb") as buffer:
                while True:
                    chunk = await f.read(1024 * 64)
                    if not chunk:
                        break
                    bytes_written += len(chunk)
                    if bytes_written > MAX_UPLOAD_BYTES:
                        buffer.close()
                        raise HTTPException(status_code=413, detail=f"File '{safe_fn}' exceeds maximum upload limit of 100MB.")
                    if not is_json:
                        hasher.update(chunk)
                    buffer.write(chunk)

            if safe_fn.endswith('.gz'):
                try:
                    with open(part_path, "rb") as check_f:
                        lead = check_f.read(2)
                        if len(lead) < 2 or lead[0] != 0x1f or lead[1] != 0x8b:
                            raise HTTPException(status_code=400, detail=f"File '{safe_fn}' is not a valid gzip stream.")
                except HTTPException:
                    raise
                except Exception:
                    raise HTTPException(status_code=400, detail=f"Invalid gzip header format in '{safe_fn}'.")

            saved_paths.append(part_path)
            saved_filenames.append(safe_fn)
            if is_json:
                manifest_paths.append(part_path)
            else:
                data_paths.append(part_path)
                data_filenames.append(safe_fn)

    except Exception as e:
        for p in saved_paths:
            if os.path.exists(p):
                os.remove(p)
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Failed to stream upload: {str(e)}")

    if not data_paths:
        for p in saved_paths:
            if os.path.exists(p):
                os.remove(p)
        raise HTTPException(status_code=400, detail="No CUR data files (.csv or .csv.gz) were provided with the manifest.")

    manifest_info = None
    if manifest_paths:
        try:
            manifest_info = parse_cur_manifest(manifest_paths[0])
        except ValueError as ve:
            for p in saved_paths:
                if os.path.exists(p):
                    os.remove(p)
            raise HTTPException(status_code=400, detail=f"Invalid CUR manifest: {str(ve)}")

    checksum_sha256 = hasher.hexdigest()
    data_paths.sort(key=lambda p: os.path.basename(p))

    if len(data_paths) > 1 or manifest_info is not None:
        try:
            validate_multipart_cur_export(data_paths, manifest=manifest_info)
        except ValueError as ve:
            for p in saved_paths:
                if os.path.exists(p):
                    os.remove(p)
            raise HTTPException(status_code=400, detail=f"Multi-part CUR validation failed: {str(ve)}")

    intermediate_parts_to_clean: List[str] = []
    if len(data_paths) == 1:
        final_filepath = data_paths[0]
        base_filename = data_filenames[0]
    else:
        first_base = data_filenames[0].replace('.csv.gz', '').replace('.csv', '').replace('.gz', '')
        import re
        clean_prefix = re.sub(r'[-_]00001$', '', first_base)
        combined_storage_name = f"cur_org_{org.id}_{file_id}_merged_{clean_prefix}.csv.gz"
        final_filepath = os.path.join(UPLOADS_DIR, combined_storage_name)
        try:
            await asyncio.to_thread(merge_cur_files, data_paths, final_filepath, manifest=manifest_info)
            intermediate_parts_to_clean.extend(data_paths)
        except Exception as e:
            for p in saved_paths:
                if os.path.exists(p):
                    os.remove(p)
            raise HTTPException(status_code=500, detail=f"Failed to merge CUR part files: {str(e)}")

        base_filename = f"{clean_prefix} (Merged {len(data_paths)} parts).csv.gz"

    async with get_upload_semaphore():
        try:
            parsed = await asyncio.to_thread(parse_cur_file, final_filepath)
        except Exception as e:
            if os.path.exists(final_filepath):
                os.remove(final_filepath)
            for p in saved_paths:
                if os.path.exists(p):
                    os.remove(p)
            raise HTTPException(status_code=500, detail=f"File uploaded but failed to parse: {str(e)}")

    for p in intermediate_parts_to_clean:
        if os.path.exists(p):
            try:
                os.remove(p)
            except Exception:
                pass

    clean_acc_name = account_name.strip() if (account_name and account_name.strip()) else None
    usage_acc = parsed.get('usage_account_id')

    if not clean_acc_name and usage_acc and usage_acc != 'Unknown':
        existing_alias = db.query(DatasetRecord.account_name).filter(
            DatasetRecord.organization_id == org.id,
            DatasetRecord.usage_account_id == usage_acc,
            DatasetRecord.account_name.isnot(None),
            DatasetRecord.account_name != ''
        ).order_by(DatasetRecord.id.desc()).first()
        if existing_alias and existing_alias[0]:
            clean_acc_name = existing_alias[0]

    final_filename = base_filename

    try:
        ds_id = await asyncio.to_thread(
            _ingest_dataset_sync,
            org.id,
            user.id,
            final_filename,
            final_filepath,
            checksum_sha256,
            parsed,
            manifest_info,
            clean_acc_name
        )
    except Exception as e:
        if os.path.exists(final_filepath):
            try:
                os.remove(final_filepath)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=f"Database persistence failed: {str(e)}")

    cache_put_parsed(final_filepath, parsed)
    org_dataset_put(org.id, {
        'filename': final_filename,
        'filepath': final_filepath,
        'data': parsed
    })
    global_cache.invalidate_org(org.id)

    return {
        "success": True,
        "dataset_id": ds_id,
        "filename": final_filename,
        "account_name": clean_acc_name,
        "usage_account_id": usage_acc,
        "payer_account_id": parsed.get('payer_account_id'),
        "billing_period_start": parsed.get('billing_period_start'),
        "billing_period_end": parsed.get('billing_period_end'),
        "total_cost": parsed['total_cost'],
        "gross_cost": parsed['gross_cost'],
        "net_cost": parsed['net_cost'],
        "credits_total": parsed['credits_total'],
        "refunds_total": parsed['refunds_total'],
        "taxes_total": parsed['taxes_total'],
        "total_rows": parsed['total_rows'],
        "dates": parsed['dates'],
        "checksum_sha256": checksum_sha256,
        "message": f"Successfully parsed and activated {final_filename}"
    }
