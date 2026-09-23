from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class StockBalanceRead(BaseModel):
    id: uuid.UUID
    location_id: uuid.UUID
    location_name: str
    quantity: int
    reserved_quantity: int


class InventoryItemCreate(BaseModel):
    item_type: str = Field(pattern="^(consumable|permanent_component)$")
    name: str = Field(min_length=1, max_length=240)
    brand: str | None = None
    model: str | None = None
    serial_number: str | None = None
    patrimony_number: str | None = None
    invoice_number: str | None = None
    description: str | None = None
    condition_status: str = "operacional"
    category_id: uuid.UUID | None = None
    category_name: str | None = None
    current_location_id: uuid.UUID | None = None
    location_name: str | None = None
    unit: str = "un"
    initial_quantity: int = Field(default=0, ge=0)
    minimum_stock_national: int = Field(default=0, ge=0)
    minimum_stock_import: int = Field(default=0, ge=0)
    minimum_stock_maintenance: int = Field(default=0, ge=0)
    ideal_stock: int = Field(default=0, ge=0)
    reason: str | None = None


class InventoryItemUpdate(BaseModel):
    # Sem patrimony_number: o número é o QR Code impresso e não muda depois do cadastro.
    name: str | None = Field(default=None, min_length=1, max_length=240)
    brand: str | None = None
    model: str | None = None
    serial_number: str | None = None
    invoice_number: str | None = None
    description: str | None = None
    condition_status: str | None = None
    category_id: uuid.UUID | None = None
    category_name: str | None = None
    current_location_id: uuid.UUID | None = None
    location_name: str | None = None
    unit: str | None = None
    minimum_stock_national: int | None = Field(default=None, ge=0)
    minimum_stock_import: int | None = Field(default=None, ge=0)
    minimum_stock_maintenance: int | None = Field(default=None, ge=0)
    ideal_stock: int | None = Field(default=None, ge=0)
    reason: str | None = None


class InventoryItemRead(BaseModel):
    id: uuid.UUID
    item_type: str
    name: str
    brand: str | None
    model: str | None
    serial_number: str | None
    patrimony_number: str | None
    invoice_number: str | None
    description: str | None
    condition_status: str
    category_id: uuid.UUID | None
    category_name: str | None
    current_location_id: uuid.UUID | None
    current_location_name: str | None
    unit: str
    minimum_stock_national: int
    minimum_stock_import: int
    minimum_stock_maintenance: int
    ideal_stock: int
    is_active: bool
    row_version: int
    stock_total: int
    balances: list[StockBalanceRead]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryListRead(BaseModel):
    items: list[InventoryItemRead]
    total: int


class InventoryFieldSuggestionsRead(BaseModel):
    field: str
    q: str
    items: list[str]


class InventoryDeleteRequest(BaseModel):
    reason: str = Field(min_length=3)


class MovementRequestCreate(BaseModel):
    item_id: uuid.UUID
    quantity: int = Field(gt=0)
    from_location_id: uuid.UUID
    to_location_id: uuid.UUID | None = None
    to_location_name: str | None = None
    reason: str = Field(min_length=3)


class MovementDecision(BaseModel):
    reason: str = Field(min_length=3)


class StockMovementRead(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    movement_type: str
    from_location_id: uuid.UUID | None
    from_location_name: str | None
    to_location_id: uuid.UUID | None
    to_location_name: str | None
    quantity: int
    requested_by_id: int
    requested_by_username: str
    approved_by_id: int | None
    approved_by_username: str | None
    status: str
    reason: str
    decision_reason: str | None
    created_at: datetime
    approved_at: datetime | None


class MovementListRead(BaseModel):
    items: list[StockMovementRead]
    total: int


class ItemHistoryRead(BaseModel):
    movements: list[StockMovementRead]
    audit_logs: list[dict]
