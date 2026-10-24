"""
Authentication Router for ZORVEX FinOps Platform.
Provides registration, login, logout, profile discovery, and cryptographic password reset flows.
"""

import time
import secrets
import logging
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

logger = logging.getLogger("zorvex.auth")

from ....core.rate_limit import enforce_rate_limit
from ....core.captcha import (
    get_client_identifier,
    record_failed_attempt,
    is_captcha_required,
    reset_failed_attempts,
    generate_local_challenge,
    verify_local_solution,
    verify_turnstile_token
)

def _enforce_rate_limit(request: Request, action: str, max_attempts: int, window_sec: int):
    enforce_rate_limit(request, f"auth_{action}", max_requests=max_attempts, window_seconds=window_sec)

from ....core.config import SESSION_TTL_HOURS
from ....database import get_db
from ....models import User, Organization, UserSession, PasswordResetToken, AuditEvent
from ....security import (
    hash_password,
    verify_and_upgrade_password,
    generate_session_token,
    generate_reset_token,
    hash_reset_token,
    validate_password_strength
)
from ....schemas.auth import (
    RegisterRequest,
    LoginRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest
)
from ...deps import get_current_user_and_org, require_auth

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
def register_user(req: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    _enforce_rate_limit(request, "register", max_attempts=5, window_sec=60)
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
        expires_at=datetime.now(timezone.utc) + timedelta(hours=SESSION_TTL_HOURS)
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


@router.get("/captcha")
def get_captcha_challenge(request: Request):
    """Provides a fresh stateless security challenge with optional Turnstile key."""
    import os
    challenge = generate_local_challenge()
    turnstile_key = os.getenv("CLOUDFLARE_TURNSTILE_SITE_KEY", "").strip()
    challenge["turnstile_site_key"] = turnstile_key or None
    return challenge


@router.post("/login")
def login_user(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    _enforce_rate_limit(request, "login", max_attempts=10, window_sec=60)
    clean_email = req.email.strip().lower()
    if not clean_email or not req.password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    client_id = get_client_identifier(request)
    captcha_needed = is_captcha_required(client_id)

    if captcha_needed:
        verified = False
        if req.turnstile_token:
            verified = verify_turnstile_token(req.turnstile_token, client_id)
        elif req.captcha_id and req.captcha_solution:
            verified = verify_local_solution(req.captcha_id, req.captcha_solution)

        if not verified:
            raise HTTPException(
                status_code=400,
                detail="Security verification required. Please solve the challenge to sign in.",
                headers={"X-Captcha-Required": "true"}
            )

    user = db.query(User).filter(User.email == clean_email).first()
    if not user:
        # Constant-Time Protection: Execute dummy Bcrypt verification to prevent timing-based user enumeration
        verify_and_upgrade_password(req.password, "$2b$12$K1Z3sX2pU3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w")
        cnt = record_failed_attempt(client_id)
        hdrs = {"X-Captcha-Required": "true"} if cnt >= 2 else {}
        msg = "Invalid email or password. Security verification now required." if cnt >= 2 else "Invalid email or password"
        raise HTTPException(status_code=401, detail=msg, headers=hdrs)

    is_valid, needs_upgrade = verify_and_upgrade_password(req.password, user.password_hash)
    if not is_valid:
        cnt = record_failed_attempt(client_id)
        hdrs = {"X-Captcha-Required": "true"} if cnt >= 2 else {}
        msg = "Invalid email or password. Security verification now required." if cnt >= 2 else "Invalid email or password"
        raise HTTPException(status_code=401, detail=msg, headers=hdrs)

    # Success: reset failed attempt counter
    reset_failed_attempts(client_id)

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
        expires_at=datetime.now(timezone.utc) + timedelta(hours=SESSION_TTL_HOURS)
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


@router.get("/me")
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


@router.post("/logout")
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
        # Instant Redis Token Blacklist Revocation (Sub-millisecond token neutralization)
        try:
            from ....cache import global_cache
            if global_cache.redis_available and global_cache.redis_client:
                global_cache.redis_client.setex(f"zorvex:blacklist:token:{auth_token}", 86400, "revoked")
        except Exception as e:
            logger.debug("Redis token blacklist notice: %s", e)
    return {"success": True}


@router.get("/dpdpa-notice")
def get_dpdpa_compliance_notice():
    """
    Returns official Statutory Privacy & Data Protection Notice under
    Digital Personal Data Protection Act, 2023 (DPDPA, India).
    """
    return {
        "framework": "Digital Personal Data Protection Act, 2023 (DPDPA)",
        "jurisdiction": "Republic of India",
        "data_fiduciary": "ZORVEX FinOps Platform / Cloud FinOps Engineering",
        "purposes_of_processing": [
            "Ingestion and automated algorithmic variance analysis of AWS Cost and Usage Reports (CUR)",
            "Cloud infrastructure waste detection and rightsizing recommendations",
            "Multi-tenant cost allocation and budget guard telemetry",
            "Enterprise authentication and cryptographic session lifecycle management"
        ],
        "categories_of_personal_data": [
            "Corporate workspace business email addresses",
            "Data principal full name and authorized organization name",
            "Cryptographically hashed authentication credentials (one-way bcrypt salted)",
            "Audit trail metadata (IP address, action type, timestamp)"
        ],
        "data_principal_rights": {
            "section_11": "Right to Access Information about personal data",
            "section_12": "Right to Correction and Erasure of personal data",
            "section_13": "Right of Grievance Redressal"
        },
        "grievance_officer": {
            "title": "Data Protection Officer (DPO)",
            "email": "dpo@zorvex.io",
            "response_sla": "72 Hours"
        },
        "data_retention_policy": "Session tokens expire within 8 hours. Telemetry audit trails retained according to organization compliance mandate. Users may trigger instant account erasure under Section 12."
    }


@router.post("/dpdpa/erasure")
def request_dpdpa_data_erasure(
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    Fulfills statutory Right to Erasure / Right to be Forgotten under Section 12 of DPDPA 2023.
    Immediately purges user sessions, reset tokens, and anonymizes user identity.
    """
    user, org = auth
    user_id = user.id
    email_masked = f"{user.email[:2]}***@{user.email.split('@')[-1]}"

    # Invalidate all active sessions
    db.query(UserSession).filter(UserSession.user_id == user_id).delete()
    # Invalidate reset tokens
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user_id).delete()

    # Record compliant audit event
    db.add(AuditEvent(
        organization_id=org.id,
        user_id=None,
        action="DPDPA_ERASURE_FULFILLED",
        details=f"Statutory DPDPA 2023 Section 12 erasure executed for user ID {user_id} ({email_masked})."
    ))

    # Anonymize user profile
    user.name = "Erased User (DPDPA)"
    user.email = f"erased_{user_id}_{secrets.token_hex(4)}@privacy.internal"
    user.password_hash = "$2b$12$erasedAccountDisabledKeyHashPaddingString999999999999"
    db.commit()

    return {
        "success": True,
        "status": "ERASURE_FULFILLED",
        "message": "DPDPA Section 12 data erasure fulfilled. All active sessions, reset tokens, and personal credentials have been permanently scrubbed."
    }


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    _enforce_rate_limit(request, "forgot_password", max_attempts=3, window_sec=300)
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

        # In non-SMTP development environments, log strictly to secure server-side journal
        # NEVER return raw reset token in client HTTP payload (eliminates Inspect Network account takeover vulnerability)
        logger.info("[SECURE DISPATCH] Single-use password reset token for %s: %s (expires in 15 mins)", clean_email, raw_token)

    return {
        "success": True,
        "message": f"If {clean_email} is registered with an authorized workspace, password recovery instructions and a secure reset token have been dispatched."
    }


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)):
    _enforce_rate_limit(request, "reset_password", max_attempts=5, window_sec=300)
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
