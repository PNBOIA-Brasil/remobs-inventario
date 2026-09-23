from __future__ import annotations

import io
import json
import re
import unicodedata
from difflib import SequenceMatcher

import boto3
import pypdfium2 as pdfium
from botocore.exceptions import BotoCoreError, ClientError
from PIL import Image, ImageOps
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AppError
from app.models.audit_log import AuditLog
from app.models.inventory import InventoryItem
from app.schemas.receipt import InvoiceRead

IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_PAGES = 10

PROMPT = """Você lê notas fiscais brasileiras (DANFE de NF-e) em foto ou PDF, possivelmente em várias páginas.
Extraia os dados e responda SOMENTE com um objeto JSON, sem texto antes ou depois, neste formato:
{"supplier_name": str|null, "supplier_cnpj": str|null, "number": str|null, "series": str|null,
 "issue_date": "AAAA-MM-DD"|null, "total_value": number|null, "access_key": str|null,
 "lines": [{"supplier_code": str|null, "description": str, "unit": str|null, "quantity": number,
            "unit_value": number|null, "total_value": number|null, "ncm": str|null}],
 "uncertain_fields": [str]}
Regras: uma entrada em "lines" por produto da tabela "DADOS DOS PRODUTOS", na ordem da nota, somando todas as páginas;
copie a descrição como está; na nota a vírgula é o separador decimal e o ponto o de milhar
("50,000" = 50; "1.234,50" = 1234.5); no JSON use ponto decimal e nenhum separador de milhar;
"uncertain_fields" lista os campos do cabeçalho que ficaram ilegíveis ou duvidosos (use os nomes das chaves).
Se não for uma nota fiscal, responda {"lines": []}."""


def _client():
    """Cliente do Bedrock; com `invoice_ai_role_arn`, assume a role da conta de IA (acesso entre contas)."""
    if not settings.invoice_ai_role_arn:
        return boto3.client("bedrock-runtime", region_name=settings.invoice_ai_region)
    # ponytail: assume a role a cada leitura (~100 ms); cachear as credenciais se o volume crescer.
    creds = boto3.client("sts", region_name=settings.invoice_ai_region).assume_role(
        RoleArn=settings.invoice_ai_role_arn, RoleSessionName="remobs-inventario-invoice"
    )["Credentials"]
    return boto3.client(
        "bedrock-runtime",
        region_name=settings.invoice_ai_region,
        aws_access_key_id=creds["AccessKeyId"],
        aws_secret_access_key=creds["SecretAccessKey"],
        aws_session_token=creds["SessionToken"],
    )


def to_jpeg_pages(mime_type: str, content: bytes) -> list[bytes]:
    """Foto ou PDF → páginas JPEG de até 2000 px: o modelo não lê PDF e recusa imagens acima de 3,75 MB."""
    mime = (mime_type or "").split(";")[0].strip().lower()
    try:
        if mime == "application/pdf":
            pdf = pdfium.PdfDocument(content)
            images = [pdf[index].render(scale=2).to_pil() for index in range(min(len(pdf), MAX_PAGES))]
        elif mime in IMAGE_TYPES:
            images = [ImageOps.exif_transpose(Image.open(io.BytesIO(content)))]
        else:
            raise AppError("Envie a nota como foto (JPG, PNG, WEBP) ou PDF.", code="unsupported_invoice_type", status_code=400)
    except (pdfium.PdfiumError, OSError) as exc:
        raise AppError("Arquivo da nota corrompido ou protegido.", code="invalid_invoice_file", status_code=400) from exc
    pages = []
    for image in images:
        image = image.convert("RGB")
        image.thumbnail((2000, 2000))
        buffer = io.BytesIO()
        image.save(buffer, "JPEG", quality=85)
        pages.append(buffer.getvalue())
    return pages


def parse_model_json(text: str) -> InvoiceRead:
    """Aceita o JSON puro ou cercado por ```json …```/texto; recusa o que não validar no schema."""
    match = re.search(r"\{.*\}", text or "", re.DOTALL)
    try:
        return InvoiceRead.model_validate(json.loads(match.group(0) if match else ""))
    except (json.JSONDecodeError, ValidationError) as exc:
        raise AppError("Não foi possível entender a nota. Tente uma foto mais nítida.", code="invoice_unreadable", status_code=422) from exc


def read_invoice(files: list[tuple[str, bytes]]) -> InvoiceRead:
    """Envia as páginas (mime, bytes) ao modelo de visão do Bedrock e devolve cabeçalho e linhas da nota."""
    if not files:
        raise AppError("Envie ao menos uma página da nota.", code="empty_invoice", status_code=400)
    if len(files) > MAX_PAGES:
        raise AppError(f"Envie no máximo {MAX_PAGES} arquivos por nota.", code="too_many_pages", status_code=400)
    pages = [page for mime, data in files for page in to_jpeg_pages(mime, data)]
    if len(pages) > MAX_PAGES:
        raise AppError(f"A nota pode ter no máximo {MAX_PAGES} páginas.", code="too_many_pages", status_code=400)
    content: list[dict] = [{"image": {"format": "jpeg", "source": {"bytes": page}}} for page in pages]
    content.append({"text": PROMPT})
    try:
        response = _client().converse(
            modelId=settings.invoice_ai_model_id,
            messages=[{"role": "user", "content": content}],
            inferenceConfig={"maxTokens": 8000, "temperature": 0},
        )
    except (BotoCoreError, ClientError) as exc:
        raise AppError("O serviço de leitura de notas está indisponível. Tente de novo ou lance manualmente.", code="invoice_ai_unavailable", status_code=502) from exc
    text = "".join(block.get("text", "") for block in response["output"]["message"]["content"])
    return check_quantities(parse_model_json(text))


def check_quantities(invoice: InvoiceRead) -> InvoiceRead:
    """Quantidade que não fecha com total ÷ unitário (ex.: "50,000" lido como 50000) é recalculada."""
    for line in invoice.lines:
        if line.unit_value and line.total_value:
            expected = round(line.total_value / line.unit_value, 3)
            if abs(expected - line.quantity) > max(0.01, expected * 0.01):
                line.quantity = expected
    return invoice


def normalize(text: str | None) -> str:
    plain = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode().lower()
    return " ".join(re.findall(r"[a-z0-9]+", plain))


def similarity(a: str, b: str) -> float:
    """Mistura sequência de caracteres e palavras em comum; 0 a 1."""
    na, nb = normalize(a), normalize(b)
    if not na or not nb:
        return 0.0
    ta, tb = set(na.split()), set(nb.split())
    overlap = len(ta & tb) / max(len(ta), len(tb))
    return round(0.5 * SequenceMatcher(None, na, nb).ratio() + 0.5 * overlap, 3)


async def known_supplier_codes(session: AsyncSession, cnpj: str | None) -> dict[str, str]:
    """Código do fornecedor → item, aprendido das entradas por nota já registradas (log de auditoria)."""
    digits = re.sub(r"\D", "", cnpj or "")
    if not digits:
        return {}
    # ponytail: varre as últimas 2000 entradas em Python; tabela própria se o histórico crescer muito.
    rows = (
        await session.execute(
            select(AuditLog.entity_id, AuditLog.audit_metadata)
            .where(AuditLog.action == "receipt_registered")
            .order_by(AuditLog.occurred_at.desc())
            .limit(2000)
        )
    ).all()
    mapping: dict[str, str] = {}
    for entity_id, meta in rows:
        meta = meta or {}
        code = meta.get("supplier_code")
        if code and re.sub(r"\D", "", meta.get("supplier_cnpj") or "") == digits:
            mapping.setdefault(str(code).strip(), entity_id)
    return mapping


async def suggest_items(session: AsyncSession, invoice: InvoiceRead, limit: int = 3) -> list[list[dict]]:
    """Até `limit` itens do estoque por linha; o item já vinculado ao código do fornecedor vem primeiro."""
    items = (await session.execute(select(InventoryItem).where(InventoryItem.deleted_at.is_(None), InventoryItem.is_active.is_(True)))).scalars().all()
    by_id = {str(item.id): item for item in items}
    known = await known_supplier_codes(session, invoice.supplier_cnpj)
    result = []
    for line in invoice.lines:
        scored = sorted(((similarity(line.description, item.name), item) for item in items), key=lambda pair: pair[0], reverse=True)
        # Um por nome: permanentes repetem o nome em cada unidade e só o patrimônio muda.
        picks, names = [], set()
        for score, item in scored:
            if len(picks) == limit or score < 0.35:
                break
            if normalize(item.name) not in names:
                names.add(normalize(item.name))
                picks.append({"item_id": item.id, "score": score, "match": "similar"})
        linked = by_id.get(known.get((line.supplier_code or "").strip(), ""))
        if linked:
            picks = [{"item_id": linked.id, "score": 1.0, "match": "supplier_code"}] + [p for p in picks if p["item_id"] != linked.id][: limit - 1]
        result.append(picks)
    return result
