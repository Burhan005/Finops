"""
Enterprise Security Module for ZORVEX FinOps Platform
- Modern Bcrypt password hashing with backward-compatible SHA-256 migration
- High-entropy cryptographic token generation
- Sanitization for AWS CLI / Boto3 / Terraform script generation against injection
"""

import os
import re
import secrets
import hashlib
import bcrypt
import logging
from typing import Tuple

logger = logging.getLogger(__name__)

def hash_password(password: str) -> str:
    """Hashes password using bcrypt with salt rounds."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_and_upgrade_password(plain_password: str, stored_hash: str) -> Tuple[bool, bool]:
    """
    Verifies a password against stored hash.
    Returns (is_valid, needs_upgrade).
    If password matches a legacy SHA-256 hash, needs_upgrade is True.
    """
    if not stored_hash or not plain_password:
        return False, False

    # Check for Bcrypt hash ($2b$ or $2a$)
    if stored_hash.startswith("$2b$") or stored_hash.startswith("$2a$"):
        try:
            valid = bcrypt.checkpw(plain_password.encode("utf-8"), stored_hash.encode("utf-8"))
            return valid, False
        except Exception as exc:
            logger.warning("Bcrypt verification failed with error: %s", exc)
            return False, False

    # Legacy SHA-256 check
    legacy_hash = hashlib.sha256(plain_password.encode("utf-8")).hexdigest()
    if secrets.compare_digest(legacy_hash, stored_hash):
        return True, True  # Valid, but needs upgrade to Bcrypt!

    return False, False

def sanitize_identifier(value: str) -> str:
    """
    Sanitizes AWS Resource IDs, ARNs, Accounts, and tags against command/script injection.
    Allows only standard AWS identifier characters (alphanumeric, -, _, /, :, ., @).
    """
    if not value:
        return ""
    # Strip any shell control characters, semicolons, backticks, pipe, quotes, etc.
    cleaned = re.sub(r'[^a-zA-Z0-9\-_/:.@=]', '', str(value).strip())
    return cleaned

def generate_session_token() -> str:
    """Generates 256-bit cryptographically secure session token."""
    return secrets.token_hex(32)

def generate_reset_token() -> Tuple[str, str]:
    """
    Generates a high-entropy single-use password reset token.
    Returns (raw_token, token_hash).
    Only token_hash (SHA-256) is persisted in the database to prevent token leakage from DB dumps.
    """
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    return raw_token, token_hash

def hash_reset_token(raw_token: str) -> str:
    """Hashes a client-supplied raw reset token with SHA-256 for constant-time DB comparison."""
    if not raw_token:
        return ""
    return hashlib.sha256(raw_token.strip().encode("utf-8")).hexdigest()

def validate_password_strength(password: str) -> Tuple[bool, str]:
    """
    Enforces enterprise password complexity:
    - Minimum 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one numerical digit
    """
    if not password or len(password) < 8:
        return False, "Password must be at least 8 characters in length."
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter (A-Z)."
    if not any(c.islower() for c in password):
        return False, "Password must contain at least one lowercase letter (a-z)."
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one numerical digit (0-9)."
    return True, ""

def sanitize_upload_filename(filename: str) -> str:
    """
    Strictly sanitizes uploaded filenames to eliminate Path Traversal and Null Byte attacks:
    - Extracts only the base name (no directory separators or traversal '..')
    - Restricts characters to standard alphanumeric, dashes, underscores, and dots
    - Rejects hidden/dotfiles
    """
    if not filename:
        return "unnamed_upload.csv"
    # Take only the final path component
    base = os.path.basename(filename.strip().replace("\\", "/"))
    # Remove any traversal patterns
    base = re.sub(r'\.\.+', '.', base)
    # Allow only safe characters
    cleaned = re.sub(r'[^a-zA-Z0-9_\-\. ]', '_', base)
    if cleaned.startswith('.'):
        cleaned = f"upload_{cleaned.lstrip('.')}"
    return cleaned or "upload.csv"

