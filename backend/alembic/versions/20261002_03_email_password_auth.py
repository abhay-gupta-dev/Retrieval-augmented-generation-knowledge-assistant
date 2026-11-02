"""Add password_hash column and make google_id nullable for email/password authentication.

Revision ID: 20261002_03
Revises: 20260922_02
Create Date: 2026-10-02
"""

import sqlalchemy as sa
from alembic import op

revision = "20261002_03"
down_revision = "20260922_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("users", "google_id", existing_type=sa.String(length=255), nullable=True)
    op.add_column("users", sa.Column("password_hash", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "password_hash")
    op.alter_column("users", "google_id", existing_type=sa.String(length=255), nullable=False)
