from datetime import datetime

import click
from sqlalchemy import select

from app.cache import get_cached_search, invalidate_search_cache, set_cached_search
from app.db import get_session
from app.models import Book, Loan, Member


@click.group()
def cli():
    """Library Management CLI."""


@cli.command("seed-data")
def seed_data():
    """Insert a small set of sample books/members - safe to run multiple times."""
    session = get_session()

    sample_books = [
        {"title": "Dune", "author": "Frank Herbert", "isbn": "9780441172719"},
        {"title": "Foundation", "author": "Isaac Asimov", "isbn": "9780553293357"},
        {"title": "Neuromancer", "author": "William Gibson", "isbn": "9780441569595"},
    ]
    sample_members = [
        {"name": "Fizza Ali", "email": "fizza@example.com"},
        {"name": "Ahmed Khan", "email": "ahmed@example.com"},
    ]

    added_books = 0
    for b in sample_books:
        exists = session.execute(select(Book).where(Book.isbn == b["isbn"])).scalar_one_or_none()
        if not exists:
            session.add(Book(**b))
            added_books += 1

    added_members = 0
    for m in sample_members:
        exists = session.execute(
            select(Member).where(Member.email == m["email"])
        ).scalar_one_or_none()
        if not exists:
            session.add(Member(**m))
            added_members += 1

    session.commit()
    invalidate_search_cache()
    click.echo(f"Seeded {added_books} new book(s) and {added_members} new member(s).")


@cli.command("add-book")
@click.option("--title", required=True)
@click.option("--author", required=True)
@click.option("--isbn", required=True)
def add_book(title, author, isbn):
    session = get_session()
    book = Book(title=title, author=author, isbn=isbn)
    session.add(book)
    session.commit()
    invalidate_search_cache()
    click.echo(f"Added book '{title}' (ISBN {isbn})")


@cli.command("list-books")
def list_books():
    session = get_session()
    books = session.execute(select(Book)).scalars().all()
    if not books:
        click.echo("No books found.")
        return
    for b in books:
        status = "available" if b.available else "on loan"
        click.echo(f"[{b.id}] {b.title} by {b.author} (ISBN {b.isbn}) - {status}")


@cli.command("search-books")
@click.option("--query", required=True)
def search_books(query):
    cached = get_cached_search(query)
    if cached is not None:
        click.echo(f"(cached) {len(cached)} result(s) for '{query}'")
        for r in cached:
            click.echo(f"[{r['id']}] {r['title']} by {r['author']}")
        return

    session = get_session()
    like = f"%{query}%"
    books = session.execute(
        select(Book).where(Book.title.ilike(like) | Book.author.ilike(like))
    ).scalars().all()

    results = [{"id": b.id, "title": b.title, "author": b.author} for b in books]
    set_cached_search(query, results)

    click.echo(f"{len(results)} result(s) for '{query}'")
    for r in results:
        click.echo(f"[{r['id']}] {r['title']} by {r['author']}")


@cli.command("remove-book")
@click.option("--isbn", required=True)
def remove_book(isbn):
    session = get_session()
    book = session.execute(select(Book).where(Book.isbn == isbn)).scalar_one_or_none()
    if not book:
        click.echo(f"No book found with ISBN {isbn}")
        return
    session.delete(book)
    session.commit()
    invalidate_search_cache()
    click.echo(f"Removed book with ISBN {isbn}")


@cli.command("add-member")
@click.option("--name", required=True)
@click.option("--email", required=True)
def add_member(name, email):
    session = get_session()
    member = Member(name=name, email=email)
    session.add(member)
    session.commit()
    click.echo(f"Registered member '{name}' <{email}>")


@cli.command("loan")
@click.option("--isbn", required=True)
@click.option("--member-email", required=True)
def loan_book(isbn, member_email):
    session = get_session()
    book = session.execute(select(Book).where(Book.isbn == isbn)).scalar_one_or_none()
    member = session.execute(
        select(Member).where(Member.email == member_email)
    ).scalar_one_or_none()

    if not book or not member:
        click.echo("Book or member not found.")
        return
    if not book.available:
        click.echo(f"Book '{book.title}' is already on loan.")
        return

    book.available = False
    session.add(Loan(book_id=book.id, member_id=member.id))
    session.commit()
    click.echo(f"Loaned '{book.title}' to {member.name}")


@cli.command("return")
@click.option("--isbn", required=True)
def return_book(isbn):
    session = get_session()
    book = session.execute(select(Book).where(Book.isbn == isbn)).scalar_one_or_none()
    if not book:
        click.echo(f"No book found with ISBN {isbn}")
        return

    loan = session.execute(
        select(Loan).where(Loan.book_id == book.id, Loan.returned_at.is_(None))
    ).scalar_one_or_none()

    if not loan:
        click.echo(f"'{book.title}' is not currently on loan.")
        return

    loan.returned_at = datetime.utcnow()
    book.available = True
    session.commit()
    click.echo(f"'{book.title}' returned. Thank you!")


if __name__ == "__main__":
    cli()
