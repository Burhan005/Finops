"""
Authentication and Organization Scoping Dependencies for ZORVEX FinOps Platform.
"""

import os
from typing import Optional, Tuple, Dict, Any
from datetime import datetime, timezone

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from ..core.config import SAMPLES_DIR
from ..core.state import (
    CURRENT_DATASET,
    get_org_lock,
    org_dataset_get,
    org_dataset_put,
    org_dataset_del,
    cache_get_parsed,
    cache_put_parsed
)
from ..parser import parse_cur_file
from ..cache import global_cache
from ..database import get_db
from ..models import User, Organization, UserSession, DatasetRecord
from ..repository import BillingRepository

import logging
logger = logging.getLogger("zorvex.deps")


def get_current_user_and_org(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Tuple[Optional[User], Optional[Organization]]:
    """
    Extracts session token strictly from Authorization: Bearer header.
    Query-string tokens are disallowed to prevent credential leakage in URLs/logs.
    Returns (User, Organization) or (None, None) if unauthenticated.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None, None

    auth_token = authorization.split("Bearer ", 1)[1].strip()
    if not auth_token:
        return None, None

    sess = (
        db.query(UserSession)
        .options(joinedload(UserSession.user).joinedload(User.organization))
        .filter(UserSession.token == auth_token)
        .first()
    )
    if not sess:
        return None, None

    if sess.expires_at:
        now_utc = datetime.now(timezone.utc)
        exp = sess.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if now_utc > exp:
            return None, None

    user = sess.user
    if not user:
        return None, None

    org = user.organization
    if not org and user.organization_id:
        org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    if not org:
        # Strict tenant boundary: user without an authoritative organization is unauthenticated
        return None, None

    return user, org


def require_auth(
    user_org: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org)
) -> Tuple[User, Organization]:
    """
    Enforces authentication on protected endpoints.
    Returns 401 Unauthorized if request does not contain a valid session token.
    """
    user, org = user_org
    if not user or not org:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid session token.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    return user, org


def get_active_dataset_for_org(org: Optional[Organization], db: Session) -> Dict[str, Any]:
    """
    Returns active in-memory dataset scoped to the specified organization.
    Falls back to global initial dataset for unauthenticated sample exploration.
    Guarantees isolation: mutating an org dataset never alters another tenant or global demo state.
    """
    if org:
        active_rec = db.query(DatasetRecord).filter(
            DatasetRecord.organization_id == org.id,
            DatasetRecord.is_active == 1
        ).order_by(DatasetRecord.id.desc()).first()

        active_filepath = active_rec.filepath if (active_rec and os.path.exists(active_rec.filepath)) else None

        if active_filepath:
            cached_org = org_dataset_get(org.id)
            try:
                current_mtime = os.path.getmtime(active_filepath)
            except OSError:
                current_mtime = None

            if cached_org and cached_org.get('data') and cached_org.get('filepath') == active_filepath:
                if current_mtime is None or cached_org.get('mtime') == current_mtime:
                    return cached_org

            with get_org_lock(org.id):
                cached_org = org_dataset_get(org.id)
                if cached_org and cached_org.get('data') and cached_org.get('filepath') == active_filepath:
                    if current_mtime is None or cached_org.get('mtime') == current_mtime:
                        return cached_org

                try:
                    norm_path = os.path.abspath(active_filepath)
                    mtime = current_mtime if current_mtime is not None else os.path.getmtime(active_filepath)
                    cache_key = f"{norm_path}_{mtime}"

                    parsed = cache_get_parsed(cache_key)
                    if parsed is None:
                        if CURRENT_DATASET.get('data') and CURRENT_DATASET.get('filepath') and norm_path == os.path.abspath(CURRENT_DATASET['filepath']):
                            parsed = CURRENT_DATASET['data']
                            cache_put_parsed(cache_key, parsed)
                        else:
                            parsed = parse_cur_file(active_filepath)
                            cache_put_parsed(cache_key, parsed)

                    entry = {
                        'id': active_rec.id,
                        'filename': active_rec.filename,
                        'filepath': active_filepath,
                        'mtime': mtime,
                        'data': parsed
                    }
                    org_dataset_put(org.id, entry)
                    return entry
                except Exception as e:
                    logger.warning("Failed to parse cached dataset for org %s: %s", org.id, e)

        if active_rec:
            if not active_filepath:
                org_dataset_del(org.id)
                global_cache.invalidate_org(org.id)
                return {
                    'id': active_rec.id,
                    'filename': active_rec.filename,
                    'filepath': active_rec.filepath or '',
                    'data': None
                }

        # If org has no active record, isolate a dedicated copy for this org if CURRENT_DATASET has a valid file
        if CURRENT_DATASET.get('filepath') and os.path.exists(CURRENT_DATASET['filepath']):
            cached_org = org_dataset_get(org.id)
            if not cached_org or not cached_org.get('data'):
                cached_org = {
                    'filename': CURRENT_DATASET.get('filename'),
                    'filepath': CURRENT_DATASET.get('filepath'),
                    'mtime': os.path.getmtime(CURRENT_DATASET['filepath']) if os.path.exists(CURRENT_DATASET['filepath']) else 0,
                    'data': CURRENT_DATASET.get('data')
                }
                org_dataset_put(org.id, cached_org)
            return cached_org

        org_dataset_del(org.id)
        global_cache.invalidate_org(org.id)
        return {
            'id': None,
            'filename': None,
            'filepath': None,
            'data': None
        }

    # Public unauthenticated visitor: strictly return public demo sample dataset
    sample_path = os.path.join(SAMPLES_DIR, "aws_cur_production_exact.csv")
    if not CURRENT_DATASET.get('data') or not CURRENT_DATASET.get('filepath') or 'cur_org_' in str(CURRENT_DATASET.get('filepath', '')):
        if os.path.exists(sample_path):
            parsed = parse_cur_file(sample_path)
            CURRENT_DATASET['filename'] = "aws_cur_production_exact.csv"
            CURRENT_DATASET['filepath'] = sample_path
            CURRENT_DATASET['data'] = parsed
    return CURRENT_DATASET or {
        'id': None,
        'filename': 'aws_cur_production_exact.csv',
        'filepath': sample_path if os.path.exists(sample_path) else None,
        'data': None
    }


def get_billing_repository(org: Optional[Organization], dataset: Dict[str, Any], db: Session) -> BillingRepository:
    """
    Instantiates BillingRepository bound to the organization and active dataset record.
    Supports both uploaded datasets and active catalog demo fixtures.
    Strict tenant boundary: Unauthenticated callers bind to in-memory fixture (never Org 1 or private uploads).
    """
    if org:
        org_id = org.id
        ds_id = dataset.get('id')
        d_rec = None
        if ds_id is None:
            fname = dataset.get('filename')
            if fname:
                d_rec = db.query(DatasetRecord).filter(
                    DatasetRecord.organization_id == org_id,
                    DatasetRecord.filename == fname,
                    DatasetRecord.is_active == 1
                ).order_by(DatasetRecord.id.desc()).first()
                if not d_rec:
                    d_rec = db.query(DatasetRecord).filter(
                        DatasetRecord.organization_id == org_id,
                        DatasetRecord.filename == fname
                    ).order_by(DatasetRecord.id.desc()).first()
                if d_rec:
                    ds_id = d_rec.id
        else:
            d_rec = db.query(DatasetRecord).filter(
                DatasetRecord.id == ds_id,
                DatasetRecord.organization_id == org_id
            ).first()

        repo = BillingRepository(db, org_id=org_id, dataset_id=ds_id)
        repo.d_rec = d_rec
        repo.parsed_data = dataset.get('data')
        return repo
    else:
        # Public unauthenticated visitor: strictly bound to demo in-memory fixture (never queries Org 1 or private uploads)
        repo = BillingRepository(db, org_id=0, dataset_id=None)
        repo.d_rec = None
        repo.parsed_data = dataset.get('data')
        return repo
