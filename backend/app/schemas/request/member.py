from pydantic import BaseModel, EmailStr, Field

class MemberCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr

class MemberUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None
