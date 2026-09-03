import uuid
from datetime import datetime
from pydantic import BaseModel
from app.models.notification import NotificationStatus

class NotificationOut(BaseModel):
    id: uuid.UUID
    loan_id: uuid.UUID
    book_title: str
    borrower_name: str | None = None
    due_at: datetime
    status: NotificationStatus
    message: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}
