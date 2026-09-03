from click.testing import CliRunner

from app.main import cli


def _run(*args):
    runner = CliRunner()
    return runner.invoke(cli, list(args))


def test_seed_data_inserts_sample_rows(db_session):
    result = _run("seed-data")
    assert result.exit_code == 0
    assert "Seeded 15 new book(s) and 2 new member(s)." in result.output

    result = _run("list-books")
    assert "Dune" in result.output
    assert "Foundation" in result.output
    assert "Neuromancer" in result.output


def test_seed_data_is_idempotent(db_session):
    _run("seed-data")
    result = _run("seed-data")
    assert "Seeded 0 new book(s) and 0 new member(s)." in result.output
