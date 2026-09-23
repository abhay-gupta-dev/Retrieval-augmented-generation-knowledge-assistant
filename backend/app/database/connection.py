"""SQLAlchemy engine and session factory.

No connection is opened at import time, allowing the health endpoint to remain
available while a database is provisioned or temporarily unavailable.
"""

from sqlalchemy import create_engine
from collections.abc import Generator

from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

engine = create_engine(get_settings().database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    """Base class for future PostgreSQL models."""


def get_db() -> Generator[Session, None, None]:
    """Provide one transactional database session per request."""
    database = SessionLocal()
    try:
        yield database
    finally:
        database.close()
