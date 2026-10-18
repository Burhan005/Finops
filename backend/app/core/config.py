"""
ZORVEX Core Application Configuration
========================================================================================
Centralized enterprise configuration providing 12-factor environment variable bindings,
canonical filesystem paths, session lifecycle controls, and CORS policies.
"""

import os
from typing import List

# BASE_DIR is backend/ (parent of backend/app/)
APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE_DIR = os.path.dirname(APP_DIR)
PROJECT_ROOT = BASE_DIR
FRONTEND_DIST = os.path.abspath(os.path.join(PROJECT_ROOT, "frontend", "dist"))

DATA_DIR = os.path.join(BASE_DIR, "data")
SAMPLES_DIR = os.path.join(DATA_DIR, "samples")
UPLOADS_DIR = os.path.join(DATA_DIR, "uploads")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(SAMPLES_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)

# Security & Authentication
SESSION_TTL_HOURS = int(os.environ.get("ZORVEX_SESSION_TTL_HOURS", "8"))
MAX_UPLOAD_BYTES = int(os.environ.get("ZORVEX_MAX_UPLOAD_BYTES", str(100 * 1024 * 1024)))  # 100 MB

# In-Memory Cache Limits
MAX_PARSED_CACHE_ENTRIES = int(os.environ.get("ZORVEX_MAX_PARSED_CACHE_ENTRIES", "5"))
MAX_ORG_DATASETS_ENTRIES = int(os.environ.get("ZORVEX_MAX_ORG_DATASETS_ENTRIES", "10"))

# CORS Configuration
DEFAULT_CORS_ORIGINS: List[str] = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

cors_env = os.getenv("CORS_ORIGINS", "").strip()
if cors_env:
    CORS_ALLOWED_ORIGINS = [o.strip() for o in cors_env.split(",") if o.strip()]
    for def_orig in DEFAULT_CORS_ORIGINS:
        if def_orig not in CORS_ALLOWED_ORIGINS:
            CORS_ALLOWED_ORIGINS.append(def_orig)
else:
    CORS_ALLOWED_ORIGINS = list(DEFAULT_CORS_ORIGINS)
