import enum
import uuid
from sqlalchemy import String, Enum, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base_model import Base

class UserRole(enum.StrEnum):
    LIBRARIAN = "librarian"
    MEMBER = "member"

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(
            UserRole,
            name="user_role",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=UserRole.MEMBER,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    notifications: Mapped[list["Notification"]] = relationship(back_populates="recipient")
