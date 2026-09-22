from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Uuid

from app.core.database import Base, table_ref


class WithdrawalOrder(Base):
    __tablename__ = "withdrawal_orders"
    __table_args__ = (
        Index("ix_withdrawal_orders_status", "status"),
        Index("ix_withdrawal_orders_requested_by", "requested_by_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    requested_by_id: Mapped[int] = mapped_column(Integer, nullable=False)
    requested_by_username: Mapped[str] = mapped_column(String(160), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(64), default="pending_approval", nullable=False)
    # consumo | emprestimo (exige due_date) | plataforma (exige platform_id)
    purpose: Mapped[str] = mapped_column(String(32), default="consumo", server_default="consumo", nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    platform_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), ForeignKey(table_ref("platforms")), nullable=True)
    decided_by_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    decided_by_username: Mapped[str | None] = mapped_column(String(160), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decision_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    delivered_by_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    delivered_by_username: Mapped[str | None] = mapped_column(String(160), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivery_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class WithdrawalLine(Base):
    __tablename__ = "withdrawal_lines"
    __table_args__ = (
        Index("ix_withdrawal_lines_order_id", "order_id"),
        Index("ix_withdrawal_lines_item_id", "item_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey(table_ref("withdrawal_orders")), nullable=False)
    item_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey(table_ref("inventory_items")), nullable=False)
    from_location_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey(table_ref("locations")), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    reserved_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    delivered_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    returned_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    written_off_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(64), default="pending", nullable=False)


class CustodyPosition(Base):
    __tablename__ = "custody_positions"
    __table_args__ = (UniqueConstraint("line_id", name="uq_custody_positions_line"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    line_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey(table_ref("withdrawal_lines")), nullable=False)
    order_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey(table_ref("withdrawal_orders")), nullable=False)
    item_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey(table_ref("inventory_items")), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False)
    username: Mapped[str] = mapped_column(String(160), nullable=False)
    location_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey(table_ref("locations")), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class CustodyEvent(Base):
    __tablename__ = "custody_events"
    __table_args__ = (
        Index("ix_custody_events_line_id", "line_id"),
        Index("ix_custody_events_order_id", "order_id"),
        Index("ix_custody_events_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    line_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey(table_ref("withdrawal_lines")), nullable=False)
    order_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey(table_ref("withdrawal_orders")), nullable=False)
    item_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey(table_ref("inventory_items")), nullable=False)
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    requested_by_id: Mapped[int] = mapped_column(Integer, nullable=False)
    requested_by_username: Mapped[str] = mapped_column(String(160), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    decided_by_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    decided_by_username: Mapped[str | None] = mapped_column(String(160), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decision_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
