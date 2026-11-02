"""JWT creation, validation, and FastAPI authentication dependencies."""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.database.connection import get_db
from app.database.models import User

bearer_scheme = HTTPBearer(auto_error=False)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(user_id: uuid.UUID) -> str:
    settings = get_settings()
    if not settings.jwt_secret_key:
        raise RuntimeError("JWT_SECRET_KEY is not configured")
    expires_at = utc_now() + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode({"sub": str(user_id), "type": "access", "exp": expires_at, "iat": utc_now()}, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def new_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    """Hash password using PBKDF2-HMAC-SHA256 with 260,000 rounds and 16-byte random salt."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 260_000)
    return f"pbkdf2_sha256$260000${salt}${key.hex()}"


def verify_password(plain_password: str, password_hash: str | None) -> bool:
    """Verify password hash using constant-time comparison."""
    if not password_hash or not plain_password:
        return False
    try:
        import hmac

        algorithm, iterations_str, salt, stored_hash = password_hash.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        iterations = int(iterations_str)
        computed_key = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), iterations)
        return hmac.compare_digest(computed_key.hex(), stored_hash)
    except Exception:
        return False


def _unauthorized(detail: str = "Authentication required") -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail, headers={"WWW-Authenticate": "Bearer"})


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    database: Session = Depends(get_db),
) -> User:
    """Accept an HttpOnly access cookie or Authorization bearer token."""
    token = credentials.credentials if credentials else request.cookies.get("access_token")
    if not token:
        raise _unauthorized()

    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != "access":
            raise _unauthorized("Invalid access token")
        user_id = uuid.UUID(payload["sub"])
    except (InvalidTokenError, KeyError, ValueError):
        raise _unauthorized("Authentication expired or invalid") from None

    user = database.get(User, user_id)
    if not user:
        raise _unauthorized("Account no longer exists")
    return user
