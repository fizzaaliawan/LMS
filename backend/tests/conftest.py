import os
os.environ["CELERY_BROKER_URL"] = "memory://"
os.environ["CELERY_RESULT_BACKEND"] = "db+sqlite:///test.db"
os.environ["CELERY_TASK_ALWAYS_EAGER"] = "1"

import pytest
import socket
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import DATABASE_URL
from app.models import Base


def is_postgres_listening() -> bool:
    """Check if PostgreSQL is listening on the default localhost port with a tiny timeout."""
    try:
        with socket.create_connection(("localhost", 5432), timeout=0.2):
            return True
    except Exception:
        return False


@pytest.fixture(scope="session", autouse=True)
def configure_celery():
    """Force Celery to run eagerly in-memory during tests to prevent Redis connections."""
    try:
        from app.jobs import celery_app
        celery_app.conf.task_always_eager = True
        celery_app.conf.broker_url = "memory://"
        celery_app.conf.result_backend = "db+sqlite:///test.db"
    except (ImportError, AttributeError):
        pass


@pytest.fixture(scope="session")
def engine():
    url = DATABASE_URL
    is_sqlite = False

    # Fast port check. If port is closed and we aren't in CI, fall back to SQLite.
    if not is_postgres_listening() and os.environ.get("CI") != "true":
        print("\n[Warning] PostgreSQL not detected on localhost:5432. Falling back to SQLite for testing.")
        
        # Clean up any legacy test database file
        if os.path.exists("test.db"):
            try:
                os.remove("test.db")
            except Exception:
                pass
                
        url = "sqlite:///test.db"
        is_sqlite = True
        eng = create_engine(url, connect_args={"timeout": 30})
    else:
        eng = create_engine(url)

    if not is_sqlite:
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        alembic_ini_path = os.path.join(base_dir, "database", "alembic.ini")
        alembic_cfg = Config(alembic_ini_path)
        alembic_cfg.set_main_option("sqlalchemy.url", url)
        command.upgrade(alembic_cfg, "head")
    else:
        # Drop and recreate all tables using metadata directly on the SQLite database
        Base.metadata.drop_all(eng)
        Base.metadata.create_all(eng)

    yield eng

    if not is_sqlite:
        try:
            command.downgrade(alembic_cfg, "base")
        except Exception:
            pass
    eng.dispose()

    # Clean up test.db file at the very end
    if is_sqlite and os.path.exists("test.db"):
        try:
            os.remove("test.db")
        except Exception:
            pass


@pytest.fixture()
def db_session(engine, monkeypatch):
    """Fresh session per test; truncates all tables after each test for isolation."""
    Session = sessionmaker(bind=engine)
    session = Session()

    # Set override for SessionLocal inside tests to share transactional context
    import app.database.session as session_module
    session_module._session_override = session

    # Make app database providers return *this* session during the test
    monkeypatch.setattr("app.db.get_session", lambda: session)
    monkeypatch.setattr("app.main.get_session", lambda: session)

    yield session

    session_module._session_override = None
    session.rollback()
    for table in reversed(Base.metadata.sorted_tables):
        session.execute(table.delete())
    session.commit()
    session.close()


@pytest.fixture(autouse=True)
def _clear_redis_cache():
    from app.cache import invalidate_search_cache

    invalidate_search_cache()
    yield
    invalidate_search_cache()


@pytest.fixture()
def api_client(db_session):
    """FastAPI TestClient wired to the same database session as db_session."""
    from fastapi.testclient import TestClient

    from app.api.deps import get_db
    from app.api.main import app

    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()
