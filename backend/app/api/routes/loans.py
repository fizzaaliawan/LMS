import uuid
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.api.deps import get_db
from app.api.auth import require_role, get_current_user
from app.models.user import UserRole, User
from app.models.loan import Loan
from app.repositories.member import member_repository
from app.schemas.request.loan import LoanCreate
from app.schemas.response.loan import LoanOut
from app.services.loan import loan_service

router = APIRouter(prefix="/loans", tags=["loans"])

@router.get("", response_model=list[LoanOut])
def list_loans(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.LIBRARIAN, UserRole.MEMBER))
):
    if current_user.role == UserRole.LIBRARIAN:
        return loan_service.list_loans(db)
    
    # For members, find member record by email
    member = member_repository.get_by_email(db, current_user.email)
    if not member:
        return []
        
    # Get active/outstanding loans for this member
    loans = db.execute(
        select(Loan).where(
            Loan.member_id == member.id,
            Loan.is_deleted == False
        )
    ).scalars().all()
    return list(loans)

@router.post("", response_model=LoanOut, status_code=status.HTTP_201_CREATED)
def create_loan(
    payload: LoanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.LIBRARIAN, UserRole.MEMBER))
):
    member_id = payload.member_id
    zero_uuid = uuid.UUID("00000000-0000-0000-0000-000000000000")
    
    if not member_id or current_user.role == UserRole.MEMBER or member_id == zero_uuid:
        member = member_repository.get_by_email(db, current_user.email)
        if not member:
            from app.models.member import Member
            name = current_user.email.split("@")[0].replace(".", " ").capitalize()
            member = Member(name=name, email=current_user.email)
            db.add(member)
            db.commit()
            db.refresh(member)
        member_id = member.id
        
    return loan_service.borrow_book(db, payload.book_id, member_id)

@router.post("/{loan_id}/return", response_model=LoanOut)
def return_loan(
    loan_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.LIBRARIAN, UserRole.MEMBER))
):
    # Retrieve loan
    loan = db.get(Loan, loan_id)
    if not loan or loan.returned_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active loan record not found."
        )
        
    if current_user.role == UserRole.MEMBER:
        member = member_repository.get_by_email(db, current_user.email)
        if not member or loan.member_id != member.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Cannot check-in another member's loan record."
            )
            
    return loan_service.return_book(db, loan_id)
