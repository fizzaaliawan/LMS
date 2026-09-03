import enum
import uuid
from datetime import datetime, UTC
from sqlalchemy import ForeignKey, DateTime, Boolean, Enum, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base_model import Base

class NotificationStatus(enum.StrEnum):
    DUE_SOON = "due_soon"
    DUE_TODAY = "due_today"
    OVERDUE = "overdue"

class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        UniqueConstraint("loan_id", "recipient_user_id", "status", name="uq_notification_event"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    loan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("loans.id"), nullable=False)
    recipient_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[NotificationStatus] = mapped_column(
        Enum(NotificationStatus, name="notification_status", values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
    )
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None), nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    loan: Mapped["Loan"] = relationship(back_populates="notifications")
    recipient: Mapped["User"] = relationship(back_populates="notifications")
