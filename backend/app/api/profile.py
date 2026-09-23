"""Authenticated profile endpoint."""

from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.database.models import User
from app.schemas.auth import UserResponse

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("", response_model=UserResponse)
def profile(user: User = Depends(get_current_user)) -> User:
    return user
