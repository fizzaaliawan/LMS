import uuid
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.member import Member
from app.repositories.member import member_repository

class MemberService:
    def get_member(self, db: Session, member_id: uuid.UUID) -> Member:
        """Retrieve a member by UUID, raising 404 if not found or soft-deleted."""
        member = member_repository.get(db, member_id)
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found"
            )
        return member

    def list_members(self, db: Session) -> list[Member]:
        """List all active members."""
        return member_repository.get_all(db)

    def search_members(self, db: Session, query: str) -> list[Member]:
        """Search members by name or email."""
        return member_repository.search_members(db, query)

    def create_member(self, db: Session, name: str, email: str) -> Member:
        """Register a new member, verifying email uniqueness."""
        existing = member_repository.get_by_email(db, email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Member with this email already registered"
            )
        
        member = Member(name=name, email=email)
        return member_repository.create(db, member)

    def update_member(self, db: Session, member_id: uuid.UUID, update_data: dict) -> Member:
        """Update member details."""
        member = self.get_member(db, member_id)
        # Prevent email modification if it conflicts with someone else
        new_email = update_data.get("email")
        if new_email and new_email != member.email:
            existing = member_repository.get_by_email(db, new_email)
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email already in use by another member"
                )
        
        update_data.pop("id", None)
        return member_repository.update(db, member, update_data)

    def delete_member(self, db: Session, member_id: uuid.UUID) -> None:
        """Soft delete a member profile."""
        member = self.get_member(db, member_id)
        member_repository.soft_delete(db, member)

member_service = MemberService()
