"""Background job: overdue-loan report.

This job triggers periodically or on-demand, checking for overdue loans and issuing alerts.
It uses Celery when available, with a local synchronous fallback for CLI/testing.
"""

import json
import os
import uuid
from datetime import UTC, datetime, timedelta
import redis
from sqlalchemy import select
from app.database.session import SessionLocal
from app.models.book import Book
from app.models.loan import Loan, LoanStatus
from app.models.member import Member
from app.models.notification import Notification, NotificationStatus
from app.models.user import User, UserRole
from app.utils.sse_manager import sse_manager

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
OVERDUE_LOAN_DAYS = int(os.environ.get("OVERDUE_LOAN_DAYS", "14"))
JOB_TTL_SECONDS = 3600

try:
    _client = redis.Redis.from_url(
        REDIS_URL,
        decode_responses=True,
        socket_connect_timeout=0.1,
        socket_timeout=0.1
    )
    _client.ping()
except Exception:
    _client = None

_fallback_job_store: dict[str, dict] = {}

def _job_key(job_id: str) -> str:
    return f"job:overdue-report:{job_id}"

def _safe_client_call(action, default=None):
    if _client is None:
        return default
    try:
        return action()
    except (redis.exceptions.ConnectionError, redis.exceptions.TimeoutError, OSError):
        return default

def _load_job_payload(job_id: str) -> dict | None:
    return _fallback_job_store.get(_job_key(job_id))

def _store_job_payload(job_id: str, payload: dict) -> None:
    _fallback_job_store[_job_key(job_id)] = payload

def create_job() -> str:
    """Registers a new pending job and returns its id."""
    job_id = str(uuid.uuid4())
    pending_payload = {"status": "pending"}
    _safe_client_call(
        lambda: _client.setex(_job_key(job_id), JOB_TTL_SECONDS, json.dumps(pending_payload))
    )
    _store_job_payload(job_id, pending_payload)
    return job_id

def get_job(job_id: str) -> dict | None:
    raw = _safe_client_call(lambda: _client.get(_job_key(job_id)))
    if raw is not None:
        return json.loads(raw)
    return _load_job_payload(job_id)

def _set_job_payload(job_id: str, payload: dict) -> None:
    _safe_client_call(lambda: _client.setex(_job_key(job_id), JOB_TTL_SECONDS, json.dumps(payload)))
    _store_job_payload(job_id, payload)

def _run_overdue_report(job_id: str) -> dict:
    session = SessionLocal()
    try:
        refresh_due_date_notifications(session)
        now = datetime.now(UTC).replace(tzinfo=None)
        overdue_loans = (
            session.execute(
                select(Loan).where(Loan.returned_at.is_(None), Loan.due_at < now)
            )
            .scalars()
            .all()
        )

        results = []
        for loan in overdue_loans:
            book = session.get(Book, loan.book_id)
            member = session.get(Member, loan.member_id)
            days_overdue = (now - loan.due_at).days
            results.append(
                {
                    "loan_id": str(loan.id),
                    "book_title": book.title if book else "unknown",
                    "member_email": member.email if member else "unknown",
                    "borrowed_at": loan.borrowed_at.isoformat(),
                    "days_overdue": days_overdue,
                }
            )
            print(
                f"[overdue-notification] {member.email if member else '?'} - "
                f"'{book.title if book else '?'}' is {days_overdue} day(s) overdue"
            )

        payload = {
            "status": "completed",
            "completed_at": datetime.now(UTC).isoformat(),
            "overdue_count": len(results),
            "overdue_loans": results,
        }
        _set_job_payload(job_id, payload)
        return payload
    except Exception as exc:
        payload = {"status": "failed", "error": str(exc)}
        _set_job_payload(job_id, payload)
        return payload
    finally:
        session.close()

def _create_notification(
    session, loan: Loan, recipient: User, notification_status: NotificationStatus
) -> None:
    """Create one notification event per loan/recipient/status. Enforces DB uniqueness."""
    exists = session.execute(
        select(Notification.id).where(
            Notification.loan_id == loan.id,
            Notification.recipient_user_id == recipient.id,
            Notification.status == notification_status,
        )
    ).scalar_one_or_none()
    if exists is None:
        notif = Notification(
            loan_id=loan.id,
            recipient_user_id=recipient.id,
            status=notification_status,
        )
        session.add(notif)
        session.flush() # populate ID field
        
        # Broadcast via SSE in real-time
        book = session.get(Book, loan.book_id)
        book_title = book.title if book else "Unknown book"
        sse_manager.broadcast(
            recipient.email,
            {
                "type": "notification",
                "id": str(notif.id),
                "loan_id": str(loan.id),
                "book_title": book_title,
                "status": notification_status.value,
                "message": f'"{book_title}" status update: {notification_status.value.replace("_", " ")}.',
                "created_at": datetime.now(UTC).isoformat()
            }
        )

def refresh_due_date_notifications(session) -> dict[str, int]:
    """Check due dates on active loans, updates loan status, and logs notifications."""
    today = datetime.now(UTC).replace(tzinfo=None).date()
    active_loans = session.execute(select(Loan).where(Loan.returned_at.is_(None))).scalars().all()
    created = 0
    for loan in active_loans:
        due_date = loan.due_at.date()
        if today > due_date:
            loan.status = LoanStatus.OVERDUE
            event = NotificationStatus.OVERDUE
        elif today == due_date:
            loan.status = LoanStatus.DUE_SOON
            event = NotificationStatus.DUE_TODAY
        elif today == due_date - timedelta(days=3):
            loan.status = LoanStatus.DUE_SOON
            event = NotificationStatus.DUE_SOON
        else:
            loan.status = LoanStatus.BORROWED
            event = None

        if event is None:
            continue
        before = len(session.new)
        member = session.get(Member, loan.member_id)
        if member:
            member_user = session.execute(
                select(User).where(User.email == member.email, User.role == UserRole.MEMBER, User.is_active, User.is_deleted == False)
            ).scalar_one_or_none()
            if member_user:
                _create_notification(session, loan, member_user, event)
        if event == NotificationStatus.OVERDUE:
            librarians = session.execute(
                select(User).where(User.role == UserRole.LIBRARIAN, User.is_active, User.is_deleted == False)
            ).scalars().all()
            for librarian in librarians:
                _create_notification(session, loan, librarian, event)
        created += len(session.new) - before
    session.commit()
    return {"notifications_created": created, "loans_checked": len(active_loans)}

def run_overdue_report(job_id: str) -> None:
    _run_overdue_report(job_id)

try:
    from celery import Celery
except ImportError:
    Celery = None

if Celery is not None:
    broker_url = os.environ.get("CELERY_BROKER_URL", REDIS_URL)
    if os.environ.get("RUNNING_IN_DOCKER") != "1":
        broker_url = broker_url.replace("://redis:", "://localhost:")

    if os.environ.get("PYTEST_CURRENT_TEST"):
        broker_url = "memory://"

    result_backend = os.environ.get("CELERY_RESULT_BACKEND") or "cache+memory://"
    if os.environ.get("PYTEST_CURRENT_TEST"):
        result_backend = "db+sqlite:///test.db"
    celery_app = Celery(
        "library_tasks",
        broker=broker_url,
        backend=result_backend,
        include=["app.jobs"],
    )
    celery_app.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
        task_track_started=True,
        task_always_eager=True if os.environ.get("PYTEST_CURRENT_TEST") else (os.environ.get("CELERY_TASK_ALWAYS_EAGER", "0").lower() in {"1", "true", "yes", "on"}),
        task_store_eager_result=True,
        beat_schedule={
            "check-loan-due-dates-hourly": {
                "task": "app.jobs.check_due_dates_task",
                "schedule": 3600.0,
            }
        },
    )

    @celery_app.task(name="app.jobs.run_overdue_report_task")
    def run_overdue_report_task(job_id: str) -> dict:
        return _run_overdue_report(job_id)

    @celery_app.task(name="app.jobs.check_due_dates_task")
    def check_due_dates_task() -> dict:
        session = SessionLocal()
        try:
            return refresh_due_date_notifications(session)
        finally:
            session.close()
else:
    _local_results: dict[str, dict] = {}

    class _LocalResult:
        def __init__(self, task_id: str, payload: dict | None):
            self.id = task_id
            self.state = "SUCCESS" if payload is not None else "PENDING"
            self.result = payload

    class _LocalTask:
        def delay(self, job_id: str):
            payload = _run_overdue_report(job_id)
            _local_results[job_id] = payload
            return _LocalResult(job_id, payload)

        def apply_async(self, job_id: str, *args, **kwargs):
            return self.delay(job_id)

        def AsyncResult(self, task_id: str):
            payload = _local_results.get(task_id)
            if payload is None:
                return _LocalResult(task_id, None)
            state = "SUCCESS" if payload.get("status") == "completed" else "FAILURE"
            return _LocalResult(task_id, payload if state == "SUCCESS" else payload)

    run_overdue_report_task = _LocalTask()
