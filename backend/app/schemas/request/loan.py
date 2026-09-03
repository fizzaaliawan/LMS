import uuid
from pydantic import BaseModel

class LoanCreate(BaseModel):
    book_id: uuid.UUID
    member_id: uuid.UUID | None = None

