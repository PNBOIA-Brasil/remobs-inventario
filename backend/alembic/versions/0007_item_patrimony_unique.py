"""Número patrimonial único em todo item.

Preenche `REM-000001`, `REM-000002`… nos itens sem patrimônio (ordem de cadastro)
e cria índice único. Patrimônios já preenchidos ficam como estão; duplicados
interrompem a migração para correção manual.

Revision ID: 0007_item_patrimony_unique
Revises: 0006_acquisition_needs
Create Date: 2026-09-23
"""

from __future__ import annotations

import re

import sqlalchemy as sa
from alembic import op


revision = "0007_item_patrimony_unique"
down_revision = "0006_acquisition_needs"
branch_labels = None
depends_on = None

SCHEMA: str | None = None
PREFIX = "REM-"


def upgrade() -> None:
    items = sa.table(
        "inventory_items",
        sa.column("id", sa.Uuid()),
        sa.column("patrimony_number", sa.String()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        schema=SCHEMA,
    )
    bind = op.get_bind()

    duplicates = bind.execute(
        sa.select(items.c.patrimony_number)
        .where(items.c.patrimony_number.is_not(None), sa.func.trim(items.c.patrimony_number) != "")
        .group_by(items.c.patrimony_number)
        .having(sa.func.count() > 1)
    ).scalars().all()
    if duplicates:
        raise RuntimeError(f"Patrimônios duplicados, corrija antes de migrar: {sorted(duplicates)}")

    used = bind.execute(sa.select(items.c.patrimony_number).where(items.c.patrimony_number.like(f"{PREFIX}%"))).scalars()
    last = max((int(value[len(PREFIX):]) for value in used if re.fullmatch(rf"{PREFIX}\d{{6}}", value)), default=0)

    missing = bind.execute(
        sa.select(items.c.id)
        .where(sa.or_(items.c.patrimony_number.is_(None), sa.func.trim(items.c.patrimony_number) == ""))
        .order_by(items.c.created_at, items.c.id)
    ).scalars().all()
    for offset, item_id in enumerate(missing, start=1):
        bind.execute(items.update().where(items.c.id == item_id).values(patrimony_number=f"{PREFIX}{last + offset:06d}"))

    op.create_index(
        "ix_inventory_items_patrimony_number",
        "inventory_items",
        ["patrimony_number"],
        unique=True,
        schema=SCHEMA,
    )


def downgrade() -> None:
    # Os números gerados ficam: patrimônio já pode estar impresso em etiqueta.
    op.drop_index("ix_inventory_items_patrimony_number", table_name="inventory_items", schema=SCHEMA)
