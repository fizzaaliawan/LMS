from pydantic import BaseModel, EmailStr, Field
from app.models.user import UserRole

class UserSignup(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = UserRole.MEMBER

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class SSOLoginRequest(BaseModel):
    email: EmailStr
    name: str
    provider: str = "google"
