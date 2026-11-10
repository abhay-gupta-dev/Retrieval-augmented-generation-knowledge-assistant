"""Typed, environment-based application settings."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AI Knowledge Platform"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/knowledge_platform"
    frontend_url: str = "http://127.0.0.1:5173"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://127.0.0.1:8000/api/v1/auth/google/callback"
    jwt_secret_key: str = ""
    session_secret_key: str = ""
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 14
    cookie_secure: bool = False
    upload_directory: str = "./data/uploads"
    max_upload_bytes: int = 20 * 1024 * 1024
    embedding_model: str = "all-MiniLM-L6-v2"
    embedding_dimensions: int = 384
    chat_model: str = "openai/gpt-oss-20b"
    vision_model: str = "qwen/qwen3.8-27b"
    groq_api_key: str = ""
    max_image_bytes: int = 10 * 1024 * 1024
    admin_notification_email: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_starttls: bool = True

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    def missing_oauth_settings(self) -> list[str]:
        required = {
            "GOOGLE_CLIENT_ID": self.google_client_id,
            "GOOGLE_CLIENT_SECRET": self.google_client_secret,
            "JWT_SECRET_KEY": self.jwt_secret_key,
            "SESSION_SECRET_KEY": self.session_secret_key,
        }
        return [name for name, value in required.items() if not value]


@lru_cache
def get_settings() -> Settings:
    return Settings()
