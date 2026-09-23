from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.errors import AppError
from app.core.permissions import require_permissions
from app.core.security import AuthUser
from app.models.inventory import InventoryItem, StockBalance, StockMovement
from app.schemas.file import EntityFileDeleteRequest, EntityFileListRead, EntityFileRead
from app.schemas.inventory import (
    InventoryDeleteRequest,
    InventoryFieldSuggestionsRead,
    InventoryItemCreate,
    InventoryItemRead,
    InventoryItemUpdate,
    InventoryListRead,
    ItemHistoryRead,
)
from app.services.audit_service import log_action
from app.services.file_service import attach_upload, get_entity_file_or_404, list_entity_files, soft_delete_entity_file
from app.services import file_storage
from app.services.inventory_service import (
    active_items_query,
    audit_logs_for_item,
    ensure_stock_alert,
    get_item_or_404,
    get_or_create_balance,
    get_or_create_category,
    get_or_create_location,
    resolve_patrimony_number,
    serialize_item,
    serialize_items_bulk,
    serialize_movement,
    suggest_item_field_values,
)

router = APIRouter(prefix="/inventory/items", tags=["inventory"])


@router.get("", response_model=InventoryListRead)
async def list_items(
    q: str | None = Query(default=None),
    item_type: str | None = Query(default=None),
    user: AuthUser = Depends(require_permissions(["inventory:item:read"])),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    stmt = active_items_query().order_by(InventoryItem.name)
    if q:
        # Nome por trecho; patrimônio e série também, para o leitor de etiquetas achar pelo código.
        pattern = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                InventoryItem.name.ilike(pattern),
                InventoryItem.patrimony_number.ilike(pattern),
                InventoryItem.serial_number.ilike(pattern),
            )
        )
    if item_type:
        stmt = stmt.where(InventoryItem.item_type == item_type)

    items = (await session.execute(stmt)).scalars().all()
    return {"items": await serialize_items_bulk(session, items), "total": len(items)}


@router.get("/suggestions", response_model=InventoryFieldSuggestionsRead)
async def suggest_item_fields(
    field: str = Query(..., pattern="^(name|brand|model|category_name|location_name)$"),
    q: str = Query(default="", max_length=240),
    limit: int = Query(default=20, ge=1, le=50),
    user: AuthUser = Depends(require_permissions(["inventory:item:read"])),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    """Sugestões rápidas de nome/marca/modelo/categoria/local para autocomplete no cadastro."""
    items = await suggest_item_field_values(session, field=field, q=q, limit=limit)
    return {"field": field, "q": q.strip(), "items": items}


@router.post("", response_model=InventoryItemRead, status_code=status.HTTP_201_CREATED)
async def create_item(
    payload: InventoryItemCreate,
    user: AuthUser = Depends(require_permissions(["inventory:item:create"])),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    category = await get_or_create_category(session, category_id=payload.category_id, name=payload.category_name)
    location = await get_or_create_location(session, location_id=payload.current_location_id, name=payload.location_name)
    item = InventoryItem(
        item_type=payload.item_type,
        category_id=category.id,
        name=payload.name,
        brand=payload.brand,
        model=payload.model,
        serial_number=payload.serial_number,
        patrimony_number=await resolve_patrimony_number(session, payload.patrimony_number),
        invoice_number=payload.invoice_number,
        description=payload.description,
        condition_status=payload.condition_status,
        current_location_id=location.id,
        unit=payload.unit,
        minimum_stock_national=payload.minimum_stock_national,
        minimum_stock_import=payload.minimum_stock_import,
        minimum_stock_maintenance=payload.minimum_stock_maintenance,
        ideal_stock=payload.ideal_stock,
    )
    session.add(item)
    try:
        await session.flush()
    except IntegrityError as exc:
        # ponytail: dois cadastros no mesmo instante pegam o mesmo número; o segundo repete o envio.
        raise AppError("Número patrimonial já usado. Salve de novo.", code="patrimony_number_taken", status_code=409) from exc

    balance = await get_or_create_balance(session, item_id=item.id, location_id=location.id)
    if payload.initial_quantity:
        balance.quantity += payload.initial_quantity

    after_data = await serialize_item(session, item)
    await log_action(
        session,
        actor=user,
        action="inventory_item_created",
        entity_type="inventory_item",
        entity_id=str(item.id),
        entity_label_snapshot=item.name,
        after_data=after_data,
        reason=payload.reason,
    )
    await ensure_stock_alert(session, item)
    await session.commit()
    await session.refresh(item)
    return await serialize_item(session, item)


@router.get("/{item_id}", response_model=InventoryItemRead)
async def get_item(
    item_id: uuid.UUID,
    user: AuthUser = Depends(require_permissions(["inventory:item:read"])),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    item = await get_item_or_404(session, item_id)
    return await serialize_item(session, item)


@router.patch("/{item_id}", response_model=InventoryItemRead)
async def update_item(
    item_id: uuid.UUID,
    payload: InventoryItemUpdate,
    user: AuthUser = Depends(require_permissions(["inventory:item:update"])),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    item = await get_item_or_404(session, item_id)
    before_data = await serialize_item(session, item)
    data = payload.model_dump(exclude_unset=True)

    if "category_name" in data or "category_id" in data:
        category = await get_or_create_category(session, category_id=payload.category_id, name=payload.category_name)
        item.category_id = category.id
    if "location_name" in data or "current_location_id" in data:
        location = await get_or_create_location(session, location_id=payload.current_location_id, name=payload.location_name)
        item.current_location_id = location.id
        await get_or_create_balance(session, item_id=item.id, location_id=location.id)

    ignored = {"category_name", "category_id", "location_name", "current_location_id", "reason"}
    for field, value in data.items():
        if field not in ignored:
            setattr(item, field, value)
    item.row_version += 1

    # flush+refresh: updated_at tem onupdate=func.now() e fica expirado no async;
    # acessar item.updated_at em serialize_item sem refresh gera MissingGreenlet (500).
    await session.flush()
    await session.refresh(item)

    after_data = await serialize_item(session, item)
    await log_action(
        session,
        actor=user,
        action="inventory_item_updated",
        entity_type="inventory_item",
        entity_id=str(item.id),
        entity_label_snapshot=item.name,
        before_data=before_data,
        after_data=after_data,
        reason=payload.reason,
    )
    await ensure_stock_alert(session, item)
    await session.commit()
    await session.refresh(item)
    return await serialize_item(session, item)


@router.delete("/{item_id}")
async def delete_item(
    item_id: uuid.UUID,
    payload: InventoryDeleteRequest,
    user: AuthUser = Depends(require_permissions(["inventory:item:delete"])),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, str]:
    item = await get_item_or_404(session, item_id)
    before_data = await serialize_item(session, item)
    item.is_active = False
    item.deleted_at = datetime.now(timezone.utc)
    item.row_version += 1
    await log_action(
        session,
        actor=user,
        action="inventory_item_deleted",
        entity_type="inventory_item",
        entity_id=str(item.id),
        entity_label_snapshot=item.name,
        before_data=before_data,
        after_data={"deleted_at": item.deleted_at.isoformat(), "is_active": False},
        reason=payload.reason,
    )
    await session.commit()
    return {"status": "ok"}


@router.get("/{item_id}/history", response_model=ItemHistoryRead)
async def get_item_history(
    item_id: uuid.UUID,
    user: AuthUser = Depends(require_permissions(["inventory:item:read"])),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    await get_item_or_404(session, item_id)
    movements = (
        await session.execute(
            select(StockMovement)
            .where(StockMovement.item_id == item_id)
            .order_by(StockMovement.created_at.desc())
        )
    ).scalars().all()
    return {
        "movements": [await serialize_movement(session, movement) for movement in movements],
        "audit_logs": await audit_logs_for_item(session, item_id),
    }


@router.get("/{item_id}/files", response_model=EntityFileListRead)
async def list_item_files(
    item_id: uuid.UUID,
    user: AuthUser = Depends(require_permissions(["inventory:item:read"])),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    await get_item_or_404(session, item_id)
    items = await list_entity_files(session, entity_type="inventory_item", entity_id=str(item_id))
    return {"items": items, "total": len(items)}


@router.post("/{item_id}/files", response_model=EntityFileRead, status_code=status.HTTP_201_CREATED)
async def upload_item_file(
    item_id: uuid.UUID,
    file: UploadFile = File(...),
    file_role: str = Form(default="documento"),
    notes: str | None = Form(default=None),
    user: AuthUser = Depends(require_permissions(["inventory:item:update"])),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    item = await get_item_or_404(session, item_id)
    content = await file.read()
    if not content:
        raise AppError("Arquivo vazio não é permitido.", code="empty_file", status_code=400)

    result = await attach_upload(
        session,
        actor=user,
        entity_type="inventory_item",
        entity_id=str(item.id),
        entity_label=item.name,
        file_role=file_role,
        original_name=file.filename or "arquivo",
        mime_type=file.content_type or "application/octet-stream",
        content=content,
        notes=notes,
    )
    await session.commit()
    return result


@router.get("/{item_id}/files/{entity_file_id}/content")
async def download_item_file(
    item_id: uuid.UUID,
    entity_file_id: uuid.UUID,
    user: AuthUser = Depends(require_permissions(["inventory:item:read"])),
    session: AsyncSession = Depends(get_async_session),
) -> Response:
    await get_item_or_404(session, item_id)
    _entity_file, file_meta = await get_entity_file_or_404(
        session,
        entity_type="inventory_item",
        entity_id=str(item_id),
        entity_file_id=entity_file_id,
    )
    content = file_storage.read_bytes(file_meta.storage_key)
    headers = {
        "Content-Disposition": f'inline; filename="{file_meta.original_name}"',
    }
    return Response(content=content, media_type=file_meta.mime_type, headers=headers)


@router.delete("/{item_id}/files/{entity_file_id}")
async def delete_item_file(
    item_id: uuid.UUID,
    entity_file_id: uuid.UUID,
    payload: EntityFileDeleteRequest,
    user: AuthUser = Depends(require_permissions(["inventory:item:update"])),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, str]:
    item = await get_item_or_404(session, item_id)
    await soft_delete_entity_file(
        session,
        actor=user,
        entity_type="inventory_item",
        entity_id=str(item.id),
        entity_label=item.name,
        entity_file_id=entity_file_id,
        reason=payload.reason,
    )
    await session.commit()
    return {"status": "ok"}
