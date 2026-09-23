"""Identity persistence and refresh-session lifecycle."""

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_refresh_token, new_refresh_token, utc_now
from app.database.models import RefreshSession, User


def upsert_google_user(database: Session, *, google_id: str, email: str, name: str, picture: str | None) -> User:
    user = database.scalar(select(User).where(User.google_id == google_id))
    if user is None:
        user = User(google_id=google_id, email=email, name=name or email.split("@", 1)[0], profile_picture=picture, provider="google")
        database.add(user)
    else:
        user.email = email
        user.name = name or user.name
        user.profile_picture = picture
    database.commit()
    database.refresh(user)
    return user


def create_refresh_session(database: Session, user: User, lifetime_days: int) -> str:
    token = new_refresh_token()
    session = RefreshSession(user_id=user.id, token_hash=hash_refresh_token(token), expires_at=utc_now() + timedelta(days=lifetime_days))
    database.add(session)
    database.commit()
    return token


def rotate_refresh_session(database: Session, token: str, lifetime_days: int) -> tuple[User, str] | None:
    session = database.scalar(select(RefreshSession).where(RefreshSession.token_hash == hash_refresh_token(token)))
    if not session or session.revoked_at is not None or session.expires_at <= utc_now():
        return None
    session.revoked_at = utc_now()
    database.commit()
    user = session.user
    return user, create_refresh_session(database, user, lifetime_days)


def revoke_refresh_session(database: Session, token: str | None) -> None:
    if not token:
        return
    session = database.scalar(select(RefreshSession).where(RefreshSession.token_hash == hash_refresh_token(token)))
    if session and session.revoked_at is None:
        session.revoked_at = utc_now()
        database.commit()
