from __future__ import annotations

import asyncio
import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.errors import AppError
from app.core.permissions import require_any_permission
from app.core.security import AuthUser
from app.schemas.file import EntityFileRead
from app.schemas.receipt import InvoiceReadResponse, ReceiptCreate, ReceiptRead
from app.services.file_service import attach_upload
from app.services.inventory_service import get_item_or_404, serialize_movement
from app.services.invoice_reader import read_invoice, suggest_items
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


@router.post("/receipts/invoice/read", response_model=InvoiceReadResponse)
async def read_receipt_invoice(
    files: list[UploadFile] = File(...),
    user: AuthUser = Depends(require_any_permission(RECEIPT_PERMISSIONS)),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    """Lê a nota (fotos ou PDF), guarda os arquivos e sugere o item do estoque de cada linha."""
    pages = [(upload.filename or "nota", upload.content_type or "", await upload.read()) for upload in files]
    if any(not content for _name, _mime, content in pages):
        raise AppError("Arquivo vazio não é permitido.", code="empty_file", status_code=400)
    invoice = await asyncio.to_thread(read_invoice, [(mime, content) for _name, mime, content in pages])
    invoice_id = uuid.uuid4()
    label = f"NF {invoice.number or 'sem número'}"
    for name, mime, content in pages:
        await attach_upload(
            session,
            actor=user,
            entity_type="invoice",
            entity_id=str(invoice_id),
            entity_label=label,
            file_role="documento",
            original_name=name,
            mime_type=mime,
            content=content,
        )
    suggestions = await suggest_items(session, invoice)
    await session.commit()
    return {**invoice.model_dump(), "invoice_id": invoice_id, "suggestions": suggestions}


@router.post("/receipts/photos", response_model=EntityFileRead, status_code=status.HTTP_201_CREATED)
async def upload_receipt_photo(
    item_id: uuid.UUID = Form(...),
    file: UploadFile = File(...),
    user: AuthUser = Depends(require_any_permission(RECEIPT_PERMISSIONS)),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    """Foto do material tirada no recebimento; só imagem, para quem recebe mas não edita o item."""
    item = await get_item_or_404(session, item_id)
    content = await file.read()
    result = await attach_upload(
        session,
        actor=user,
        entity_type="inventory_item",
        entity_id=str(item.id),
        entity_label=item.name,
        file_role="foto",
        original_name=file.filename or "foto.jpg",
        mime_type=file.content_type or "application/octet-stream",
        content=content,
        notes="Foto do recebimento.",
    )
    await session.commit()
    return result
