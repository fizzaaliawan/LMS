import uuid
from datetime import datetime
from pydantic import BaseModel
from app.models.loan import LoanStatus

class LoanOut(BaseModel):
    id: uuid.UUID
    book_id: uuid.UUID
    member_id: uuid.UUID
    borrowed_at: datetime
    due_at: datetime
    returned_at: datetime | None
    status: LoanStatus

    model_config = {"from_attributes": True}
