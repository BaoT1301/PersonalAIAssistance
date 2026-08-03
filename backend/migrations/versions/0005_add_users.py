"""add users (native authentication)

Revision ID: 0005_add_users
Revises: 0004_add_document_chunks
Create Date: 2026-07-29
"""

from alembic import op
import sqlalchemy as sa


revision = "0005_add_users"
down_revision = "0004_add_document_chunks"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("username", sa.String(length=120), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")
