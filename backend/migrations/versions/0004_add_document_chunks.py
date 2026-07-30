"""add document chunks (RAG embeddings)

Revision ID: 0004_add_document_chunks
Revises: 0003_add_workspace_owner
Create Date: 2026-07-29
"""

from alembic import op
import sqlalchemy as sa


revision = "0004_add_document_chunks"
down_revision = "0003_add_workspace_owner"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "document_chunks",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("document_id", sa.String(length=36), nullable=False),
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("content", sa.Text(), nullable=False),
        # JSON-encoded list[float] embedding vector, stored as text for portability.
        sa.Column("embedding", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_document_chunks_document_id", "document_chunks", ["document_id"])
    op.create_index("ix_document_chunks_session_id", "document_chunks", ["session_id"])


def downgrade() -> None:
    op.drop_index("ix_document_chunks_session_id", table_name="document_chunks")
    op.drop_index("ix_document_chunks_document_id", table_name="document_chunks")
    op.drop_table("document_chunks")
