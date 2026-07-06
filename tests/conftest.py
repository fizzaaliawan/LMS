import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import DATABASE_URL
from app.models import Base


@pytest.fixture(scope="session")
def engine():
    eng = create_engine(DATABASE_URL)
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture()
def db_session(engine, monkeypatch):
    """Fresh session per test; truncates all tables after each test for isolation."""
    Session = sessionmaker(bind=engine)
    session = Session()

    # Make app.db.get_session() return *this* session during the test
    monkeypatch.setattr("app.db.get_session", lambda: session)
    monkeypatch.setattr("app.main.get_session", lambda: session)

    yield session

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
