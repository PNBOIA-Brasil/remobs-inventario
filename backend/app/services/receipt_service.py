from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.security import AuthUser
from app.models.inventory import InventoryItem, Location, StockBalance, StockMovement
from app.schemas.receipt import ReceiptCreate
from app.services.acquisition_service import allocate_receipt
from app.services.audit_service import log_action
from app.services.inventory_service import (
    ensure_stock_alert,
    get_item_or_404,
    get_or_create_balance,
    resolve_patrimony_number,
    serialize_item,
)

ORIGIN_LABEL = {"compra": "Compra", "doacao": "Doação", "transferencia": "Transferência"}
PERMANENT = "permanent_component"


def receipt_reason(payload: ReceiptCreate) -> str:
    parts = [ORIGIN_LABEL[payload.origin]]
    if payload.document:
        parts.append(f"documento {payload.document.strip()}")
    text = " · ".join(parts)
    return f"{text}. {payload.notes.strip()}" if payload.notes and payload.notes.strip() else text


async def is_fresh(session: AsyncSession, item: InventoryItem) -> bool:
    """Cadastrado e nunca movimentado nem com saldo: pode ser a primeira peça recebida."""
    moved = await session.scalar(select(StockMovement.id).where(StockMovement.item_id == item.id).limit(1))
    stock = await session.scalar(select(func.coalesce(func.sum(StockBalance.quantity), 0)).where(StockBalance.item_id == item.id))
    return not moved and not stock


async def new_unit(
    session: AsyncSession, *, user: AuthUser, template: InventoryItem, location: Location, invoice_number: str | None
) -> InventoryItem:
    """Unidade nova de um permanente: mesmo cadastro, patrimônio próprio."""
    unit = InventoryItem(
        item_type=PERMANENT,
        category_id=template.category_id,
        name=template.name,
        brand=template.brand,
        model=template.model,
        invoice_number=invoice_number or template.invoice_number,
        description=template.description,
        current_location_id=location.id,
        unit=template.unit,
        patrimony_number=await resolve_patrimony_number(session, None),
    )
    session.add(unit)
    try:
        await session.flush()
    except IntegrityError as exc:
        raise AppError("Número patrimonial já usado. Registre de novo.", code="patrimony_number_taken", status_code=409) from exc
    await log_action(
        session,
        actor=user,
        action="inventory_item_created",
        entity_type="inventory_item",
        entity_id=str(unit.id),
        entity_label_snapshot=unit.name,
        after_data=await serialize_item(session, unit),
        reason=f"Unidade nova no recebimento, com o cadastro de {template.patrimony_number or template.name}.",
    )
    return unit


async def register_receipt(session: AsyncSession, *, user: AuthUser, payload: ReceiptCreate) -> tuple[list[StockMovement], list[InventoryItem]]:
    """Entrada de material: soma ao saldo do local e grava um movimento `entrada` por item recebido.

    Consumível soma no próprio item. Permanente vira uma unidade nova por peça (patrimônio próprio),
    com o cadastro do item informado; um permanente cadastrado e nunca movimentado é a primeira peça.
    """
    location = await session.get(Location, payload.location_id)
    if not location or not location.is_active:
        raise AppError("Local de destino não encontrado.", code="location_not_found", status_code=404)
    item_ids = [line.item_id for line in payload.lines]
    if len(set(item_ids)) != len(item_ids):
        raise AppError("O mesmo material não pode repetir na entrada.", code="duplicate_line", status_code=422)

    reason = receipt_reason(payload)
    now = datetime.now(timezone.utc)
    movements: list[StockMovement] = []
    received: list[InventoryItem] = []
    for line in payload.lines:
        item = await get_item_or_404(session, line.item_id)
        if item.item_type == PERMANENT:
            first = [item] if await is_fresh(session, item) else []
            if first:
                item.current_location_id = location.id
                item.invoice_number = item.invoice_number or payload.invoice_number
            units = first + [
                await new_unit(session, user=user, template=item, location=location, invoice_number=payload.invoice_number)
                for _ in range(line.quantity - len(first))
            ]
            targets = [(unit, 1) for unit in units]
        else:
            targets = [(item, line.quantity)]

        # Baixa a necessidade antes do alerta: se ainda faltar, o alerta reabre uma sugestão nova.
        fulfilled = await allocate_receipt(session, item_id=item.id, quantity=line.quantity)
        for target, quantity in targets:
            balance = await get_or_create_balance(session, item_id=target.id, location_id=location.id)
            before = balance.quantity
            balance.quantity += quantity
            movement = StockMovement(
                item_id=target.id,
                movement_type="entrada",
                from_location_id=None,
                to_location_id=location.id,
                quantity=quantity,
                requested_by_id=user.id,
                requested_by_username=user.username,
                approved_by_id=user.id,
                approved_by_username=user.username,
                status="completed",
                reason=reason,
                invoice_id=payload.invoice_id,
                created_at=now,
                approved_at=now,
                completed_at=now,
            )
            session.add(movement)
            target.row_version += 1
            await session.flush()
            await log_action(
                session,
                actor=user,
                action="receipt_registered",
                entity_type="inventory_item",
                entity_id=str(target.id),
                entity_label_snapshot=target.name,
                before_data={"location": location.name, "quantity": before},
                after_data={"location": location.name, "quantity": balance.quantity},
                reason=reason,
                metadata={
                    "movement_id": str(movement.id),
                    "origin": payload.origin,
                    "document": payload.document,
                    "acquisition_ids": [str(need.id) for need in fulfilled],
                    "invoice_id": str(payload.invoice_id) if payload.invoice_id else None,
                    "supplier_cnpj": payload.supplier_cnpj,
                    # Vínculo código do fornecedor → item informado (o cadastro-modelo, no caso de permanente).
                    "supplier_code": line.supplier_code,
                    "linked_item_id": str(item.id),
                },
            )
            movements.append(movement)
            received.append(target)
        await ensure_stock_alert(session, item)
    return movements, received
