"""Consolidated initial schema with UUIDs

Revision ID: 0001
Revises:
Create Date: 2026-07-14
"""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Create books table
    op.create_table(
        "books",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("author", sa.String(length=255), nullable=False),
        sa.Column("isbn", sa.String(length=20), nullable=False),
        sa.Column("available", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("isbn")
    )
    op.create_index("ix_books_title", "books", ["title"])
    op.create_index("ix_books_author", "books", ["author"])

    # 2. Create members table
    op.create_table(
        "members",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email")
    )

    # 3. Create users table
    op.create_table(
        "users",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("role", sa.Enum("librarian", "member", name="user_role"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email")
    )

    # 4. Create loans table
    op.create_table(
        "loans",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("book_id", sa.UUID(), nullable=False),
        sa.Column("member_id", sa.UUID(), nullable=False),
        sa.Column("borrowed_at", sa.DateTime(), nullable=False),
        sa.Column("due_at", sa.DateTime(), nullable=False),
        sa.Column("loan_duration_days", sa.Integer(), server_default="14", nullable=False),
        sa.Column("is_custom_due_date", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("returned_at", sa.DateTime(), nullable=True),
        sa.Column("status", sa.Enum("borrowed", "due_soon", "overdue", "returned", name="loan_status"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"]),
        sa.ForeignKeyConstraint(["member_id"], ["members.id"]),
        sa.PrimaryKeyConstraint("id")
    )

    # 5. Create notifications table
    op.create_table(
        "notifications",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("loan_id", sa.UUID(), nullable=False),
        sa.Column("recipient_user_id", sa.UUID(), nullable=False),
        sa.Column("status", sa.Enum("due_soon", "due_today", "overdue", name="notification_status"), nullable=False),
        sa.Column("is_read", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.ForeignKeyConstraint(["loan_id"], ["loans.id"]),
        sa.ForeignKeyConstraint(["recipient_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("loan_id", "recipient_user_id", "status", name="uq_notification_event")
    )


def downgrade() -> None:
    op.drop_table("notifications")
    op.drop_table("loans")
    op.drop_table("users")
    op.drop_table("members")
    op.drop_index("ix_books_author", table_name="books")
    op.drop_index("ix_books_title", table_name="books")
    op.drop_table("books")
    
    # Drop custom enums
    sa.Enum(name="user_role").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="loan_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="notification_status").drop(op.get_bind(), checkfirst=True)