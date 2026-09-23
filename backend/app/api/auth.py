"""Google OIDC, cookie-based JWT session, and current-user endpoints."""

from functools import lru_cache
from urllib.parse import urlencode

from authlib.integrations.base_client.errors import OAuthError
from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.security import create_access_token, get_current_user
from app.database.connection import get_db
from app.database.models import User
from app.schemas.auth import UserResponse
from app.services.auth_service import create_refresh_session, revoke_refresh_session, rotate_refresh_session, upsert_google_user

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
    response.set_cookie("access_token", create_access_token(user.id), max_age=settings.access_token_expire_minutes * 60, httponly=True, secure=settings.cookie_secure, samesite="lax", path="/")
    response.set_cookie("refresh_token", refresh_token, max_age=settings.refresh_token_expire_days * 24 * 60 * 60, httponly=True, secure=settings.cookie_secure, samesite="lax", path="/api/v1/auth")


def clear_session_cookies(response: Response, settings: Settings) -> None:
    response.delete_cookie("access_token", path="/", secure=settings.cookie_secure, samesite="lax")
    response.delete_cookie("refresh_token", path="/api/v1/auth", secure=settings.cookie_secure, samesite="lax")


@router.get("/google/login")
async def google_login(request: Request) -> Response:
    settings = get_settings()
    missing = settings.missing_oauth_settings()
    if missing:
        return login_error_redirect(settings, f"Server authentication is not configured ({', '.join(missing)}).")
    return await google_client().authorize_redirect(request, settings.google_redirect_uri)


@router.get("/google/callback", name="google_callback")
async def google_callback(request: Request, database: Session = Depends(get_db)) -> Response:
    settings = get_settings()
    try:
        token = await google_client().authorize_access_token(request)
        profile = token.get("userinfo") or {}
        google_id, email = profile.get("sub"), profile.get("email")
        if not google_id or not email or profile.get("email_verified") is not True:
            return login_error_redirect(settings, "Google did not provide a verified email address.")
        user = upsert_google_user(database, google_id=google_id, email=email, name=profile.get("name") or "", picture=profile.get("picture"))
        refresh_token = create_refresh_session(database, user, settings.refresh_token_expire_days)
    except (OAuthError, RuntimeError):
        return login_error_redirect(settings, "Google login failed. Please try again.")

    response = RedirectResponse(f"{settings.frontend_url}/dashboard", status_code=status.HTTP_303_SEE_OTHER)
    set_session_cookies(response, user, refresh_token, settings)
    return response


@router.get("/me", response_model=UserResponse)
def current_user(user: User = Depends(get_current_user)) -> User:
    return user


@router.post("/refresh", response_model=UserResponse)
def refresh_session(request: Request, response: Response, database: Session = Depends(get_db)) -> User:
    settings = get_settings()
    rotated = rotate_refresh_session(database, request.cookies.get("refresh_token", ""), settings.refresh_token_expire_days)
    if not rotated:
        clear_session_cookies(response, settings)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired. Please sign in again.")
    user, refresh_token = rotated
    set_session_cookies(response, user, refresh_token, settings)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, database: Session = Depends(get_db)) -> Response:
    settings = get_settings()
    revoke_refresh_session(database, request.cookies.get("refresh_token"))
    clear_session_cookies(response, settings)
    return response
