import uuid
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.loan import Loan, LoanStatus
from app.repositories.base import BaseRepository

class LoanRepository(BaseRepository[Loan]):
    def __init__(self):
        super().__init__(Loan)

    def get_active_loan_by_book(self, db: Session, book_id: uuid.UUID) -> Loan | None:
        """Fetch current active loan for a given book, if any."""
        return db.execute(
            select(Loan).where(
                Loan.book_id == book_id,
                Loan.returned_at.is_(None),
                Loan.is_deleted == False
            )
        ).scalar_one_or_none()

    def get_active_loans(self, db: Session) -> list[Loan]:
        """Fetch all active loans in the system."""
        return list(
            db.execute(
                select(Loan).where(
                    Loan.returned_at.is_(None),
                    Loan.is_deleted == False
                )
            ).scalars().all()
        )

    def get_overdue_loans(self, db: Session, current_time) -> list[Loan]:
        """Fetch all overdue loans."""
        return list(
            db.execute(
                select(Loan).where(
                    Loan.returned_at.is_(None),
                    Loan.due_at < current_time,
                    Loan.is_deleted == False
                )
            ).scalars().all()
        )

loan_repository = LoanRepository()
