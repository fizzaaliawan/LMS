import uuid
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.book import Book
from app.repositories.book import book_repository
from app.utils.cache import get_cached_search, set_cached_search, invalidate_search_cache

class BookService:
    def get_book(self, db: Session, book_id: uuid.UUID) -> Book:
        """Retrieve a book by UUID, raising 404 if not found or soft-deleted."""
        book = book_repository.get(db, book_id)
        if not book or not book.is_active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Book not found"
            )
        return book

    def list_books(self, db: Session) -> list[Book]:
        """List all active books in the library."""
        # Use book_repository.get_all, but we only want is_active=True ones
        from sqlalchemy import select
        query = select(Book).where(Book.is_deleted == False, Book.is_active == True)
        return list(db.execute(query).scalars().all())

    def search_books(self, db: Session, query: str) -> list[Book] | list[dict]:
        """Search books by title/author with query caching."""
        cached = get_cached_search(query)
        if cached is not None:
            return cached
            
        books = book_repository.search_books(db, query)
        
        # Serialize results to cache
        results = [
            {
                "id": str(b.id),
                "title": b.title,
                "author": b.author,
                "isbn": b.isbn,
                "available": b.available,
                "is_active": b.is_active
            }
            for b in books
        ]
        set_cached_search(query, results)
        return books

    def create_book(self, db: Session, title: str, author: str, isbn: str) -> Book:
        """Create a new book, checking for active ISBN duplicates."""
        existing = book_repository.get_by_isbn(db, isbn)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="ISBN already exists"
            )
        
        book = Book(title=title, author=author, isbn=isbn, available=True, is_active=True)
        book_repository.create(db, book)
        invalidate_search_cache()
        return book

    def update_book(self, db: Session, book_id: uuid.UUID, update_data: dict) -> Book:
        """Update a book's attributes and invalidate search cache."""
        book = self.get_book(db, book_id)
        # Prevent manual modification of ID/ISBN via generic update
        update_data.pop("id", None)
        update_data.pop("isbn", None)
        
        updated = book_repository.update(db, book, update_data)
        invalidate_search_cache()
        return updated

    def delete_book(self, db: Session, book_id: uuid.UUID) -> None:
        """Soft delete: mark book as inactive and deleted."""
        book = self.get_book(db, book_id)
        book.is_active = False
        book.is_deleted = True
        db.commit()
        invalidate_search_cache()

book_service = BookService()
