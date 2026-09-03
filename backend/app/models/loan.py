import enum
import uuid
from datetime import datetime, UTC
from sqlalchemy import ForeignKey, DateTime, Integer, Boolean, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base_model import Base

class LoanStatus(enum.StrEnum):
    BORROWED = "borrowed"
    DUE_SOON = "due_soon"
    OVERDUE = "overdue"
    RETURNED = "returned"

class Loan(Base):
    __tablename__ = "loans"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    book_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("books.id"), nullable=False)
    member_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("members.id"), nullable=False)
    borrowed_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None))
    due_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    loan_duration_days: Mapped[int] = mapped_column(Integer, nullable=False, default=14)
    is_custom_due_date: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    returned_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[LoanStatus] = mapped_column(
        Enum(LoanStatus, name="loan_status", values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        default=LoanStatus.BORROWED,
        nullable=False,
    )
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    book: Mapped["Book"] = relationship(back_populates="loans")
    member: Mapped["Member"] = relationship(back_populates="loans")
    notifications: Mapped[list["Notification"]] = relationship(back_populates="loan")
