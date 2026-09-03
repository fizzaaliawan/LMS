from datetime import UTC, datetime, timedelta
import click
import os
from sqlalchemy import select

from app.database.session import get_session
from app.models.book import Book
from app.models.member import Member
from app.models.loan import Loan, LoanStatus
from app.repositories.book import book_repository
from app.repositories.member import member_repository
from app.repositories.loan import loan_repository
from app.services.book import book_service
from app.services.member import member_service
from app.services.loan import loan_service

@click.group()
def cli():
    """Library Management System CLI."""
    pass

@cli.command("add-book")
@click.option("--title", required=True, help="Title of the book")
@click.option("--author", required=True, help="Author of the book")
@click.option("--isbn", required=True, help="ISBN of the book")
def add_book(title, author, isbn):
    session = get_session()
    try:
        book_service.create_book(session, title, author, isbn)
        click.echo(f"Added book '{title}'")
    except Exception as e:
        click.echo(f"Error: {e.detail if hasattr(e, 'detail') else e}")
    finally:
        session.close()

@cli.command("list-books")
def list_books():
    session = get_session()
    try:
        # CLI wants to list all books in DB to show circulation status (including soft-deleted/removed)
        books = session.execute(select(Book)).scalars().all()
        if not books:
            click.echo("No books found.")
            return
        for book in books:
            if not book.is_active:
                status = "removed"
            elif book.available:
                status = "Available"
            else:
                status = "on loan"
            click.echo(f"{book.title} by {book.author} (ISBN: {book.isbn}) - {status}")
    except Exception as e:
        click.echo(f"Error: {e}")
    finally:
        session.close()

@cli.command("search-books")
@click.option("--query", required=True, help="Query string to search books by title/author")
def search_books(query):
    session = get_session()
    try:
        # Using service with Redis caching
        results = book_service.search_books(session, query)
        if results and isinstance(results[0], dict):
            click.echo("(cached)")
        click.echo(f"{len(results)} result(s) found.")
        for b in results:
            # Handle list of dicts (cached) or list of Book objects
            if isinstance(b, dict):
                status = "Available" if b["available"] else "on loan"
                click.echo(f"{b['title']} by {b['author']} (ISBN: {b['isbn']}) - {status}")
            else:
                status = "Available" if b.available else "on loan"
                click.echo(f"{b.title} by {b.author} (ISBN: {b.isbn}) - {status}")
    except Exception as e:
        click.echo(f"Error: {e}")
    finally:
        session.close()

@cli.command("remove-book")
@click.option("--isbn", required=True, help="ISBN of the book to remove")
def remove_book(isbn):
    session = get_session()
    try:
        book = book_repository.get_by_isbn(session, isbn)
        if not book or not book.is_active:
            click.echo("No active book found")
            return
        book_service.delete_book(session, book.id)
        click.echo(f"Book '{book.title}' removed from circulation")
    except Exception as e:
        click.echo(f"Error: {e.detail if hasattr(e, 'detail') else e}")
    finally:
        session.close()

@cli.command("add-member")
@click.option("--name", required=True, help="Name of the member")
@click.option("--email", required=True, help="Email of the member")
def add_member(name, email):
    session = get_session()
    try:
        member_service.create_member(session, name, email)
        click.echo(f"Registered member '{name}'")
    except Exception as e:
        click.echo(f"Error: {e.detail if hasattr(e, 'detail') else e}")
    finally:
        session.close()

@cli.command("loan")
@click.option("--isbn", required=True, help="ISBN of the book to loan")
@click.option("--member-email", required=True, help="Email of the member borrowing the book")
def loan_book(isbn, member_email):
    session = get_session()
    try:
        book = book_repository.get_by_isbn(session, isbn)
        member = member_repository.get_by_email(session, member_email)
        if not book or not member:
            click.echo("Book or member not found")
            return
        loan_service.borrow_book(session, book.id, member.id)
        click.echo(f"Loaned '{book.title}' to {member.name}")
    except Exception as e:
        click.echo(f"Error: {e.detail if hasattr(e, 'detail') else e}")
    finally:
        session.close()

@cli.command("return")
@click.option("--isbn", required=True, help="ISBN of the book to return")
def return_book(isbn):
    session = get_session()
    try:
        book = book_repository.get_by_isbn(session, isbn)
        if not book:
            click.echo("Book not found")
            return
        active_loan = loan_repository.get_active_loan_by_book(session, book.id)
        if not active_loan:
            click.echo("Book is not currently on loan")
            return
        loan_service.return_book(session, active_loan.id)
        click.echo(f"Book '{book.title}' returned. Thank you!")
    except Exception as e:
        click.echo(f"Error: {e.detail if hasattr(e, 'detail') else e}")
    finally:
        session.close()

@cli.command("seed-data")
def seed_data():
    session = get_session()
    try:
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
        members_to_seed = [
            {"name": "Alice", "email": "alice@example.com"},
            {"name": "Bob", "email": "bob@example.com"},
        ]

        books_seeded = 0
        for b in books_to_seed:
            existing = book_repository.get_by_isbn(session, b["isbn"])
            if not existing:
                book_service.create_book(session, b["title"], b["author"], b["isbn"])
                books_seeded += 1

        members_seeded = 0
        for m in members_to_seed:
            existing = member_repository.get_by_email(session, m["email"])
            if not existing:
                member_service.create_member(session, m["name"], m["email"])
                members_seeded += 1

        click.echo(f"Seeded {books_seeded} new book(s) and {members_seeded} new member(s).")
    except Exception as e:
        click.echo(f"Error: {e}")
    finally:
        session.close()

@cli.command("menu")
def menu():
    while True:
        click.echo("1. Add book")
        click.echo("2. List books")
        click.echo("3. Search books")
        click.echo("4. Remove book")
        click.echo("5. Add member")
        click.echo("6. Loan book")
        click.echo("7. Return book")
        click.echo("8. Seed data")
        click.echo("0. Exit")
        choice = click.prompt("Enter option", default="0")

        session = get_session()
        try:
            if choice == "1":
                title = click.prompt("Title")
                author = click.prompt("Author")
                isbn = click.prompt("ISBN")
                book_service.create_book(session, title, author, isbn)
                click.echo(f"Added book '{title}'")
            elif choice == "2":
                books = session.execute(select(Book)).scalars().all()
                for book in books:
                    if not book.is_active:
                        status = "removed"
                    elif book.available:
                        status = "Available"
                    else:
                        status = "on loan"
                    click.echo(f"{book.title} by {book.author} (ISBN: {book.isbn}) - {status}")
            elif choice == "3":
                query = click.prompt("Search query")
                results = book_service.search_books(session, query)
                if not results:
                    click.echo("No books found.")
                for b in results:
                    if isinstance(b, dict):
                        status = "Available" if b["available"] else "on loan"
                        click.echo(f"{b['title']} by {b['author']} (ISBN: {b['isbn']}) - {status}")
                    else:
                        status = "Available" if b.available else "on loan"
                        click.echo(f"{b.title} by {b.author} (ISBN: {b.isbn}) - {status}")
            elif choice == "4":
                isbn = click.prompt("ISBN")
                book = book_repository.get_by_isbn(session, isbn)
                if not book or not book.is_active:
                    click.echo("No active book found")
                    continue
                book_service.delete_book(session, book.id)
                click.echo(f"Book '{book.title}' removed from circulation")
            elif choice == "5":
                name = click.prompt("Name")
                email = click.prompt("Email")
                member_service.create_member(session, name, email)
                click.echo(f"Registered member '{name}'")
            elif choice == "6":
                isbn = click.prompt("ISBN")
                member_email = click.prompt("Member email")
                book = book_repository.get_by_isbn(session, isbn)
                member = member_repository.get_by_email(session, member_email)
                if not book or not member:
                    click.echo("Book or member not found")
                    continue
                loan_service.borrow_book(session, book.id, member.id)
                click.echo(f"Loaned '{book.title}' to {member.name}")
            elif choice == "7":
                isbn = click.prompt("ISBN")
                book = book_repository.get_by_isbn(session, isbn)
                if not book:
                    click.echo("Book not found")
                    continue
                active_loan = loan_repository.get_active_loan_by_book(session, book.id)
                if not active_loan:
                    click.echo("Book is not currently on loan")
                    continue
                loan_service.return_book(session, active_loan.id)
                click.echo(f"Book '{book.title}' returned. Thank you!")
            elif choice == "8":
                # Reuse the seed click logic directly
                runner = click.Context(cli)
                runner.invoke(seed_data)
            elif choice == "0":
                click.echo("Goodbye!")
                break
            else:
                click.echo("Invalid option")
        except Exception as e:
            click.echo(f"Error: {e.detail if hasattr(e, 'detail') else e}")
        finally:
            session.close()
