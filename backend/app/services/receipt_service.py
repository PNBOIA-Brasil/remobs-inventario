from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.security import AuthUser
from app.models.inventory import Location, StockMovement
from app.schemas.receipt import ReceiptCreate
from app.services.audit_service import log_action
from app.services.inventory_service import ensure_stock_alert, get_item_or_404, get_or_create_balance

ORIGIN_LABEL = {"compra": "Compra", "doacao": "Doação", "transferencia": "Transferência"}


def receipt_reason(payload: ReceiptCreate) -> str:
    parts = [ORIGIN_LABEL[payload.origin]]
    if payload.document:
        parts.append(f"documento {payload.document.strip()}")
    text = " · ".join(parts)
    return f"{text}. {payload.notes.strip()}" if payload.notes and payload.notes.strip() else text


async def register_receipt(session: AsyncSession, *, user: AuthUser, payload: ReceiptCreate) -> list[StockMovement]:
    """Entrada de material: soma ao saldo do local e grava um movimento `entrada` por linha."""
    location = await session.get(Location, payload.location_id)
    if not location or not location.is_active:
        raise AppError("Local de destino não encontrado.", code="location_not_found", status_code=404)
    item_ids = [line.item_id for line in payload.lines]
    if len(set(item_ids)) != len(item_ids):
        raise AppError("O mesmo material não pode repetir na entrada.", code="duplicate_line", status_code=422)

    reason = receipt_reason(payload)
    now = datetime.now(timezone.utc)
    movements: list[StockMovement] = []
    for line in payload.lines:
        item = await get_item_or_404(session, line.item_id)
        balance = await get_or_create_balance(session, item_id=item.id, location_id=location.id)
        before = balance.quantity
        balance.quantity += line.quantity
        movement = StockMovement(
            item_id=item.id,
            movement_type="entrada",
            from_location_id=None,
            to_location_id=location.id,
            quantity=line.quantity,
            requested_by_id=user.id,
            requested_by_username=user.username,
            approved_by_id=user.id,
            approved_by_username=user.username,
            status="completed",
            reason=reason,
            created_at=now,
            approved_at=now,
            completed_at=now,
        )
        session.add(movement)
        item.row_version += 1
        await session.flush()
        await ensure_stock_alert(session, item)
        await log_action(
            session,
            actor=user,
            action="receipt_registered",
            entity_type="inventory_item",
            entity_id=str(item.id),
            entity_label_snapshot=item.name,
            before_data={"location": location.name, "quantity": before},
            after_data={"location": location.name, "quantity": balance.quantity},
            reason=reason,
            metadata={"movement_id": str(movement.id), "origin": payload.origin, "document": payload.document},
        )
        movements.append(movement)
    return movements
