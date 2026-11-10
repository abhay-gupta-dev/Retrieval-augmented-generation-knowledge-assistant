"""Add Razorpay billing ledger and reply balances.

Revision ID: 20261111_06
Revises: 20261106_05
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20261111_06"
down_revision = "20261106_05"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("free_replies_used", sa.Integer(), server_default="0", nullable=False))
    op.add_column("users", sa.Column("token_balance", sa.Integer(), server_default="0", nullable=False))
    op.add_column("users", sa.Column("subscription_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("subscription_period_started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("subscription_replies_used", sa.Integer(), server_default="0", nullable=False))
    op.create_table(
        "billing_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("gateway_order_id", sa.String(length=80), nullable=False),
        sa.Column("gateway_payment_id", sa.String(length=80), nullable=True),
        sa.Column("product_code", sa.String(length=40), nullable=False),
        sa.Column("amount_paise", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("buyer_name", sa.String(length=255), nullable=False),
        sa.Column("buyer_email", sa.String(length=320), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("gateway_order_id"),
        sa.UniqueConstraint("gateway_payment_id"),
    )
    op.create_index("ix_billing_orders_user_id", "billing_orders", ["user_id"])
    op.create_index("ix_billing_orders_gateway_order_id", "billing_orders", ["gateway_order_id"])
    op.create_index("ix_billing_orders_buyer_email", "billing_orders", ["buyer_email"])
    op.create_index("ix_billing_orders_status", "billing_orders", ["status"])


def downgrade() -> None:
    op.drop_index("ix_billing_orders_status", table_name="billing_orders")
    op.drop_index("ix_billing_orders_buyer_email", table_name="billing_orders")
    op.drop_index("ix_billing_orders_gateway_order_id", table_name="billing_orders")
    op.drop_index("ix_billing_orders_user_id", table_name="billing_orders")
    op.drop_table("billing_orders")
    op.drop_column("users", "subscription_replies_used")
    op.drop_column("users", "subscription_period_started_at")
    op.drop_column("users", "subscription_expires_at")
    op.drop_column("users", "token_balance")
    op.drop_column("users", "free_replies_used")
