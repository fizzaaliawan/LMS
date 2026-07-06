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
    assert "available" in result.output


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
    assert "Removed book with ISBN 111" in result.output

    result = _run("list-books")
    assert "Dune" not in result.output


def test_remove_nonexistent_book_reports_not_found(db_session):
    result = _run("remove-book", "--isbn", "does-not-exist")
    assert "No book found" in result.output
