"""
Core Application Configuration
Provides environment variable bindings, canonical paths, session controls, and service defaults.
"""

import os
from pathlib import Path
from typing import List
from dotenv import load_dotenv

# Load .env file from backend root
APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE_DIR = os.path.dirname(APP_DIR)
PROJECT_ROOT = BASE_DIR
ENV_PATH = os.path.join(BASE_DIR, ".env")
if os.path.exists(ENV_PATH):
    load_dotenv(ENV_PATH)

FRONTEND_DIST = os.path.abspath(os.path.join(PROJECT_ROOT, "frontend", "dist"))

DATA_DIR = os.path.join(BASE_DIR, "data")
SAMPLES_DIR = os.path.join(DATA_DIR, "samples")
UPLOADS_DIR = os.path.join(DATA_DIR, "uploads")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(SAMPLES_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)

# Application Identity
APP_NAME = os.getenv("APP_NAME", "ZORVEX")
APP_TAGLINE = os.getenv("APP_TAGLINE", "See Beyond Spend.")
APP_VERSION = os.getenv("APP_VERSION", "2.4.0")
ENVIRONMENT = os.getenv("ENVIRONMENT", "production")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8050"))

# Database Configuration (PostgreSQL 18 default)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://zorvex_app:yhE7Z%2Arp%21%29%23D734@localhost:5432/finops_db"
)

# Cache / Redis
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CACHE_TTL_DEFAULT = int(os.getenv("CACHE_TTL_DEFAULT", "300"))
CACHE_TTL_OVERVIEW = int(os.getenv("CACHE_TTL_OVERVIEW", "60"))

# Security & Authentication
SESSION_TTL_HOURS = int(os.getenv("ZORVEX_SESSION_TTL_HOURS", "8"))
MAX_UPLOAD_BYTES = int(os.getenv("ZORVEX_MAX_UPLOAD_BYTES", str(100 * 1024 * 1024)))  # 100 MB

# Seed / Initial Admin Configuration
SEED_ADMIN_EMAIL = os.getenv("SEED_ADMIN_EMAIL", "cloudops@finopsclay.io")
SEED_ADMIN_PASSWORD = os.getenv("SEED_ADMIN_PASSWORD", "Password123!")
DEFAULT_CONTACT_EMAIL = os.getenv("DEFAULT_CONTACT_EMAIL", "cloudops@finopsclay.io")

if ENVIRONMENT == "production" and SEED_ADMIN_PASSWORD == "Password123!":
    import logging
    logging.getLogger("zorvex.security").warning(
        "[SECURITY ADVISORY] System running in production with default SEED_ADMIN_PASSWORD. Please configure a custom SEED_ADMIN_PASSWORD."
    )

# Rate Limiting Controls
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
RATE_LIMIT_LOGIN_MAX = int(os.getenv("RATE_LIMIT_LOGIN_MAX", "10"))
RATE_LIMIT_ANALYTICS_MAX = int(os.getenv("RATE_LIMIT_ANALYTICS_MAX", "100"))

# In-Memory Cache Limits
MAX_PARSED_CACHE_ENTRIES = int(os.getenv("ZORVEX_MAX_PARSED_CACHE_ENTRIES", "5"))
MAX_ORG_DATASETS_ENTRIES = int(os.getenv("ZORVEX_MAX_ORG_DATASETS_ENTRIES", "10"))

# CORS Configuration
DEFAULT_CORS_ORIGINS: List[str] = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000"
]

cors_env = os.getenv("CORS_ORIGINS", "").strip()
if cors_env:
    CORS_ALLOWED_ORIGINS = [o.strip() for o in cors_env.split(",") if o.strip()]
    for def_orig in DEFAULT_CORS_ORIGINS:
        if def_orig not in CORS_ALLOWED_ORIGINS:
            CORS_ALLOWED_ORIGINS.append(def_orig)
else:
    CORS_ALLOWED_ORIGINS = list(DEFAULT_CORS_ORIGINS)
