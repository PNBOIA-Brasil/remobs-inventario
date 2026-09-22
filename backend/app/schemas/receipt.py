from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.inventory import StockMovementRead


class ReceiptLineCreate(BaseModel):
    item_id: uuid.UUID
    quantity: int = Field(gt=0)


class ReceiptCreate(BaseModel):
    origin: Literal["compra", "doacao", "transferencia"]
    document: str | None = Field(default=None, max_length=160)
    location_id: uuid.UUID
    notes: str | None = None
    lines: list[ReceiptLineCreate] = Field(min_length=1)


class ReceiptRead(BaseModel):
    movements: list[StockMovementRead]
    total_quantity: int
