"""Google OIDC, cookie-based JWT session, dev-login, and current-user endpoints."""

from functools import lru_cache
from urllib.parse import urlencode
from uuid import uuid4

from authlib.integrations.base_client.errors import OAuthError
from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.security import create_access_token, get_current_user
from app.database.connection import get_db
from app.database.models import User
import uuid
from app.schemas.auth import LoginRequest, RegisterRequest, UserResponse
from app.services.auth_service import (
    authenticate_user,
    create_refresh_session,
    register_user,
    revoke_refresh_session,
    rotate_refresh_session,
    upsert_google_user,
)
from app.services.admin_notifications import account_signup_notification, guest_session_notification, send_admin_notification
from sqlalchemy import or_, select

router = APIRouter(prefix="/auth", tags=["authentication"])
oauth = OAuth()


@lru_cache
def google_client():
    settings = get_settings()
    missing = settings.missing_oauth_settings()
    if missing:
        raise RuntimeError(f"Google OAuth is not configured: {', '.join(missing)}")
    return oauth.register(
        name="google",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )


def login_error_redirect(settings: Settings, message: str) -> RedirectResponse:
    return RedirectResponse(f"{settings.frontend_url}/login?{urlencode({'error': message})}", status_code=status.HTTP_303_SEE_OTHER)


def set_session_cookies(response: Response, user: User, refresh_token: str, settings: Settings) -> None:
    response.set_cookie(
        "access_token",
        create_access_token(user.id),
        max_age=settings.access_token_expire_minutes * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        "refresh_token",
        refresh_token,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/api/v1/auth",
    )


def clear_session_cookies(response: Response, settings: Settings) -> None:
    response.delete_cookie("access_token", path="/", httponly=True, secure=settings.cookie_secure, samesite="lax")
    response.delete_cookie("refresh_token", path="/api/v1/auth", httponly=True, secure=settings.cookie_secure, samesite="lax")


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    response: Response,
    background_tasks: BackgroundTasks,
    database: Session = Depends(get_db),
) -> User:
    """Register a new user with name, email, and password."""
    settings = get_settings()
    try:
        user = register_user(database, name=payload.name, email=payload.email, password=payload.password)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err

    refresh_token = create_refresh_session(database, user, settings.refresh_token_expire_days)
    set_session_cookies(response, user, refresh_token, settings)
    subject, body = account_signup_notification(user.name, user.email, "email/password")
    background_tasks.add_task(send_admin_notification, subject, body)
    return user


@router.post("/login", response_model=UserResponse)
def login(
    payload: LoginRequest,
    response: Response,
    database: Session = Depends(get_db),
) -> User:
    """Authenticate a user using email and password."""
    settings = get_settings()
    try:
        user = authenticate_user(database, email=payload.email, password=payload.password)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(err)) from err

    refresh_token = create_refresh_session(database, user, settings.refresh_token_expire_days)
    set_session_cookies(response, user, refresh_token, settings)
    return user


@router.post("/guest-login", response_model=UserResponse)
def guest_login(
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    database: Session = Depends(get_db),
) -> User:
    """Create or reuse an anonymous workspace session without requiring signup."""
    settings = get_settings()
    # Check if user already has a valid session cookie
    token = request.cookies.get("access_token")
    if token and settings.jwt_secret_key:
        try:
            import jwt
            payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
            if payload.get("type") == "access":
                user_id = uuid.UUID(payload["sub"])
                existing = database.get(User, user_id)
                # Keep an existing guest workspace on this browser, but never
                # treat a signed-in account cookie as a guest session.
                if existing and existing.provider == "guest":
                    return existing
        except Exception:
            pass

    guest_id = uuid4().hex
    user = upsert_google_user(
        database,
        google_id=f"guest_{guest_id}",
        email=f"guest_{guest_id}@example.com",
        name="Guest",
        picture=None,
        provider="guest",
    )
    refresh_token = create_refresh_session(database, user, settings.refresh_token_expire_days)
    set_session_cookies(response, user, refresh_token, settings)
    subject, body = guest_session_notification()
    background_tasks.add_task(send_admin_notification, subject, body)
    return user


class DevLoginRequest(BaseModel):
    email: EmailStr = "developer@example.com"
    name: str = "Developer"


@router.post("/dev-login", response_model=UserResponse)
def dev_login(
    payload: DevLoginRequest,
    response: Response,
    database: Session = Depends(get_db),
) -> User:
    """Fast local developer login available in non-production environments."""
    settings = get_settings()
    if settings.is_production:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Developer login is disabled in production.")

    dev_google_id = f"dev_{payload.email}"
    user = upsert_google_user(
        database,
        google_id=dev_google_id,
        email=str(payload.email),
        name=payload.name,
        picture=None,
    )
    refresh_token = create_refresh_session(database, user, settings.refresh_token_expire_days)
    set_session_cookies(response, user, refresh_token, settings)
    return user


@router.get("/google/login")
async def google_login(request: Request) -> Response:
    settings = get_settings()
    missing = settings.missing_oauth_settings()
    if missing:
        return login_error_redirect(settings, f"Server authentication is not configured ({', '.join(missing)}).")
    return await google_client().authorize_redirect(request, settings.google_redirect_uri)


@router.get("/google/callback", name="google_callback")
async def google_callback(
    request: Request,
    background_tasks: BackgroundTasks,
    database: Session = Depends(get_db),
) -> Response:
    settings = get_settings()
    try:
        token = await google_client().authorize_access_token(request)
        profile = token.get("userinfo") or {}
        google_id, email = profile.get("sub"), profile.get("email")
        if not google_id or not email or profile.get("email_verified") is not True:
            return login_error_redirect(settings, "Google did not provide a verified email address.")
        existing_user = database.scalar(
            select(User.id).where(or_(User.google_id == google_id, User.email == email.strip().lower()))
        )
        user = upsert_google_user(database, google_id=google_id, email=email, name=profile.get("name") or "", picture=profile.get("picture"))
        if existing_user is None:
            subject, body = account_signup_notification(user.name, user.email, "Google")
            background_tasks.add_task(send_admin_notification, subject, body)
        refresh_token = create_refresh_session(database, user, settings.refresh_token_expire_days)
    except (OAuthError, RuntimeError):
        return login_error_redirect(settings, "Google login failed. Please try again.")

    response = RedirectResponse(f"{settings.frontend_url}/chat?auth=1", status_code=status.HTTP_303_SEE_OTHER)
    set_session_cookies(response, user, refresh_token, settings)
    return response


@router.get("/me", response_model=UserResponse)
def current_user(user: User = Depends(get_current_user)) -> User:
    return user


@router.post("/refresh", response_model=UserResponse)
def refresh_session(request: Request, response: Response, database: Session = Depends(get_db)) -> User:
    settings = get_settings()
    refresh_tok = request.cookies.get("refresh_token", "")
    rotated = rotate_refresh_session(database, refresh_tok, settings.refresh_token_expire_days)
    if not rotated:
        clear_session_cookies(response, settings)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired. Please sign in again.")
    user, new_refresh = rotated
    set_session_cookies(response, user, new_refresh, settings)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, database: Session = Depends(get_db)) -> None:
    settings = get_settings()
    revoke_refresh_session(database, request.cookies.get("refresh_token"))
    clear_session_cookies(response, settings)
