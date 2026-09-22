from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.security import AuthUser
from app.models.audit_log import AuditLog
from app.models.custody import CustodyEvent, CustodyPosition, WithdrawalLine, WithdrawalOrder
from app.models.inventory import InventoryItem, Location, StockMovement
from app.services.audit_service import log_action
from app.services.inventory_service import ensure_stock_alert, get_balance, get_item_or_404, get_or_create_balance

DECISION_PERMISSIONS = (
    "inventory:withdrawal:approve",
    "inventory:withdrawal:deliver",
    "inventory:return:decide",
    "inventory:writeoff:decide",
)

EVENT_PERMISSION = {
    "devolucao": "inventory:return:decide",
    "baixa": "inventory:writeoff:decide",
}


def sees_all_orders(user: AuthUser) -> bool:
    if "*" in user.permissions:
        return True
    return any(permission in user.permissions for permission in DECISION_PERMISSIONS)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _deny_self(user: AuthUser, requester_id: int) -> None:
    if user.id == requester_id:
        raise AppError(
            "O solicitante não pode decidir o próprio pedido.",
            code="self_decision_denied",
            status_code=403,
        )


def _require_permission(user: AuthUser, code: str) -> None:
    if "*" in user.permissions or code in user.permissions:
        return
    raise AppError(
        "Permissões insuficientes.",
        code="permissions_missing",
        status_code=403,
        meta={"missing_permissions": [code]},
    )


async def _order_or_404(session: AsyncSession, order_id: uuid.UUID) -> WithdrawalOrder:
    order = await session.get(WithdrawalOrder, order_id)
    if not order:
        raise AppError("Pedido de retirada não encontrado.", code="withdrawal_not_found", status_code=404)
    return order


def _assert_can_read(user: AuthUser, order: WithdrawalOrder) -> None:
    if sees_all_orders(user) or order.requested_by_id == user.id:
        return
    raise AppError("Pedido de retirada não encontrado.", code="withdrawal_not_found", status_code=404)


async def _lines_for(session: AsyncSession, order_ids: list[uuid.UUID]) -> list[WithdrawalLine]:
    if not order_ids:
        return []
    return list(
        (
            await session.execute(select(WithdrawalLine).where(WithdrawalLine.order_id.in_(order_ids)))
        ).scalars().all()
    )


async def _events_for(session: AsyncSession, order_ids: list[uuid.UUID]) -> list[CustodyEvent]:
    if not order_ids:
        return []
    return list(
        (
            await session.execute(
                select(CustodyEvent)
                .where(CustodyEvent.order_id.in_(order_ids))
                .order_by(CustodyEvent.created_at.asc())
            )
        ).scalars().all()
    )


async def _positions_for(session: AsyncSession, order_ids: list[uuid.UUID]) -> dict[uuid.UUID, CustodyPosition]:
    if not order_ids:
        return {}
    rows = (
        await session.execute(select(CustodyPosition).where(CustodyPosition.order_id.in_(order_ids)))
    ).scalars().all()
    return {row.line_id: row for row in rows}


async def serialize_orders(
    session: AsyncSession,
    orders: list[WithdrawalOrder],
    *,
    include_details: bool,
) -> list[dict]:
    if not orders:
        return []

    order_ids = [order.id for order in orders]
    lines = await _lines_for(session, order_ids)
    item_ids = {line.item_id for line in lines}
    location_ids = {line.from_location_id for line in lines}
    items = {
        item.id: item
        for item in (
            await session.execute(select(InventoryItem).where(InventoryItem.id.in_(item_ids)))
        ).scalars().all()
    } if item_ids else {}
    locations = {
        location.id: location
        for location in (
            await session.execute(select(Location).where(Location.id.in_(location_ids)))
        ).scalars().all()
    } if location_ids else {}
    positions = await _positions_for(session, order_ids)
    events = await _events_for(session, order_ids) if include_details else []
    audits: list[AuditLog] = []
    if include_details:
        audits = list(
            (
                await session.execute(
                    select(AuditLog)
                    .where(
                        AuditLog.entity_type == "withdrawal_order",
                        AuditLog.entity_id.in_([str(order_id) for order_id in order_ids]),
                    )
                    .order_by(AuditLog.occurred_at.asc())
                )
            ).scalars().all()
        )

    lines_by_order: dict[uuid.UUID, list[WithdrawalLine]] = {order.id: [] for order in orders}
    for line in lines:
        lines_by_order.setdefault(line.order_id, []).append(line)
    events_by_order: dict[uuid.UUID, list[CustodyEvent]] = {order.id: [] for order in orders}
    for event in events:
        events_by_order.setdefault(event.order_id, []).append(event)
    audits_by_order: dict[str, list[AuditLog]] = {str(order.id): [] for order in orders}
    for entry in audits:
        audits_by_order.setdefault(entry.entity_id or "", []).append(entry)

    serialized: list[dict] = []
    for order in orders:
        order_lines = []
        for line in lines_by_order.get(order.id, []):
            item = items.get(line.item_id)
            location = locations.get(line.from_location_id)
            position = positions.get(line.id)
            order_lines.append(
                {
                    "id": line.id,
                    "item_id": line.item_id,
                    "item_name": item.name if item else "Material",
                    "item_type": item.item_type if item else "",
                    "from_location_id": line.from_location_id,
                    "from_location_name": location.name if location else None,
                    "quantity": line.quantity,
                    "reserved_quantity": line.reserved_quantity,
                    "delivered_quantity": line.delivered_quantity,
                    "returned_quantity": line.returned_quantity,
                    "written_off_quantity": line.written_off_quantity,
                    "custody_quantity": position.quantity if position else 0,
                    "status": line.status,
                }
            )
        order_events = []
        for event in events_by_order.get(order.id, []):
            item = items.get(event.item_id)
            order_events.append(
                {
                    "id": event.id,
                    "line_id": event.line_id,
                    "item_id": event.item_id,
                    "item_name": item.name if item else "Material",
                    "event_type": event.event_type,
                    "quantity": event.quantity,
                    "status": event.status,
                    "reason": event.reason,
                    "requested_by_id": event.requested_by_id,
                    "requested_by_username": event.requested_by_username,
                    "decided_by_username": event.decided_by_username,
                    "decision_reason": event.decision_reason,
                    "created_at": event.created_at,
                    "decided_at": event.decided_at,
                }
            )
        serialized.append(
            {
                "id": order.id,
                "status": order.status,
                "reason": order.reason,
                "requested_by_id": order.requested_by_id,
                "requested_by_username": order.requested_by_username,
                "decided_by_username": order.decided_by_username,
                "decision_reason": order.decision_reason,
                "delivered_by_username": order.delivered_by_username,
                "delivery_reason": order.delivery_reason,
                "created_at": order.created_at,
                "decided_at": order.decided_at,
                "delivered_at": order.delivered_at,
                "lines": order_lines,
                "events": order_events,
                "audit_trail": [
                    {
                        "id": entry.id,
                        "occurred_at": entry.occurred_at,
                        "actor_username": entry.actor_username,
                        "actor_roles": entry.actor_roles or [],
                        "action": entry.action,
                        "reason": entry.reason,
                    }
                    for entry in audits_by_order.get(str(order.id), [])
                ],
            }
        )
    return serialized


async def serialize_order(session: AsyncSession, order: WithdrawalOrder, *, include_details: bool = True) -> dict:
    rows = await serialize_orders(session, [order], include_details=include_details)
    return rows[0]


def _available(balance) -> int:
    if not balance:
        return 0
    return balance.quantity - balance.reserved_quantity


async def _record_movement(
    session: AsyncSession,
    *,
    line: WithdrawalLine,
    order: WithdrawalOrder,
    movement_type: str,
    quantity: int,
    status: str,
    reason: str,
    actor: AuthUser | None,
) -> StockMovement:
    now = _now()
    movement = StockMovement(
        item_id=line.item_id,
        movement_type=movement_type,
        from_location_id=line.from_location_id,
        to_location_id=None,
        quantity=quantity,
        requested_by_id=order.requested_by_id,
        requested_by_username=order.requested_by_username,
        approved_by_id=actor.id if actor else None,
        approved_by_username=actor.username if actor else None,
        status=status,
        reason=reason,
        decision_reason=reason if actor else None,
        approved_at=now if actor else None,
        completed_at=now if status == "completed" else None,
        withdrawal_order_id=order.id,
        withdrawal_line_id=line.id,
    )
    session.add(movement)
    await session.flush()
    return movement


async def _reserva_movement(session: AsyncSession, line: WithdrawalLine) -> StockMovement | None:
    return await session.scalar(
        select(StockMovement).where(
            StockMovement.withdrawal_line_id == line.id,
            StockMovement.movement_type == "reserva",
        )
    )


async def create_withdrawal(session: AsyncSession, *, user: AuthUser, reason: str, lines_payload: list) -> WithdrawalOrder:
    seen: set[tuple[uuid.UUID, uuid.UUID]] = set()
    prepared: list[tuple[InventoryItem, uuid.UUID, int]] = []
    for line in lines_payload:
        key = (line.item_id, line.from_location_id)
        if key in seen:
            raise AppError(
                "O mesmo material não pode repetir a origem no pedido.",
                code="duplicate_line",
                status_code=422,
            )
        seen.add(key)
        item = await get_item_or_404(session, line.item_id)
        location = await session.get(Location, line.from_location_id)
        if not location:
            raise AppError("Local de origem não encontrado.", code="location_not_found", status_code=404)
        balance = await get_balance(session, item_id=item.id, location_id=location.id)
        if _available(balance) < line.quantity:
            raise AppError(
                f"Estoque insuficiente de {item.name}.",
                code="stock_insufficient",
                status_code=409,
            )
        prepared.append((item, location.id, line.quantity))

    order = WithdrawalOrder(
        requested_by_id=user.id,
        requested_by_username=user.username,
        reason=reason,
        status="pending_approval",
        created_at=_now(),
    )
    session.add(order)
    await session.flush()

    created_lines: list[WithdrawalLine] = []
    for item, location_id, quantity in prepared:
        balance = await get_balance(session, item_id=item.id, location_id=location_id)
        if balance is None or _available(balance) < quantity:
            raise AppError(f"Estoque insuficiente de {item.name}.", code="stock_insufficient", status_code=409)
        balance.reserved_quantity += quantity
        line = WithdrawalLine(
            order_id=order.id,
            item_id=item.id,
            from_location_id=location_id,
            quantity=quantity,
            reserved_quantity=quantity,
            status="pending",
        )
        session.add(line)
        await session.flush()
        await _record_movement(
            session,
            line=line,
            order=order,
            movement_type="reserva",
            quantity=quantity,
            status="pending",
            reason=reason,
            actor=None,
        )
        created_lines.append(line)

    await log_action(
        session,
        actor=user,
        action="withdrawal_requested",
        entity_type="withdrawal_order",
        entity_id=str(order.id),
        entity_label_snapshot=f"Retirada de {len(created_lines)} material(is)",
        after_data=await serialize_order(session, order),
        reason=reason,
        metadata={"item_ids": [str(line.item_id) for line in created_lines]},
    )
    return order


async def list_withdrawals(session: AsyncSession, *, user: AuthUser) -> list[WithdrawalOrder]:
    query = select(WithdrawalOrder).order_by(WithdrawalOrder.created_at.desc())
    if not sees_all_orders(user):
        query = query.where(WithdrawalOrder.requested_by_id == user.id)
    return list((await session.execute(query)).scalars().all())


async def get_withdrawal(session: AsyncSession, *, user: AuthUser, order_id: uuid.UUID) -> WithdrawalOrder:
    order = await _order_or_404(session, order_id)
    _assert_can_read(user, order)
    return order


async def approve_withdrawal(session: AsyncSession, *, user: AuthUser, order_id: uuid.UUID, reason: str) -> WithdrawalOrder:
    order = await _order_or_404(session, order_id)
    _deny_self(user, order.requested_by_id)
    if order.status != "pending_approval":
        raise AppError("Pedido não está pendente de aprovação.", code="withdrawal_not_pending", status_code=409)
    before = await serialize_order(session, order, include_details=False)
    lines = await _lines_for(session, [order.id])
    for line in lines:
        balance = await get_balance(session, item_id=line.item_id, location_id=line.from_location_id)
        if not balance or balance.reserved_quantity < line.reserved_quantity or balance.quantity < line.quantity:
            item = await get_item_or_404(session, line.item_id)
            raise AppError(f"Estoque insuficiente de {item.name}.", code="stock_insufficient", status_code=409)
        line.status = "reserved"
    now = _now()
    order.status = "approved"
    order.decided_by_id = user.id
    order.decided_by_username = user.username
    order.decided_at = now
    order.decision_reason = reason
    await log_action(
        session,
        actor=user,
        action="withdrawal_approved",
        entity_type="withdrawal_order",
        entity_id=str(order.id),
        entity_label_snapshot=order.requested_by_username,
        before_data=before,
        after_data=await serialize_order(session, order, include_details=False),
        reason=reason,
    )
    return order


async def reject_withdrawal(session: AsyncSession, *, user: AuthUser, order_id: uuid.UUID, reason: str) -> WithdrawalOrder:
    order = await _order_or_404(session, order_id)
    _deny_self(user, order.requested_by_id)
    if order.status != "pending_approval":
        raise AppError("Pedido não está pendente de aprovação.", code="withdrawal_not_pending", status_code=409)
    before = await serialize_order(session, order, include_details=False)
    lines = await _lines_for(session, [order.id])
    for line in lines:
        balance = await get_balance(session, item_id=line.item_id, location_id=line.from_location_id)
        if balance:
            balance.reserved_quantity = max(0, balance.reserved_quantity - line.reserved_quantity)
        line.reserved_quantity = 0
        line.status = "rejected"
        reserva = await _reserva_movement(session, line)
        if reserva:
            reserva.status = "rejected"
            reserva.approved_by_id = user.id
            reserva.approved_by_username = user.username
            reserva.approved_at = _now()
            reserva.decision_reason = reason
    order.status = "rejected"
    order.decided_by_id = user.id
    order.decided_by_username = user.username
    order.decided_at = _now()
    order.decision_reason = reason
    await log_action(
        session,
        actor=user,
        action="withdrawal_rejected",
        entity_type="withdrawal_order",
        entity_id=str(order.id),
        entity_label_snapshot=order.requested_by_username,
        before_data=before,
        after_data=await serialize_order(session, order, include_details=False),
        reason=reason,
    )
    return order


async def deliver_withdrawal(session: AsyncSession, *, user: AuthUser, order_id: uuid.UUID, reason: str) -> WithdrawalOrder:
    order = await _order_or_404(session, order_id)
    _deny_self(user, order.requested_by_id)
    if order.status != "approved":
        raise AppError("Pedido precisa estar aprovado para a entrega.", code="withdrawal_not_approved", status_code=409)
    before = await serialize_order(session, order, include_details=False)
    lines = await _lines_for(session, [order.id])
    now = _now()
    for line in lines:
        balance = await get_balance(session, item_id=line.item_id, location_id=line.from_location_id)
        item = await get_item_or_404(session, line.item_id)
        if not balance or balance.quantity < line.quantity or balance.reserved_quantity < line.quantity:
            raise AppError(f"Estoque insuficiente de {item.name}.", code="stock_insufficient", status_code=409)
        balance.quantity -= line.quantity
        balance.reserved_quantity -= line.quantity
        line.reserved_quantity = 0
        line.delivered_quantity = line.quantity
        line.status = "in_custody"
        session.add(
            CustodyPosition(
                line_id=line.id,
                order_id=order.id,
                item_id=line.item_id,
                user_id=order.requested_by_id,
                username=order.requested_by_username,
                location_id=line.from_location_id,
                quantity=line.quantity,
            )
        )
        reserva = await _reserva_movement(session, line)
        if reserva:
            reserva.status = "completed"
            reserva.completed_at = now
            reserva.approved_by_id = user.id
            reserva.approved_by_username = user.username
            reserva.approved_at = now
            reserva.decision_reason = reason
        await _record_movement(
            session,
            line=line,
            order=order,
            movement_type="entrega",
            quantity=line.quantity,
            status="completed",
            reason=reason,
            actor=user,
        )
        item.row_version += 1
        await ensure_stock_alert(session, item)
    order.status = "delivered"
    order.delivered_by_id = user.id
    order.delivered_by_username = user.username
    order.delivered_at = now
    order.delivery_reason = reason
    await log_action(
        session,
        actor=user,
        action="withdrawal_delivered",
        entity_type="withdrawal_order",
        entity_id=str(order.id),
        entity_label_snapshot=order.requested_by_username,
        before_data=before,
        after_data=await serialize_order(session, order, include_details=False),
        reason=reason,
    )
    return order


async def _pending_quantity(session: AsyncSession, line_id: uuid.UUID) -> int:
    events = (
        await session.execute(
            select(CustodyEvent).where(CustodyEvent.line_id == line_id, CustodyEvent.status == "pending")
        )
    ).scalars().all()
    return sum(event.quantity for event in events)


async def _request_custody_event(
    session: AsyncSession,
    *,
    user: AuthUser,
    order_id: uuid.UUID,
    line_id: uuid.UUID,
    event_type: str,
    quantity: int,
    reason: str,
) -> WithdrawalOrder:
    order = await _order_or_404(session, order_id)
    if order.requested_by_id != user.id:
        raise AppError("Só o solicitante pode pedir devolução ou baixa.", code="requester_only", status_code=403)
    if order.status != "delivered":
        raise AppError("O material ainda não foi entregue.", code="withdrawal_not_delivered", status_code=409)
    line = await session.get(WithdrawalLine, line_id)
    if not line or line.order_id != order.id:
        raise AppError("Linha do pedido não encontrada.", code="line_not_found", status_code=404)
    item = await get_item_or_404(session, line.item_id)
    if event_type == "baixa" and item.item_type != "consumable":
        raise AppError("Baixa só é permitida para material de consumo.", code="writeoff_not_consumable", status_code=409)
    position = await session.scalar(select(CustodyPosition).where(CustodyPosition.line_id == line.id))
    pending = await _pending_quantity(session, line.id)
    available = (position.quantity if position else 0) - pending
    if quantity > available:
        raise AppError("Quantidade maior que a posse disponível.", code="custody_quantity_exceeded", status_code=409)
    before = await serialize_order(session, order, include_details=False)
    event = CustodyEvent(
        line_id=line.id,
        order_id=order.id,
        item_id=line.item_id,
        event_type=event_type,
        quantity=quantity,
        requested_by_id=user.id,
        requested_by_username=user.username,
        status="pending",
        reason=reason,
        created_at=_now(),
    )
    session.add(event)
    await session.flush()
    action = "return_requested" if event_type == "devolucao" else "writeoff_requested"
    await log_action(
        session,
        actor=user,
        action=action,
        entity_type="withdrawal_order",
        entity_id=str(order.id),
        entity_label_snapshot=item.name,
        before_data=before,
        after_data=await serialize_order(session, order),
        reason=reason,
        metadata={"line_id": str(line.id), "event_id": str(event.id), "item_id": str(item.id)},
    )
    return order


async def request_return(
    session: AsyncSession,
    *,
    user: AuthUser,
    order_id: uuid.UUID,
    line_id: uuid.UUID,
    quantity: int,
    reason: str,
) -> WithdrawalOrder:
    return await _request_custody_event(
        session,
        user=user,
        order_id=order_id,
        line_id=line_id,
        event_type="devolucao",
        quantity=quantity,
        reason=reason,
    )


async def request_writeoff(
    session: AsyncSession,
    *,
    user: AuthUser,
    order_id: uuid.UUID,
    line_id: uuid.UUID,
    quantity: int,
    reason: str,
) -> WithdrawalOrder:
    return await _request_custody_event(
        session,
        user=user,
        order_id=order_id,
        line_id=line_id,
        event_type="baixa",
        quantity=quantity,
        reason=reason,
    )


async def _refresh_line_closure(session: AsyncSession, line: WithdrawalLine) -> None:
    position = await session.scalar(select(CustodyPosition).where(CustodyPosition.line_id == line.id))
    pending = await _pending_quantity(session, line.id)
    if position and position.quantity == 0 and pending == 0 and line.delivered_quantity > 0:
        line.status = "closed"
    elif line.delivered_quantity > 0:
        line.status = "in_custody"


async def _refresh_order_closure(session: AsyncSession, order: WithdrawalOrder) -> None:
    if order.status != "delivered":
        return
    lines = await _lines_for(session, [order.id])
    if lines and all(line.status == "closed" for line in lines):
        order.status = "closed"


async def decide_custody_event(
    session: AsyncSession,
    *,
    user: AuthUser,
    event_id: uuid.UUID,
    accept: bool,
    reason: str,
) -> WithdrawalOrder:
    event = await session.get(CustodyEvent, event_id)
    if not event:
        raise AppError("Solicitação de devolução ou baixa não encontrada.", code="event_not_found", status_code=404)
    order = await _order_or_404(session, event.order_id)
    _deny_self(user, order.requested_by_id)
    _require_permission(user, EVENT_PERMISSION[event.event_type])
    if event.status != "pending":
        raise AppError("Solicitação já foi decidida.", code="event_not_pending", status_code=409)
    line = await session.get(WithdrawalLine, event.line_id)
    if not line:
        raise AppError("Linha do pedido não encontrada.", code="line_not_found", status_code=404)
    item = await get_item_or_404(session, line.item_id)
    before = await serialize_order(session, order, include_details=False)
    now = _now()
    event.decided_by_id = user.id
    event.decided_by_username = user.username
    event.decided_at = now
    event.decision_reason = reason
    if not accept:
        event.status = "refused"
        action = "return_refused" if event.event_type == "devolucao" else "writeoff_refused"
    else:
        position = await session.scalar(select(CustodyPosition).where(CustodyPosition.line_id == line.id))
        if not position or position.quantity < event.quantity:
            raise AppError("Quantidade maior que a posse disponível.", code="custody_quantity_exceeded", status_code=409)
        position.quantity -= event.quantity
        event.status = "accepted"
        if event.event_type == "devolucao":
            balance = await get_or_create_balance(session, item_id=line.item_id, location_id=line.from_location_id)
            balance.quantity += event.quantity
            line.returned_quantity += event.quantity
            movement_type = "devolucao"
            action = "return_accepted"
        else:
            if item.item_type != "consumable":
                raise AppError("Baixa só é permitida para material de consumo.", code="writeoff_not_consumable", status_code=409)
            line.written_off_quantity += event.quantity
            movement_type = "baixa"
            action = "writeoff_accepted"
        await _record_movement(
            session,
            line=line,
            order=order,
            movement_type=movement_type,
            quantity=event.quantity,
            status="completed",
            reason=reason,
            actor=user,
        )
        item.row_version += 1
        await ensure_stock_alert(session, item)
    await _refresh_line_closure(session, line)
    await _refresh_order_closure(session, order)
    await log_action(
        session,
        actor=user,
        action=action,
        entity_type="withdrawal_order",
        entity_id=str(order.id),
        entity_label_snapshot=item.name,
        before_data=before,
        after_data=await serialize_order(session, order),
        reason=reason,
        metadata={"line_id": str(line.id), "event_id": str(event.id), "item_id": str(item.id)},
    )
    return order
