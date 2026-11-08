"""
Application configuration, loaded from environment variables (.env).
"""
import os
from pydantic_settings import BaseSettings
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    # Falls back to a local SQLite DB file if no DATABASE_URL is provided,
    # so the project can be run immediately without standing up Postgres.
    DATABASE_URL: str = f"sqlite:///{BASE_DIR / 'civicfix.db'}"

    APP_ENV: str = "development"
    SECRET_KEY: str = "insecure-dev-secret-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    UPLOAD_DIR: str = str(BASE_DIR / "uploads")
    MAX_UPLOAD_SIZE_MB: int = 8

    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    AI_MODEL_PATH: str = str(BASE_DIR.parent / "ai-model" / "models" / "civic_classifier.pt")
    AI_CONFIDENCE_THRESHOLD: float = 0.55

    FRONTEND_ORIGIN: str = "http://localhost:5173"

    class Config:
        env_file = ".env"
        case_sensitive = True

    @property
    def cloudinary_configured(self) -> bool:
        return all((
            self.CLOUDINARY_CLOUD_NAME,
            self.CLOUDINARY_API_KEY,
            self.CLOUDINARY_API_SECRET,
        ))

    @property
    def frontend_origins(self) -> list[str]:
        return [origin.strip() for origin in self.FRONTEND_ORIGIN.split(",") if origin.strip()]


settings = Settings()
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

if settings.APP_ENV.lower() == "production":
    if len(settings.SECRET_KEY) < 32 or settings.SECRET_KEY == "insecure-dev-secret-change-me":
        raise ValueError("Production requires a SECRET_KEY with at least 32 characters")
    if not settings.DATABASE_URL.startswith(("postgresql://", "postgresql+psycopg2://")):
        raise ValueError("Production requires a PostgreSQL DATABASE_URL")
    if not settings.cloudinary_configured:
        raise ValueError("Production requires all Cloudinary credentials for persistent image storage")
    if not settings.frontend_origins:
        raise ValueError("Production requires at least one FRONTEND_ORIGIN")
