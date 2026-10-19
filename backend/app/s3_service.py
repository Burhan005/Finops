"""
ZORVEX Phase 5: S3 Cost and Usage Report (CUR) Integration Service
===================================================================
Provides robust, least-privilege direct AWS S3 CUR discovery, manifest parsing,
bounded streaming downloads, multi-part reconciliation, and dataset persistence.

Security Principles:
- Never hardcodes or logs AWS credentials or private keys.
- Implements least-privilege IAM permission definitions.
- Strictly bounds download sizes and validates gzip streams (0x1f 0x8b).
- Transparently distinguishes credential absence from actual network/S3 errors.
- Respects multi-tenant isolation: tenants can only sync their configured S3 buckets.
"""

import os
import json
import gzip
import shutil
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Tuple

from sqlalchemy.orm import Session

from .core.config import UPLOADS_DIR, MAX_UPLOAD_BYTES
from .models import S3SyncConfig, S3SyncExecutionHistory, DatasetRecord, AuditEvent
from .parser import (
    parse_cur_manifest,
    parse_cur_file,
    validate_multipart_cur_export,
    merge_cur_files
)
from .security import sanitize_upload_filename
from .cache import global_cache
from .core.state import cache_put_parsed, org_dataset_put

logger = logging.getLogger("zorvex.s3_service")


def generate_least_privilege_iam_policy(bucket_name: str, prefix: str = "") -> Dict[str, Any]:
    """
    Generates an exact least-privilege AWS IAM Policy document for S3 CUR read access.
    Restricts read access strictly to the configured bucket and CUR report prefix.
    """
    clean_prefix = prefix.strip().lstrip("/")
    if clean_prefix and not clean_prefix.endswith("*"):
        obj_prefix = f"{clean_prefix}*" if clean_prefix.endswith("/") else f"{clean_prefix}/*"
    elif clean_prefix:
        obj_prefix = clean_prefix
    else:
        obj_prefix = "*"

    return {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "ZorvexCurBucketListing",
                "Effect": "Allow",
                "Action": [
                    "s3:ListBucket",
                    "s3:GetBucketLocation"
                ],
                "Resource": f"arn:aws:s3:::{bucket_name}",
                "Condition": {
                    "StringLike": {
                        "s3:prefix": [
                            f"{clean_prefix}*" if clean_prefix else "*"
                        ]
                    }
                }
            },
            {
                "Sid": "ZorvexCurObjectRead",
                "Effect": "Allow",
                "Action": [
                    "s3:GetObject"
                ],
                "Resource": f"arn:aws:s3:::{bucket_name}/{obj_prefix}"
            }
        ]
    }


def resolve_aws_session(
    region: str = "ap-south-1",
    profile_name: Optional[str] = None,
    role_arn: Optional[str] = None
) -> Tuple[Optional[Any], str, Optional[str]]:
    """
    Resolves a boto3 Session using the standard AWS credential chain:
    1. Explicit profile if provided or AWS_PROFILE
    2. Environment variables (AWS_ACCESS_KEY_ID, etc.)
    3. IAM Role / ECS / EC2 Instance Metadata
    4. Optional AssumeRole if role_arn provided

    Returns:
        (session, status, error_detail)
        status: "AUTHENTICATED", "CREDENTIALS_REQUIRED", "ACCESS_DENIED", "ERROR"
    """
    try:
        import boto3
        import botocore.exceptions
    except ImportError:
        return None, "ERROR", "boto3 is not installed in the environment."

    # Check if credentials exist in environment
    has_env = bool(
        os.environ.get("AWS_ACCESS_KEY_ID") and os.environ.get("AWS_SECRET_ACCESS_KEY")
    )
    has_role = bool(
        os.environ.get("AWS_CONTAINER_CREDENTIALS_RELATIVE_URI") or
        os.environ.get("AWS_WEB_IDENTITY_TOKEN_FILE")
    )

    # Determine profile
    target_profile = profile_name or os.environ.get("AWS_PROFILE")
    if not target_profile and not has_env and not has_role:
        try:
            available = boto3.Session().available_profiles
            if "iam-roles-anywhere" in available:
                target_profile = "iam-roles-anywhere"
        except Exception:
            pass

    try:
        if target_profile:
            session = boto3.Session(profile_name=target_profile, region_name=region)
        else:
            session = boto3.Session(region_name=region)

        # Validate credential retrieval
        credentials = session.get_credentials()
        if not credentials:
            return None, "CREDENTIALS_REQUIRED", "No AWS credentials detected in environment, config, or IAM role chain."

        # If role_arn is specified for cross-account assume role
        if role_arn:
            try:
                sts_client = session.client("sts", region_name=region)
                current_caller = sts_client.get_caller_identity()
                current_arn = current_caller.get("Arn", "")
                role_name = role_arn.split("/")[-1]
                # If current session is already authenticated as or assumed this exact role, skip redundant assume_role
                if f":assumed-role/{role_name}/" in current_arn or current_arn.endswith(f":role/{role_name}"):
                    return session, "AUTHENTICATED", None

                assumed = sts_client.assume_role(
                    RoleArn=role_arn,
                    RoleSessionName="ZorvexFinOpsCurSyncSession",
                    DurationSeconds=3600
                )
                creds = assumed["Credentials"]
                session = boto3.Session(
                    aws_access_key_id=creds["AccessKeyId"],
                    aws_secret_access_key=creds["SecretAccessKey"],
                    aws_session_token=creds["SessionToken"],
                    region_name=region
                )
            except botocore.exceptions.ClientError as ce:
                err_code = ce.response.get("Error", {}).get("Code", "AccessDenied")
                err_msg = ce.response.get("Error", {}).get("Message", str(ce))
                return None, "ACCESS_DENIED", f"AssumeRole failed for {role_arn} ({err_code}): {err_msg}"

        return session, "AUTHENTICATED", None

    except botocore.exceptions.ProfileNotFound as pnf:
        return None, "CREDENTIALS_REQUIRED", f"AWS Profile '{target_profile}' not found: {str(pnf)}"
    except botocore.exceptions.ClientError as ce:
        err_code = ce.response.get("Error", {}).get("Code", "ClientError")
        return None, "ACCESS_DENIED", f"AWS Client Error ({err_code}): {str(ce)}"
    except Exception as exc:
        return None, "CREDENTIALS_REQUIRED", f"AWS authentication initialization error: {str(exc)}"


def discover_s3_cur_reports(
    s3_client: Any,
    bucket_name: str,
    prefix: str = ""
) -> Dict[str, Any]:
    """
    Discovers Cost and Usage Reports (CUR) in the target S3 bucket under the prefix.
    Identifies:
    - Manifest files (*-Manifest.json or *Manifest.json)
    - Assembly IDs, billing periods, and reportKeys
    - Direct CSV/CSV.GZ files if no manifest is present
    """
    clean_prefix = prefix.strip().lstrip("/")
    paginator = s3_client.get_paginator("list_objects_v2")
    
    manifest_keys = []
    data_keys = []
    total_objects_scanned = 0

    for page in paginator.paginate(Bucket=bucket_name, Prefix=clean_prefix):
        contents = page.get("Contents", [])
        for obj in contents:
            total_objects_scanned += 1
            key = obj["Key"]
            key_lower = key.lower()

            if key_lower.endswith(".json") and ("manifest" in key_lower):
                manifest_keys.append({
                    "key": key,
                    "size": obj["Size"],
                    "last_modified": obj["LastModified"].isoformat()
                })
            elif key_lower.endswith(".csv.gz") or key_lower.endswith(".csv"):
                data_keys.append({
                    "key": key,
                    "size": obj["Size"],
                    "last_modified": obj["LastModified"].isoformat()
                })

    # Sort manifests by last_modified descending (latest first)
    manifest_keys.sort(key=lambda x: x["last_modified"], reverse=True)

    authoritative_manifest = None
    manifest_data = None
    report_files_to_fetch = []

    if manifest_keys:
        # Use latest manifest
        authoritative_manifest = manifest_keys[0]["key"]
        try:
            resp = s3_client.get_object(Bucket=bucket_name, Key=authoritative_manifest)
            manifest_content = resp["Body"].read().decode("utf-8")
            manifest_data = json.loads(manifest_content)

            # Extract reportKeys from manifest
            report_keys_raw = manifest_data.get("reportKeys", [])
            for rk in report_keys_raw:
                report_files_to_fetch.append(rk)
        except Exception as e:
            logger.warning("Failed to parse manifest %s from S3: %s", authoritative_manifest, e)

    # Fallback if no manifest or empty reportKeys: pick data keys grouped by latest directory/date
    if not report_files_to_fetch and data_keys:
        # Group by folder / billing period prefix
        data_keys.sort(key=lambda x: x["last_modified"], reverse=True)
        # Group keys by common directory
        latest_dir = os.path.dirname(data_keys[0]["key"])
        report_files_to_fetch = [
            dk["key"] for dk in data_keys if os.path.dirname(dk["key"]) == latest_dir
        ]

    return {
        "bucket_name": bucket_name,
        "prefix": clean_prefix,
        "total_objects_scanned": total_objects_scanned,
        "manifest_found": bool(authoritative_manifest),
        "manifest_key": authoritative_manifest,
        "manifest_metadata": manifest_data,
        "assembly_id": manifest_data.get("assemblyId") if manifest_data else None,
        "billing_period": manifest_data.get("billingPeriod") if manifest_data else None,
        "report_keys_count": len(report_files_to_fetch),
        "report_keys": report_files_to_fetch
    }


def download_and_ingest_cur_from_s3(
    db: Session,
    org_id: int,
    user_id: int,
    s3_config: S3SyncConfig,
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Executes end-to-end direct S3 CUR sync:
    1. Authenticates against AWS securely.
    2. Discovers CUR manifests and data files.
    3. Downloads and validates data files with byte-budget and gzip checks.
    4. Merges multi-part reports if applicable.
    5. Normalizes and persists to SQLite database.
    6. Updates dataset revision and invalidates tenant cache.
    7. Records execution telemetry in S3SyncExecutionHistory.
    """
    now_utc = datetime.now(timezone.utc)
    bucket_name = s3_config.bucket_name
    region = s3_config.region or "ap-south-1"
    prefix = s3_config.prefix or ""

    # 1. Resolve AWS Session
    session, auth_status, auth_err = resolve_aws_session(
        region=region,
        role_arn=s3_config.role_arn
    )

    if auth_status != "AUTHENTICATED" or not session:
        policy_rec = generate_least_privilege_iam_policy(bucket_name, prefix)
        s3_config.last_synced_at = now_utc
        s3_config.last_status = auth_status
        s3_config.last_message = f"AWS authentication failed: {auth_err}"

        history = S3SyncExecutionHistory(
            organization_id=org_id,
            s3_config_id=s3_config.id,
            started_at=now_utc,
            completed_at=now_utc,
            status=auth_status,
            records_ingested=0,
            bytes_downloaded=0,
            error_message=auth_err
        )
        db.add(history)
        db.commit()

        return {
            "success": False,
            "status": auth_status,
            "bucket_name": bucket_name,
            "region": region,
            "prefix": prefix,
            "error": auth_err,
            "recommended_iam_policy": policy_rec,
            "message": f"Unable to authenticate with AWS. Ensure IAM credentials or role is configured. Status: {auth_status}"
        }

    s3_client = session.client("s3", region_name=region)

    # 2. Verify Bucket Access
    try:
        s3_client.head_bucket(Bucket=bucket_name)
    except Exception as exc:
        err_msg = str(exc)
        s3_config.last_synced_at = now_utc
        s3_config.last_status = "ACCESS_DENIED"
        s3_config.last_message = f"Cannot access S3 bucket '{bucket_name}': {err_msg}"

        history = S3SyncExecutionHistory(
            organization_id=org_id,
            s3_config_id=s3_config.id,
            started_at=now_utc,
            completed_at=now_utc,
            status="ACCESS_DENIED",
            records_ingested=0,
            bytes_downloaded=0,
            error_message=err_msg
        )
        db.add(history)
        db.commit()

        return {
            "success": False,
            "status": "ACCESS_DENIED",
            "bucket_name": bucket_name,
            "region": region,
            "error": err_msg,
            "recommended_iam_policy": generate_least_privilege_iam_policy(bucket_name, prefix),
            "message": f"Access denied to S3 bucket '{bucket_name}'. Verify bucket name and IAM permissions."
        }

    # 3. Discover CUR Reports
    discovery = discover_s3_cur_reports(s3_client, bucket_name, prefix)
    report_keys = discovery.get("report_keys", [])

    if not report_keys:
        s3_config.last_synced_at = now_utc
        s3_config.last_status = "NO_REPORTS_FOUND"
        s3_config.last_message = f"No CUR report files found under prefix '{prefix}' in bucket '{bucket_name}'."

        history = S3SyncExecutionHistory(
            organization_id=org_id,
            s3_config_id=s3_config.id,
            started_at=now_utc,
            completed_at=now_utc,
            status="NO_REPORTS_FOUND",
            records_ingested=0,
            bytes_downloaded=0,
            manifest_key=discovery.get("manifest_key")
        )
        db.add(history)
        db.commit()

        return {
            "success": False,
            "status": "NO_REPORTS_FOUND",
            "bucket_name": bucket_name,
            "prefix": prefix,
            "discovery": discovery,
            "message": f"No CUR data files or manifests discovered in bucket '{bucket_name}' under prefix '{prefix}'."
        }

    if dry_run:
        return {
            "success": True,
            "status": "DRY_RUN_COMPLETED",
            "discovery": discovery,
            "message": f"Discovered {len(report_keys)} CUR report objects ready for ingestion."
        }

    # 4. Stream and Download Objects with Size Bounds
    downloaded_paths = []
    total_bytes_downloaded = 0
    hasher = hashlib.sha256()

    staging_dir = os.path.join(UPLOADS_DIR, f"s3_sync_org_{org_id}_{int(now_utc.timestamp())}")
    os.makedirs(staging_dir, exist_ok=True)

    try:
        for rk in report_keys:
            raw_fn = os.path.basename(rk)
            safe_fn = sanitize_upload_filename(raw_fn)
            local_target = os.path.join(staging_dir, safe_fn)

            resp = s3_client.get_object(Bucket=bucket_name, Key=rk)
            body = resp["Body"]

            file_bytes = 0
            with open(local_target, "wb") as f_out:
                while True:
                    chunk = body.read(1024 * 64)
                    if not chunk:
                        break
                    file_bytes += len(chunk)
                    total_bytes_downloaded += len(chunk)
                    if total_bytes_downloaded > MAX_UPLOAD_BYTES:
                        raise ValueError(f"Total S3 sync payload exceeds limit of {MAX_UPLOAD_BYTES} bytes.")
                    hasher.update(chunk)
                    f_out.write(chunk)

            # Validate gzip header if .gz
            if safe_fn.endswith(".gz"):
                with open(local_target, "rb") as gz_check:
                    magic = gz_check.read(2)
                    if len(magic) < 2 or magic[0] != 0x1F or magic[1] != 0x8B:
                        raise ValueError(f"Downloaded S3 object '{rk}' has invalid gzip stream.")

            downloaded_paths.append(local_target)

        # 5. Handle Multi-Part Merging
        manifest_meta = discovery.get("manifest_metadata")
        if len(downloaded_paths) == 1:
            final_filepath = downloaded_paths[0]
            final_filename = f"s3_{bucket_name}_{os.path.basename(downloaded_paths[0])}"
        else:
            merged_filename = f"s3_{bucket_name}_merged_cur_{int(now_utc.timestamp())}.csv.gz"
            final_filepath = os.path.join(staging_dir, merged_filename)
            merge_cur_files(downloaded_paths, final_filepath, manifest=manifest_meta)
            final_filename = merged_filename

        # 6. Parse CUR Report
        parsed = parse_cur_file(final_filepath)
        checksum_sha256 = hasher.hexdigest()

        # Import _ingest_dataset_sync lazily to avoid circular imports
        from .api.v1.endpoints.datasets import _ingest_dataset_sync

        # Move to persistent uploads path
        persistent_filepath = os.path.join(UPLOADS_DIR, f"cur_org_{org_id}_s3_{os.path.basename(final_filepath)}")
        shutil.copy2(final_filepath, persistent_filepath)

        # Ingest to database
        dataset_id = _ingest_dataset_sync(
            org_id=org_id,
            user_id=user_id,
            final_filename=final_filename,
            final_filepath=persistent_filepath,
            checksum_sha256=checksum_sha256,
            parsed=parsed,
            manifest_metadata=manifest_meta,
            account_name=(getattr(s3_config, 'account_name', None) or f"AWS S3 Sync ({bucket_name})")
        )

        # Update cache & active state
        cache_put_parsed(persistent_filepath, parsed)
        org_dataset_put(org_id, {
            "filename": final_filename,
            "filepath": persistent_filepath,
            "data": parsed
        })
        global_cache.invalidate_org(org_id)

        # Update config & execution history
        s3_config.last_synced_at = now_utc
        s3_config.last_status = "SYNCED"
        s3_config.last_message = f"Successfully synced {parsed['total_rows']:,} rows from S3 '{bucket_name}' ({final_filename})."

        history = S3SyncExecutionHistory(
            organization_id=org_id,
            s3_config_id=s3_config.id,
            started_at=now_utc,
            completed_at=datetime.now(timezone.utc),
            status="SYNCED",
            records_ingested=parsed["total_rows"],
            bytes_downloaded=total_bytes_downloaded,
            manifest_key=discovery.get("manifest_key")
        )
        db.add(history)
        db.commit()

        return {
            "success": True,
            "status": "SYNCED",
            "dataset_id": dataset_id,
            "filename": final_filename,
            "bucket_name": bucket_name,
            "prefix": prefix,
            "bytes_downloaded": total_bytes_downloaded,
            "files_downloaded": len(downloaded_paths),
            "manifest_key": discovery.get("manifest_key"),
            "assembly_id": discovery.get("assembly_id"),
            "total_rows": parsed["total_rows"],
            "total_cost": parsed["total_cost"],
            "gross_cost": parsed["gross_cost"],
            "net_cost": parsed["net_cost"],
            "credits_total": parsed["credits_total"],
            "refunds_total": parsed["refunds_total"],
            "taxes_total": parsed["taxes_total"],
            "dates": parsed["dates"],
            "checksum_sha256": checksum_sha256,
            "message": f"Successfully ingested CUR report from S3 bucket '{bucket_name}' into dataset #{dataset_id}."
        }

    except Exception as exc:
        logger.exception("S3 CUR download or ingestion failed: %s", exc)
        err_msg = str(exc)

        s3_config.last_synced_at = now_utc
        s3_config.last_status = "FAILED"
        s3_config.last_message = f"S3 CUR ingestion error: {err_msg}"

        history = S3SyncExecutionHistory(
            organization_id=org_id,
            s3_config_id=s3_config.id,
            started_at=now_utc,
            completed_at=datetime.now(timezone.utc),
            status="FAILED",
            records_ingested=0,
            bytes_downloaded=total_bytes_downloaded,
            error_message=err_msg
        )
        db.add(history)
        db.commit()

        return {
            "success": False,
            "status": "FAILED",
            "bucket_name": bucket_name,
            "error": err_msg,
            "bytes_downloaded": total_bytes_downloaded,
            "message": f"Failed during S3 CUR download or parsing: {err_msg}"
        }

    finally:
        # Cleanup temporary staging directory
        if os.path.exists(staging_dir):
            try:
                shutil.rmtree(staging_dir)
            except Exception:
                pass
