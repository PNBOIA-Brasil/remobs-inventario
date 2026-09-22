"""Pedido de retirada, posse e eventos de devolução ou baixa.

Revision ID: 0004_withdrawal_custody
Revises: 0003_item_brand_model_idx
Create Date: 2026-09-22
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0004_withdrawal_custody"
down_revision = "0003_item_brand_model_idx"
branch_labels = None
depends_on = None

SCHEMA: str | None = None


def foreign_key(table: str, column: str = "id") -> str:
    if SCHEMA:
        return f"{SCHEMA}.{table}.{column}"
    return f"{table}.{column}"


def upgrade() -> None:
    op.create_table(
        "withdrawal_orders",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("requested_by_id", sa.Integer(), nullable=False),
        sa.Column("requested_by_username", sa.String(length=160), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=64), nullable=False),
        sa.Column("decided_by_id", sa.Integer(), nullable=True),
        sa.Column("decided_by_username", sa.String(length=160), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decision_reason", sa.Text(), nullable=True),
        sa.Column("delivered_by_id", sa.Integer(), nullable=True),
        sa.Column("delivered_by_username", sa.String(length=160), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivery_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        schema=SCHEMA,
    )
    op.create_index("ix_withdrawal_orders_status", "withdrawal_orders", ["status"], schema=SCHEMA)
    op.create_index("ix_withdrawal_orders_requested_by", "withdrawal_orders", ["requested_by_id"], schema=SCHEMA)

    op.create_table(
        "withdrawal_lines",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("order_id", sa.Uuid(), nullable=False),
        sa.Column("item_id", sa.Uuid(), nullable=False),
        sa.Column("from_location_id", sa.Uuid(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("reserved_quantity", sa.Integer(), nullable=False),
        sa.Column("delivered_quantity", sa.Integer(), nullable=False),
        sa.Column("returned_quantity", sa.Integer(), nullable=False),
        sa.Column("written_off_quantity", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=64), nullable=False),
        sa.ForeignKeyConstraint(["order_id"], [foreign_key("withdrawal_orders")]),
        sa.ForeignKeyConstraint(["item_id"], [foreign_key("inventory_items")]),
        sa.ForeignKeyConstraint(["from_location_id"], [foreign_key("locations")]),
        sa.PrimaryKeyConstraint("id"),
        schema=SCHEMA,
    )
    op.create_index("ix_withdrawal_lines_order_id", "withdrawal_lines", ["order_id"], schema=SCHEMA)
    op.create_index("ix_withdrawal_lines_item_id", "withdrawal_lines", ["item_id"], schema=SCHEMA)

    op.create_table(
        "custody_positions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("line_id", sa.Uuid(), nullable=False),
        sa.Column("order_id", sa.Uuid(), nullable=False),
        sa.Column("item_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(length=160), nullable=False),
        sa.Column("location_id", sa.Uuid(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["line_id"], [foreign_key("withdrawal_lines")]),
        sa.ForeignKeyConstraint(["order_id"], [foreign_key("withdrawal_orders")]),
        sa.ForeignKeyConstraint(["item_id"], [foreign_key("inventory_items")]),
        sa.ForeignKeyConstraint(["location_id"], [foreign_key("locations")]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("line_id", name="uq_custody_positions_line"),
        schema=SCHEMA,
    )

    op.create_table(
        "custody_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("line_id", sa.Uuid(), nullable=False),
        sa.Column("order_id", sa.Uuid(), nullable=False),
        sa.Column("item_id", sa.Uuid(), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("requested_by_id", sa.Integer(), nullable=False),
        sa.Column("requested_by_username", sa.String(length=160), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("decided_by_id", sa.Integer(), nullable=True),
        sa.Column("decided_by_username", sa.String(length=160), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decision_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["line_id"], [foreign_key("withdrawal_lines")]),
        sa.ForeignKeyConstraint(["order_id"], [foreign_key("withdrawal_orders")]),
        sa.ForeignKeyConstraint(["item_id"], [foreign_key("inventory_items")]),
        sa.PrimaryKeyConstraint("id"),
        schema=SCHEMA,
    )
    op.create_index("ix_custody_events_line_id", "custody_events", ["line_id"], schema=SCHEMA)
    op.create_index("ix_custody_events_order_id", "custody_events", ["order_id"], schema=SCHEMA)
    op.create_index("ix_custody_events_status", "custody_events", ["status"], schema=SCHEMA)

    with op.batch_alter_table("stock_movements", schema=SCHEMA) as batch:
        batch.add_column(sa.Column("withdrawal_order_id", sa.Uuid(), nullable=True))
        batch.add_column(sa.Column("withdrawal_line_id", sa.Uuid(), nullable=True))
        batch.create_foreign_key(
            "fk_stock_movements_withdrawal_order_id",
            "withdrawal_orders",
            ["withdrawal_order_id"],
            ["id"],
        )
        batch.create_foreign_key(
            "fk_stock_movements_withdrawal_line_id",
            "withdrawal_lines",
            ["withdrawal_line_id"],
            ["id"],
        )
        batch.create_index("ix_stock_movements_withdrawal_order_id", ["withdrawal_order_id"])
        batch.create_index("ix_stock_movements_withdrawal_line_id", ["withdrawal_line_id"])


def downgrade() -> None:
    with op.batch_alter_table("stock_movements", schema=SCHEMA) as batch:
        batch.drop_index("ix_stock_movements_withdrawal_line_id")
        batch.drop_index("ix_stock_movements_withdrawal_order_id")
        batch.drop_constraint("fk_stock_movements_withdrawal_line_id", type_="foreignkey")
        batch.drop_constraint("fk_stock_movements_withdrawal_order_id", type_="foreignkey")
        batch.drop_column("withdrawal_line_id")
        batch.drop_column("withdrawal_order_id")

    op.drop_index("ix_custody_events_status", table_name="custody_events", schema=SCHEMA)
    op.drop_index("ix_custody_events_order_id", table_name="custody_events", schema=SCHEMA)
    op.drop_index("ix_custody_events_line_id", table_name="custody_events", schema=SCHEMA)
    op.drop_table("custody_events", schema=SCHEMA)
    op.drop_table("custody_positions", schema=SCHEMA)
    op.drop_index("ix_withdrawal_lines_item_id", table_name="withdrawal_lines", schema=SCHEMA)
    op.drop_index("ix_withdrawal_lines_order_id", table_name="withdrawal_lines", schema=SCHEMA)
    op.drop_table("withdrawal_lines", schema=SCHEMA)
    op.drop_index("ix_withdrawal_orders_requested_by", table_name="withdrawal_orders", schema=SCHEMA)
    op.drop_index("ix_withdrawal_orders_status", table_name="withdrawal_orders", schema=SCHEMA)
    op.drop_table("withdrawal_orders", schema=SCHEMA)
