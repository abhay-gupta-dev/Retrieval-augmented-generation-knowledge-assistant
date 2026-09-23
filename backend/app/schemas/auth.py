"""Authentication request and response contracts."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    google_id: str
    email: EmailStr
    name: str
    profile_picture: str | None
    provider: str
    created_at: datetime
    updated_at: datetime
