"""
FastAPI Server for ZORVEX Enterprise FinOps Platform
Multi-Tenant Architecture with Scoped Analytics, Cryptographic Reset Security,
Decompression Bomb & Path Traversal Immunity, and Normalized SQLite Persistence.
"""

import os
import logging
from typing import Optional, Tuple

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

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
from .models import Organization, User, DatasetRecord
from .security import hash_password
from .api.deps import (
    get_current_user_and_org,
    require_auth,
    get_active_dataset_for_org,
    get_billing_repository
)
from .api.v1.api import api_v1_router
from .api.v1.endpoints.datasets import _ingest_dataset_sync

logger = logging.getLogger(__name__)

# Initialize DB tables
Base.metadata.create_all(bind=engine)
try:
    from .migrate import ensure_schema_compatibility
    ensure_schema_compatibility(engine)
except Exception as e:
    logger.warning("Database schema compatibility check notice: %s", e)

app = FastAPI(
    title="ZORVEX FinOps Clay Platform API",
    version="2.0.0",
    description="Enterprise AWS Cost & Usage Analysis Engine with Multi-Tenant Isolation and Hardened Security"
)

# CORS setup with explicit origin allowlist
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
                email="cloudops@finopsclay.io",
                password_hash=hash_password("admin123")
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


# ==================== MOUNT API V1 ROUTER ====================

app.include_router(api_v1_router, prefix="/api")


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
