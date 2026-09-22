"""Necessidades de aquisição.

Revision ID: 0006_acquisition_needs
Revises: 0005_withdrawal_purpose
Create Date: 2026-09-22
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0006_acquisition_needs"
down_revision = "0005_withdrawal_purpose"
branch_labels = None
depends_on = None

SCHEMA: str | None = None


def foreign_key(table: str, column: str = "id") -> str:
    if SCHEMA:
        return f"{SCHEMA}.{table}.{column}"
    return f"{table}.{column}"


def upgrade() -> None:
    op.create_table(
        "acquisition_needs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("item_id", sa.Uuid(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("received_quantity", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("priority", sa.String(length=16), nullable=False),
        sa.Column("origin", sa.String(length=16), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("process_number", sa.String(length=80), nullable=True),
        sa.Column("expected_date", sa.Date(), nullable=True),
        sa.Column("created_by_username", sa.String(length=160), nullable=True),
        sa.Column("updated_by_username", sa.String(length=160), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["item_id"], [foreign_key("inventory_items")]),
        sa.PrimaryKeyConstraint("id"),
        schema=SCHEMA,
    )
    op.create_index("ix_acquisition_needs_status", "acquisition_needs", ["status"], schema=SCHEMA)
    op.create_index("ix_acquisition_needs_item_id", "acquisition_needs", ["item_id"], schema=SCHEMA)


def downgrade() -> None:
    op.drop_index("ix_acquisition_needs_item_id", table_name="acquisition_needs", schema=SCHEMA)
    op.drop_index("ix_acquisition_needs_status", table_name="acquisition_needs", schema=SCHEMA)
    op.drop_table("acquisition_needs", schema=SCHEMA)
