import uuid
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.user import User
from app.repositories.base import BaseRepository

class UserRepository(BaseRepository[User]):
    def __init__(self):
        super().__init__(User)

    def get_by_email(self, db: Session, email: str) -> User | None:
        """Fetch active user by email."""
        return db.execute(
            select(User).where(User.email == email, User.is_deleted == False)
        ).scalar_one_or_none()

user_repository = UserRepository()
