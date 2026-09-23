"""Recebimento por nota fiscal: leitura (modelo simulado), sugestões, vínculo por código do fornecedor e foto."""
from __future__ import annotations

import io
import uuid

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.core.errors import AppError
from app.routers import receipts
from app.schemas.receipt import InvoiceRead
from app.services.invoice_reader import check_quantities, parse_model_json, similarity, to_jpeg_pages
from test_auth_inventory_contract import client, database_schema  # noqa: F401
from test_fluxos_operacionais import PAIOL, REQUESTER, _item


def _png() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (40, 30), "white").save(buffer, "PNG")
    return buffer.getvalue()


def test_paginas_viram_jpeg_e_tipo_invalido_e_recusado() -> None:
    pdf = io.BytesIO()
    Image.new("RGB", (400, 560), "white").save(pdf, "PDF")
    [page] = to_jpeg_pages("application/pdf", pdf.getvalue())
    assert page[:2] == b"\xff\xd8"
    assert to_jpeg_pages("image/png", _png())[0][:2] == b"\xff\xd8"
    with pytest.raises(AppError):
        to_jpeg_pages("text/plain", b"abc")
    with pytest.raises(AppError):
        to_jpeg_pages("application/pdf", b"nao e pdf")


def test_resposta_do_modelo_aceita_cerca_e_recusa_lixo() -> None:
    read = parse_model_json('Segue:\n```json\n{"number": "12", "lines": [{"description": "X", "quantity": 2}]}\n```')
    assert (read.number, read.lines[0].quantity) == ("12", 2)
    with pytest.raises(AppError):
        parse_model_json("não consegui ler")


def test_quantidade_confere_com_total_dividido_pelo_unitario() -> None:
    read = check_quantities(InvoiceRead(lines=[
        {"description": "Cabo", "quantity": 50000, "unit_value": 18.9, "total_value": 945},
        {"description": "Manilha", "quantity": 12, "unit_value": 22.5, "total_value": 270},
        {"description": "Sem valor", "quantity": 3},
    ]))
    assert [line.quantity for line in read.lines] == [50, 12, 3]


def test_similaridade_ignora_acento_e_caixa() -> None:
    assert similarity("CABO PP 3X2,5MM ROLO 100M", "Cabo PP 3x2,5 mm rolo") > similarity("CABO PP 3X2,5MM ROLO 100M", "Bateria 12 V")


def test_le_nota_sugere_item_e_aprende_codigo_do_fornecedor(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    tag = uuid.uuid4().hex[:6]
    item_id, loc = _item(client, quantity=0, name=f"Manilha zincada {tag}")
    cnpj = f"{uuid.uuid4().int % 10**14:014d}"
    invoice = InvoiceRead(
        supplier_name="Fornecedor Teste",
        supplier_cnpj=cnpj,
        number="4521",
        lines=[{"supplier_code": f"C-{tag}", "description": f"MANILHA ZINCADA {tag.upper()}", "unit": "PC", "quantity": 12}],
    )
    monkeypatch.setattr(receipts, "read_invoice", lambda files: invoice)
    upload = {"files": ("nota.png", _png(), "image/png")}

    assert client.post("/inventory/receipts/invoice/read", headers=REQUESTER, files=upload).status_code == 403

    read = client.post("/inventory/receipts/invoice/read", headers=PAIOL, files=upload)
    assert read.status_code == 200, read.text
    body = read.json()
    assert body["number"] == "4521" and body["invoice_id"]
    assert body["suggestions"][0][0] == {"item_id": item_id, "score": body["suggestions"][0][0]["score"], "match": "similar"}

    receipt = client.post(
        "/inventory/receipts",
        headers=PAIOL,
        json={
            "origin": "compra",
            "document": "NF 4521",
            "location_id": loc,
            "invoice_id": body["invoice_id"],
            "supplier_cnpj": cnpj,
            "lines": [{"item_id": item_id, "quantity": 10, "supplier_code": f"C-{tag}"}],
        },
    )
    assert receipt.status_code == 201, receipt.text

    again = client.post("/inventory/receipts/invoice/read", headers=PAIOL, files=upload).json()
    assert again["suggestions"][0][0]["match"] == "supplier_code"
    assert again["suggestions"][0][0]["item_id"] == item_id


def test_foto_do_recebimento_so_aceita_imagem(client: TestClient) -> None:
    item_id, _ = _item(client, quantity=0)
    photo = client.post("/inventory/receipts/photos", headers=PAIOL, data={"item_id": item_id}, files={"file": ("f.png", _png(), "image/png")})
    assert photo.status_code == 201, photo.text
    assert photo.json()["file_role"] == "foto"
    text = client.post("/inventory/receipts/photos", headers=PAIOL, data={"item_id": item_id}, files={"file": ("f.txt", b"x", "text/plain")})
    assert text.status_code == 400
    assert client.post("/inventory/receipts/photos", headers=REQUESTER, data={"item_id": item_id}, files={"file": ("f.png", _png(), "image/png")}).status_code == 403
