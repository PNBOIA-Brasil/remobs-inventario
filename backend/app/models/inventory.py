from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Uuid

from app.core.database import Base, table_ref


class InventoryCategory(Base):
    __tablename__ = "inventory_categories"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(160), nullable=False, unique=True, index=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Location(Base):
    __tablename__ = "locations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(160), nullable=False, unique=True, index=True)
    location_type: Mapped[str] = mapped_column(String(64), default="estoque", nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(table_ref("inventory_categories")),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(240), nullable=False, index=True)
    brand: Mapped[str | None] = mapped_column(String(160), nullable=True, index=True)
    model: Mapped[str | None] = mapped_column(String(160), nullable=True, index=True)
    serial_number: Mapped[str | None] = mapped_column(String(160), nullable=True, index=True)
    # Único; a API gera REM-000001… quando o cadastro não informa (migração 0007).
    patrimony_number: Mapped[str | None] = mapped_column(String(160), nullable=True, unique=True, index=True)
    invoice_number: Mapped[str | None] = mapped_column(String(160), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    condition_status: Mapped[str] = mapped_column(String(64), default="operacional", nullable=False, index=True)
    current_location_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(table_ref("locations")),
        nullable=True,
        index=True,
    )
    unit: Mapped[str] = mapped_column(String(32), default="un", nullable=False)
    minimum_stock_national: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    minimum_stock_import: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    minimum_stock_maintenance: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ideal_stock: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False, index=True)
    row_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class StockBalance(Base):
    __tablename__ = "stock_balances"
    __table_args__ = (UniqueConstraint("item_id", "location_id", name="uq_stock_balances_item_location"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey(table_ref("inventory_items")), index=True)
    location_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey(table_ref("locations")), index=True)
    quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reserved_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey(table_ref("inventory_items")), index=True)
    movement_type: Mapped[str] = mapped_column(String(64), default="saida", nullable=False, index=True)
    from_location_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), ForeignKey(table_ref("locations")), nullable=True)
    to_location_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), ForeignKey(table_ref("locations")), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    requested_by_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    requested_by_username: Mapped[str] = mapped_column(String(160), nullable=False)
    approved_by_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    approved_by_username: Mapped[str | None] = mapped_column(String(160), nullable=True)
    status: Mapped[str] = mapped_column(String(64), default="pending", nullable=False, index=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    decision_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    withdrawal_order_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(table_ref("withdrawal_orders")),
        nullable=True,
    )
    withdrawal_line_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(table_ref("withdrawal_lines")),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
