import uuid
from sqlalchemy import select, or_
from sqlalchemy.orm import Session
from app.models.member import Member
from app.repositories.base import BaseRepository

class MemberRepository(BaseRepository[Member]):
    def __init__(self):
        super().__init__(Member)

    def get_by_email(self, db: Session, email: str) -> Member | None:
        """Fetch active member by email."""
        return db.execute(
            select(Member).where(Member.email == email, Member.is_deleted == False)
        ).scalar_one_or_none()

    def search_members(self, db: Session, query: str) -> list[Member]:
        """Search members by name or email."""
        like = f"%{query}%"
        return list(
            db.execute(
                select(Member).where(
                    Member.is_deleted == False,
                    or_(Member.name.ilike(like), Member.email.ilike(like))
                )
            ).scalars().all()
        )

member_repository = MemberRepository()
