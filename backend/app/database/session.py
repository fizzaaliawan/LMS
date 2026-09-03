import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config.config import settings

url = settings.DATABASE_URL
# Automatically fall back to the test SQLite database during pytest runs
if os.environ.get("PYTEST_CURRENT_TEST"):
    url = "sqlite:///test.db"

# pool_pre_ping is not supported by SQLite
connect_args = {}
if url.startswith("sqlite"):
    engine = create_engine(url, connect_args={"check_same_thread": False, "timeout": 30})
else:
    engine = create_engine(url, pool_pre_ping=True)

OriginalSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

# Transactional override for testing, to share transactions and prevent SQLite deadlocks
_session_override = None

class SessionLocalWrapper:
    def __call__(self, *args, **kwargs):
        if _session_override is not None:
            return _session_override
        return OriginalSessionLocal(*args, **kwargs)

SessionLocal = SessionLocalWrapper()

def get_db():
    """Dependency for API routes providing a scoped session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        # Only close if we are not in override mode (test session is managed by conftest)
        if _session_override is None:
            db.close()

def get_session():
    """CLI/Generic friendly DB session provider."""
    return SessionLocal()
