import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.api.auth import get_current_user
from app.api.deps import get_db
from app.models.book import Book
from app.models.loan import Loan
from app.models.member import Member
from app.models.notification import Notification, NotificationStatus
from app.schemas.response.notification import NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])

def _serialize(notification: Notification, db: Session, include_borrower: bool) -> NotificationOut:
    loan = db.get(Loan, notification.loan_id)
    book = db.get(Book, loan.book_id) if loan else None
    member = db.get(Member, loan.member_id) if loan and include_borrower else None
    title = book.title if book else "Unknown book"

    messages = {
        NotificationStatus.DUE_SOON: f'"{title}" is due in 3 days.',
        NotificationStatus.DUE_TODAY: f'"{title}" is due today.',
        NotificationStatus.OVERDUE: f'"{title}" is overdue.',
    }

    return NotificationOut(
        id=notification.id,
        loan_id=notification.loan_id,
        book_title=title,
        borrower_name=member.name if member else None,
        due_at=loan.due_at if loan else notification.created_at,
        status=notification.status,
        message=messages.get(notification.status, f'"{title}" status update.'),
        is_read=notification.is_read,
        created_at=notification.created_at,
    )

@router.get("", response_model=list[NotificationOut])
def list_notifications(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    notifications = (
        db.execute(
            select(Notification)
            .where(
                Notification.recipient_user_id == current_user.id,
                Notification.is_deleted == False
            )
            .order_by(Notification.created_at.desc())
        )
        .scalars()
        .all()
    )
    return [_serialize(item, db, current_user.role.value == "librarian") for item in notifications]

@router.get("/unread-count")
def unread_notification_count(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    count = db.scalar(
        select(func.count(Notification.id)).where(
            Notification.recipient_user_id == current_user.id,
            Notification.is_read.is_(False),
            Notification.is_deleted == False
        )
    )
    return {"count": count or 0}

@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    notification = db.get(Notification, notification_id)
    if not notification or notification.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
        
    if notification.recipient_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your notification")

    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return _serialize(notification, db, current_user.role.value == "librarian")

@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_notifications_read(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    notifications = (
        db.execute(
            select(Notification).where(
                Notification.recipient_user_id == current_user.id,
                Notification.is_read.is_(False),
                Notification.is_deleted == False
            )
        )
        .scalars()
        .all()
    )
    for notification in notifications:
        notification.is_read = True
    db.commit()
