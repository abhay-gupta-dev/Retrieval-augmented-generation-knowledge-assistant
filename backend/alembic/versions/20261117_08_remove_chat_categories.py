"""Remove the temporary chat category used by the retired Medical AI page.

Revision ID: 20261117_08
Revises: 20261116_07
"""

import sqlalchemy as sa
from alembic import op

revision = "20261117_08"
down_revision = "20261116_07"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("chat_sessions")}
    if "category" not in columns:
        return
    indexes = {index["name"] for index in inspector.get_indexes("chat_sessions")}
    if "ix_chat_sessions_category" in indexes:
        op.drop_index("ix_chat_sessions_category", table_name="chat_sessions")
    op.drop_column("chat_sessions", "category")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("chat_sessions")}
    if "category" in columns:
        return
    op.add_column(
        "chat_sessions",
        sa.Column("category", sa.String(length=24), server_default="general", nullable=False),
    )
    op.create_index("ix_chat_sessions_category", "chat_sessions", ["category"])
