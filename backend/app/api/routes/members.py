import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.api.auth import require_role
from app.models.user import UserRole
from app.schemas.request.member import MemberCreate, MemberUpdate
from app.schemas.response.member import MemberOut
from app.services.member import member_service

router = APIRouter(prefix="/members", tags=["members"])

@router.get("", response_model=list[MemberOut])
def list_members(
    db: Session = Depends(get_db),
    _librarian=Depends(require_role(UserRole.LIBRARIAN))
):
    return member_service.list_members(db)

@router.get("/search", response_model=list[MemberOut])
def search_members(
    q: str,
    db: Session = Depends(get_db),
    _librarian=Depends(require_role(UserRole.LIBRARIAN))
):
    return member_service.search_members(db, q)

@router.get("/{member_id}", response_model=MemberOut)
def get_member(
    member_id: uuid.UUID,
    db: Session = Depends(get_db),
    _librarian=Depends(require_role(UserRole.LIBRARIAN))
):
    return member_service.get_member(db, member_id)

@router.post("", response_model=MemberOut, status_code=status.HTTP_201_CREATED)
def create_member(
    payload: MemberCreate,
    db: Session = Depends(get_db),
    _librarian=Depends(require_role(UserRole.LIBRARIAN))
):
    return member_service.create_member(db, payload.name, payload.email)

@router.patch("/{member_id}", response_model=MemberOut)
def update_member(
    member_id: uuid.UUID,
    payload: MemberUpdate,
    db: Session = Depends(get_db),
    _librarian=Depends(require_role(UserRole.LIBRARIAN))
):
    return member_service.update_member(db, member_id, payload.model_dump(exclude_unset=True))

@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_member(
    member_id: uuid.UUID,
    db: Session = Depends(get_db),
    _librarian=Depends(require_role(UserRole.LIBRARIAN))
):
    member_service.delete_member(db, member_id)
