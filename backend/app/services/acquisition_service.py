from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.security import AuthUser
from app.models.acquisition import OPEN_ACQUISITION_STATUSES, AcquisitionNeed
from app.models.inventory import InventoryItem, StockBalance
from app.schemas.acquisition import AcquisitionCreate, AcquisitionUpdate
from app.services.audit_service import log_action
from app.services.inventory_service import active_items_query, get_item_or_404, suggest_acquisition

TRANSITIONS = {
    "sugerida": {"aprovada", "cancelada"},
    "aprovada": {"em_compra", "cancelada"},
    "em_compra": {"atendida", "cancelada"},
}
# A entrada abate primeiro o que já está em compra, depois o aprovado, por último o sugerido.
ALLOCATION_ORDER = {"em_compra": 0, "aprovada": 1, "sugerida": 2}


async def _stock_totals(session: AsyncSession, item_ids: set[uuid.UUID]) -> dict[uuid.UUID, int]:
    if not item_ids:
        return {}
    rows = await session.execute(
        select(StockBalance.item_id, func.coalesce(func.sum(StockBalance.quantity), 0))
        .where(StockBalance.item_id.in_(item_ids))
        .group_by(StockBalance.item_id)
    )
    return {item_id: int(total) for item_id, total in rows.all()}


async def serialize_needs(session: AsyncSession, needs: list[AcquisitionNeed]) -> list[dict]:
    item_ids = {need.item_id for need in needs}
    items = {
        item.id: item
        for item in (await session.execute(select(InventoryItem).where(InventoryItem.id.in_(item_ids)))).scalars().all()
    } if item_ids else {}
    totals = await _stock_totals(session, item_ids)
    return [
        {
            "id": need.id,
            "item_id": need.item_id,
            "item_name": items[need.item_id].name if need.item_id in items else "Material",
            "item_unit": items[need.item_id].unit if need.item_id in items else "un",
            "stock_total": totals.get(need.item_id, 0),
            "quantity": need.quantity,
            "received_quantity": need.received_quantity,
            "status": need.status,
            "priority": need.priority,
            "origin": need.origin,
            "reason": need.reason,
            "process_number": need.process_number,
            "expected_date": need.expected_date,
            "created_by_username": need.created_by_username,
            "updated_by_username": need.updated_by_username,
            "created_at": need.created_at,
            "updated_at": need.updated_at,
        }
        for need in needs
    ]


async def list_needs(session: AsyncSession) -> list[AcquisitionNeed]:
    return list((await session.execute(select(AcquisitionNeed).order_by(AcquisitionNeed.created_at.desc()))).scalars().all())


async def _need_or_404(session: AsyncSession, need_id: uuid.UUID) -> AcquisitionNeed:
    need = await session.get(AcquisitionNeed, need_id)
    if not need:
        raise AppError("Necessidade de aquisição não encontrada.", code="acquisition_not_found", status_code=404)
    return need


async def create_need(session: AsyncSession, *, user: AuthUser, payload: AcquisitionCreate) -> AcquisitionNeed:
    item = await get_item_or_404(session, payload.item_id)
    need = AcquisitionNeed(
        item_id=item.id,
        quantity=payload.quantity,
        status="aprovada",
        priority=payload.priority,
        origin="manual",
        reason=payload.reason,
        created_by_username=user.username,
        updated_by_username=user.username,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    session.add(need)
    await session.flush()
    await log_action(
        session,
        actor=user,
        action="acquisition_created",
        entity_type="acquisition_need",
        entity_id=str(need.id),
        entity_label_snapshot=item.name,
        after_data=(await serialize_needs(session, [need]))[0],
        reason=payload.reason,
    )
    return need


async def update_need(session: AsyncSession, *, user: AuthUser, need_id: uuid.UUID, payload: AcquisitionUpdate) -> AcquisitionNeed:
    need = await _need_or_404(session, need_id)
    if need.status not in OPEN_ACQUISITION_STATUSES:
        raise AppError("Necessidade já encerrada.", code="acquisition_closed", status_code=409)
    before = (await serialize_needs(session, [need]))[0]
    if payload.status and payload.status != need.status:
        if payload.status not in TRANSITIONS[need.status]:
            raise AppError("Mudança de etapa não permitida.", code="acquisition_invalid_transition", status_code=409)
        need.status = payload.status
    if payload.quantity is not None:
        need.quantity = payload.quantity
    if payload.priority is not None:
        need.priority = payload.priority
    if payload.process_number is not None:
        need.process_number = payload.process_number.strip() or None
    if payload.expected_date is not None:
        need.expected_date = payload.expected_date
    need.updated_by_username = user.username
    need.updated_at = datetime.now(timezone.utc)
    await log_action(
        session,
        actor=user,
        action="acquisition_updated",
        entity_type="acquisition_need",
        entity_id=str(need.id),
        entity_label_snapshot=before["item_name"],
        before_data=before,
        after_data=(await serialize_needs(session, [need]))[0],
        reason=payload.reason,
    )
    return need


async def allocate_receipt(session: AsyncSession, *, item_id: uuid.UUID, quantity: int) -> list[AcquisitionNeed]:
    """Abate a quantidade recebida das necessidades abertas do item. Completa → `atendida`."""
    needs = list(
        (
            await session.execute(
                select(AcquisitionNeed)
                .where(AcquisitionNeed.item_id == item_id, AcquisitionNeed.status.in_(OPEN_ACQUISITION_STATUSES))
                .order_by(AcquisitionNeed.created_at.asc())
            )
        ).scalars().all()
    )
    needs.sort(key=lambda need: ALLOCATION_ORDER[need.status])
    remaining = quantity
    touched: list[AcquisitionNeed] = []
    for need in needs:
        if remaining <= 0:
            break
        take = min(remaining, need.quantity - need.received_quantity)
        if take <= 0:
            continue
        need.received_quantity += take
        remaining -= take
        if need.received_quantity >= need.quantity:
            need.status = "atendida"
        need.updated_at = datetime.now(timezone.utc)
        touched.append(need)
    return touched


async def suggest_all(session: AsyncSession) -> int:
    """Varre itens com mínimo definido e abre sugestão para os que estão abaixo dele."""
    items = list((await session.execute(active_items_query().where(InventoryItem.minimum_stock_national > 0))).scalars().all())
    totals = await _stock_totals(session, {item.id for item in items})
    created = 0
    for item in items:
        total = totals.get(item.id, 0)
        if total < item.minimum_stock_national and await suggest_acquisition(session, item, total):
            created += 1
    return created
