from click.testing import CliRunner

from app.main import cli


def test_menu_add_and_list_book(db_session):
    runner = CliRunner()
    result = runner.invoke(cli, ["menu"], input="1\nMenu Book\nMenu Author\n999\n2\n0\n")
    assert result.exit_code == 0
    assert "Added book 'Menu Book'" in result.output
    assert "Menu Book by Menu Author" in result.output
    assert "Goodbye!" in result.output


def test_menu_lists_all_available_actions(db_session):
    runner = CliRunner()
    result = runner.invoke(cli, ["menu"], input="0\n")
    assert result.exit_code == 0
    assert "1. Add book" in result.output
    assert "2. List books" in result.output
    assert "3. Search books" in result.output
    assert "4. Remove book" in result.output
    assert "5. Add member" in result.output
    assert "6. Loan book" in result.output
    assert "7. Return book" in result.output
    assert "8. Seed data" in result.output
    assert "0. Exit" in result.output


def test_menu_invalid_choice_does_not_crash(db_session):
    runner = CliRunner()
    result = runner.invoke(cli, ["menu"], input="99\n0\n")
    assert result.exit_code == 0
    assert "Invalid option" in result.output
