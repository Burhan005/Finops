"""
Authentication Router for ZORVEX FinOps Platform.
Provides registration, login, logout, profile discovery, and cryptographic password reset flows.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

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
from ...deps import get_current_user_and_org

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
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


@router.post("/login")
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
    return {"success": True}


@router.post("/forgot-password")
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


@router.post("/reset-password")
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
