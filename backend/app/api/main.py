import os
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from app.database.session import SessionLocal
from app.models.book import Book
from app.models.member import Member
from app.api.routes import auth, books, members, loans, notifications, jobs, sse

app = FastAPI(
    title="Library Management API",
    description="REST API for the Library Management System - books, members, loans, and JWT auth.",
    version="0.1.0",
)

# CORS setup
_cors_origins = os.environ.get("CORS_ORIGINS", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _cors_origins == "*" else _cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def run_migrations_and_seed():
    if os.environ.get("PYTEST_CURRENT_TEST"):
        return
    try:
        # Run Alembic migrations
        alembic_cfg = Config("alembic.ini")
        command.upgrade(alembic_cfg, "head")
        print("Database migrations completed.")
    except Exception as e:
        print(f"Migrations failed: {e}")

    # Seed initial database records if empty
    session = SessionLocal()
    try:
        if session.query(Book).count() == 0:
            books_to_seed = [
                {"title": "Dune", "author": "Frank Herbert", "isbn": "111"},
                {"title": "Foundation", "author": "Isaac Asimov", "isbn": "222"},
                {"title": "Neuromancer", "author": "William Gibson", "isbn": "333"},
                {"title": "1984", "author": "George Orwell", "isbn": "444"},
                {"title": "Brave New World", "author": "Aldous Huxley", "isbn": "555"},
                {"title": "Fahrenheit 451", "author": "Ray Bradbury", "isbn": "666"},
                {"title": "The Hobbit", "author": "J.R.R. Tolkien", "isbn": "777"},
                {"title": "The Lord of the Rings", "author": "J.R.R. Tolkien", "isbn": "888"},
                {"title": "Snow Crash", "author": "Neal Stephenson", "isbn": "999"},
                {"title": "The Matrix", "author": "Sophia Stewart", "isbn": "101"},
                {"title": "Frankenstein", "author": "Mary Shelley", "isbn": "102"},
                {"title": "Dracula", "author": "Bram Stoker", "isbn": "103"},
                {"title": "The Time Machine", "author": "H.G. Wells", "isbn": "104"},
                {"title": "Starship Troopers", "author": "Robert A. Heinlein", "isbn": "105"},
                {"title": "Rendezvous with Rama", "author": "Arthur C. Clarke", "isbn": "106"},
            ]
            for b in books_to_seed:
                book = Book(
                    title=b["title"],
                    author=b["author"],
                    isbn=b["isbn"],
                    available=True,
                    is_active=True,
                )
                session.add(book)

            members_to_seed = [
                {"name": "Alice", "email": "alice@example.com"},
                {"name": "Bob", "email": "bob@example.com"},
            ]
            for m in members_to_seed:
                member = Member(name=m["name"], email=m["email"])
                session.add(member)

            session.commit()
            print("Database successfully auto-seeded with 15 classic books and 2 members.")
    except Exception as e:
        session.rollback()
        print(f"Auto-seeding failed: {e}")
    finally:
        session.close()

@app.on_event("startup")
def on_startup():
    run_migrations_and_seed()

app.include_router(auth.router)
app.include_router(books.router)
app.include_router(members.router)
app.include_router(loans.router)
app.include_router(notifications.router)
app.include_router(jobs.router)
app.include_router(sse.router)

@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}
