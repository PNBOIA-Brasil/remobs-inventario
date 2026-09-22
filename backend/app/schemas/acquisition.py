from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

Priority = Literal["alta", "media", "baixa"]
Status = Literal["sugerida", "aprovada", "em_compra", "atendida", "cancelada"]


class AcquisitionCreate(BaseModel):
    item_id: uuid.UUID
    quantity: int = Field(gt=0)
    priority: Priority = "media"
    reason: str = Field(min_length=3)


class AcquisitionUpdate(BaseModel):
    status: Status | None = None
    quantity: int | None = Field(default=None, gt=0)
    priority: Priority | None = None
    process_number: str | None = Field(default=None, max_length=80)
    expected_date: date | None = None
    reason: str = Field(min_length=3)


class AcquisitionRead(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    item_name: str
    item_unit: str
    stock_total: int
    quantity: int
    received_quantity: int
    status: str
    priority: str
    origin: str
    reason: str | None
    process_number: str | None
    expected_date: date | None
    created_by_username: str | None
    updated_by_username: str | None
    created_at: datetime
    updated_at: datetime


class AcquisitionListRead(BaseModel):
    items: list[AcquisitionRead]
    total: int


class AcquisitionSuggestRead(BaseModel):
    created: int
