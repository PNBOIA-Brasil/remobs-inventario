from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.inventory import InventoryItemRead, StockMovementRead


class ReceiptLineCreate(BaseModel):
    item_id: uuid.UUID
    quantity: int = Field(gt=0)
    # Código do produto na nota; com o CNPJ, vincula o item nas próximas notas do mesmo fornecedor.
    supplier_code: str | None = Field(default=None, max_length=80)


class ReceiptCreate(BaseModel):
    origin: Literal["compra", "doacao", "transferencia"]
    document: str | None = Field(default=None, max_length=160)
    location_id: uuid.UUID
    notes: str | None = None
    lines: list[ReceiptLineCreate] = Field(min_length=1)
    # Nota fiscal lida em /receipts/invoice/read: cabeçalho conferido pelo usuário.
    invoice_id: uuid.UUID | None = None
    invoice_number: str | None = Field(default=None, max_length=60)
    invoice_series: str | None = Field(default=None, max_length=20)
    supplier_name: str | None = Field(default=None, max_length=240)
    supplier_cnpj: str | None = Field(default=None, max_length=32)
    issue_date: date | None = None
    total_value: float | None = Field(default=None, ge=0)
    access_key: str | None = Field(default=None, max_length=60)


class ReceiptRead(BaseModel):
    movements: list[StockMovementRead]
    total_quantity: int
    # Itens que receberam saldo; permanente traz cada unidade nova (para imprimir etiquetas).
    items: list[InventoryItemRead]


class InvoiceLine(BaseModel):
    supplier_code: str | None = None
    description: str = ""
    unit: str | None = None
    quantity: float = 0
    unit_value: float | None = None
    total_value: float | None = None
    ncm: str | None = None


class InvoiceRead(BaseModel):
    """Dados lidos da nota pelo modelo de visão; tudo pode vir vazio e é conferido pelo usuário."""

    supplier_name: str | None = None
    supplier_cnpj: str | None = None
    number: str | None = None
    series: str | None = None
    issue_date: date | None = None
    total_value: float | None = None
    access_key: str | None = None
    lines: list[InvoiceLine] = Field(default_factory=list)
    uncertain_fields: list[str] = Field(default_factory=list)


class InvoiceSuggestion(BaseModel):
    item_id: uuid.UUID
    score: float
    match: Literal["supplier_code", "similar"]


class ReceivedInvoiceSummary(BaseModel):
    id: uuid.UUID
    number: str | None
    series: str | None
    supplier_name: str | None
    supplier_cnpj: str | None
    issue_date: date | None
    total_value: float | None
    access_key: str | None
    origin: str | None
    location_name: str | None
    notes: str | None
    received_by_username: str
    received_at: datetime
    lines: int
    units: int
    files: int


class ReceivedInvoiceList(BaseModel):
    items: list[ReceivedInvoiceSummary]
    total: int


class ReceivedInvoiceItem(BaseModel):
    item_id: uuid.UUID
    name: str
    patrimony_number: str | None
    item_type: str
    unit: str
    quantity: int


class ReceivedInvoiceDetail(ReceivedInvoiceSummary):
    received_items: list[ReceivedInvoiceItem]


class InvoiceReadResponse(InvoiceRead):
    invoice_id: uuid.UUID
    suggestions: list[list[InvoiceSuggestion]]
    # Mesma nota (chave de acesso, ou CNPJ + número) já registrada numa entrada.
    already_received: ReceivedInvoiceSummary | None = None
