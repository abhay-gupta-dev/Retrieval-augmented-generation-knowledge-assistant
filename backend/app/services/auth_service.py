"""Identity persistence and refresh-session lifecycle."""

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, hash_refresh_token, new_refresh_token, utc_now, verify_password
from app.database.models import RefreshSession, User


def register_user(
    database: Session,
    *,
    name: str,
    email: str,
    password: str,
) -> User:
    normalized_email = email.strip().lower()
    existing = database.scalar(select(User).where(User.email == normalized_email))
    if existing:
        raise ValueError("An account with this email already exists.")
    if len(password) < 6:
        raise ValueError("Password must be at least 6 characters long.")

    user = User(
        google_id=None,
        email=normalized_email,
        name=name.strip() or normalized_email.split("@")[0],
        password_hash=hash_password(password),
        provider="local",
    )
    database.add(user)
    database.commit()
    database.refresh(user)
    return user


def authenticate_user(
    database: Session,
    *,
    email: str,
    password: str,
) -> User:
    normalized_email = email.strip().lower()
    user = database.scalar(select(User).where(User.email == normalized_email))
    if not user:
        raise ValueError("Invalid email or password.")
    if not user.password_hash:
        if user.provider == "google":
            raise ValueError("This account was created with Google. Please continue with Google.")
        raise ValueError("Invalid login method for this account.")
    if not verify_password(password, user.password_hash):
        raise ValueError("Invalid email or password.")
    return user



def upsert_google_user(
    database: Session,
    *,
    google_id: str,
    email: str,
    name: str,
    picture: str | None,
    provider: str = "google",
) -> User:
    normalized_email = email.strip().lower()
    user = database.scalar(select(User).where(User.google_id == google_id))
    if user is None:
        # Google supplies a verified email. Link it to an existing email account
        # instead of failing on the users.email unique constraint.
        user = database.scalar(select(User).where(User.email == normalized_email))
        if user is None:
            user = User(
                google_id=google_id,
                email=normalized_email,
                name=name or normalized_email.split("@", 1)[0],
                profile_picture=picture,
                provider=provider,
            )
            database.add(user)
        else:
            user.google_id = google_id
            user.name = name or user.name
            user.profile_picture = picture
            user.provider = provider
    else:
        user.email = normalized_email
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
