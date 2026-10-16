"""
FastAPI Server for ZORVEX Enterprise FinOps Platform
Multi-Tenant Architecture with Scoped Analytics, Cryptographic Reset Security,
Decompression Bomb & Path Traversal Immunity, and Normalized SQLite Persistence.
"""

import os
import glob
import shutil
import hashlib
import secrets
import logging
import threading
import asyncio
from collections import defaultdict, OrderedDict
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone, timedelta

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Header, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from .database import engine, Base, get_db, SessionLocal
from .models import (
    Organization, User, UserSession, PasswordResetToken, ExportTicket,
    DatasetRecord, BillingRecord, AuditEvent, S3SyncConfig, 
    AgencyBrandingConfig, UnitEconomicsConfig, RecommendationRecord, 
    AnomalyAlert, BudgetConfig, ForecastRun, AiAnalystQuery, S3SyncExecutionHistory
)
from .security import (
    hash_password, verify_and_upgrade_password, generate_session_token,
    sanitize_identifier, generate_reset_token, hash_reset_token,
    validate_password_strength, sanitize_upload_filename
)
from .anomalies import detect_anomalies_from_dataset, sync_anomalies_to_db, get_stored_anomalies
from .budget_guard import calculate_cost_forecast, evaluate_budgets
from .savings_ledger import (
    sync_recommendations_to_ledger, update_recommendation_status, 
    get_ledger_records, get_executive_ledger_summary
)
from .ai_analyst import ask_zorvex_analyst
from .parser import parse_cur_file, parse_cur_files, merge_cur_files
from .analytics import compare_dates, get_trend_data, calculate_daily_delta, compare_months
from .recommendations import generate_recommendations
from .exporter import generate_executive_html, generate_executive_excel
from .simulator import simulate_savings_plan
from .forex import fetch_live_usd_to_inr
from .resource_explorer import query_resource_explorer, get_available_hierarchies, get_resource_detail
from .root_cause import analyze_cost_root_cause
from .cache import global_cache

logger = logging.getLogger(__name__)

# Initialize DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="ZORVEX FinOps Clay Platform API",
    version="2.0.0",
    description="Enterprise AWS Cost & Usage Analysis Engine with Multi-Tenant Isolation and Hardened Security"
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIST = os.path.abspath(os.path.join(BASE_DIR, '..', 'frontend', 'dist'))
SAMPLES_DIR = os.path.join(BASE_DIR, 'data', 'samples')
UPLOADS_DIR = os.path.join(BASE_DIR, 'data', 'uploads')
os.makedirs(SAMPLES_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)

# Multi-tenant and in-memory cached dataset state
CURRENT_DATASET: Dict[str, Any] = {
    'filename': '',
    'filepath': '',
    'data': None
}
MAX_PARSED_CACHE_ENTRIES = 5
MAX_ORG_DATASETS_ENTRIES = 10

PARSED_CACHE: OrderedDict[str, Dict[str, Any]] = OrderedDict()
ORG_DATASETS: OrderedDict[int, Dict[str, Any]] = OrderedDict()

_CACHE_LOCK = threading.Lock()
_ORG_DATASETS_LOCK = threading.Lock()
DATASET_LOCK = threading.Lock()
_UPLOAD_SEMAPHORE: Optional[asyncio.Semaphore] = None

# Thread-safe per-tenant lock registry without unsafe clearing
# NOTE: These in-process threading.Lock instances coordinate concurrency across threads
# within a single worker process; they do NOT coordinate across separate worker OS processes.
_ORG_LOCKS: Dict[int, threading.Lock] = {}
_LOCKS_MUTEX = threading.Lock()

def get_org_lock(org_id: int) -> threading.Lock:
    """
    Returns a persistent per-organization mutex for the current process.
    Never clears active locks to guarantee mutual exclusion integrity.
    """
    with _LOCKS_MUTEX:
        if org_id not in _ORG_LOCKS:
            _ORG_LOCKS[org_id] = threading.Lock()
        return _ORG_LOCKS[org_id]

def cache_get_parsed(key: str) -> Optional[Dict[str, Any]]:
    """Retrieves an entry from PARSED_CACHE and refreshes LRU recency."""
    with _CACHE_LOCK:
        if key in PARSED_CACHE:
            PARSED_CACHE.move_to_end(key)
            return PARSED_CACHE[key]
        return None

def cache_put_parsed(key: str, data: Dict[str, Any]):
    """Inserts or updates an entry in PARSED_CACHE with genuine LRU eviction."""
    with _CACHE_LOCK:
        if key in PARSED_CACHE:
            PARSED_CACHE.move_to_end(key)
            PARSED_CACHE[key] = data
            return
        while len(PARSED_CACHE) >= MAX_PARSED_CACHE_ENTRIES:
            PARSED_CACHE.popitem(last=False)
        PARSED_CACHE[key] = data

def org_dataset_get(org_id: int) -> Optional[Dict[str, Any]]:
    """Retrieves an entry from ORG_DATASETS and refreshes LRU recency."""
    with _ORG_DATASETS_LOCK:
        if org_id in ORG_DATASETS:
            ORG_DATASETS.move_to_end(org_id)
            return ORG_DATASETS[org_id]
        return None

def org_dataset_put(org_id: int, entry: Dict[str, Any]):
    """Inserts or updates an entry in ORG_DATASETS with genuine LRU eviction."""
    with _ORG_DATASETS_LOCK:
        if org_id in ORG_DATASETS:
            ORG_DATASETS.move_to_end(org_id)
            ORG_DATASETS[org_id] = entry
            return
        while len(ORG_DATASETS) >= MAX_ORG_DATASETS_ENTRIES:
            ORG_DATASETS.popitem(last=False)
        ORG_DATASETS[org_id] = entry

_RECS_CACHE: OrderedDict[str, Dict[str, Any]] = OrderedDict()
_RECS_LOCK = threading.Lock()
_LEDGER_SYNCED_SETS = set()
_LEDGER_SYNC_LOCK = threading.Lock()

def get_cached_recommendations(dataset_key: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Retrieves or calculates recommendations without mutating the shared dataset dictionary."""
    with _RECS_LOCK:
        if dataset_key in _RECS_CACHE:
            _RECS_CACHE.move_to_end(dataset_key)
            return _RECS_CACHE[dataset_key]
        recs = generate_recommendations(data)
        while len(_RECS_CACHE) >= 10:
            _RECS_CACHE.popitem(last=False)
        _RECS_CACHE[dataset_key] = recs
        return recs

def get_upload_semaphore() -> asyncio.Semaphore:
    global _UPLOAD_SEMAPHORE
    if _UPLOAD_SEMAPHORE is None:
        _UPLOAD_SEMAPHORE = asyncio.Semaphore(2)
    return _UPLOAD_SEMAPHORE

def load_initial_dataset():
    chosen = None
    db = next(get_db())
    try:
        active_rec = db.query(DatasetRecord).filter(DatasetRecord.is_active == 1).order_by(DatasetRecord.id.desc()).first()
        if active_rec and active_rec.filepath and os.path.exists(active_rec.filepath):
            chosen = active_rec.filepath
    except Exception as e:
        print(f"Active record lookup warning: {e}")
    finally:
        db.close()

    if not chosen:
        samples = glob.glob(os.path.join(SAMPLES_DIR, '*.csv')) + glob.glob(os.path.join(SAMPLES_DIR, '*.csv.gz'))
        if samples:
            for s in samples:
                if 'CUR-Report-Daily' in s:
                    chosen = s
                    break
            if not chosen:
                for s in samples:
                    if 'production_exact' in s or 'ultimate_master' in s:
                        chosen = s
                        break
            if not chosen:
                chosen = samples[0]

    if chosen and os.path.exists(chosen):
        try:
            parsed = parse_cur_file(chosen)
            CURRENT_DATASET['filename'] = os.path.basename(chosen)
            CURRENT_DATASET['filepath'] = chosen
            CURRENT_DATASET['data'] = parsed
            norm_path = os.path.abspath(chosen)
            mtime = os.path.getmtime(chosen)
            cache_put_parsed(chosen, parsed)
            cache_put_parsed(norm_path, parsed)
            cache_put_parsed(f"{norm_path}_{mtime}", parsed)
            print(f" Loaded initial dataset: {os.path.basename(chosen)} (${parsed['total_cost']})")
        except Exception as e:
            print(f"Failed to load initial dataset {chosen}: {e}")

load_initial_dataset()

# ==================== PYDANTIC SCHEMAS ====================

class SelectDatasetRequest(BaseModel):
    filename: str

class CompareRequest(BaseModel):
    baseline_date: str
    target_date: str
    account_id: Optional[str] = None

class DailyDeltaRequest(BaseModel):
    target_date: str
    baseline_date: Optional[str] = None
    account_id: Optional[str] = None

class MonthlyCompareRequest(BaseModel):
    baseline_month: str
    target_month: str
    account_id: Optional[str] = None

class RootCauseRequest(BaseModel):
    baseline_start: str
    baseline_end: str
    target_start: str
    target_end: str
    service: Optional[str] = None
    account_id: Optional[str] = None
    min_delta: Optional[float] = 0.001

class S3SyncConfigRequest(BaseModel):
    bucket_name: str
    region: Optional[str] = "us-east-1"
    prefix: Optional[str] = ""
    role_arn: Optional[str] = ""

class RegisterRequest(BaseModel):
    name: str
    company: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    password: str
    token: str

class AgencyBrandingRequest(BaseModel):
    agency_name: str
    client_name: str
    prepared_by: str
    contact_email: Optional[str] = "cloudops@finopsclay.io"
    confidentiality_note: Optional[str] = "Strictly Confidential — Prepared for Executive Boardroom Review"

class UnitEconomicsRequest(BaseModel):
    metric_name: str
    metric_unit: str
    current_volume: float
    previous_volume: float
    target_unit_cost: Optional[float] = None
    notes: Optional[str] = ""

class SavingsPlanSimulatorRequest(BaseModel):
    commitment_hourly: Optional[float] = None
    reserved_units: Optional[int] = None
    term_years: int = 1
    payment_option: str = "NO_UPFRONT"
    plan_type: Optional[str] = "COMPUTE_SP"
    account_id: Optional[str] = None
    region: Optional[str] = None

class AnomalyActionRequest(BaseModel):
    user_name: Optional[str] = "Admin"
    notes: Optional[str] = None

class BudgetCreateRequest(BaseModel):
    name: str
    scope_type: str = "WORKSPACE"
    scope_value: str = "all"
    monthly_budget_usd: float
    alert_threshold_pct: float = 80.0
    notification_email: Optional[str] = None

class RecommendationStatusRequest(BaseModel):
    status: str
    user_name: Optional[str] = "Admin"
    notes: Optional[str] = None

class AiQueryRequest(BaseModel):
    query: str

class ExportTicketRequest(BaseModel):
    format: str = "html"
    baseline_date: Optional[str] = None
    target_date: Optional[str] = None
    account_id: Optional[str] = None


# ==================== SEED DEFAULT ORG & USER ====================

def seed_default_user():
    db = next(get_db())
    try:
        org = db.query(Organization).filter(Organization.name == "Cloud FinOps Engineering").first()
        if not org:
            org = Organization(name="Cloud FinOps Engineering")
            db.add(org)
            db.commit()
            db.refresh(org)

        if db.query(User).count() == 0:
            demo_user = User(
                organization_id=org.id,
                name="Burhan Kapasi",
                company="Cloud FinOps Engineering",
                email="cloudops@finopsclay.io",
                password_hash=hash_password("admin123")
            )
            db.add(demo_user)
            db.commit()
    except Exception as e:
        print(f"Seed user warning: {e}")
    finally:
        db.close()

seed_default_user()


# ==================== AUTHENTICATION & MULTI-TENANT DEPENDENCIES ====================

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
                        if norm_path == os.path.abspath(CURRENT_DATASET.get('filepath', '')) and CURRENT_DATASET.get('data'):
                            parsed = CURRENT_DATASET['data']
                            cache_put_parsed(cache_key, parsed)
                        else:
                            parsed = parse_cur_file(active_filepath)
                            cache_put_parsed(cache_key, parsed)

                    entry = {
                        'filename': active_rec.filename,
                        'filepath': active_filepath,
                        'mtime': mtime,
                        'data': parsed
                    }
                    org_dataset_put(org.id, entry)
                    return entry
                except Exception as e:
                    logger.warning("Failed to parse cached dataset for org %s: %s", org.id, e)

        # If org has no active record, isolate a dedicated copy for this org
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

    return CURRENT_DATASET


# ==================== HEALTH API ====================

@app.get("/api/health")
def health_check(
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    dataset = get_active_dataset_for_org(org, db)
    return {
        "status": "healthy",
        "brand": "ZORVEX",
        "tagline": "See Beyond Spend.",
        "active_dataset": dataset.get('filename') or "None",
        "records_loaded": len(dataset['data']['records']) if dataset.get('data') else 0,
        "organization": org.name if org else "Default",
        "authenticated": user is not None
    }


# ==================== AUTHENTICATION API ====================

@app.post("/api/auth/register")
def register_user(req: RegisterRequest, db: Session = Depends(get_db)):
    clean_email = req.email.strip().lower()
    if not clean_email or not req.password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    # Enforce enterprise password complexity
    is_strong, err_msg = validate_password_strength(req.password)
    if not is_strong:
        raise HTTPException(status_code=400, detail=err_msg)

    existing = db.query(User).filter(User.email == clean_email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    company_name = req.company.strip() or "Enterprise Workspace"
    org = db.query(Organization).filter(Organization.name == company_name).first()
    if not org:
        org = Organization(name=company_name)
        db.add(org)
        db.commit()
        db.refresh(org)

    pwd_hash = hash_password(req.password)
    user = User(
        organization_id=org.id,
        name=req.name.strip() or "Cloud Engineer",
        company=company_name,
        email=clean_email,
        password_hash=pwd_hash
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = generate_session_token()
    session = UserSession(
        token=token,
        user_id=user.id,
        organization_id=org.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=30)
    )
    db.add(session)
    db.add(AuditEvent(
        organization_id=org.id,
        user_id=user.id,
        action="REGISTER",
        details=f"User registered: {clean_email}"
    ))
    db.commit()

    return {
        "token": token,
        "user": {
            "id": user.id,
            "name": user.name,
            "company": user.company,
            "email": user.email,
            "organization_id": org.id
        }
    }


@app.post("/api/auth/login")
def login_user(req: LoginRequest, db: Session = Depends(get_db)):
    clean_email = req.email.strip().lower()
    if not clean_email or not req.password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    user = db.query(User).filter(User.email == clean_email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    is_valid, needs_upgrade = verify_and_upgrade_password(req.password, user.password_hash)
    if not is_valid:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Seamless zero-downtime upgrade from legacy SHA-256 to Bcrypt
    if needs_upgrade:
        user.password_hash = hash_password(req.password)
        db.commit()

    # Ensure user has organization linked
    org = user.organization
    if not org and user.organization_id:
        org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    if not org:
        org = db.query(Organization).first()
        if not org:
            org = Organization(name="Default Organization")
            db.add(org)
            db.commit()
            db.refresh(org)
        user.organization_id = org.id
        db.commit()

    token = generate_session_token()
    session = UserSession(
        token=token,
        user_id=user.id,
        organization_id=org.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=30)
    )
    db.add(session)
    db.add(AuditEvent(
        organization_id=org.id,
        user_id=user.id,
        action="LOGIN",
        details=f"User logged in: {clean_email}"
    ))
    db.commit()

    return {
        "token": token,
        "user": {
            "id": user.id,
            "name": user.name,
            "company": user.company,
            "email": user.email,
            "organization_id": org.id
        }
    }


@app.get("/api/auth/me")
def get_current_user_profile(
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org)
):
    user, org = auth
    if user and org:
        return {
            "user": {
                "id": user.id,
                "name": user.name,
                "company": user.company,
                "email": user.email,
                "organization_id": org.id,
                "organization_name": org.name
            }
        }
    return {"user": None}


@app.post("/api/auth/logout")
def logout_user(
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    auth_token = None
    if authorization and authorization.startswith("Bearer "):
        auth_token = authorization.split("Bearer ", 1)[1].strip()
    elif token:
        auth_token = token.strip()

    if auth_token:
        db.query(UserSession).filter(UserSession.token == auth_token).delete()
        db.commit()
    return {"success": True}


@app.post("/api/auth/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    clean_email = req.email.strip().lower()
    if not clean_email:
        raise HTTPException(status_code=400, detail="Email is required")

    user = db.query(User).filter(User.email == clean_email).first()
    raw_token = None
    if user:
        # Invalidate previous unused tokens
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used == 0
        ).update({PasswordResetToken.used: 1})

        raw_token, token_hash = generate_reset_token()
        now_utc = datetime.now(timezone.utc)
        expires_at = now_utc + timedelta(minutes=15)
        reset_rec = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
            used=0,
            created_at=now_utc
        )
        db.add(reset_rec)
        db.add(AuditEvent(
            organization_id=user.organization_id,
            user_id=user.id,
            action="PASSWORD_RESET_REQUEST",
            details=f"Password reset token issued for {clean_email}"
        ))
        db.commit()

    resp = {
        "success": True,
        "message": f"If {clean_email} is registered with a workspace, password recovery instructions and a secure reset token have been generated."
    }
    if raw_token:
        resp["reset_token"] = raw_token
    return resp


@app.post("/api/auth/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    clean_email = req.email.strip().lower()
    if not clean_email or not req.password:
        raise HTTPException(status_code=400, detail="Email and new password are required")
    if not req.token or not req.token.strip():
        raise HTTPException(status_code=400, detail="Password reset verification token is required")

    # Enterprise password complexity check
    is_strong, err_msg = validate_password_strength(req.password)
    if not is_strong:
        raise HTTPException(status_code=400, detail=err_msg)

    # Hash incoming token with SHA-256 to compare with database hash
    supplied_token_hash = hash_reset_token(req.token)
    token_record = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == supplied_token_hash
    ).first()

    if not token_record:
        raise HTTPException(status_code=400, detail="Invalid or unrecognized password reset token")

    if token_record.used == 1:
        raise HTTPException(status_code=400, detail="This password reset token has already been used")

    # Check expiration (15-minute window)
    now_utc = datetime.now(timezone.utc)
    token_exp = token_record.expires_at
    if token_exp.tzinfo is None:
        token_exp = token_exp.replace(tzinfo=timezone.utc)
    if token_exp < now_utc:
        raise HTTPException(status_code=400, detail="This password reset token has expired (15-minute limit)")

    user = db.query(User).filter(User.id == token_record.user_id).first()
    if not user or user.email.lower() != clean_email:
        raise HTTPException(status_code=400, detail="Reset token does not match the provided email address")

    # Update password using Bcrypt
    user.password_hash = hash_password(req.password)
    token_record.used = 1

    # Invalidate all active sessions for security
    db.query(UserSession).filter(UserSession.user_id == user.id).delete()

    db.add(AuditEvent(
        organization_id=user.organization_id,
        user_id=user.id,
        action="PASSWORD_RESET_SUCCESS",
        details=f"Password successfully changed for {user.email}"
    ))
    db.commit()

    return {
        "success": True,
        "message": "Password successfully updated. You can now sign in with your new password."
    }


# ==================== DATASETS API ====================

@app.get("/api/datasets")
def list_datasets(
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    active_ds = get_active_dataset_for_org(org, db)
    active_filename = active_ds.get('filename')

    samples = []
    for fp in glob.glob(os.path.join(SAMPLES_DIR, '*.*')):
        if fp.endswith(('.csv', '.gz')):
            size_kb = round(os.path.getsize(fp) / 1024, 1)
            bname = os.path.basename(fp)
            samples.append({
                "filename": bname,
                "type": "demo_fixture",
                "provenance": "synthetic" if not bname.startswith("CUR-Report-Daily") else "demo_internal_telemetry",
                "size_kb": size_kb,
                "is_active": (bname == active_filename)
            })

    uploads = []
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
                "type": "upload",
                "size_kb": size_kb,
                "total_cost": rec.total_cost,
                "net_cost": rec.net_cost,
                "is_active": bool(rec.is_active)
            })

    return {
        "active_dataset": active_filename,
        "active": active_filename,
        "samples": samples,
        "uploads": uploads
    }


@app.post("/api/datasets/select")
def select_dataset(
    req: SelectDatasetRequest,
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    fname = req.filename

    if not fname or not isinstance(fname, str):
        raise HTTPException(status_code=400, detail="Invalid dataset filename.")

    # Reject path traversal tokens, absolute paths, or drive specifiers
    clean_fname = os.path.normpath(fname).lstrip("\\/")
    if ".." in clean_fname.split(os.sep) or ".." in fname or os.path.isabs(fname) or ":" in fname:
        raise HTTPException(status_code=400, detail="Path traversal or absolute path injection rejected.")

    # Canonical sample containment verification
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
        # Custom uploaded datasets strictly require tenant authentication and ownership
        if not org:
            raise HTTPException(status_code=401, detail="Authentication required to select uploaded datasets.")

        rec = db.query(DatasetRecord).filter(
            DatasetRecord.organization_id == org.id,
            DatasetRecord.filename == fname,
            DatasetRecord.file_type == 'upload'
        ).first()
        if not rec or not rec.filepath or not os.path.exists(rec.filepath):
            raise HTTPException(status_code=404, detail=f"Dataset '{fname}' not found or does not belong to your organization.")

        # Verify uploaded file path is strictly contained within UPLOADS_DIR
        canonical_uploads_dir = os.path.realpath(UPLOADS_DIR)
        canonical_rec_path = os.path.realpath(rec.filepath)
        try:
            upload_common = os.path.commonpath([canonical_uploads_dir, canonical_rec_path])
            if upload_common != canonical_uploads_dir or not os.path.isfile(canonical_rec_path):
                raise HTTPException(status_code=403, detail="Dataset file location is invalid.")
        except ValueError:
            raise HTTPException(status_code=403, detail="Dataset file location is invalid.")

        target_path = canonical_rec_path

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
            # Deactivate previous active selections for this organization
            db.query(DatasetRecord).filter(DatasetRecord.organization_id == target_org.id).update({DatasetRecord.is_active: 0})

            if not is_sample:
                if rec:
                    rec.is_active = 1
            else:
                sample_rec = db.query(DatasetRecord).filter(
                    DatasetRecord.organization_id == target_org.id,
                    DatasetRecord.filename == fname,
                    DatasetRecord.file_type == 'sample'
                ).first()
                if sample_rec:
                    sample_rec.is_active = 1
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
            db.commit()

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


def _ingest_dataset_sync(
    org_id: int,
    user_id: int,
    final_filename: str,
    final_filepath: str,
    checksum_sha256: str,
    parsed: Dict[str, Any]
) -> int:
    """
    Executes database persistence transaction in worker thread off the event loop.
    Creates and owns its dedicated SessionLocal() to ensure thread safety.
    Guarantees atomic rollback on exception.
    """
    sync_db = SessionLocal()
    try:
        # Mark existing datasets for this org as inactive
        sync_db.query(DatasetRecord).filter(
            DatasetRecord.organization_id == org_id
        ).update({DatasetRecord.is_active: 0})

        dataset_rec = DatasetRecord(
            organization_id=org_id,
            filename=final_filename,
            filepath=final_filepath,
            file_type='upload',
            checksum_sha256=checksum_sha256,
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
            billing_dicts.append({
                'organization_id': org_id,
                'dataset_id': ds_id,
                'usage_date': r.get('date', 'Unknown'),
                'usage_month': r.get('month', 'Unknown'),
                'usage_hour': r.get('hour', '00:00'),
                'service': r.get('service', 'Unknown'),
                'resource_id': r.get('resource_id', 'Unassigned'),
                'short_id': r.get('short_id', ''),
                'account_id': r.get('account_id', 'Unknown'),
                'region': r.get('region', 'us-east-1'),
                'cost': r.get('cost', 0.0),
                'unblended_cost': r.get('cost', 0.0),
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

        sync_db.add(AuditEvent(
            organization_id=org_id,
            user_id=user_id,
            action="UPLOAD",
            details=f"Uploaded and ingested {final_filename} ({parsed['total_rows']} rows, gross ${parsed['gross_cost']}, net ${parsed['net_cost']})"
        ))
        sync_db.commit()
        return dataset_rec.id
    except Exception:
        sync_db.rollback()
        raise
    finally:
        sync_db.close()


@app.post("/api/upload")
async def upload_cur_file(
    file: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None),
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
        raw_name = f.filename or "upload.csv"
        if not (raw_name.endswith('.csv') or raw_name.endswith('.csv.gz') or raw_name.endswith('.gz')):
            raise HTTPException(status_code=400, detail=f"File '{raw_name}' is not supported. Only .csv and .csv.gz files are allowed.")

    file_id = secrets.token_hex(8)
    saved_paths: List[str] = []
    saved_filenames: List[str] = []
    MAX_UPLOAD_BYTES = 100 * 1024 * 1024
    hasher = hashlib.sha256()

    try:
        for idx, f in enumerate(incoming_files):
            raw_fn = f.filename or f"upload_{idx}.csv"
            safe_fn = sanitize_upload_filename(raw_fn)
            storage_name = f"cur_org_{org.id}_{file_id}_part{idx}_{safe_fn}"
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
                    hasher.update(chunk)
                    buffer.write(chunk)

            # Check gzip magic bytes
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

    except Exception as e:
        for p in saved_paths:
            if os.path.exists(p):
                os.remove(p)
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Failed to stream upload: {str(e)}")

    checksum_sha256 = hasher.hexdigest()

    # Sort parts logically by filename (e.g. -00001, -00002)
    saved_paths.sort(key=lambda p: os.path.basename(p))

    if len(saved_paths) == 1:
        final_filepath = saved_paths[0]
        final_filename = saved_filenames[0]
    else:
        # Multiple part files: merge them into a single consolidated file on disk
        first_base = saved_filenames[0].replace('.csv.gz', '').replace('.csv', '').replace('.gz', '')
        import re
        clean_prefix = re.sub(r'[-_]00001$', '', first_base)
        combined_storage_name = f"cur_org_{org.id}_{file_id}_merged_{clean_prefix}.csv.gz"
        final_filepath = os.path.join(UPLOADS_DIR, combined_storage_name)
        try:
            await asyncio.to_thread(merge_cur_files, saved_paths, final_filepath)
        except Exception as e:
            for p in saved_paths:
                if os.path.exists(p):
                    os.remove(p)
            raise HTTPException(status_code=500, detail=f"Failed to merge CUR part files: {str(e)}")

        final_filename = f"{clean_prefix} (Merged {len(saved_paths)} parts).csv.gz"

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

    # Ingest line items into persistent SQLite BillingRecord in worker thread off event loop
    try:
        ds_id = await asyncio.to_thread(
            _ingest_dataset_sync,
            org.id,
            user.id,
            final_filename,
            final_filepath,
            checksum_sha256,
            parsed
        )
    except Exception as e:
        if os.path.exists(final_filepath):
            try:
                os.remove(final_filepath)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=f"Database persistence failed: {str(e)}")

    # Update in-memory state
    cache_put_parsed(final_filepath, parsed)
    org_dataset_put(org.id, {
        'filename': final_filename,
        'filepath': final_filepath,
        'data': parsed
    })
    global_cache.invalidate_org(org.id)

    return {
        "success": True,
        "filename": final_filename,
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


# ==================== FINOPS ANALYTICS API ====================

@app.get("/api/overview")
def get_overview(
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None,
    account_id: Optional[str] = None,
    service: Optional[str] = None,
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    dataset = get_active_dataset_for_org(org, db)
    if not dataset.get('data'):
        raise HTTPException(status_code=400, detail="No active dataset loaded")

    data = dataset['data']
    ds_key = dataset.get('filepath') or dataset.get('filename') or 'active'
    recs = get_cached_recommendations(ds_key, data)

    dates = data.get('dates', [])
    filtered_dates = dates
    if start_date:
        filtered_dates = [d for d in filtered_dates if d >= start_date]
    if end_date:
        filtered_dates = [d for d in filtered_dates if d <= end_date]

    svc_filter = service.strip() if service else None
    if svc_filter and svc_filter.lower() in ('all', ''):
        svc_filter = None

    acc_filter = account_id.strip() if account_id else None
    if acc_filter and acc_filter.lower() in ('all', ''):
        acc_filter = None

    matching_res_count = None
    all_dates = data.get('dates', [])
    is_full_span = (not start_date or (all_dates and start_date <= all_dates[0])) and (not end_date or (all_dates and end_date >= all_dates[-1]))

    if svc_filter or acc_filter:
        matching_recs = []
        for r in data.get('records', []):
            if svc_filter and r.get('service') != svc_filter:
                continue
            if acc_filter and r.get('account_id') != acc_filter:
                continue
            matching_recs.append(r)

        daily_totals = defaultdict(float)
        daily_gross_totals = defaultdict(float)
        daily_tax_totals = defaultdict(float)
        daily_credit_totals = defaultdict(float)
        daily_refund_totals = defaultdict(float)

        for r in matching_recs:
            d = r.get('date')
            c = float(r.get('cost', 0.0) or 0.0)
            lt = r.get('line_type', '')
            daily_totals[d] += c
            if lt == 'Tax':
                daily_tax_totals[d] += c
            elif lt in ('Credit', 'SavingsPlanNegation'):
                daily_credit_totals[d] += c
            elif lt == 'Refund':
                daily_refund_totals[d] += c
            else:
                daily_gross_totals[d] += c

        daily_totals = {k: round(v, 2) for k, v in daily_totals.items()}
        daily_gross_totals = {k: round(v, 2) for k, v in daily_gross_totals.items()}
        daily_tax_totals = {k: round(v, 2) for k, v in daily_tax_totals.items()}
        daily_credit_totals = {k: round(v, 2) for k, v in daily_credit_totals.items()}
        daily_refund_totals = {k: round(v, 2) for k, v in daily_refund_totals.items()}

        filtered_gross = round(sum(daily_gross_totals.get(d, 0.0) for d in filtered_dates), 2)
        filtered_tax = round(sum(daily_tax_totals.get(d, 0.0) for d in filtered_dates), 2)
        filtered_credit = round(sum(daily_credit_totals.get(d, 0.0) for d in filtered_dates), 2)
        filtered_refund = round(sum(daily_refund_totals.get(d, 0.0) for d in filtered_dates), 2)
        filtered_net = round(sum(daily_totals.get(d, 0.0) for d in filtered_dates), 2)
        filtered_cost = filtered_gross
        matching_res_count = len(set(r.get('resource_id') for r in matching_recs if r.get('resource_id')))
    else:
        daily_totals = data.get('daily_totals', {})
        daily_gross_totals = data.get('daily_gross_totals', daily_totals)
        daily_tax_totals = data.get('daily_tax_totals', {})
        daily_credit_totals = data.get('daily_credit_totals', {})
        daily_refund_totals = data.get('daily_refund_totals', {})

        if start_date or end_date:
            if is_full_span:
                filtered_gross = data.get('gross_cost', data['total_cost'])
                filtered_tax = data.get('taxes_total', 0.0)
                filtered_credit = data.get('credits_total', 0.0)
                filtered_refund = data.get('refunds_total', 0.0)
                filtered_net = data.get('net_cost', filtered_gross)
                filtered_cost = data['total_cost']
            else:
                filtered_gross = round(sum(daily_gross_totals.get(d, 0.0) for d in filtered_dates), 2)
                filtered_tax = round(sum(daily_tax_totals.get(d, 0.0) for d in filtered_dates), 2)
                filtered_credit = round(sum(daily_credit_totals.get(d, 0.0) for d in filtered_dates), 2)
                filtered_refund = round(sum(daily_refund_totals.get(d, 0.0) for d in filtered_dates), 2)
                filtered_net = round(sum(daily_totals.get(d, 0.0) for d in filtered_dates), 2)
                filtered_cost = filtered_gross
        else:
            filtered_gross = data.get('gross_cost', data['total_cost'])
            filtered_tax = data.get('taxes_total', 0.0)
            filtered_credit = data.get('credits_total', 0.0)
            filtered_refund = data.get('refunds_total', 0.0)
            filtered_net = data.get('net_cost', filtered_gross)
            filtered_cost = data['total_cost']

    if is_full_span and not acc_filter and not svc_filter:
        resp_services = data['services']
        resp_accounts = data.get('accounts', {})
    else:
        agg_services = defaultdict(float)
        agg_accounts = defaultdict(float)
        date_set = set(filtered_dates)
        recs_source = matching_recs if (svc_filter or acc_filter) else data.get('records', [])
        for r in recs_source:
            if r.get('date') in date_set:
                c = float(r.get('cost', 0.0) or 0.0)
                lt = r.get('line_type', '')
                if lt not in ('Credit', 'Refund', 'SavingsPlanNegation') and c > 0:
                    s = r.get('service', 'Other')
                    agg_services[s] += c
                if c != 0:
                    a = r.get('account_id', 'Primary-Account')
                    agg_accounts[a] += c
        resp_services = {k: round(v, 2) for k, v in sorted(agg_services.items(), key=lambda item: item[1], reverse=True)}
        resp_accounts = {k: round(v, 2) for k, v in sorted(agg_accounts.items(), key=lambda item: item[1], reverse=True)}

    baseline_default = filtered_dates[-2] if len(filtered_dates) >= 2 else (filtered_dates[0] if filtered_dates else "")
    target_default = filtered_dates[-1] if filtered_dates else ""
    
    delta_info = None
    if baseline_default and target_default:
        c_base = daily_totals.get(baseline_default, 0.0)
        c_target = daily_totals.get(target_default, 0.0)
        d_cost = round(c_target - c_base, 2)
        pct = round((d_cost / c_base * 100.0), 2) if c_base > 0 else 0.0
        delta_info = {
            'delta_cost': d_cost,
            'pct_change': pct,
            'pct_display': f"{'+' if pct > 0 else ''}{pct}%"
        }

    gross_val = filtered_gross
    net_val = filtered_net
    credits_val = filtered_credit
    refunds_val = filtered_refund
    taxes_val = filtered_tax

    reconciliation = {
        "gross_usage_cost": gross_val,
        "credits_total": credits_val,
        "refunds_total": refunds_val,
        "taxes_total": taxes_val,
        "net_invoiced_spend": net_val,
        "formula": "net_invoiced_spend = gross_usage_cost + credits_total + refunds_total + taxes_total",
        "is_reconciled": bool(abs(round(gross_val + credits_val + refunds_val + taxes_val - net_val, 2)) < 0.01)
    }

    return {
        "filename": dataset.get('filename'),
        "total_cost": filtered_cost,
        "gross_cost": gross_val,
        "net_cost": net_val,
        "credits_total": credits_val,
        "refunds_total": refunds_val,
        "taxes_total": taxes_val,
        "accounting_reconciliation": reconciliation,
        "total_rows": data['total_rows'],
        "dates": data['dates'],
        "filtered_dates": filtered_dates,
        "months": data['months'],
        "services": resp_services,
        "accounts": resp_accounts,
        "daily_totals": {d: daily_totals.get(d, 0.0) for d in filtered_dates},
        "default_comparison": {
            "baseline_date": baseline_default,
            "target_date": target_default,
            "delta_cost": delta_info['delta_cost'] if delta_info else 0.0,
            "pct_change": delta_info['pct_change'] if delta_info else 0.0,
            "pct_display": delta_info['pct_display'] if delta_info else "0.0%"
        },
        "potential_savings": recs['total_potential_savings'],
        "total_resources": matching_res_count if matching_res_count is not None else len(data['resources'])
    }


@app.get("/api/trends")
def get_trends(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    dataset = get_active_dataset_for_org(org, db)
    if not dataset.get('data'):
        raise HTTPException(status_code=400, detail="No active dataset loaded")
    data = dataset['data']
    if not start_date and not end_date:
        if '_trends' not in data:
            data['_trends'] = get_trend_data(data)
        return data['_trends']
    return get_trend_data(data, start_date=start_date, end_date=end_date)


@app.post("/api/compare")
def compare_spending(
    req: CompareRequest,
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    dataset = get_active_dataset_for_org(org, db)
    if not dataset.get('data'):
        raise HTTPException(status_code=400, detail="No active dataset loaded")

    data = dataset['data']
    dates = set(data.get('dates', []))

    if req.baseline_date not in dates:
        raise HTTPException(status_code=400, detail=f"Baseline date {req.baseline_date} not in dataset dates")
    if req.target_date not in dates:
        raise HTTPException(status_code=400, detail=f"Target date {req.target_date} not in dataset dates")

    org_id = org.id if org else 0
    ds_key = dataset.get('filename', 'default')
    cache_key = global_cache.build_key(org_id, ds_key, "compare_spending", b=req.baseline_date, t=req.target_date, acc=req.account_id)

    return global_cache.get_or_compute(
        cache_key,
        lambda: compare_dates(data, req.baseline_date, req.target_date, account_id=req.account_id),
        ttl=1800
    )


@app.post("/api/analytics/daily-delta")
def get_daily_delta(
    req: DailyDeltaRequest,
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    dataset = get_active_dataset_for_org(org, db)
    if not dataset.get('data'):
        raise HTTPException(status_code=400, detail="No active dataset loaded")

    org_id = org.id if org else 0
    ds_key = dataset.get('filename', 'default')
    cache_key = global_cache.build_key(org_id, ds_key, "daily_delta", t=req.target_date, b=req.baseline_date, acc=req.account_id)

    return global_cache.get_or_compute(
        cache_key,
        lambda: calculate_daily_delta(dataset['data'], req.target_date, req.baseline_date, account_id=req.account_id),
        ttl=1800
    )


@app.post("/api/analytics/monthly-comparison")
def get_monthly_comparison(
    req: MonthlyCompareRequest,
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    dataset = get_active_dataset_for_org(org, db)
    if not dataset.get('data'):
        raise HTTPException(status_code=400, detail="No active dataset loaded")

    org_id = org.id if org else 0
    ds_key = dataset.get('filename', 'default')
    cache_key = global_cache.build_key(org_id, ds_key, "monthly_comparison", b=req.baseline_month, t=req.target_month, acc=req.account_id)

    return global_cache.get_or_compute(
        cache_key,
        lambda: compare_months(dataset['data'], req.baseline_month, req.target_month, account_id=req.account_id),
        ttl=1800
    )


@app.post("/api/analytics/root-cause")
def get_cost_root_cause(
    req: RootCauseRequest,
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    """
    Authoritative FinOps Cost Root-Cause Analysis.
    Decomposes arbitrary time-window cost variances into usage surges, newly launched
    resources, decommissioned workloads, capacity shifts, and billing adjustments.
    """
    user, org = auth
    dataset = get_active_dataset_for_org(org, db)
    if not dataset.get('data'):
        raise HTTPException(status_code=400, detail="No active dataset loaded")

    org_id = org.id if org else 0
    ds_key = dataset.get('filename', 'default')
    cache_key = global_cache.build_key(
        org_id, ds_key, "root_cause",
        b_start=req.baseline_start, b_end=req.baseline_end,
        t_start=req.target_start, t_end=req.target_end,
        svc=req.service, acc=req.account_id, min_delta=req.min_delta
    )

    return global_cache.get_or_compute(
        cache_key,
        lambda: analyze_cost_root_cause(
            cur_data=dataset['data'],
            baseline_start=req.baseline_start,
            baseline_end=req.baseline_end,
            target_start=req.target_start,
            target_end=req.target_end,
            service=req.service,
            account_id=req.account_id,
            min_delta=req.min_delta or 0.001
        ),
        ttl=1800
    )


@app.get("/api/system/cache-stats")
def get_cache_diagnostics():
    """Returns real-time dual-tier cache diagnostics, hit ratios, and Redis status."""
    return global_cache.get_status()


# ==================== EXPORTER API ====================

@app.post("/api/export/ticket")
def create_export_ticket(
    req: ExportTicketRequest,
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    user, org = auth
    fmt = req.format.lower()
    if fmt not in ["html", "excel"]:
        raise HTTPException(status_code=400, detail="Invalid export format. Only 'html' and 'excel' are supported.")

    import json
    ticket_str = f"ticket_{secrets.token_urlsafe(32)}"
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=60)
    params_payload = {
        "baseline_date": req.baseline_date,
        "target_date": req.target_date,
        "account_id": req.account_id
    }

    t_rec = ExportTicket(
        ticket=ticket_str,
        user_id=user.id,
        organization_id=org.id,
        export_format=fmt,
        params_json=json.dumps(params_payload),
        expires_at=expires_at,
        used=0,
        created_at=datetime.now(timezone.utc)
    )
    db.add(t_rec)
    db.commit()

    return {
        "success": True,
        "ticket": ticket_str,
        "expires_in_seconds": 60,
        "format": fmt
    }


@app.get("/api/export/executive-report")
def export_executive_report(
    format: str = "html",
    baseline_date: Optional[str] = None,
    target_date: Optional[str] = None,
    account_id: Optional[str] = None,
    ticket: Optional[str] = Query(None),
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth

    if ticket:
        t_rec = db.query(ExportTicket).filter(ExportTicket.ticket == ticket).first()
        if not t_rec:
            raise HTTPException(status_code=401, detail="Invalid export ticket.")
        if t_rec.used:
            raise HTTPException(status_code=403, detail="Export ticket has already been used. Please request a new ticket.")

        now_utc = datetime.now(timezone.utc)
        exp = t_rec.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if now_utc > exp:
            raise HTTPException(status_code=403, detail="Export ticket has expired. Please request a new ticket.")

        # Replay prevention: Mark ticket used immediately
        t_rec.used = 1
        db.commit()

        user = db.query(User).filter(User.id == t_rec.user_id).first()
        org = db.query(Organization).filter(Organization.id == t_rec.organization_id).first()
        if not user or not org:
            raise HTTPException(status_code=401, detail="User or organization associated with ticket not found.")

        if t_rec.export_format:
            format = t_rec.export_format
        if t_rec.params_json:
            try:
                import json
                p = json.loads(t_rec.params_json)
                baseline_date = baseline_date or p.get("baseline_date")
                target_date = target_date or p.get("target_date")
                account_id = account_id or p.get("account_id")
            except Exception:
                pass
    elif not user or not org:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Provide Authorization: Bearer token header or a valid single-use export ticket.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    dataset = get_active_dataset_for_org(org, db)
    if not dataset.get('data'):
        raise HTTPException(status_code=400, detail="No active dataset loaded")

    data = dataset['data']
    dates = data.get('dates', [])
    b_date = baseline_date or (dates[-2] if len(dates) >= 2 else (dates[0] if dates else 'N/A'))
    t_date = target_date or (dates[-1] if dates else 'N/A')

    comp = compare_dates(data, b_date, t_date, account_id=account_id) if (b_date != 'N/A' and t_date != 'N/A') else None
    recs = generate_recommendations(data)
    fname = dataset.get('filename', 'AWS_CUR_Report')

    b_query = db.query(AgencyBrandingConfig)
    if org:
        b_query = b_query.filter(AgencyBrandingConfig.organization_id == org.id)
    b_cfg = b_query.order_by(AgencyBrandingConfig.id.desc()).first()

    brand_dict = {
        "agency_name": b_cfg.agency_name if b_cfg else "Cloud FinOps Advisory Partners",
        "client_name": b_cfg.client_name if b_cfg else "Enterprise Client Organization",
        "prepared_by": b_cfg.prepared_by if b_cfg else "Burhan Kapasi, Principal FinOps Lead",
        "confidentiality_note": b_cfg.confidentiality_note if b_cfg else "Strictly Confidential — Prepared for Executive Boardroom Review"
    }

    if format.lower() == "excel":
        excel_bytes = generate_executive_excel(fname, data, comparison=comp, recommendations=recs, branding=brand_dict)
        clean_name = fname.replace('.csv.gz', '').replace('.csv', '')
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=FinOps_Executive_Report_{clean_name}.xlsx"}
        )
    else:
        html_content = generate_executive_html(fname, data, comparison=comp, recommendations=recs, branding=brand_dict)
        return HTMLResponse(content=html_content)


# ==================== BRANDING API ====================

@app.get("/api/branding")
def get_branding(
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    if not org:
        return {
            "agency_name": "Cloud FinOps Advisory Partners",
            "client_name": "Enterprise Client Organization",
            "prepared_by": "Burhan Kapasi, Principal FinOps Lead",
            "contact_email": "cloudops@finopsclay.io",
            "confidentiality_note": "Strictly Confidential — Prepared for Executive Boardroom Review"
        }
    cfg = db.query(AgencyBrandingConfig).filter(AgencyBrandingConfig.organization_id == org.id).order_by(AgencyBrandingConfig.id.desc()).first()
    if not cfg:
        return {
            "agency_name": "Cloud FinOps Advisory Partners",
            "client_name": "Enterprise Client Organization",
            "prepared_by": "Burhan Kapasi, Principal FinOps Lead",
            "contact_email": "cloudops@finopsclay.io",
            "confidentiality_note": "Strictly Confidential — Prepared for Executive Boardroom Review"
        }
    return {
        "agency_name": cfg.agency_name,
        "client_name": cfg.client_name,
        "prepared_by": cfg.prepared_by,
        "contact_email": cfg.contact_email,
        "confidentiality_note": cfg.confidentiality_note
    }


@app.post("/api/branding")
def save_branding(
    req: AgencyBrandingRequest,
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    user, org = auth
    cfg = db.query(AgencyBrandingConfig).filter(
        AgencyBrandingConfig.organization_id == org.id
    ).order_by(AgencyBrandingConfig.id.desc()).first()

    now_utc = datetime.now(timezone.utc)
    if not cfg:
        cfg = AgencyBrandingConfig(
            organization_id=org.id,
            agency_name=req.agency_name.strip(),
            client_name=req.client_name.strip(),
            prepared_by=req.prepared_by.strip(),
            contact_email=req.contact_email.strip() if req.contact_email else "cloudops@finopsclay.io",
            confidentiality_note=req.confidentiality_note.strip() if req.confidentiality_note else "Strictly Confidential",
            updated_at=now_utc
        )
        db.add(cfg)
    else:
        cfg.agency_name = req.agency_name.strip()
        cfg.client_name = req.client_name.strip()
        cfg.prepared_by = req.prepared_by.strip()
        if req.contact_email:
            cfg.contact_email = req.contact_email.strip()
        if req.confidentiality_note:
            cfg.confidentiality_note = req.confidentiality_note.strip()
        cfg.updated_at = now_utc
    db.commit()
    return {"success": True, "message": "Agency branding updated successfully."}


# ==================== UNIT ECONOMICS API ====================

@app.get("/api/unit-economics")
def get_unit_economics(
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    cfg = None
    if org:
        cfg = db.query(UnitEconomicsConfig).filter(UnitEconomicsConfig.organization_id == org.id).order_by(UnitEconomicsConfig.id.desc()).first()

    metric_name = cfg.metric_name if cfg else "Monthly Active Users (MAU)"
    metric_unit = cfg.metric_unit if cfg else "Users"
    curr_vol = cfg.current_volume if cfg else 25000.0
    prev_vol = cfg.previous_volume if cfg else 18000.0
    target_cost = cfg.target_unit_cost if cfg else 0.10

    dataset = get_active_dataset_for_org(org, db)
    total_cost = 0.0
    prev_cost = 0.0
    if dataset.get('data'):
        data = dataset['data']
        total_cost = data.get('total_cost', 0.0)
        dates = data.get('dates', [])
        daily_totals = data.get('daily_totals', {})
        # Derive prior period cost dynamically from actual earlier days (Zero synthetic multipliers)
        if len(dates) >= 2:
            mid = len(dates) // 2
            prev_days = dates[:mid]
            curr_days = dates[mid:]
            prev_sum = sum(daily_totals.get(d, 0.0) for d in prev_days)
            # Scale prior period spend to equal duration for honest baseline comparison
            prev_cost = round(prev_sum * (len(dates) / max(1, len(prev_days))), 2)
        else:
            prev_cost = total_cost

    curr_unit_cost = round(total_cost / max(1.0, curr_vol), 4)
    prev_unit_cost = round(prev_cost / max(1.0, prev_vol), 4)

    if prev_unit_cost > 0:
        efficiency_gain_pct = round(((prev_unit_cost - curr_unit_cost) / prev_unit_cost) * 100.0, 1)
    else:
        efficiency_gain_pct = 0.0

    return {
        "metric_name": metric_name,
        "metric_unit": metric_unit,
        "current_volume": curr_vol,
        "previous_volume": prev_vol,
        "total_cloud_cost": total_cost,
        "previous_cloud_cost": prev_cost,
        "current_unit_cost": curr_unit_cost,
        "previous_unit_cost": prev_unit_cost,
        "unit_cost_delta": round(curr_unit_cost - prev_unit_cost, 4),
        "efficiency_gain_pct": efficiency_gain_pct,
        "is_improving": efficiency_gain_pct >= 0,
        "target_unit_cost": target_cost,
        "notes": cfg.notes if cfg else "Unit cost tracked across cloud compute & storage infrastructure"
    }


@app.post("/api/unit-economics")
def save_unit_economics(
    req: UnitEconomicsRequest,
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    user, org = auth
    cfg = db.query(UnitEconomicsConfig).filter(
        UnitEconomicsConfig.organization_id == org.id
    ).order_by(UnitEconomicsConfig.id.desc()).first()

    now_utc = datetime.now(timezone.utc)
    if not cfg:
        cfg = UnitEconomicsConfig(
            organization_id=org.id,
            metric_name=req.metric_name.strip(),
            metric_unit=req.metric_unit.strip(),
            current_volume=max(1.0, req.current_volume),
            previous_volume=max(1.0, req.previous_volume),
            target_unit_cost=req.target_unit_cost,
            notes=req.notes,
            updated_at=now_utc
        )
        db.add(cfg)
    else:
        cfg.metric_name = req.metric_name.strip()
        cfg.metric_unit = req.metric_unit.strip()
        cfg.current_volume = max(1.0, req.current_volume)
        cfg.previous_volume = max(1.0, req.previous_volume)
        if req.target_unit_cost is not None:
            cfg.target_unit_cost = req.target_unit_cost
        cfg.notes = req.notes
        cfg.updated_at = now_utc
    db.commit()
    return get_unit_economics(auth=(user, org), db=db)


# ==================== SAVINGS PLAN SIMULATOR API ====================

@app.post("/api/simulator/savings-plans")
def simulate_sp_endpoint(
    req: SavingsPlanSimulatorRequest,
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    dataset = get_active_dataset_for_org(org, db)
    if not dataset.get('data'):
        raise HTTPException(status_code=400, detail="No active dataset loaded")
    return simulate_savings_plan(
        dataset['data'],
        commitment_hourly=req.commitment_hourly,
        reserved_units=req.reserved_units,
        term_years=req.term_years,
        payment_option=req.payment_option,
        plan_type=req.plan_type or "COMPUTE_SP",
        account_id=req.account_id,
        region=req.region
    )


# ==================== FOREX API ====================

@app.get("/api/forex/usd-inr")
def get_forex_usd_to_inr():
    return fetch_live_usd_to_inr()


# ==================== AWS S3 SYNC API ====================

@app.get("/api/s3/config")
def get_s3_config(
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    if not org:
        return {
            "configured": False,
            "bucket_name": "",
            "region": "us-east-1",
            "prefix": "",
            "role_arn": "",
            "is_enabled": False,
            "last_synced_at": None,
            "last_status": "NOT_CONFIGURED"
        }
    cfg = db.query(S3SyncConfig).filter(S3SyncConfig.organization_id == org.id).order_by(S3SyncConfig.id.desc()).first()
    if not cfg:
        return {
            "configured": False,
            "bucket_name": "",
            "region": "us-east-1",
            "prefix": "",
            "role_arn": "",
            "is_enabled": False,
            "last_synced_at": None,
            "last_status": "NOT_CONFIGURED"
        }
    return {
        "configured": True,
        "bucket_name": cfg.bucket_name,
        "region": cfg.region,
        "prefix": cfg.prefix,
        "role_arn": cfg.role_arn,
        "is_enabled": bool(cfg.is_enabled),
        "last_synced_at": cfg.last_synced_at.isoformat() if cfg.last_synced_at else None,
        "last_status": cfg.last_status,
        "last_message": cfg.last_message
    }


@app.post("/api/s3/config")
def save_s3_config(
    req: S3SyncConfigRequest,
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    user, org = auth
    cfg = db.query(S3SyncConfig).filter(
        S3SyncConfig.organization_id == org.id
    ).order_by(S3SyncConfig.id.desc()).first()

    if not cfg:
        cfg = S3SyncConfig(
            organization_id=org.id,
            bucket_name=req.bucket_name.strip(),
            region=req.region.strip() if req.region else "us-east-1",
            prefix=req.prefix.strip() if req.prefix else "",
            role_arn=req.role_arn.strip() if req.role_arn else "",
            is_enabled=1,
            last_status="CONFIGURED",
            last_message="S3 Automated Sync configuration saved."
        )
        db.add(cfg)
    else:
        cfg.bucket_name = req.bucket_name.strip()
        cfg.region = req.region.strip() if req.region else "us-east-1"
        cfg.prefix = req.prefix.strip() if req.prefix else ""
        cfg.role_arn = req.role_arn.strip() if req.role_arn else ""
        cfg.last_status = "CONFIGURED"
        cfg.last_message = "S3 configuration updated."

    db.commit()
    return {"success": True, "message": "AWS S3 Sync configuration saved successfully."}


@app.post("/api/s3/sync")
def trigger_s3_sync(
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    user, org = auth
    cfg = db.query(S3SyncConfig).filter(
        S3SyncConfig.organization_id == org.id
    ).order_by(S3SyncConfig.id.desc()).first()

    if not cfg:
        raise HTTPException(status_code=400, detail="Please configure S3 Bucket details first for your organization.")

    now_utc = datetime.now(timezone.utc)

    # Check for actual AWS IAM credentials in runtime environment
    has_env_credentials = bool(
        (os.environ.get("AWS_ACCESS_KEY_ID") and os.environ.get("AWS_SECRET_ACCESS_KEY")) or
        os.environ.get("AWS_PROFILE") or
        os.environ.get("AWS_CONTAINER_CREDENTIALS_RELATIVE_URI") or
        os.environ.get("AWS_WEB_IDENTITY_TOKEN_FILE")
    )

    if not has_env_credentials:
        cfg.last_synced_at = now_utc
        cfg.last_status = "CREDENTIALS_REQUIRED"
        cfg.last_message = f"AWS IAM credentials not configured. Unable to connect to S3 bucket '{cfg.bucket_name}'."
        history = S3SyncExecutionHistory(
            organization_id=org.id,
            s3_config_id=cfg.id,
            started_at=now_utc,
            completed_at=now_utc,
            status="CREDENTIALS_REQUIRED",
            records_ingested=0,
            error_message="AWS IAM credentials not found in server environment"
        )
        db.add(history)
        db.commit()
        return {
            "success": False,
            "bucket": cfg.bucket_name,
            "region": cfg.region,
            "synced_at": now_utc.isoformat(),
            "status": "CREDENTIALS_REQUIRED",
            "message": f"AWS credentials not detected. Configure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY or IAM Role to pull live CUR reports from '{cfg.bucket_name}'."
        }

    # If AWS credentials exist, attempt real Boto3 check
    try:
        import boto3
        s3 = boto3.client('s3', region_name=cfg.region or 'us-east-1')
        s3.head_bucket(Bucket=cfg.bucket_name)
        cfg.last_synced_at = now_utc
        cfg.last_status = "SYNCED"
        cfg.last_message = f"Connected to S3 bucket '{cfg.bucket_name}' ({cfg.region}). Bucket access verified."
        history = S3SyncExecutionHistory(
            organization_id=org.id,
            s3_config_id=cfg.id,
            started_at=now_utc,
            completed_at=now_utc,
            status="SYNCED",
            records_ingested=0,
            manifest_key=cfg.prefix
        )
        db.add(history)
        db.commit()
        return {
            "success": True,
            "bucket": cfg.bucket_name,
            "region": cfg.region,
            "synced_at": now_utc.isoformat(),
            "status": "SYNCED",
            "message": f"Successfully verified S3 connection to '{cfg.bucket_name}'."
        }
    except Exception as exc:
        cfg.last_synced_at = now_utc
        cfg.last_status = "FAILED"
        cfg.last_message = f"AWS S3 error: {str(exc)}"
        history = S3SyncExecutionHistory(
            organization_id=org.id,
            s3_config_id=cfg.id,
            started_at=now_utc,
            completed_at=now_utc,
            status="FAILED",
            records_ingested=0,
            error_message=str(exc)
        )
        db.add(history)
        db.commit()
        return {
            "success": False,
            "bucket": cfg.bucket_name,
            "region": cfg.region,
            "synced_at": now_utc.isoformat(),
            "status": "FAILED",
            "message": f"Failed to connect to S3: {str(exc)}"
        }


# ==================== RECOMMENDATIONS API ====================

@app.get("/api/recommendations")
def get_recommendations(
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    dataset = get_active_dataset_for_org(org, db)
    if not dataset.get('data'):
        raise HTTPException(status_code=400, detail="No active dataset loaded")
    ds_key = dataset.get('filepath') or dataset.get('filename') or 'active'
    raw = get_cached_recommendations(ds_key, dataset['data'])
    with _LEDGER_SYNC_LOCK:
        needs_sync = ds_key not in _LEDGER_SYNCED_SETS
        if needs_sync:
            _LEDGER_SYNCED_SETS.add(ds_key)

    if needs_sync:
        try:
            sync_recommendations_to_ledger(db, raw.get('recommendations', []))
        except Exception as e:
            logger.warning("Ledger sync warning: %s", e)
    return raw


@app.get("/api/resources")
def search_resources(
    query: Optional[str] = None,
    service: Optional[str] = "All",
    category: Optional[str] = "ALL",
    account_id: Optional[str] = "all",
    region: Optional[str] = "all",
    min_cost: Optional[float] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    sort_by: str = "cost",
    sort_order: str = "desc",
    page: int = 1,
    page_size: int = 25,
    limit: Optional[int] = None,
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    dataset = get_active_dataset_for_org(org, db)
    if not dataset.get('data'):
        raise HTTPException(status_code=400, detail="No active dataset loaded")

    eff_page_size = limit if (limit and limit > 0) else page_size

    return query_resource_explorer(
        dataset['data'],
        service=service,
        category=category,
        account_id=account_id,
        region=region,
        query=query,
        min_cost=min_cost,
        start_date=start_date,
        end_date=end_date,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=eff_page_size
    )


@app.get("/api/resources/hierarchies")
def get_resource_hierarchies(
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    dataset = get_active_dataset_for_org(org, db)
    if not dataset.get('data'):
        raise HTTPException(status_code=400, detail="No active dataset loaded")
    return get_available_hierarchies(dataset['data'])


@app.get("/api/resources/detail")
def get_resource_detail_endpoint(
    resource_id: str = Query(..., description="AWS Resource ID or ARN to inspect"),
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    dataset = get_active_dataset_for_org(org, db)
    if not dataset.get('data'):
        raise HTTPException(status_code=400, detail="No active dataset loaded")
    detail = get_resource_detail(dataset['data'], resource_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Resource '{resource_id}' not found in active dataset")
    return detail


# ==================== COST ANOMALY DETECTION API ====================

@app.get("/api/anomalies")
def list_anomalies(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    org_id = org.id if org else None
    dataset = get_active_dataset_for_org(org, db)
    if dataset.get('data'):
        try:
            sync_anomalies_to_db(db, dataset['data'], org_id=org_id)
        except Exception as e:
            logger.warning("Anomaly sync warning: %s", e)
    return get_stored_anomalies(db, status=status, severity=severity, org_id=org_id)


@app.post("/api/anomalies/{alert_id}/acknowledge")
def acknowledge_anomaly(
    alert_id: int,
    req: AnomalyActionRequest,
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    user, org = auth
    alert = db.query(AnomalyAlert).filter(AnomalyAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Anomaly alert not found")
    if alert.organization_id and alert.organization_id != org.id:
        raise HTTPException(status_code=403, detail="Permission denied: Anomaly alert belongs to another organization.")

    now_utc = datetime.now(timezone.utc)
    alert.status = "ACKNOWLEDGED"
    alert.acknowledged_by = req.user_name or user.name
    alert.acknowledged_at = now_utc
    if req.notes:
        alert.notes = (alert.notes + "\n" + req.notes) if alert.notes else req.notes
    db.commit()
    db.refresh(alert)
    return {"success": True, "alert_id": alert.id, "status": alert.status}


@app.post("/api/anomalies/{alert_id}/resolve")
def resolve_anomaly(
    alert_id: int,
    req: AnomalyActionRequest,
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    user, org = auth
    alert = db.query(AnomalyAlert).filter(AnomalyAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Anomaly alert not found")
    if alert.organization_id and alert.organization_id != org.id:
        raise HTTPException(status_code=403, detail="Permission denied: Anomaly alert belongs to another organization.")

    now_utc = datetime.now(timezone.utc)
    alert.status = "RESOLVED"
    alert.resolved_by = req.user_name or user.name
    alert.resolved_at = now_utc
    if req.notes:
        alert.notes = (alert.notes + "\n" + req.notes) if alert.notes else req.notes
    db.commit()
    db.refresh(alert)
    return {"success": True, "alert_id": alert.id, "status": alert.status}


# ==================== FORECASTING & BUDGET GUARD API ====================

@app.get("/api/forecast")
def get_forecast(
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    dataset = get_active_dataset_for_org(org, db)
    if not dataset.get('data'):
        raise HTTPException(status_code=400, detail="No active dataset loaded")
    return calculate_cost_forecast(dataset['data'])


@app.get("/api/budgets")
def get_budgets(
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    dataset = get_active_dataset_for_org(org, db)
    if not dataset.get('data'):
        raise HTTPException(status_code=400, detail="No active dataset loaded")
    return evaluate_budgets(db, dataset['data'], org_id=org.id if org else None)


@app.post("/api/budgets")
def create_budget(
    req: BudgetCreateRequest,
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    user, org = auth
    now_utc = datetime.now(timezone.utc)
    new_b = BudgetConfig(
        organization_id=org.id,
        name=req.name.strip(),
        scope_type=req.scope_type,
        scope_value=req.scope_value,
        monthly_budget_usd=max(1.0, req.monthly_budget_usd),
        alert_threshold_pct=req.alert_threshold_pct,
        notification_email=req.notification_email,
        is_active=1,
        created_at=now_utc,
        updated_at=now_utc
    )
    db.add(new_b)
    db.commit()
    db.refresh(new_b)
    dataset = get_active_dataset_for_org(org, db)
    if dataset.get('data'):
        return evaluate_budgets(db, dataset['data'], org_id=org.id)
    return [{"id": new_b.id, "name": new_b.name, "status": "HEALTHY"}]


@app.delete("/api/budgets/{budget_id}")
def delete_budget(
    budget_id: int,
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    user, org = auth
    b = db.query(BudgetConfig).filter(
        BudgetConfig.id == budget_id,
        BudgetConfig.organization_id == org.id
    ).first()
    if not b:
        exists_other = db.query(BudgetConfig).filter(BudgetConfig.id == budget_id).first()
        if exists_other:
            raise HTTPException(status_code=403, detail="Permission denied: Cannot delete budget belonging to another organization.")
        raise HTTPException(status_code=404, detail="Budget not found")

    db.delete(b)
    db.commit()
    return {"success": True, "deleted_id": budget_id}


# ==================== EXECUTIVE SAVINGS LEDGER API ====================

@app.get("/api/ledger/records")
def list_ledger_records(
    status: Optional[str] = None,
    category: Optional[str] = None,
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    org_id = org.id if org else None
    dataset = get_active_dataset_for_org(org, db)
    if dataset.get('data'):
        raw = generate_recommendations(dataset['data'])
        sync_recommendations_to_ledger(db, raw.get('recommendations', []), org_id=org_id)
    return get_ledger_records(db, status=status, category=category, org_id=org_id)


@app.get("/api/ledger/summary")
def get_ledger_summary(
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    org_id = org.id if org else None
    dataset = get_active_dataset_for_org(org, db)
    if dataset.get('data'):
        raw = generate_recommendations(dataset['data'])
        sync_recommendations_to_ledger(db, raw.get('recommendations', []), org_id=org_id)
    return get_executive_ledger_summary(db, org_id=org_id)


@app.post("/api/recommendations/{rec_id}/status")
def change_recommendation_status(
    rec_id: str,
    req: RecommendationStatusRequest,
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    user, org = auth
    updated = update_recommendation_status(
        db,
        rec_id=rec_id,
        new_status=req.status,
        user_name=req.user_name or user.name,
        notes=req.notes,
        org_id=org.id
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return updated


# ==================== ASK ZORVEX AI ANALYST API ====================

@app.post("/api/ai/query")
def query_ai_analyst(
    req: AiQueryRequest,
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    dataset = get_active_dataset_for_org(org, db)
    if not dataset.get('data'):
        raise HTTPException(status_code=400, detail="No active dataset loaded")
    return ask_zorvex_analyst(req.query, dataset['data'], db)


@app.get("/api/ai/history")
def get_ai_history(
    limit: int = 20,
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    if not org:
        return []
    rows = db.query(AiAnalystQuery).filter(AiAnalystQuery.organization_id == org.id).order_by(AiAnalystQuery.id.desc()).limit(limit).all()
    return [{
        "id": r.id,
        "query": r.query_text,
        "intent": r.intent_detected,
        "answer": r.response_text,
        "provider_used": r.provider_used,
        "timestamp": r.created_at.isoformat()
    } for r in rows]


# ==================== SPA & STATIC ASSETS ROUTING ====================

if os.path.exists(FRONTEND_DIST):
    assets_dir = os.path.join(FRONTEND_DIST, 'assets')
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if full_path and os.path.exists(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
