import uuid
from pydantic import BaseModel

class BookOut(BaseModel):
    id: uuid.UUID
    title: str
    author: str
    isbn: str
    available: bool
    is_active: bool

    model_config = {"from_attributes": True}
