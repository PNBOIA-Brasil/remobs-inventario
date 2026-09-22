"""Finalidade, prazo de devolução e plataforma de destino no pedido de retirada.

Revision ID: 0005_withdrawal_purpose
Revises: 0004_withdrawal_custody
Create Date: 2026-09-22
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0005_withdrawal_purpose"
down_revision = "0004_withdrawal_custody"
branch_labels = None
depends_on = None

SCHEMA: str | None = None


def foreign_key(table: str, column: str = "id") -> str:
    if SCHEMA:
        return f"{SCHEMA}.{table}.{column}"
    return f"{table}.{column}"


def upgrade() -> None:
    with op.batch_alter_table("withdrawal_orders", schema=SCHEMA) as batch:
        batch.add_column(sa.Column("purpose", sa.String(length=32), server_default="consumo", nullable=False))
        batch.add_column(sa.Column("due_date", sa.Date(), nullable=True))
        batch.add_column(sa.Column("platform_id", sa.Uuid(), nullable=True))
        batch.create_foreign_key("fk_withdrawal_orders_platform_id", "platforms", ["platform_id"], ["id"], referent_schema=SCHEMA)
        batch.create_index("ix_withdrawal_orders_due_date", ["due_date"])


def downgrade() -> None:
    with op.batch_alter_table("withdrawal_orders", schema=SCHEMA) as batch:
        batch.drop_index("ix_withdrawal_orders_due_date")
        batch.drop_constraint("fk_withdrawal_orders_platform_id", type_="foreignkey")
        batch.drop_column("platform_id")
        batch.drop_column("due_date")
        batch.drop_column("purpose")
