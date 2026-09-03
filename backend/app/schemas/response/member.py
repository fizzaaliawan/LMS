import uuid
from pydantic import BaseModel

class MemberOut(BaseModel):
    id: uuid.UUID
    name: str
    email: str

    model_config = {"from_attributes": True}
