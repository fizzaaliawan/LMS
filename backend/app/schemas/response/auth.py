import uuid
from pydantic import BaseModel
from app.models.user import UserRole

class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    role: UserRole
    is_active: bool

    model_config = {"from_attributes": True}

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
