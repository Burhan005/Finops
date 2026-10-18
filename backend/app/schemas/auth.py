"""Authentication schemas for ZORVEX."""

from pydantic import BaseModel

class RegisterRequest(BaseModel):
    name: str
    company: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    password: str
    token: str
