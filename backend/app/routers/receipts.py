from __future__ import annotations

import asyncio
import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.errors import AppError
from app.core.permissions import require_any_permission, require_permissions
from app.core.security import AuthUser
from app.models.inventory import InventoryItem, ReceivedInvoice, StockMovement
from app.schemas.file import EntityFileListRead, EntityFileRead
from app.schemas.receipt import InvoiceReadResponse, ReceiptCreate, ReceiptRead, ReceivedInvoiceDetail, ReceivedInvoiceList
from app.services import file_storage
from app.services.file_service import attach_upload, get_entity_file_or_404, list_entity_files
from app.services.inventory_service import get_item_or_404, serialize_items_bulk, serialize_movement
from app.services.invoice_reader import read_invoice, suggest_items
from app.services.receipt_service import find_already_received, register_receipt, summarize_invoices

router = APIRouter(prefix="/inventory", tags=["receipts"])

# Quem edita item ou entrega no balcão (paiol) também recebe material.
RECEIPT_PERMISSIONS = ["inventory:item:update", "inventory:withdrawal:deliver"]


@router.post("/receipts", response_model=ReceiptRead, status_code=status.HTTP_201_CREATED)
async def create_receipt(
    payload: ReceiptCreate,
    user: AuthUser = Depends(require_any_permission(RECEIPT_PERMISSIONS)),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    movements, received = await register_receipt(session, user=user, payload=payload)
    await session.commit()
    items = list({item.id: item for item in received}.values())
    for item in items:
        await session.refresh(item)  # updated_at é gerado no banco e expira no flush.
    return {
        "movements": [await serialize_movement(session, movement) for movement in movements],
        "total_quantity": sum(movement.quantity for movement in movements),
        "items": await serialize_items_bulk(session, items),
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
    previous = await find_already_received(session, access_key=invoice.access_key, cnpj=invoice.supplier_cnpj, number=invoice.number)
    await session.commit()
    return {
        **invoice.model_dump(),
        "invoice_id": invoice_id,
        "suggestions": suggestions,
        "already_received": (await summarize_invoices(session, [previous]))[0] if previous else None,
    }


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


@router.get("/receipts/invoices/{invoice_id}/files", response_model=EntityFileListRead)
async def list_invoice_files(
    invoice_id: uuid.UUID,
    user: AuthUser = Depends(require_permissions(["inventory:item:read"])),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    """Páginas da nota fiscal guardadas no recebimento (S3 em produção)."""
    items = await list_entity_files(session, entity_type="invoice", entity_id=str(invoice_id))
    for entry in items:
        entry["download_path"] = f"/inventory/receipts/invoices/{invoice_id}/files/{entry['id']}/content"
    return {"items": items, "total": len(items)}


@router.get("/receipts/invoices/{invoice_id}/files/{entity_file_id}/content")
async def download_invoice_file(
    invoice_id: uuid.UUID,
    entity_file_id: uuid.UUID,
    user: AuthUser = Depends(require_permissions(["inventory:item:read"])),
    session: AsyncSession = Depends(get_async_session),
) -> Response:
    _entity_file, file_meta = await get_entity_file_or_404(
        session, entity_type="invoice", entity_id=str(invoice_id), entity_file_id=entity_file_id
    )
    headers = {"Content-Disposition": f'attachment; filename="{file_meta.original_name}"'}
    return Response(content=file_storage.read_bytes(file_meta.storage_key), media_type=file_meta.mime_type, headers=headers)


@router.get("/receipts/invoices", response_model=ReceivedInvoiceList)
async def list_received_invoices(
    user: AuthUser = Depends(require_permissions(["inventory:item:read"])),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    """Notas fiscais recebidas, da mais recente para a mais antiga."""
    # ponytail: teto de 500 notas sem paginação nem busca no servidor; a tela filtra. Paginar quando passar disso.
    query = select(ReceivedInvoice).order_by(ReceivedInvoice.received_at.desc()).limit(500)
    items = await summarize_invoices(session, list((await session.execute(query)).scalars()))
    return {"items": items, "total": len(items)}


@router.get("/receipts/invoices/{invoice_id}", response_model=ReceivedInvoiceDetail)
async def get_received_invoice(
    invoice_id: uuid.UUID,
    user: AuthUser = Depends(require_permissions(["inventory:item:read"])),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    invoice = await session.get(ReceivedInvoice, invoice_id)
    if not invoice:
        raise AppError("Nota fiscal não encontrada.", code="invoice_not_found", status_code=404)
    [summary] = await summarize_invoices(session, [invoice])
    rows = await session.execute(
        select(StockMovement, InventoryItem)
        .join(InventoryItem, InventoryItem.id == StockMovement.item_id)
        .where(StockMovement.invoice_id == invoice_id)
        .order_by(StockMovement.created_at, InventoryItem.name)
    )
    summary["received_items"] = [
        {
            "item_id": item.id,
            "name": item.name,
            "patrimony_number": item.patrimony_number,
            "item_type": item.item_type,
            "unit": item.unit,
            "quantity": movement.quantity,
        }
        for movement, item in rows
    ]
    return summary
