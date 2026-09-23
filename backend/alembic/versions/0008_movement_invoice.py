"""Nota fiscal ligada ao movimento de entrada.

Revision ID: 0008_movement_invoice
Revises: 0007_item_patrimony_unique
Create Date: 2026-09-23
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0008_movement_invoice"
down_revision = "0007_item_patrimony_unique"
branch_labels = None
depends_on = None

SCHEMA: str | None = None


def upgrade() -> None:
    # Sem FK: os arquivos da nota ficam em entity_files com entity_type = "invoice" e entity_id = este id.
    op.add_column("stock_movements", sa.Column("invoice_id", sa.Uuid(), nullable=True), schema=SCHEMA)
    op.create_index("ix_stock_movements_invoice_id", "stock_movements", ["invoice_id"], schema=SCHEMA)


def downgrade() -> None:
    op.drop_index("ix_stock_movements_invoice_id", table_name="stock_movements", schema=SCHEMA)
    op.drop_column("stock_movements", "invoice_id", schema=SCHEMA)
