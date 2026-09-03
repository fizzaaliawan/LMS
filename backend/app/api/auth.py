import jwt
from fastapi import Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.config.config import settings
from app.api.deps import get_db
from app.models.user import User, UserRole
from app.repositories.user import user_repository

# Set auto_error=False so we can fall back to the query parameter if the header is missing
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    token_query: str | None = Query(None, alias="token"),
    db: Session = Depends(get_db),
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    actual_token = token or token_query
    if not actual_token:
        raise credentials_error

    try:
        payload = jwt.decode(actual_token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        email = payload.get("sub")
        if email is None:
            raise credentials_error
    except jwt.PyJWTError as e:
        raise credentials_error from e

    user = user_repository.get_by_email(db, email)
    if user is None or not user.is_active:
        raise credentials_error
    return user

def require_role(*allowed_roles: UserRole):
    """Dependency injection factory ensuring the user has one of the required roles."""
    def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {[r.value for r in allowed_roles]}",
            )
        return current_user
    return _check
