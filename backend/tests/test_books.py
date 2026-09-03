from click.testing import CliRunner

from app.main import cli


def _run(*args):
    runner = CliRunner()
    return runner.invoke(cli, list(args))


def test_add_and_list_book(db_session):
    result = _run("add-book", "--title", "Dune", "--author", "Frank Herbert", "--isbn", "111")
    assert result.exit_code == 0
    assert "Added book 'Dune'" in result.output

    result = _run("list-books")
    assert result.exit_code == 0
    assert "Dune" in result.output
    assert "Available" in result.output


def test_search_books_finds_by_title_or_author(db_session):
    _run("add-book", "--title", "Foundation", "--author", "Isaac Asimov", "--isbn", "222")
    _run("add-book", "--title", "Neuromancer", "--author", "William Gibson", "--isbn", "333")

    result = _run("search-books", "--query", "Asimov")
    assert "Foundation" in result.output
    assert "Neuromancer" not in result.output


def test_search_books_uses_cache_on_second_call(db_session):
    _run("add-book", "--title", "Foundation", "--author", "Isaac Asimov", "--isbn", "222")

    first = _run("search-books", "--query", "Foundation")
    assert "(cached)" not in first.output

    second = _run("search-books", "--query", "Foundation")
    assert "(cached)" in second.output


def test_remove_book(db_session):
    _run("add-book", "--title", "Dune", "--author", "Frank Herbert", "--isbn", "111")

    result = _run("remove-book", "--isbn", "111")
    assert "removed from circulation" in result.output

    # Soft delete: still visible in list-books, but marked as "removed",
    # not hidden entirely. The row itself is preserved either way.
    result = _run("list-books")
    assert "Dune" in result.output
    assert "removed" in result.output

    from sqlalchemy import select

    from app.models import Book

    session = db_session
    book = session.execute(select(Book).where(Book.isbn == "111")).scalar_one_or_none()
    assert book is not None, "book row should still exist after remove-book (soft delete)"
    assert book.is_active is False


def test_remove_nonexistent_book_reports_not_found(db_session):
    result = _run("remove-book", "--isbn", "does-not-exist")
    assert "No active book found" in result.output


def test_removed_book_excluded_from_search(db_session):
    _run("add-book", "--title", "Dune", "--author", "Frank Herbert", "--isbn", "111")
    _run("remove-book", "--isbn", "111")

    result = _run("search-books", "--query", "Dune")
    assert "0 result(s)" in result.output
    assert "by Frank Herbert" not in result.output
