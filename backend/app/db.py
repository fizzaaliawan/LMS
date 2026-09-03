from app.config.config import settings
from app.database.session import SessionLocal, get_session, engine

DATABASE_URL = settings.DATABASE_URL
