"""Persist uploaded files with their document records.

Revision ID: 20261106_05
Revises: 20261105_04
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20261106_05"
down_revision = "20261105_04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("documents", sa.Column("file_data", sa.LargeBinary(), nullable=True))
    op.add_column("chat_messages", sa.Column("attachment_document_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index("ix_chat_messages_attachment_document_id", "chat_messages", ["attachment_document_id"])
    op.create_foreign_key(
        "fk_chat_messages_attachment_document_id_documents",
        "chat_messages",
        "documents",
        ["attachment_document_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_chat_messages_attachment_document_id_documents", "chat_messages", type_="foreignkey")
    op.drop_index("ix_chat_messages_attachment_document_id", table_name="chat_messages")
    op.drop_column("chat_messages", "attachment_document_id")
    op.drop_column("documents", "file_data")
