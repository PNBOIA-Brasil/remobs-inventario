"""Vincula a nota fiscal recebida a um pedido de aquisição.

Adiciona `acquisition_need_id` em `received_invoices` (sem FK, como `invoice_id`
em `stock_movements`): o app valida a necessidade ao registrar a entrada.

Revision ID: 0010_invoice_acquisition_need
Revises: 0009_received_invoices
Create Date: 2026-10-16
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0010_invoice_acquisition_need"
down_revision = "0009_received_invoices"
branch_labels = None
depends_on = None

SCHEMA: str | None = None


def upgrade() -> None:
    op.add_column("received_invoices", sa.Column("acquisition_need_id", sa.Uuid(), nullable=True), schema=SCHEMA)
    op.create_index(
        "ix_received_invoices_acquisition_need_id", "received_invoices", ["acquisition_need_id"], schema=SCHEMA
    )


def downgrade() -> None:
    op.drop_index("ix_received_invoices_acquisition_need_id", table_name="received_invoices", schema=SCHEMA)
    op.drop_column("received_invoices", "acquisition_need_id", schema=SCHEMA)
