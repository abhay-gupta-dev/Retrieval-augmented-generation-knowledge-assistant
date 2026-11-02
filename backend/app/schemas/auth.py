"""Authentication request and response contracts."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    google_id: str | None = None
    email: EmailStr
    name: str
    profile_picture: str | None = None
    provider: str
    created_at: datetime
    updated_at: datetime
