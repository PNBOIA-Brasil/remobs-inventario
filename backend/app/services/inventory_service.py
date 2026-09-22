from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.models.acquisition import OPEN_ACQUISITION_STATUSES, AcquisitionNeed
from app.models.alert import Alert
from app.models.audit_log import AuditLog
from app.models.custody import WithdrawalLine
from app.models.inventory import InventoryCategory, InventoryItem, Location, StockBalance, StockMovement


async def get_or_create_category(session: AsyncSession, *, category_id: uuid.UUID | None, name: str | None) -> InventoryCategory:
    if category_id:
        category = await session.get(InventoryCategory, category_id)
        if not category:
            raise AppError("Categoria não encontrada.", code="category_not_found", status_code=404)
        return category

    category_name = (name or "Sem categoria").strip()
    category = await session.scalar(select(InventoryCategory).where(func.lower(InventoryCategory.name) == category_name.lower()))
    if category:
        return category

    category = InventoryCategory(name=category_name)
    session.add(category)
    await session.flush()
    return category


async def get_or_create_location(session: AsyncSession, *, location_id: uuid.UUID | None, name: str | None) -> Location:
    if location_id:
        location = await session.get(Location, location_id)
        if not location:
            raise AppError("Local não encontrado.", code="location_not_found", status_code=404)
        return location

    location_name = (name or "Estoque").strip()
    location = await session.scalar(select(Location).where(func.lower(Location.name) == location_name.lower()))
    if location:
        return location

    location = Location(name=location_name)
    session.add(location)
    await session.flush()
    return location


async def get_item_or_404(session: AsyncSession, item_id: uuid.UUID) -> InventoryItem:
    item = await session.get(InventoryItem, item_id)
    if not item or item.deleted_at is not None:
        raise AppError("Item não encontrado.", code="inventory_item_not_found", status_code=404)
    return item


async def get_balance(session: AsyncSession, *, item_id: uuid.UUID, location_id: uuid.UUID) -> StockBalance | None:
    return await session.scalar(
        select(StockBalance).where(
            StockBalance.item_id == item_id,
            StockBalance.location_id == location_id,
        )
    )


async def get_or_create_balance(session: AsyncSession, *, item_id: uuid.UUID, location_id: uuid.UUID) -> StockBalance:
    balance = await get_balance(session, item_id=item_id, location_id=location_id)
    if balance:
        return balance

    balance = StockBalance(item_id=item_id, location_id=location_id, quantity=0)
    session.add(balance)
    await session.flush()
    return balance


async def serialize_item(session: AsyncSession, item: InventoryItem) -> dict[str, Any]:
    category = await session.get(InventoryCategory, item.category_id) if item.category_id else None
    current_location = await session.get(Location, item.current_location_id) if item.current_location_id else None
    rows = (
        await session.execute(
            select(StockBalance, Location)
            .join(Location, Location.id == StockBalance.location_id)
            .where(StockBalance.item_id == item.id)
            .order_by(Location.name)
        )
    ).all()

    balances = [
        {
            "id": balance.id,
            "location_id": location.id,
            "location_name": location.name,
            "quantity": balance.quantity,
            "reserved_quantity": balance.reserved_quantity,
        }
        for balance, location in rows
    ]

    return {
        "id": item.id,
        "item_type": item.item_type,
        "name": item.name,
        "brand": item.brand,
        "model": item.model,
        "serial_number": item.serial_number,
        "patrimony_number": item.patrimony_number,
        "invoice_number": item.invoice_number,
        "description": item.description,
        "condition_status": item.condition_status,
        "category_id": item.category_id,
        "category_name": category.name if category else None,
        "current_location_id": item.current_location_id,
        "current_location_name": current_location.name if current_location else None,
        "unit": item.unit,
        "minimum_stock_national": item.minimum_stock_national,
        "minimum_stock_import": item.minimum_stock_import,
        "minimum_stock_maintenance": item.minimum_stock_maintenance,
        "ideal_stock": item.ideal_stock,
        "is_active": item.is_active,
        "row_version": item.row_version,
        "stock_total": sum(balance["quantity"] for balance in balances),
        "balances": balances,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


async def serialize_items_bulk(session: AsyncSession, items: list[InventoryItem]) -> list[dict[str, Any]]:
    """Serializa vários itens com poucas consultas, evitando N+1 por item.

    Carrega categorias, locais atuais e saldos em lote (consultas fixas
    independentes da quantidade de itens), o que mantém a listagem rápida
    mesmo com volume alto em bancos remotos como o RDS.
    """
    if not items:
        return []

    item_ids = [item.id for item in items]
    category_ids = {item.category_id for item in items if item.category_id}
    location_ids = {item.current_location_id for item in items if item.current_location_id}

    categories: dict[uuid.UUID, InventoryCategory] = {}
    if category_ids:
        rows = (await session.execute(select(InventoryCategory).where(InventoryCategory.id.in_(category_ids)))).scalars().all()
        categories = {category.id: category for category in rows}

    current_locations: dict[uuid.UUID, Location] = {}
    if location_ids:
        rows = (await session.execute(select(Location).where(Location.id.in_(location_ids)))).scalars().all()
        current_locations = {location.id: location for location in rows}

    balances_by_item: dict[uuid.UUID, list[dict[str, Any]]] = defaultdict(list)
    balance_rows = (
        await session.execute(
            select(StockBalance, Location)
            .join(Location, Location.id == StockBalance.location_id)
            .where(StockBalance.item_id.in_(item_ids))
            .order_by(Location.name)
        )
    ).all()
    for balance, location in balance_rows:
        balances_by_item[balance.item_id].append(
            {
                "id": balance.id,
                "location_id": location.id,
                "location_name": location.name,
                "quantity": balance.quantity,
                "reserved_quantity": balance.reserved_quantity,
            }
        )

    serialized: list[dict[str, Any]] = []
    for item in items:
        category = categories.get(item.category_id) if item.category_id else None
        current_location = current_locations.get(item.current_location_id) if item.current_location_id else None
        balances = balances_by_item.get(item.id, [])
        serialized.append(
            {
                "id": item.id,
                "item_type": item.item_type,
                "name": item.name,
                "brand": item.brand,
                "model": item.model,
                "serial_number": item.serial_number,
                "patrimony_number": item.patrimony_number,
                "invoice_number": item.invoice_number,
                "description": item.description,
                "condition_status": item.condition_status,
                "category_id": item.category_id,
                "category_name": category.name if category else None,
                "current_location_id": item.current_location_id,
                "current_location_name": current_location.name if current_location else None,
                "unit": item.unit,
                "minimum_stock_national": item.minimum_stock_national,
                "minimum_stock_import": item.minimum_stock_import,
                "minimum_stock_maintenance": item.minimum_stock_maintenance,
                "ideal_stock": item.ideal_stock,
                "is_active": item.is_active,
                "row_version": item.row_version,
                "stock_total": sum(balance["quantity"] for balance in balances),
                "balances": balances,
                "created_at": item.created_at,
                "updated_at": item.updated_at,
            }
        )
    return serialized


async def serialize_movement(session: AsyncSession, movement: StockMovement) -> dict[str, Any]:
    from_location = await session.get(Location, movement.from_location_id) if movement.from_location_id else None
    to_location = await session.get(Location, movement.to_location_id) if movement.to_location_id else None
    return {
        "id": movement.id,
        "item_id": movement.item_id,
        "movement_type": movement.movement_type,
        "from_location_id": movement.from_location_id,
        "from_location_name": from_location.name if from_location else None,
        "to_location_id": movement.to_location_id,
        "to_location_name": to_location.name if to_location else None,
        "quantity": movement.quantity,
        "requested_by_id": movement.requested_by_id,
        "requested_by_username": movement.requested_by_username,
        "approved_by_id": movement.approved_by_id,
        "approved_by_username": movement.approved_by_username,
        "status": movement.status,
        "reason": movement.reason,
        "decision_reason": movement.decision_reason,
        "created_at": movement.created_at,
        "approved_at": movement.approved_at,
    }


async def ensure_stock_alert(session: AsyncSession, item: InventoryItem) -> None:
    if item.minimum_stock_national <= 0:
        return

    total = await session.scalar(select(func.coalesce(func.sum(StockBalance.quantity), 0)).where(StockBalance.item_id == item.id))
    open_alert = await session.scalar(
        select(Alert).where(
            Alert.alert_type == "estoque_minimo",
            Alert.entity_type == "inventory_item",
            Alert.entity_id == str(item.id),
            Alert.status == "open",
        )
    )

    if int(total or 0) < item.minimum_stock_national and not open_alert:
        session.add(
            Alert(
                alert_type="estoque_minimo",
                severity="warning",
                entity_type="inventory_item",
                entity_id=str(item.id),
                title=f"Estoque baixo: {item.name}",
                message=f"Estoque atual ({int(total or 0)}) abaixo do mínimo nacional ({item.minimum_stock_national}).",
                alert_metadata={"stock_total": int(total or 0), "minimum_stock_national": item.minimum_stock_national},
            )
        )
    elif int(total or 0) >= item.minimum_stock_national and open_alert:
        open_alert.status = "resolved"
        open_alert.resolved_at = datetime.now(timezone.utc)

    if int(total or 0) < item.minimum_stock_national:
        await suggest_acquisition(session, item, int(total or 0))


async def suggest_acquisition(session: AsyncSession, item: InventoryItem, total: int) -> AcquisitionNeed | None:
    """Abre necessidade sugerida até o estoque ideal (ou o mínimo), se o item ainda não tiver uma aberta."""
    open_need = await session.scalar(
        select(AcquisitionNeed.id).where(
            AcquisitionNeed.item_id == item.id,
            AcquisitionNeed.status.in_(OPEN_ACQUISITION_STATUSES),
        )
    )
    if open_need:
        return None
    target = max(item.ideal_stock, item.minimum_stock_national)
    need = AcquisitionNeed(
        item_id=item.id,
        quantity=target - total,
        status="sugerida",
        priority="alta" if total == 0 else "media",
        origin="automatica",
        reason=f"Saldo {total} abaixo do mínimo {item.minimum_stock_national}.",
    )
    session.add(need)
    return need


async def audit_logs_for_item(session: AsyncSession, item_id: uuid.UUID) -> list[dict[str, Any]]:
    order_ids = (
        await session.execute(select(WithdrawalLine.order_id).where(WithdrawalLine.item_id == item_id))
    ).scalars().all()
    filters = [(AuditLog.entity_type == "inventory_item") & (AuditLog.entity_id == str(item_id))]
    if order_ids:
        filters.append(
            (AuditLog.entity_type == "withdrawal_order") & (AuditLog.entity_id.in_([str(order_id) for order_id in order_ids]))
        )
    rows = (
        await session.execute(select(AuditLog).where(or_(*filters)).order_by(AuditLog.occurred_at.desc()))
    ).scalars().all()
    return [
        {
            "id": str(row.id),
            "occurred_at": row.occurred_at.isoformat(),
            "actor_username": row.actor_username,
            "action": row.action,
            "reason": row.reason,
            "before_data": row.before_data,
            "after_data": row.after_data,
        }
        for row in rows
    ]


def active_items_query() -> Select[tuple[InventoryItem]]:
    return select(InventoryItem).where(InventoryItem.deleted_at.is_(None), InventoryItem.is_active.is_(True))


ITEM_SUGGESTION_FIELDS: dict[str, Any] = {
    "name": InventoryItem.name,
    "brand": InventoryItem.brand,
    "model": InventoryItem.model,
}

ALLOWED_SUGGESTION_FIELDS = ("name", "brand", "model", "category_name", "location_name")


async def suggest_item_field_values(
    session: AsyncSession,
    *,
    field: str,
    q: str,
    limit: int = 20,
) -> list[str]:
    """Retorna valores distintos para autocomplete do cadastro de itens.

    Campos name/brand/model vêm de inventory_items (DISTINCT + prefixo).
    category_name e location_name vêm das tabelas próprias (já indexadas).
    """
    if field not in ALLOWED_SUGGESTION_FIELDS:
        raise AppError(
            "Campo de sugestão inválido.",
            code="invalid_suggestion_field",
            status_code=400,
            meta={"allowed_fields": list(ALLOWED_SUGGESTION_FIELDS)},
        )

    term = q.strip()
    if not term:
        return []

    safe_limit = max(1, min(limit, 50))

    if field == "category_name":
        stmt = (
            select(InventoryCategory.name)
            .where(
                InventoryCategory.is_active.is_(True),
                InventoryCategory.name != "",
                InventoryCategory.name.ilike(f"{term}%"),
            )
            .order_by(InventoryCategory.name.asc())
            .limit(safe_limit)
        )
    elif field == "location_name":
        stmt = (
            select(Location.name)
            .where(
                Location.is_active.is_(True),
                Location.name != "",
                Location.name.ilike(f"{term}%"),
            )
            .order_by(Location.name.asc())
            .limit(safe_limit)
        )
    else:
        column = ITEM_SUGGESTION_FIELDS[field]
        stmt = (
            select(column)
            .where(
                InventoryItem.deleted_at.is_(None),
                InventoryItem.is_active.is_(True),
                column.is_not(None),
                column != "",
                column.ilike(f"{term}%"),
            )
            .distinct()
            .order_by(column.asc())
            .limit(safe_limit)
        )

    rows = (await session.execute(stmt)).scalars().all()
    return [str(value) for value in rows if value]
