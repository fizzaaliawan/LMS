import uuid
from sqlalchemy import select, or_
from sqlalchemy.orm import Session
from app.models.book import Book
from app.repositories.base import BaseRepository

class BookRepository(BaseRepository[Book]):
    def __init__(self):
        super().__init__(Book)

    def get_by_isbn(self, db: Session, isbn: str) -> Book | None:
        """Fetch book by its ISBN, filtering out soft-deleted records."""
        return db.execute(
            select(Book).where(Book.isbn == isbn, Book.is_deleted == False)
        ).scalar_one_or_none()

    def search_books(self, db: Session, query: str) -> list[Book]:
        """Search books by title or author, matching only active non-deleted books."""
        like = f"%{query}%"
        return list(
            db.execute(
                select(Book).where(
                    Book.is_deleted == False,
                    Book.is_active == True,
                    or_(Book.title.ilike(like), Book.author.ilike(like))
                )
            ).scalars().all()
        )

book_repository = BookRepository()
