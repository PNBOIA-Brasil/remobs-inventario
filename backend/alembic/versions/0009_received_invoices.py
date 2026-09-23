"""Notas fiscais recebidas.

Cria `received_invoices` com o cabeçalho conferido da nota e preenche uma linha
para cada `invoice_id` já usado em entradas (sem cabeçalho; o número vem do
texto do movimento quando possível).

Revision ID: 0009_received_invoices
Revises: 0008_movement_invoice
Create Date: 2026-09-23
"""

from __future__ import annotations

import re

import sqlalchemy as sa
from alembic import op


revision = "0009_received_invoices"
down_revision = "0008_movement_invoice"
branch_labels = None
depends_on = None

SCHEMA: str | None = None


def foreign_key(table: str, column: str = "id") -> str:
    if SCHEMA:
        return f"{SCHEMA}.{table}.{column}"
    return f"{table}.{column}"


def upgrade() -> None:
    invoices = op.create_table(
        "received_invoices",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("number", sa.String(length=60), nullable=True),
        sa.Column("series", sa.String(length=20), nullable=True),
        sa.Column("supplier_name", sa.String(length=240), nullable=True),
        sa.Column("supplier_cnpj", sa.String(length=32), nullable=True),
        sa.Column("issue_date", sa.Date(), nullable=True),
        sa.Column("total_value", sa.Numeric(14, 2), nullable=True),
        sa.Column("access_key", sa.String(length=60), nullable=True),
        sa.Column("origin", sa.String(length=32), nullable=True),
        sa.Column("location_id", sa.Uuid(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("received_by_id", sa.Integer(), nullable=False),
        sa.Column("received_by_username", sa.String(length=160), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["location_id"], [foreign_key("locations")]),
        sa.PrimaryKeyConstraint("id"),
        schema=SCHEMA,
    )
    for column in ("number", "supplier_name", "supplier_cnpj", "access_key", "received_at"):
        op.create_index(f"ix_received_invoices_{column}", "received_invoices", [column], schema=SCHEMA)

    movements = sa.table(
        "stock_movements",
        sa.column("invoice_id", sa.Uuid()),
        sa.column("to_location_id", sa.Uuid()),
        sa.column("requested_by_id", sa.Integer()),
        sa.column("requested_by_username", sa.String()),
        sa.column("reason", sa.Text()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        schema=SCHEMA,
    )
    bind = op.get_bind()
    seen: set = set()
    rows = bind.execute(sa.select(movements).where(movements.c.invoice_id.is_not(None)).order_by(movements.c.created_at)).all()
    for row in rows:
        if row.invoice_id in seen:
            continue
        seen.add(row.invoice_id)
        number = re.search(r"NF (\S+)", row.reason or "")
        bind.execute(
            invoices.insert().values(
                id=row.invoice_id,
                number=number.group(1) if number else None,
                location_id=row.to_location_id,
                notes=row.reason,
                received_by_id=row.requested_by_id,
                received_by_username=row.requested_by_username,
                received_at=row.created_at,
            )
        )


def downgrade() -> None:
    for column in ("number", "supplier_name", "supplier_cnpj", "access_key", "received_at"):
        op.drop_index(f"ix_received_invoices_{column}", table_name="received_invoices", schema=SCHEMA)
    op.drop_table("received_invoices", schema=SCHEMA)
