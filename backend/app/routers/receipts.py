from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.permissions import require_any_permission
from app.core.security import AuthUser
from app.schemas.receipt import ReceiptCreate, ReceiptRead
from app.services.inventory_service import serialize_movement
from app.services.receipt_service import register_receipt

router = APIRouter(prefix="/inventory", tags=["receipts"])

# Quem edita item ou entrega no balcão (paiol) também recebe material.
RECEIPT_PERMISSIONS = ["inventory:item:update", "inventory:withdrawal:deliver"]


@router.post("/receipts", response_model=ReceiptRead, status_code=status.HTTP_201_CREATED)
async def create_receipt(
    payload: ReceiptCreate,
    user: AuthUser = Depends(require_any_permission(RECEIPT_PERMISSIONS)),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    movements = await register_receipt(session, user=user, payload=payload)
    await session.commit()
    return {
        "movements": [await serialize_movement(session, movement) for movement in movements],
        "total_quantity": sum(movement.quantity for movement in movements),
    }
