def _signup_and_login(api_client, email, role):
    api_client.post("/auth/signup", json={"email": email, "password": "supersecret1", "role": role})
    resp = api_client.post("/auth/login", data={"username": email, "password": "supersecret1"})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_list_books_is_public(api_client, db_session):
    resp = api_client.get("/books")
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_book_requires_auth(api_client, db_session):
    resp = api_client.post("/books", json={"title": "Dune", "author": "Herbert", "isbn": "111"})
    assert resp.status_code == 401


def test_member_cannot_create_book(api_client, db_session):
    headers = _signup_and_login(api_client, "member@example.com", "member")
    resp = api_client.post(
        "/books", json={"title": "Dune", "author": "Herbert", "isbn": "111"}, headers=headers
    )
    assert resp.status_code == 403


def test_librarian_can_create_and_search_book(api_client, db_session):
    headers = _signup_and_login(api_client, "lib@example.com", "librarian")
    resp = api_client.post(
        "/books", json={"title": "Dune", "author": "Herbert", "isbn": "111"}, headers=headers
    )
    assert resp.status_code == 201

    resp = api_client.get("/books/search", params={"q": "Dune"})
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_full_loan_and_return_cycle(api_client, db_session):
    headers = _signup_and_login(api_client, "lib@example.com", "librarian")

    book = api_client.post(
        "/books", json={"title": "Dune", "author": "Herbert", "isbn": "111"}, headers=headers
    ).json()
    member = api_client.post(
        "/members", json={"name": "Fizza", "email": "fizza@example.com"}, headers=headers
    ).json()

    loan = api_client.post(
        "/loans", json={"book_id": book["id"], "member_id": member["id"]}, headers=headers
    )
    assert loan.status_code == 201
    loan_id = loan.json()["id"]

    book_after_loan = api_client.get(f"/books/{book['id']}").json()
    assert book_after_loan["available"] is False

    second_loan = api_client.post(
        "/loans", json={"book_id": book["id"], "member_id": member["id"]}, headers=headers
    )
    assert second_loan.status_code == 409

    ret = api_client.post(f"/loans/{loan_id}/return", headers=headers)
    assert ret.status_code == 200
    assert ret.json()["returned_at"] is not None

    book_after_return = api_client.get(f"/books/{book['id']}").json()
    assert book_after_return["available"] is True


def test_openapi_docs_available(api_client):
    resp = api_client.get("/openapi.json")
    assert resp.status_code == 200
    resp = api_client.get("/docs")
    assert resp.status_code == 200


def test_delete_book_is_soft_delete(api_client, db_session):
    headers = _signup_and_login(api_client, "lib@example.com", "librarian")
    book = api_client.post(
        "/books", json={"title": "Dune", "author": "Herbert", "isbn": "111"}, headers=headers
    ).json()

    resp = api_client.delete(f"/books/{book['id']}", headers=headers)
    assert resp.status_code == 204

    # Hidden from public listing/search/get...
    assert book["id"] not in [b["id"] for b in api_client.get("/books").json()]
    resp = api_client.get(f"/books/{book['id']}")
    assert resp.status_code == 404

    # ...but the row itself still exists in the database with is_active=False.
    from sqlalchemy import select
    import uuid

    from app.models import Book

    row = db_session.execute(select(Book).where(Book.id == uuid.UUID(book["id"]))).scalar_one()
    assert row.is_active is False
