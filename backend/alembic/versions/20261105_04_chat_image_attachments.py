"""Store image attachments on chat messages.

Revision ID: 20261105_04
Revises: 20261002_03
"""

import sqlalchemy as sa
from alembic import op

revision = "20261105_04"
down_revision = "20261002_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("chat_messages", sa.Column("attachment_data", sa.LargeBinary(), nullable=True))
    op.add_column("chat_messages", sa.Column("attachment_content_type", sa.String(length=100), nullable=True))
    op.add_column("chat_messages", sa.Column("attachment_filename", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("chat_messages", "attachment_filename")
    op.drop_column("chat_messages", "attachment_content_type")
    op.drop_column("chat_messages", "attachment_data")
