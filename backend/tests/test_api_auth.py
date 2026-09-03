def test_signup_creates_user(api_client, db_session):
    resp = api_client.post(
        "/auth/signup",
        json={"email": "lib@example.com", "password": "supersecret1", "role": "librarian"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == "lib@example.com"
    assert body["role"] == "librarian"


def test_signup_duplicate_email_rejected(api_client, db_session):
    payload = {"email": "dup@example.com", "password": "supersecret1", "role": "member"}
    api_client.post("/auth/signup", json=payload)
    resp = api_client.post("/auth/signup", json=payload)
    assert resp.status_code == 409


def test_login_success_returns_token(api_client, db_session):
    api_client.post(
        "/auth/signup",
        json={"email": "lib@example.com", "password": "supersecret1", "role": "librarian"},
    )
    resp = api_client.post(
        "/auth/login", data={"username": "lib@example.com", "password": "supersecret1"}
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_login_wrong_password_rejected(api_client, db_session):
    api_client.post(
        "/auth/signup",
        json={"email": "lib@example.com", "password": "supersecret1", "role": "librarian"},
    )
    resp = api_client.post(
        "/auth/login", data={"username": "lib@example.com", "password": "wrongpassword"}
    )
    assert resp.status_code == 401
