from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.errors import AppError
from app.core.permissions import require_any_permission, require_permissions
from app.core.security import AuthUser
from app.models.platform import Hull, Platform, PlatformSystem
from app.models.sensor import Sensor, SensorInstallation
from app.schemas.platform import (
    PlatformCreate,
    PlatformDeleteRequest,
    PlatformDetailRead,
    PlatformListRead,
    PlatformRead,
    PlatformUpdate,
    PnboiaPreviewRead,
    PnboiaSyncRequest,
    PnboiaSyncResult,
)
from app.services.audit_service import log_action
from app.services.pnboia_platforms import ACTIVE_OPERATIONAL_STATUSES, fetch_platform_payloads

PNBOIA_MANAGE = ["platform:create", "platform:update"]

router = APIRouter(prefix="/platforms", tags=["platforms"])


@router.get("", response_model=PlatformListRead)
async def list_platforms(
    active_only: bool = Query(
        True,
        description="Quando true, retorna apenas plataformas com status operacional ativo (em_operacao/disponivel).",
    ),
    user: AuthUser = Depends(require_permissions(["platform:read"])),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    stmt = select(Platform).where(Platform.deleted_at.is_(None))
    if active_only:
        stmt = stmt.where(Platform.operational_status.in_(sorted(ACTIVE_OPERATIONAL_STATUSES)))
    items = (await session.execute(stmt.order_by(Platform.name))).scalars().all()
    return {"items": items, "total": len(items)}


@router.post("", response_model=PlatformRead, status_code=status.HTTP_201_CREATED)
async def create_platform(
    payload: PlatformCreate,
    user: AuthUser = Depends(require_any_permission(["platform:create", "platform:update"])),
    session: AsyncSession = Depends(get_async_session),
) -> Platform:
    platform = Platform(**payload.model_dump())
    session.add(platform)
    await session.flush()
    await log_action(
        session,
        actor=user,
        action="platform_created",
        entity_type="platform",
        entity_id=str(platform.id),
        entity_label_snapshot=platform.name,
        after_data=payload.model_dump(),
    )
    await session.commit()
    await session.refresh(platform)
    return platform


@router.get("/pnboia/preview", response_model=PnboiaPreviewRead)
async def preview_pnboia_platforms(
    user: AuthUser = Depends(require_any_permission(PNBOIA_MANAGE)),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    """Consulta a API de boias PNBOIA e devolve as plataformas para o usuário conferir antes de gravar."""
    try:
        payloads = await asyncio.to_thread(fetch_platform_payloads, include_metadata=False)
    except Exception as exc:  # noqa: BLE001 - a API externa pode falhar de várias formas
        raise AppError("Não foi possível consultar a API PNBOIA agora.", code="pnboia_unavailable", status_code=502) from exc
    existing = {
        name.lower()
        for (name,) in await session.execute(select(Platform.name).where(Platform.deleted_at.is_(None)))
    }
    items = [
        {
            "name": payload["name"],
            "platform_type": payload["platform_type"],
            "manufacturer": payload.get("manufacturer"),
            "model": payload.get("model"),
            "operational_status": payload["operational_status"],
            "description": payload.get("description"),
            "external_id": payload.get("external_id"),
            "exists": payload["name"].lower() in existing,
        }
        for payload in payloads
    ]
    errors = [f"Boia {p['external_id']}: {p['metadata_error']}" for p in payloads if p.get("metadata_error")]
    return {"items": items, "errors": errors}


@router.post("/pnboia/sync", response_model=PnboiaSyncResult)
async def sync_pnboia_platforms(
    payload: PnboiaSyncRequest,
    user: AuthUser = Depends(require_any_permission(PNBOIA_MANAGE)),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    """Grava as plataformas confirmadas pelo usuário: cria as novas e atualiza as existentes (casadas por nome)."""
    created = updated = 0
    for item in payload.platforms:
        existing = await session.scalar(
            select(Platform).where(func.lower(Platform.name) == item.name.lower(), Platform.deleted_at.is_(None))
        )
        if existing:
            for field, value in item.model_dump().items():
                setattr(existing, field, value)
            target, action, updated = existing, "platform_updated", updated + 1
        else:
            target = Platform(**item.model_dump())
            session.add(target)
            action, created = "platform_created", created + 1
        await session.flush()
        await log_action(
            session,
            actor=user,
            action=action,
            entity_type="platform",
            entity_id=str(target.id),
            entity_label_snapshot=target.name,
            after_data=item.model_dump(),
            reason="Sincronização com a API de boias PNBOIA.",
        )
    await session.commit()
    return {"created": created, "updated": updated}


@router.get("/{platform_id}", response_model=PlatformDetailRead)
async def get_platform(
    platform_id: uuid.UUID,
    user: AuthUser = Depends(require_permissions(["platform:read"])),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    platform = await session.get(Platform, platform_id)
    if not platform or platform.deleted_at is not None:
        raise AppError("Plataforma não encontrada.", code="platform_not_found", status_code=404)

    hull = await session.scalar(select(Hull).where(Hull.platform_id == platform.id).order_by(Hull.code))
    systems = (
        await session.execute(
            select(PlatformSystem).where(PlatformSystem.platform_id == platform.id).order_by(PlatformSystem.name)
        )
    ).scalars().all()
    sensor_rows = (
        await session.execute(
            select(Sensor, SensorInstallation)
            .join(SensorInstallation, SensorInstallation.sensor_id == Sensor.id)
            .where(
                SensorInstallation.platform_id == platform.id,
                SensorInstallation.status == "ativo",
                Sensor.deleted_at.is_(None),
            )
            .order_by(Sensor.family, Sensor.model)
        )
    ).all()

    return {
        "id": platform.id,
        "name": platform.name,
        "platform_type": platform.platform_type,
        "manufacturer": platform.manufacturer,
        "model": platform.model,
        "operational_status": platform.operational_status,
        "description": platform.description,
        "created_at": platform.created_at,
        "updated_at": platform.updated_at,
        "hull": hull,
        "systems": systems,
        "sensors": [
            {
                "id": sensor.id,
                "sensor_type": sensor.sensor_type,
                "family": sensor.family,
                "brand": sensor.brand,
                "model": sensor.model,
                "serial_number": sensor.serial_number,
                "operational_status": sensor.operational_status,
                "installation_status": installation.status,
                "installation_notes": installation.notes,
            }
            for sensor, installation in sensor_rows
        ],
    }


@router.patch("/{platform_id}", response_model=PlatformRead)
async def update_platform(
    platform_id: uuid.UUID,
    payload: PlatformUpdate,
    user: AuthUser = Depends(require_permissions(["platform:update"])),
    session: AsyncSession = Depends(get_async_session),
) -> Platform:
    platform = await session.get(Platform, platform_id)
    if not platform or platform.deleted_at is not None:
        raise AppError("Plataforma não encontrada.", code="platform_not_found", status_code=404)

    before = {
        "name": platform.name,
        "platform_type": platform.platform_type,
        "operational_status": platform.operational_status,
    }
    for field, value in payload.model_dump(exclude_unset=True, exclude={"reason"}).items():
        setattr(platform, field, value)
    await log_action(
        session,
        actor=user,
        action="platform_updated",
        entity_type="platform",
        entity_id=str(platform.id),
        entity_label_snapshot=platform.name,
        before_data=before,
        after_data=payload.model_dump(exclude_none=True),
        reason=payload.reason,
    )
    await session.commit()
    await session.refresh(platform)
    return platform


@router.delete("/{platform_id}")
async def delete_platform(
    platform_id: uuid.UUID,
    payload: PlatformDeleteRequest,
    user: AuthUser = Depends(require_any_permission(["platform:delete", "platform:update"])),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, str]:
    platform = await session.get(Platform, platform_id)
    if not platform or platform.deleted_at is not None:
        raise AppError("Plataforma não encontrada.", code="platform_not_found", status_code=404)

    before = {
        "name": platform.name,
        "platform_type": platform.platform_type,
        "operational_status": platform.operational_status,
    }
    platform.deleted_at = datetime.now(timezone.utc)
    await log_action(
        session,
        actor=user,
        action="platform_deleted",
        entity_type="platform",
        entity_id=str(platform.id),
        entity_label_snapshot=platform.name,
        before_data=before,
        after_data={"deleted_at": platform.deleted_at.isoformat()},
        reason=payload.reason,
    )
    await session.commit()
    return {"status": "ok"}
