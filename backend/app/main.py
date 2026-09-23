"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.api.agents import router as agents_router
from app.api.auth import router as auth_router
from app.api.chat import router as chat_router
from app.api.documents import router as documents_router
from app.api.knowledge_base import router as knowledge_base_router
from app.api.profile import router as profile_router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="API foundation for the AI Knowledge and Multi-Agent Platform.",
)

if settings.is_production and not settings.session_secret_key:
    raise RuntimeError("SESSION_SECRET_KEY must be set in production")

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret_key or "development-only-session-secret-replace-before-oauth",
    https_only=settings.cookie_secure,
    same_site="lax",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/health", tags=["system"])
def health_check() -> dict[str, str]:
    """Liveness endpoint intentionally independent of PostgreSQL."""
    return {"status": "healthy"}


app.include_router(auth_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
app.include_router(documents_router, prefix="/api/v1")
app.include_router(knowledge_base_router, prefix="/api/v1")
app.include_router(agents_router, prefix="/api/v1")
app.include_router(profile_router, prefix="/api/v1")
