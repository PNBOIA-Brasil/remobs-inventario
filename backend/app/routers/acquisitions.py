from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.permissions import require_permissions
from app.core.security import AuthUser
from app.schemas.acquisition import (
    AcquisitionCreate,
    AcquisitionListRead,
    AcquisitionRead,
    AcquisitionSuggestRead,
    AcquisitionUpdate,
)
from app.services.acquisition_service import create_need, list_needs, serialize_needs, suggest_all, update_need

router = APIRouter(prefix="/inventory/acquisitions", tags=["acquisitions"])

# Sem permissão nova: lê quem lê estoque; decide quem já aprova movimentação (gestor do inventário).
READ = ["inventory:item:read"]
MANAGE = ["inventory:movement:approve"]


@router.get("", response_model=AcquisitionListRead)
async def list_acquisitions(
    user: AuthUser = Depends(require_permissions(READ)),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    items = await serialize_needs(session, await list_needs(session))
    return {"items": items, "total": len(items)}


@router.post("", response_model=AcquisitionRead, status_code=status.HTTP_201_CREATED)
async def create_acquisition(
    payload: AcquisitionCreate,
    user: AuthUser = Depends(require_permissions(MANAGE)),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    need = await create_need(session, user=user, payload=payload)
    await session.commit()
    await session.refresh(need)
    return (await serialize_needs(session, [need]))[0]


@router.post("/suggest", response_model=AcquisitionSuggestRead)
async def suggest_acquisitions(
    user: AuthUser = Depends(require_permissions(MANAGE)),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    created = await suggest_all(session)
    await session.commit()
    return {"created": created}


@router.patch("/{need_id}", response_model=AcquisitionRead)
async def update_acquisition(
    need_id: uuid.UUID,
    payload: AcquisitionUpdate,
    user: AuthUser = Depends(require_permissions(MANAGE)),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    need = await update_need(session, user=user, need_id=need_id, payload=payload)
    await session.commit()
    await session.refresh(need)
    return (await serialize_needs(session, [need]))[0]
