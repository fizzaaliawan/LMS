import uuid
from typing import Generic, Type, TypeVar
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database.base_model import Base

ModelType = TypeVar("ModelType", bound=Base)

class BaseRepository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType]):
        self.model = model

    def get(self, db: Session, id: uuid.UUID) -> ModelType | None:
        """Fetch a record by UUID primary key, filtering out soft-deleted records."""
        query = select(self.model).where(self.model.id == id)
        if hasattr(self.model, "is_deleted"):
            query = query.where(self.model.is_deleted == False)
        return db.execute(query).scalar_one_or_none()

    def get_all(self, db: Session) -> list[ModelType]:
        """Fetch all records that are not soft-deleted."""
        query = select(self.model)
        if hasattr(self.model, "is_deleted"):
            query = query.where(self.model.is_deleted == False)
        return list(db.execute(query).scalars().all())

    def create(self, db: Session, obj: ModelType) -> ModelType:
        """Insert a new record in the database."""
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj

    def update(self, db: Session, db_obj: ModelType, update_data: dict) -> ModelType:
        """Update fields of an existing database object."""
        for field, value in update_data.items():
            if hasattr(db_obj, field):
                setattr(db_obj, field, value)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def soft_delete(self, db: Session, db_obj: ModelType) -> None:
        """Perform a soft delete by marking the record as deleted."""
        if hasattr(db_obj, "is_deleted"):
            setattr(db_obj, "is_deleted", True)
        elif hasattr(db_obj, "is_active"):
            setattr(db_obj, "is_active", False)
        db.commit()
