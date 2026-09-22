from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Uuid

from app.core.database import Base, table_ref

OPEN_ACQUISITION_STATUSES = ("sugerida", "aprovada", "em_compra")


class AcquisitionNeed(Base):
    """Necessidade de aquisição: sugerida pelo mínimo de estoque ou aberta à mão, baixada pela entrada."""

    __tablename__ = "acquisition_needs"
    __table_args__ = (
        Index("ix_acquisition_needs_status", "status"),
        Index("ix_acquisition_needs_item_id", "item_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey(table_ref("inventory_items")), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    received_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # sugerida -> aprovada -> em_compra -> atendida; qualquer aberta -> cancelada
    status: Mapped[str] = mapped_column(String(32), default="sugerida", nullable=False)
    priority: Mapped[str] = mapped_column(String(16), default="media", nullable=False)
    origin: Mapped[str] = mapped_column(String(16), default="manual", nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    process_number: Mapped[str | None] = mapped_column(String(80), nullable=True)
    expected_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_by_username: Mapped[str | None] = mapped_column(String(160), nullable=True)
    updated_by_username: Mapped[str | None] = mapped_column(String(160), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
