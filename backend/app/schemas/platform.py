from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PlatformCreate(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    platform_type: str
    manufacturer: str | None = None
    model: str | None = None
    operational_status: str = "disponivel"
    description: str | None = None


class PlatformUpdate(BaseModel):
    name: str | None = None
    platform_type: str | None = None
    manufacturer: str | None = None
    model: str | None = None
    operational_status: str | None = None
    description: str | None = None
    reason: str | None = None


class PlatformDeleteRequest(BaseModel):
    reason: str = Field(min_length=3)


class PnboiaPreviewItem(PlatformCreate):
    external_id: int | None = None
    exists: bool = False


class PnboiaPreviewRead(BaseModel):
    items: list[PnboiaPreviewItem]
    errors: list[str] = Field(default_factory=list)


class PnboiaSyncRequest(BaseModel):
    platforms: list[PlatformCreate] = Field(min_length=1)


class PnboiaSyncResult(BaseModel):
    created: int
    updated: int


class PlatformRead(BaseModel):
    id: uuid.UUID
    name: str
    platform_type: str
    manufacturer: str | None
    model: str | None
    operational_status: str
    description: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PlatformListRead(BaseModel):
    items: list[PlatformRead]
    total: int


class HullRead(BaseModel):
    id: uuid.UUID
    code: str
    model: str | None
    status: str
    notes: str | None

    model_config = ConfigDict(from_attributes=True)


class PlatformSystemRead(BaseModel):
    id: uuid.UUID
    name: str
    status: str
    notes: str | None

    model_config = ConfigDict(from_attributes=True)


class PlatformLinkedSensorRead(BaseModel):
    id: uuid.UUID
    sensor_type: str
    family: str
    brand: str | None
    model: str | None
    serial_number: str | None
    operational_status: str
    installation_status: str
    installation_notes: str | None


class PlatformDetailRead(PlatformRead):
    hull: HullRead | None
    systems: list[PlatformSystemRead]
    sensors: list[PlatformLinkedSensorRead]
