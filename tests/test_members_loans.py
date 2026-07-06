from click.testing import CliRunner

from app.main import cli


def _run(*args):
    runner = CliRunner()
    return runner.invoke(cli, list(args))


def test_add_member(db_session):
    result = _run("add-member", "--name", "Fizza", "--email", "fizza@example.com")
    assert result.exit_code == 0
    assert "Registered member 'Fizza'" in result.output


def test_loan_and_return_book(db_session):
    _run("add-book", "--title", "Dune", "--author", "Frank Herbert", "--isbn", "111")
    _run("add-member", "--name", "Fizza", "--email", "fizza@example.com")

    result = _run("loan", "--isbn", "111", "--member-email", "fizza@example.com")
    assert "Loaned 'Dune' to Fizza" in result.output

    # Book should now show as on loan
    result = _run("list-books")
    assert "on loan" in result.output

    # A second loan attempt should be rejected while it's out
    result = _run("loan", "--isbn", "111", "--member-email", "fizza@example.com")
    assert "already on loan" in result.output

    result = _run("return", "--isbn", "111")
    assert "returned. Thank you!" in result.output

    result = _run("list-books")
    assert "available" in result.output


def test_return_book_not_on_loan(db_session):
    _run("add-book", "--title", "Dune", "--author", "Frank Herbert", "--isbn", "111")

    result = _run("return", "--isbn", "111")
    assert "not currently on loan" in result.output


def test_loan_missing_book_or_member(db_session):
    result = _run("loan", "--isbn", "ghost", "--member-email", "nobody@example.com")
    assert "not found" in result.output
