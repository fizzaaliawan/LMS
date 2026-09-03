from datetime import UTC, datetime, timedelta

from app.jobs import create_job, run_overdue_report_task
from app.models import Loan


def _signup_and_login(api_client, email, role):
    api_client.post("/auth/signup", json={"email": email, "password": "supersecret1", "role": role})
    resp = api_client.post("/auth/login", data={"username": email, "password": "supersecret1"})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_overdue_report_finds_overdue_loans(api_client, db_session):
    headers = _signup_and_login(api_client, "lib@example.com", "librarian")

    book = api_client.post(
        "/books", json={"title": "Dune", "author": "Herbert", "isbn": "111"}, headers=headers
    ).json()
    member = api_client.post(
        "/members", json={"name": "Fizza", "email": "fizza@example.com"}, headers=headers
    ).json()
    loan = api_client.post(
        "/loans", json={"book_id": book["id"], "member_id": member["id"]}, headers=headers
    ).json()

    import uuid
    # Backdate the loan so it's overdue (default threshold is 14 days).
    loan_row = db_session.get(Loan, uuid.UUID(loan["id"]))
    loan_row.borrowed_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=34)
    loan_row.due_at = loan_row.borrowed_at + timedelta(days=14)
    db_session.commit()

    trigger = api_client.post("/reports/overdue", headers=headers)
    assert trigger.status_code == 202
    job_id = trigger.json()["job_id"]

    # TestClient runs BackgroundTasks synchronously, so the job has already
    # completed by the time this response came back.
    result = api_client.get(f"/reports/overdue/{job_id}", headers=headers)
    assert result.status_code == 200
    body = result.json()
    assert body["status"] == "completed"
    assert body["overdue_count"] == 1
    assert body["overdue_loans"][0]["book_title"] == "Dune"
    assert body["overdue_loans"][0]["member_email"] == "fizza@example.com"
    assert body["overdue_loans"][0]["days_overdue"] >= 20


def test_celery_task_runs_overdue_report_eagerly(db_session):
    job_id = create_job()
    result = run_overdue_report_task.delay(job_id)

    assert result.state == "SUCCESS"
    job = run_overdue_report_task.AsyncResult(result.id)
    assert job.state == "SUCCESS"

    payload = job.result
    assert payload["status"] == "completed"


def test_overdue_report_excludes_recent_loans(api_client, db_session):
    headers = _signup_and_login(api_client, "lib@example.com", "librarian")

    book = api_client.post(
        "/books", json={"title": "Dune", "author": "Herbert", "isbn": "111"}, headers=headers
    ).json()
    member = api_client.post(
        "/members", json={"name": "Fizza", "email": "fizza@example.com"}, headers=headers
    ).json()
    api_client.post(
        "/loans", json={"book_id": book["id"], "member_id": member["id"]}, headers=headers
    )
    # Not backdated - this loan is recent, should not show up as overdue.

    trigger = api_client.post("/reports/overdue", headers=headers)
    job_id = trigger.json()["job_id"]

    result = api_client.get(f"/reports/overdue/{job_id}", headers=headers)
    assert result.json()["overdue_count"] == 0


def test_trigger_overdue_report_requires_librarian(api_client, db_session):
    headers = _signup_and_login(api_client, "member@example.com", "member")
    resp = api_client.post("/reports/overdue", headers=headers)
    assert resp.status_code == 403


def test_trigger_overdue_report_requires_auth(api_client, db_session):
    resp = api_client.post("/reports/overdue")
    assert resp.status_code == 401


def test_unknown_job_id_returns_404(api_client, db_session):
    headers = _signup_and_login(api_client, "lib@example.com", "librarian")
    resp = api_client.get("/reports/overdue/does-not-exist", headers=headers)
    assert resp.status_code == 404
