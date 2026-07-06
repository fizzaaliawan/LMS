"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-07-03

"""
import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_books_title", "books", ["title"])
    op.create_index("ix_books_author", "books", ["author"])


def downgrade() -> None:
    op.drop_index("ix_books_author", table_name="books")
    op.drop_index("ix_books_title", table_name="books")
