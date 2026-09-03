import uuid
from datetime import datetime, UTC, timedelta
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.book import Book
from app.models.member import Member
from app.models.loan import Loan, LoanStatus
from app.repositories.book import book_repository
from app.repositories.member import member_repository
from app.repositories.loan import loan_repository
from app.config.config import settings

class LoanService:
    def borrow_book(self, db: Session, book_id: uuid.UUID, member_id: uuid.UUID) -> Loan:
        """Issue a book loan to a member, updating availability status."""
        book = book_repository.get(db, book_id)
        member = member_repository.get(db, member_id)

        if not book or not book.is_active:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
        if not member:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
        
        if not book.available:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Book is already on loan"
            )

        # Double check active loans on the book just in case
        active_loan = loan_repository.get_active_loan_by_book(db, book.id)
        if active_loan:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Book has an active outstanding loan record"
            )

        book.available = False
        borrowed_at = datetime.now(UTC).replace(tzinfo=None)
        due_at = borrowed_at + timedelta(days=settings.LOAN_PERIOD_DAYS)
        
        loan = Loan(
            book_id=book.id,
            member_id=member.id,
            borrowed_at=borrowed_at,
            due_at=due_at,
            loan_duration_days=settings.LOAN_PERIOD_DAYS,
            status=LoanStatus.BORROWED
        )
        
        db.add(loan)
        db.commit()
        db.refresh(loan)
        return loan

    def return_book(self, db: Session, loan_id: uuid.UUID) -> Loan:
        """Mark a loan as returned, restoring book availability."""
        loan = loan_repository.get(db, loan_id)
        if not loan or loan.returned_at is not None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Active loan not found"
            )

        book = book_repository.get(db, loan.book_id)
        if book:
            book.available = True
            
        loan.returned_at = datetime.now(UTC).replace(tzinfo=None)
        loan.status = LoanStatus.RETURNED
        db.commit()
        db.refresh(loan)
        return loan

    def list_loans(self, db: Session) -> list[Loan]:
        """List all active loans."""
        return loan_repository.get_all(db)

loan_service = LoanService()
