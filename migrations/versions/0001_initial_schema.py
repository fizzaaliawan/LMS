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
    op.create_table(
        "books",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("author", sa.String(255), nullable=False),
        sa.Column("isbn", sa.String(20), nullable=False, unique=True),
        sa.Column("available", sa.Boolean, nullable=False, server_default=sa.true()),
    )
    op.create_table(
        "members",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
    )
    op.create_table(
        "loans",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("book_id", sa.Integer, sa.ForeignKey("books.id"), nullable=False),
        sa.Column("member_id", sa.Integer, sa.ForeignKey("members.id"), nullable=False),
        sa.Column("borrowed_at", sa.DateTime, nullable=False),
        sa.Column("returned_at", sa.DateTime, nullable=True),
    )


def downgrade() -> None:
    op.drop_table("loans")
    op.drop_table("members")
    op.drop_table("books")
