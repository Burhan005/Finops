"""Authentication schemas for ZORVEX."""

from typing import Optional
from pydantic import BaseModel


class RegisterRequest(BaseModel):
    name: str
    company: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str
    captcha_id: Optional[str] = None
    captcha_solution: Optional[str] = None
    turnstile_token: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    password: str
    token: str


class CaptchaChallengeResponse(BaseModel):
    captcha_id: str
    challenge_svg: str
    challenge_type: str
    expires_in: int
