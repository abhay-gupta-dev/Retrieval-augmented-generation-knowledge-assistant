"""FastAPI application entry point."""

from contextlib import asynccontextmanager
from pathlib import Path
from threading import Thread

from alembic import command
from alembic.config import Config

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.api.agents import router as agents_router
from app.api.auth import router as auth_router
from app.api.billing import router as billing_router
from app.api.chat import router as chat_router
from app.api.dashboard import router as dashboard_router
from app.api.documents import router as documents_router
from app.api.knowledge_base import router as knowledge_base_router
from app.api.profile import router as profile_router
from app.core.config import get_settings
from app.services.document_service import recover_pending_documents

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    # New hosted databases start empty. Apply schema migrations before any
    # request so auth and guest endpoints cannot run against missing tables.
    backend_dir = Path(__file__).resolve().parents[1]
    migration_config = Config(str(backend_dir / "alembic.ini"))
    migration_config.set_main_option("script_location", str(backend_dir / "alembic"))
    command.upgrade(migration_config, "head")
    Thread(target=recover_pending_documents, name="document-index-recovery", daemon=True).start()
    yield

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Production-grade AI Knowledge Platform & RAG Assistant API.",
    lifespan=lifespan,
)

if settings.is_production and not settings.session_secret_key:
    raise RuntimeError("SESSION_SECRET_KEY must be set in production")

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret_key or "development-only-session-secret-replace-before-oauth",
    https_only=settings.cookie_secure,
    same_site="lax",
)

# Comprehensive CORS origins ensuring both localhost and 127.0.0.1 work in development
cors_origins = set(settings.cors_origins)
cors_origins.add("http://localhost:5173")
cors_origins.add("http://127.0.0.1:5173")
if settings.frontend_url:
    cors_origins.add(settings.frontend_url.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(cors_origins),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
)


@app.get("/health", tags=["system"])
def health_check() -> dict[str, str]:
    """Liveness endpoint."""
    return {"status": "healthy"}


app.include_router(auth_router, prefix="/api/v1")
app.include_router(billing_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
app.include_router(documents_router, prefix="/api/v1")
app.include_router(knowledge_base_router, prefix="/api/v1")
app.include_router(profile_router, prefix="/api/v1")
app.include_router(agents_router, prefix="/api/v1")
