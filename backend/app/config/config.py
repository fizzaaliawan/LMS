import os
from pathlib import Path
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(PROJECT_ROOT / ".env", override=False)

class Settings:
    PROJECT_NAME: str = "Library Management System"
    
    # Database
    POSTGRES_USER: str = os.environ.get("POSTGRES_USER", "library")
    POSTGRES_PASSWORD: str = os.environ.get("POSTGRES_PASSWORD", "library")
    POSTGRES_DB: str = os.environ.get("POSTGRES_DB", "library")
    POSTGRES_HOST: str = os.environ.get("POSTGRES_HOST", "db")
    POSTGRES_PORT: str = os.environ.get("POSTGRES_PORT", "5432")
    
    @property
    def DATABASE_URL(self) -> str:
        configured_url = os.environ.get("DATABASE_URL")
        if configured_url:
            return configured_url
        
        host = self.POSTGRES_HOST
        if host == "db" and os.environ.get("RUNNING_IN_DOCKER") != "1":
            host = "localhost"
            
        return f"postgresql+psycopg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{host}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    # Redis
    REDIS_URL: str = os.environ.get("REDIS_URL", "redis://redis:6379/0")
    SEARCH_CACHE_TTL_SECONDS: int = int(os.environ.get("SEARCH_CACHE_TTL_SECONDS", "60"))
    
    # Auth
    JWT_SECRET_KEY: str = os.environ.get("JWT_SECRET_KEY", "dev-only-insecure-secret-change-me")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    
    # Business logic config
    OVERDUE_LOAN_DAYS: int = int(os.environ.get("OVERDUE_LOAN_DAYS", "14"))
    LOAN_PERIOD_DAYS: int = int(os.environ.get("LOAN_PERIOD_DAYS", "14"))
    
    # CORS
    CORS_ORIGINS: str = os.environ.get("CORS_ORIGINS", "*")

settings = Settings()
