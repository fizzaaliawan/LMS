import uuid
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.models.member import Member
from app.repositories.user import user_repository
from app.repositories.member import member_repository
from app.core.security import hash_password, verify_password, create_access_token

class AuthService:
    def signup(self, db: Session, email: str, password: str, role: UserRole) -> User:
        """Create a new user. If the role is member, also register a patron member profile."""
        existing = user_repository.get_by_email(db, email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered"
            )

        hashed = hash_password(password)
        user = User(email=email, hashed_password=hashed, role=role)
        user_repository.create(db, user)

        if role == UserRole.MEMBER:
            existing_member = member_repository.get_by_email(db, email)
            if not existing_member:
                name_prefix = email.split("@")[0].replace(".", " ").title()
                member = Member(name=name_prefix, email=email)
                member_repository.create(db, member)

        return user

    def login(self, db: Session, email: str, password: str) -> str:
        """Verify password credentials and issue a JWT access token."""
        user = user_repository.get_by_email(db, email)
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is deactivated",
            )
        return create_access_token(subject=user.email)

    def sso_login(self, db: Session, email: str, name: str, provider: str) -> str:
        """Simulated one-click SSO login (e.g. Google, GitHub).
        Auto-registers user and member records if they do not exist.
        """
        # Search for user
        user = user_repository.get_by_email(db, email)
        if not user:
            # Generate random password for SSO-created accounts
            import secrets
            rand_pwd = secrets.token_hex(16)
            hashed = hash_password(rand_pwd)
            # Default to MEMBER role for SSO
            user = User(email=email, hashed_password=hashed, role=UserRole.MEMBER)
            user_repository.create(db, user)

            # Auto-create member profile
            existing_member = member_repository.get_by_email(db, email)
            if not existing_member:
                member = Member(name=name, email=email)
                member_repository.create(db, member)

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="SSO authenticated user account is deactivated",
            )

        return create_access_token(subject=user.email)

auth_service = AuthService()
