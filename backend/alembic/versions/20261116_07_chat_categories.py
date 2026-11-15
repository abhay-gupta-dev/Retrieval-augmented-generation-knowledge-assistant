"""Separate medical information conversations from standard chat history.

Revision ID: 20261116_07
Revises: 20261111_06
"""

import sqlalchemy as sa
from alembic import op

revision = "20261116_07"
down_revision = "20261111_06"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "chat_sessions",
        sa.Column("category", sa.String(length=24), server_default="general", nullable=False),
    )
    op.create_index("ix_chat_sessions_category", "chat_sessions", ["category"])


def downgrade() -> None:
    op.drop_index("ix_chat_sessions_category", table_name="chat_sessions")
    op.drop_column("chat_sessions", "category")
