"""
FastAPI Server for ZORVEX Enterprise FinOps Platform
Multi-Tenant Architecture with Scoped Analytics, Cryptographic Reset Security,
and Database Persistence.
"""

import os
import uuid
import time
import logging
import threading
from datetime import datetime, timezone
from typing import Optional, Tuple

from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.exceptions import HTTPException as FastHTTPException
from sqlalchemy.orm import Session

from .config import settings
from .core.config import (
    BASE_DIR,
    FRONTEND_DIST,
    SAMPLES_DIR,
    UPLOADS_DIR,
    CORS_ALLOWED_ORIGINS,
    DEFAULT_CORS_ORIGINS,
    MAX_PARSED_CACHE_ENTRIES,
    MAX_ORG_DATASETS_ENTRIES
)
from .core.state import (
    CURRENT_DATASET,
    PARSED_CACHE,
    ORG_DATASETS,
    _ORG_LOCKS,
    get_org_lock,
    cache_get_parsed,
    cache_put_parsed,
    org_dataset_get,
    org_dataset_put,
    org_dataset_del,
    get_cached_recommendations,
    get_upload_semaphore,
    load_initial_dataset
)
from .database import engine, Base, get_db
from .models import Organization, User, DatasetRecord, UserSession, PasswordResetToken, ExportTicket
from .security import hash_password
from .api.deps import (
    get_current_user_and_org,
    require_auth,
    get_active_dataset_for_org,
    get_billing_repository
)
from .api.v1.api import api_v1_router
from .api.v1.endpoints.datasets import _ingest_dataset_sync
from .parser import parse_cur_file

logger = logging.getLogger(__name__)

# Initialize DB tables
Base.metadata.create_all(bind=engine)
try:
    from .migrate import ensure_schema_compatibility
    ensure_schema_compatibility(engine)
except Exception as e:
    logger.warning("Database schema compatibility check notice: %s", e)

try:
    from .postgres_functions import ensure_postgres_functions
    ensure_postgres_functions(engine)
except Exception as e:
    logger.warning("PostgreSQL stored functions initialization notice: %s", e)

app = FastAPI(
    title="ZORVEX FinOps Clay Platform API",
    version="2.0.0",
    description="Enterprise AWS Cost & Usage Analysis Engine with Multi-Tenant Isolation and Hardened Security"
)

# -------------------------------------------------------------
# Security Headers Middleware
# -------------------------------------------------------------
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com data:; "
            "img-src 'self' data: https: blob:; "
            "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*; "
            "frame-ancestors 'none';"
        )
        response.headers["Server"] = "ZORVEX"

        # VAPT & Performance Policy: Zero-cache for sensitive APIs, immutable caching for hashed static bundles
        if request.url.path.startswith("/assets/"):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        elif request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
            response.headers["Pragma"] = "no-cache"

        return response

app.add_middleware(SecurityHeadersMiddleware)

# Performance: High-throughput GZip wire compression for JSON payloads
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS setup with explicit origin allowlist
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------
# Sanitized Global Exception Handler (Shields Internal Stack Traces)
# -------------------------------------------------------------
@app.exception_handler(Exception)
async def global_sanitized_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, FastHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=getattr(exc, "headers", None)
        )
    incident_id = uuid.uuid4().hex[:12]
    logger.error("[INCIDENT %s] Unhandled exception on %s %s: %s", incident_id, request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "InternalServerError",
            "detail": "An internal processing exception occurred. System diagnostic traces are shielded for security compliance.",
            "incident_id": incident_id
        }
    )

# Seed public demo dataset
load_initial_dataset()


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
                email=settings.SEED_ADMIN_EMAIL,
                password_hash=hash_password(settings.SEED_ADMIN_PASSWORD)
            )
            db.add(demo_user)
            db.commit()

        # Auto-propagate account_name across datasets for the same AWS account
        try:
            alias_rows = db.query(DatasetRecord.usage_account_id, DatasetRecord.account_name).filter(
                DatasetRecord.usage_account_id.isnot(None),
                DatasetRecord.account_name.isnot(None),
                DatasetRecord.account_name != ''
            ).all()
            for usage_acc, acc_name in alias_rows:
                db.query(DatasetRecord).filter(
                    DatasetRecord.usage_account_id == usage_acc,
                    (DatasetRecord.account_name.is_(None) | (DatasetRecord.account_name == ''))
                ).update({DatasetRecord.account_name: acc_name}, synchronize_session=False)
            db.commit()
        except Exception as prop_err:
            db.rollback()
            logger.debug("Account alias propagation info: %s", prop_err)
    except Exception as e:
        print(f"Seed user warning: {e}")
    finally:
        db.close()

seed_default_user()

def _background_warmup_datasets():
    """
    Pre-warms organization datasets into RAM cache quietly in a background daemon thread.
    Guarantees instant (< 15ms) dataset switching in the dropdown without disk decompression delay.
    """
    try:
        db = next(get_db())
        try:
            org = db.query(Organization).first()
            if not org:
                return
            datasets = db.query(DatasetRecord).filter(
                DatasetRecord.organization_id == org.id
            ).order_by(DatasetRecord.is_active.desc(), DatasetRecord.id.desc()).limit(8).all()

            for rec in datasets:
                if rec.filepath and os.path.exists(rec.filepath):
                    norm = os.path.realpath(rec.filepath)
                    try:
                        mtime = os.path.getmtime(rec.filepath)
                        ckey = f"{norm}_{mtime}"
                    except OSError:
                        mtime = 0
                        ckey = norm
                    if not cache_get_parsed(ckey):
                        p = parse_cur_file(rec.filepath)
                        cache_put_parsed(rec.filepath, p)
                        cache_put_parsed(norm, p)
                        cache_put_parsed(ckey, p)
                        if rec.is_active:
                            org_dataset_put(org.id, {
                                'id': rec.id,
                                'filename': rec.filename,
                                'filepath': rec.filepath,
                                'mtime': mtime,
                                'data': p
                            })
                            logger.info("Pre-warmed active dataset %s in RAM", rec.filename)
        finally:
            db.close()
    except Exception as e:
        logger.debug("Background dataset warm-up notice: %s", e)

threading.Thread(target=_background_warmup_datasets, daemon=True, name="zorvex-warmup").start()


def _background_maintenance_worker():
    """
    Periodic enterprise database hygiene & security garbage collection.
    Automatically purges expired user sessions, consumed/expired reset tokens,
    and stale export tickets to free expired resources.
    Runs immediately on startup, then every 30 minutes.
    """
    while True:
        try:
            db = next(get_db())
            try:
                now_utc = datetime.now(timezone.utc)
                del_sess = db.query(UserSession).filter(UserSession.expires_at < now_utc).delete(synchronize_session=False)
                del_tokens = db.query(PasswordResetToken).filter(
                    (PasswordResetToken.expires_at < now_utc) | (PasswordResetToken.used == 1)
                ).delete(synchronize_session=False)
                del_tickets = db.query(ExportTicket).filter(
                    (ExportTicket.expires_at < now_utc) | (ExportTicket.used == 1)
                ).delete(synchronize_session=False)
                db.commit()
                if del_sess or del_tokens or del_tickets:
                    logger.info(
                        "Database hygiene purge completed: %d expired sessions, %d stale reset tokens, %d expired tickets",
                        del_sess, del_tokens, del_tickets
                    )
            finally:
                db.close()
        except Exception as e:
            logger.debug("Database maintenance worker notice: %s", e)
        time.sleep(1800)

threading.Thread(target=_background_maintenance_worker, daemon=True, name="zorvex-db-hygiene").start()


# ==================== HEALTH API ====================

@app.get("/api/health")
def health_check(
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    active_filename = "None"
    records_count = 0
    if org:
        cached_org = org_dataset_get(org.id)
        if cached_org and cached_org.get('filename'):
            active_filename = cached_org.get('filename')
            records_count = len(cached_org.get('data', {}).get('records', [])) if cached_org.get('data') else 0
        else:
            rec = db.query(DatasetRecord.filename, DatasetRecord.total_rows).filter(
                DatasetRecord.organization_id == org.id,
                DatasetRecord.is_active == 1
            ).order_by(DatasetRecord.id.desc()).first()
            if rec:
                active_filename = rec.filename
                records_count = rec.total_rows or 0
    elif CURRENT_DATASET.get('filename'):
        active_filename = CURRENT_DATASET.get('filename')
        records_count = len(CURRENT_DATASET.get('data', {}).get('records', [])) if CURRENT_DATASET.get('data') else 0

    return {
        "status": "healthy",
        "brand": "ZORVEX",
        "tagline": "See Beyond Spend.",
        "active_dataset": active_filename,
        "records_loaded": records_count,
        "organization": org.name if org else "Default",
        "authenticated": user is not None
    }


# ==================== MOUNT API V1 ROUTER ====================

app.include_router(api_v1_router, prefix="/api")


# ==================== SPA & STATIC ASSETS ROUTING ====================

if os.path.exists(FRONTEND_DIST):
    canonical_dist = os.path.realpath(FRONTEND_DIST)
    assets_dir = os.path.join(FRONTEND_DIST, 'assets')
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        if full_path:
            clean_sub = full_path.lstrip("/\\")
            candidate = os.path.realpath(os.path.join(canonical_dist, clean_sub))
            try:
                # Ensure candidate path is strictly within the frontend build directory
                if os.path.commonpath([canonical_dist, candidate]) == canonical_dist and os.path.isfile(candidate):
                    return FileResponse(candidate)
            except (ValueError, OSError):
                pass
        return FileResponse(os.path.join(canonical_dist, "index.html"))
