from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class WithdrawalLineCreate(BaseModel):
    item_id: uuid.UUID
    quantity: int = Field(gt=0)
    from_location_id: uuid.UUID


class WithdrawalCreate(BaseModel):
    reason: str = Field(min_length=3)
    lines: list[WithdrawalLineCreate] = Field(min_length=1)


class DecisionReason(BaseModel):
    reason: str = Field(min_length=3)


class CustodyRequestCreate(BaseModel):
    quantity: int = Field(gt=0)
    reason: str = Field(min_length=3)


class WithdrawalLineRead(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    item_name: str
    item_type: str
    from_location_id: uuid.UUID
    from_location_name: str | None
    quantity: int
    reserved_quantity: int
    delivered_quantity: int
    returned_quantity: int
    written_off_quantity: int
    custody_quantity: int
    status: str


class CustodyEventRead(BaseModel):
    id: uuid.UUID
    line_id: uuid.UUID
    item_id: uuid.UUID
    item_name: str
    event_type: str
    quantity: int
    status: str
    reason: str
    requested_by_id: int
    requested_by_username: str
    decided_by_username: str | None
    decision_reason: str | None
    created_at: datetime
    decided_at: datetime | None


class WithdrawalAuditRead(BaseModel):
    id: uuid.UUID
    occurred_at: datetime
    actor_username: str | None
    actor_roles: list[str]
    action: str
    reason: str | None


class WithdrawalOrderRead(BaseModel):
    id: uuid.UUID
    status: str
    reason: str
    requested_by_id: int
    requested_by_username: str
    decided_by_username: str | None
    decision_reason: str | None
    delivered_by_username: str | None
    delivery_reason: str | None
    created_at: datetime
    decided_at: datetime | None
    delivered_at: datetime | None
    lines: list[WithdrawalLineRead]
    events: list[CustodyEventRead]
    audit_trail: list[WithdrawalAuditRead]


class WithdrawalListRead(BaseModel):
    items: list[WithdrawalOrderRead]
    total: int
