from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.permissions import require_any_permission, require_permissions
from app.core.security import AuthUser
from app.schemas.custody import (
    CustodyRequestCreate,
    DecisionReason,
    WithdrawalApproval,
    WithdrawalCreate,
    WithdrawalListRead,
    WithdrawalOrderRead,
)
from app.services.custody_service import (
    DECISION_PERMISSIONS,
    approve_withdrawal,
    decide_custody_event,
    deliver_withdrawal,
    get_withdrawal,
    list_withdrawals,
    reject_withdrawal,
    request_return,
    request_writeoff,
    create_withdrawal,
    serialize_order,
    serialize_orders,
)

router = APIRouter(prefix="/inventory", tags=["withdrawals"])

READ_PERMISSIONS = [
    "inventory:custody:read",
    "inventory:withdrawal:request",
    "inventory:movement:request",
    "inventory:item:read",
    *DECISION_PERMISSIONS,
]
REQUEST_PERMISSIONS = [
    "inventory:withdrawal:request",
    "inventory:movement:request",
    "inventory:return:request",
    "inventory:writeoff:request",
]


@router.get("/withdrawals", response_model=WithdrawalListRead)
async def list_withdrawal_orders(
    user: AuthUser = Depends(require_any_permission(READ_PERMISSIONS)),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    orders = await list_withdrawals(session, user=user)
    items = await serialize_orders(session, orders, include_details=False)
    return {"items": items, "total": len(items)}


@router.post("/withdrawals", response_model=WithdrawalOrderRead, status_code=status.HTTP_201_CREATED)
async def create_withdrawal_order(
    payload: WithdrawalCreate,
    user: AuthUser = Depends(require_any_permission(["inventory:withdrawal:request", "inventory:movement:request"])),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    order = await create_withdrawal(session, user=user, reason=payload.reason, lines_payload=payload.lines)
    await session.commit()
    await session.refresh(order)
    return await serialize_order(session, order)


@router.get("/withdrawals/{order_id}", response_model=WithdrawalOrderRead)
async def read_withdrawal_order(
    order_id: uuid.UUID,
    user: AuthUser = Depends(require_any_permission(READ_PERMISSIONS)),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    order = await get_withdrawal(session, user=user, order_id=order_id)
    return await serialize_order(session, order)


@router.post("/withdrawals/{order_id}/approve", response_model=WithdrawalOrderRead)
async def approve_withdrawal_order(
    order_id: uuid.UUID,
    payload: WithdrawalApproval,
    user: AuthUser = Depends(require_permissions(["inventory:withdrawal:approve"])),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    order = await approve_withdrawal(
        session,
        user=user,
        order_id=order_id,
        reason=payload.reason,
        line_quantities={line.line_id: line.quantity for line in payload.lines} if payload.lines else None,
    )
    await session.commit()
    await session.refresh(order)
    return await serialize_order(session, order)


@router.post("/withdrawals/{order_id}/reject", response_model=WithdrawalOrderRead)
async def reject_withdrawal_order(
    order_id: uuid.UUID,
    payload: DecisionReason,
    user: AuthUser = Depends(require_permissions(["inventory:withdrawal:approve"])),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    order = await reject_withdrawal(session, user=user, order_id=order_id, reason=payload.reason)
    await session.commit()
    await session.refresh(order)
    return await serialize_order(session, order)


@router.post("/withdrawals/{order_id}/deliver", response_model=WithdrawalOrderRead)
async def deliver_withdrawal_order(
    order_id: uuid.UUID,
    payload: DecisionReason,
    user: AuthUser = Depends(require_permissions(["inventory:withdrawal:deliver"])),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    order = await deliver_withdrawal(session, user=user, order_id=order_id, reason=payload.reason)
    await session.commit()
    await session.refresh(order)
    return await serialize_order(session, order)


@router.post("/withdrawals/{order_id}/lines/{line_id}/return", response_model=WithdrawalOrderRead)
async def return_withdrawal_line(
    order_id: uuid.UUID,
    line_id: uuid.UUID,
    payload: CustodyRequestCreate,
    user: AuthUser = Depends(require_any_permission(REQUEST_PERMISSIONS)),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    order = await request_return(
        session,
        user=user,
        order_id=order_id,
        line_id=line_id,
        quantity=payload.quantity,
        reason=payload.reason,
    )
    await session.commit()
    await session.refresh(order)
    return await serialize_order(session, order)


@router.post("/withdrawals/{order_id}/lines/{line_id}/writeoff", response_model=WithdrawalOrderRead)
async def writeoff_withdrawal_line(
    order_id: uuid.UUID,
    line_id: uuid.UUID,
    payload: CustodyRequestCreate,
    user: AuthUser = Depends(require_any_permission(REQUEST_PERMISSIONS)),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    order = await request_writeoff(
        session,
        user=user,
        order_id=order_id,
        line_id=line_id,
        quantity=payload.quantity,
        reason=payload.reason,
    )
    await session.commit()
    await session.refresh(order)
    return await serialize_order(session, order)


@router.post("/custody-events/{event_id}/accept", response_model=WithdrawalOrderRead)
async def accept_custody_event(
    event_id: uuid.UUID,
    payload: DecisionReason,
    user: AuthUser = Depends(require_any_permission(["inventory:return:decide", "inventory:writeoff:decide"])),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    order = await decide_custody_event(session, user=user, event_id=event_id, accept=True, reason=payload.reason)
    await session.commit()
    await session.refresh(order)
    return await serialize_order(session, order)


@router.post("/custody-events/{event_id}/refuse", response_model=WithdrawalOrderRead)
async def refuse_custody_event(
    event_id: uuid.UUID,
    payload: DecisionReason,
    user: AuthUser = Depends(require_any_permission(["inventory:return:decide", "inventory:writeoff:decide"])),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    order = await decide_custody_event(session, user=user, event_id=event_id, accept=False, reason=payload.reason)
    await session.commit()
    await session.refresh(order)
    return await serialize_order(session, order)
