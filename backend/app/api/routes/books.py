import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.api.auth import require_role
from app.models.user import UserRole
from app.schemas.request.book import BookCreate, BookUpdate
from app.schemas.response.book import BookOut
from app.services.book import book_service

router = APIRouter(prefix="/books", tags=["books"])

@router.get("", response_model=list[BookOut])
def list_books(db: Session = Depends(get_db)):
    return book_service.list_books(db)

@router.get("/search", response_model=list[BookOut])
def search_books(q: str, db: Session = Depends(get_db)):
    return book_service.search_books(db, q)

@router.get("/{book_id}", response_model=BookOut)
def get_book(book_id: uuid.UUID, db: Session = Depends(get_db)):
    return book_service.get_book(db, book_id)

@router.post("", response_model=BookOut, status_code=status.HTTP_201_CREATED)
def create_book(
    payload: BookCreate,
    db: Session = Depends(get_db),
    _librarian=Depends(require_role(UserRole.LIBRARIAN))
):
    return book_service.create_book(db, payload.title, payload.author, payload.isbn)

@router.patch("/{book_id}", response_model=BookOut)
def update_book(
    book_id: uuid.UUID,
    payload: BookUpdate,
    db: Session = Depends(get_db),
    _librarian=Depends(require_role(UserRole.LIBRARIAN))
):
    return book_service.update_book(db, book_id, payload.model_dump(exclude_unset=True))

@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_book(
    book_id: uuid.UUID,
    db: Session = Depends(get_db),
    _librarian=Depends(require_role(UserRole.LIBRARIAN))
):
    book_service.delete_book(db, book_id)
