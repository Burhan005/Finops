"""
Application Configuration
Exposes settings instance re-exporting from core.config.
"""

from .core import config as core_config


class Settings:
    APP_NAME = core_config.APP_NAME
    APP_TAGLINE = core_config.APP_TAGLINE
    APP_VERSION = core_config.APP_VERSION
    ENVIRONMENT = core_config.ENVIRONMENT
    HOST = core_config.HOST
    PORT = core_config.PORT
    DATABASE_URL = core_config.DATABASE_URL
    REDIS_URL = core_config.REDIS_URL
    CACHE_TTL_DEFAULT = core_config.CACHE_TTL_DEFAULT
    CACHE_TTL_OVERVIEW = core_config.CACHE_TTL_OVERVIEW
    SESSION_TTL_HOURS = core_config.SESSION_TTL_HOURS
    JWT_SECRET_KEY = core_config.JWT_SECRET_KEY
    JWT_ALGORITHM = core_config.JWT_ALGORITHM
    ACCESS_TOKEN_EXPIRE_MINUTES = core_config.ACCESS_TOKEN_EXPIRE_MINUTES
    REFRESH_TOKEN_EXPIRE_DAYS = core_config.REFRESH_TOKEN_EXPIRE_DAYS
    MAX_UPLOAD_BYTES = core_config.MAX_UPLOAD_BYTES
    SEED_ADMIN_EMAIL = core_config.SEED_ADMIN_EMAIL
    SEED_ADMIN_PASSWORD = core_config.SEED_ADMIN_PASSWORD
    DEFAULT_CONTACT_EMAIL = core_config.DEFAULT_CONTACT_EMAIL
    RATE_LIMIT_WINDOW_SECONDS = core_config.RATE_LIMIT_WINDOW_SECONDS
    RATE_LIMIT_LOGIN_MAX = core_config.RATE_LIMIT_LOGIN_MAX
    RATE_LIMIT_ANALYTICS_MAX = core_config.RATE_LIMIT_ANALYTICS_MAX
    CORS_ALLOWED_ORIGINS = core_config.CORS_ALLOWED_ORIGINS
    DATA_DIR = core_config.DATA_DIR
    SAMPLES_DIR = core_config.SAMPLES_DIR
    UPLOADS_DIR = core_config.UPLOADS_DIR
    FRONTEND_DIST = core_config.FRONTEND_DIST


settings = Settings()
