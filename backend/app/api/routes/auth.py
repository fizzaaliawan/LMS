from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.schemas.request.auth import UserSignup, SSOLoginRequest
from app.schemas.response.auth import UserOut, Token
from app.services.auth import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def signup(payload: UserSignup, db: Session = Depends(get_db)):
    return auth_service.signup(db, payload.email, payload.password, payload.role)

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # OAuth2PasswordRequestForm maps "username" field to email
    token = auth_service.login(db, form_data.username, form_data.password)
    return Token(access_token=token)

@router.post("/sso", response_model=Token)
def sso_login(payload: SSOLoginRequest, db: Session = Depends(get_db)):
    """Simulated SSO One-Click Login endpoint."""
    token = auth_service.sso_login(db, payload.email, payload.name, payload.provider)
    return Token(access_token=token)

@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user
