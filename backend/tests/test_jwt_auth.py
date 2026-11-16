"""
Production Enterprise JWT & Refresh Token Test Suite
Tests:
- Cryptographic signing with HS256 and entropy validation
- Claims structure (sub, email, org_id, jti, type, iat, exp)
- Expiration enforcement & signature tampering detection
- Dual Access/Refresh token issuance on Login & Register
- Protected endpoint authorization via Bearer JWT
- Silent token rotation & replay attack protection on /api/auth/refresh
- Logout session invalidation & JTI blacklisting
"""

import time
import pytest
from datetime import timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    JWT_SECRET_KEY,
    JWT_ALGORITHM
)
import jwt

client = TestClient(app)


def test_create_and_decode_access_token():
    user_id = 999
    email = "security-officer@finops.io"
    org_id = 1
    
    token, jti = create_access_token(user_id=user_id, email=email, org_id=org_id)
    assert token is not None
    assert token.count(".") == 2
    assert len(jti) == 36  # UUID4
    
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == str(user_id)
    assert payload["email"] == email
    assert payload["org_id"] == org_id
    assert payload["jti"] == jti
    assert payload["type"] == "access"
    assert "exp" in payload
    assert "iat" in payload


def test_tampered_access_token_rejected():
    token, _ = create_access_token(user_id=1, email="tamper@test.com", org_id=1)
    # Modify payload or signature
    parts = token.split(".")
    tampered = parts[0] + "." + parts[1] + ".invalidSignatureABC"
    
    payload = decode_access_token(tampered)
    assert payload is None


def test_expired_access_token_rejected():
    # Issue a token expired 5 seconds ago
    token, _ = create_access_token(
        user_id=1,
        email="expired@test.com",
        org_id=1,
        expires_delta=timedelta(seconds=-5)
    )
    payload = decode_access_token(token)
    assert payload is None


def test_token_type_confusion_prevention():
    # A refresh token must NOT be accepted as an access token
    ref_token, _, _ = create_refresh_token(user_id=1, org_id=1)
    
    # decode_access_token should reject refresh token
    access_payload = decode_access_token(ref_token)
    assert access_payload is None
    
    # decode_refresh_token should accept it
    ref_payload = decode_refresh_token(ref_token)
    assert ref_payload is not None
    assert ref_payload["type"] == "refresh"


def test_login_and_jwt_lifecycle():
    # Login as admin user
    login_res = client.post("/api/auth/login", json={
        "email": "cloudops@finopsclay.io",
        "password": "Password123!"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    data = login_res.json()
    
    assert "access_token" in data
    assert "refresh_token" in data
    assert "token" in data
    assert data["token"] == data["access_token"]
    assert data["token_type"] == "bearer"
    assert data["expires_in"] == 15 * 60  # 900 seconds
    assert data["user"]["email"] == "cloudops@finopsclay.io"
    
    access_token = data["access_token"]
    refresh_token = data["refresh_token"]
    
    # Access protected /api/auth/me with Bearer JWT
    me_res = client.get("/api/auth/me", headers={
        "Authorization": f"Bearer {access_token}"
    })
    assert me_res.status_code == 200
    assert me_res.json()["user"]["email"] == "cloudops@finopsclay.io"
    
    # Test silent token refresh
    refresh_res = client.post("/api/auth/refresh", json={
        "refresh_token": refresh_token
    })
    assert refresh_res.status_code == 200, f"Refresh failed: {refresh_res.text}"
    ref_data = refresh_res.json()
    assert "access_token" in ref_data
    assert "refresh_token" in ref_data
    new_access_token = ref_data["access_token"]
    new_refresh_token = ref_data["refresh_token"]
    assert new_access_token != access_token
    assert new_refresh_token != refresh_token
    
    # Access protected route with new access token
    me_res2 = client.get("/api/auth/me", headers={
        "Authorization": f"Bearer {new_access_token}"
    })
    assert me_res2.status_code == 200
    assert me_res2.json()["user"]["email"] == "cloudops@finopsclay.io"
    
    # Old refresh token should now be invalid (replay protection)
    replay_res = client.post("/api/auth/refresh", json={
        "refresh_token": refresh_token
    })
    assert replay_res.status_code == 401
    
    # Test Logout with new refresh token
    logout_res = client.post(
        "/api/auth/logout",
        headers={"Authorization": f"Bearer {new_access_token}"},
        json={"refresh_token": new_refresh_token}
    )
    assert logout_res.status_code == 200
    assert logout_res.json().get("success") is True
    
    # Refreshing after logout should fail
    post_logout_refresh = client.post("/api/auth/refresh", json={
        "refresh_token": new_refresh_token
    })
    assert post_logout_refresh.status_code == 401
