from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select


TEST_SECRET = "segredo-de-teste-remobs-com-tamanho-seguro"


def _configure_test_environment() -> None:
    db_path = Path(__file__).parent / f"test-{uuid.uuid4().hex}.sqlite"
    # Remove leftovers from runs anteriores (Windows pode manter lock no arquivo fixo).
    for stale in Path(__file__).parent.glob("test*.sqlite"):
        try:
            stale.unlink()
        except OSError:
            pass

    storage_path = Path(__file__).parent / "test_storage"
    if storage_path.exists():
        for child in storage_path.rglob("*"):
            if child.is_file():
                try:
                    child.unlink()
                except OSError:
                    pass
        for child in sorted(storage_path.rglob("*"), reverse=True):
            if child.is_dir():
                try:
                    child.rmdir()
                except OSError:
                    pass
        try:
            storage_path.rmdir()
        except OSError:
            pass

    os.environ["REMOBS_DATABASE_URL"] = f"sqlite+aiosqlite:///{db_path.as_posix()}"
    os.environ["REMOBS_DATABASE_SCHEMA"] = ""
    os.environ["REMOBS_JWT_SECRET"] = TEST_SECRET
    os.environ["REMOBS_JWT_ISSUER"] = "remobs-users"
    os.environ["REMOBS_JWT_AUDIENCE"] = "remobs-api"
    os.environ["REMOBS_ENVIRONMENT"] = "test"
    os.environ["REMOBS_STORAGE_LOCAL_PATH"] = str(storage_path)


_configure_test_environment()

from app.core.database import Base, engine  # noqa: E402
from app.core.database import AsyncSessionLocal  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models.alert import Alert  # noqa: E402
from app.models.checklist import FieldChecklist  # noqa: E402
from app.models.inventory import InventoryCategory, InventoryItem, Location, StockBalance, StockMovement  # noqa: E402
from app.models.platform import Hull, Platform, PlatformSystem  # noqa: E402
from app.models.sensor import Sensor, SensorInstallation  # noqa: E402
from app.models.sync import SyncAction  # noqa: E402
from app.models import *  # noqa: F401,F403,E402


def token_for(
    *,
    user_id: int = 7,
    username: str = "operacao",
    permissions: list[str] | None = None,
    roles: list[str] | None = None,
    expires_delta: timedelta = timedelta(hours=1),
) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "iss": "remobs-users",
        "aud": "remobs-api",
        "iat": now,
        "exp": now + expires_delta,
        "username": username,
        "roles": roles or ["operation"],
        "permissions": permissions or [],
        "resource_access": {},
    }
    return jwt.encode(payload, TEST_SECRET, algorithm="HS256")


@pytest.fixture(scope="module", autouse=True)
def database_schema() -> None:
    async def setup() -> None:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.drop_all)
            await connection.run_sync(Base.metadata.create_all)

    asyncio.run(setup())


@pytest.fixture()
def client() -> TestClient:
    app = create_app()
    return TestClient(app)


def auth_headers(permissions: list[str], *, user_id: int = 7, username: str = "operacao") -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token_for(user_id=user_id, username=username, permissions=permissions)}",
    }


def run_async(coro):
    return asyncio.run(coro)


def test_inventory_requires_valid_jwt(client: TestClient) -> None:
    response = client.get("/inventory/items")

    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "not_authenticated",
            "message": "Token de autenticação ausente.",
            "meta": {},
        }
    }


def test_inventory_rejects_missing_permission(client: TestClient) -> None:
    response = client.get("/inventory/items", headers=auth_headers(["platform:read"]))

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "permissions_missing"
    assert response.json()["error"]["meta"]["missing_permissions"] == ["inventory:item:read"]


def test_inventory_rejects_expired_jwt(client: TestClient) -> None:
    token = token_for(permissions=["inventory:item:read"], expires_delta=timedelta(seconds=-1))

    response = client.get("/inventory/items", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "token_expired"


def test_inventory_rejects_wrong_audience(client: TestClient) -> None:
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": "7",
            "iss": "remobs-users",
            "aud": "outra-api",
            "iat": now,
            "exp": now + timedelta(hours=1),
            "username": "operacao",
            "roles": ["operation"],
            "permissions": ["inventory:item:read"],
            "resource_access": {},
        },
        TEST_SECRET,
        algorithm="HS256",
    )

    response = client.get("/inventory/items", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_token_audience"


def test_inventory_accepts_valid_token_and_lists_items(client: TestClient) -> None:
    response = client.get("/inventory/items", headers=auth_headers(["inventory:item:read"]))

    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0}


def test_item_field_suggestions_prefix_and_distinct(client: TestClient) -> None:
    headers = auth_headers(["inventory:item:create", "inventory:item:read"])

    for name, brand, model in [
        ("Silicone bisnaga 200 ml", "Dow", "200 ml"),
        ("Silicone spray", "Dow", "Spray"),
        ("Cabo de aço 10mm", "Acme", "CA-10"),
    ]:
        response = client.post(
            "/inventory/items",
            headers=headers,
            json={
                "item_type": "consumable",
                "name": name,
                "brand": brand,
                "model": model,
                "category_name": "Consumíveis",
                "location_name": "Estoque",
                "unit": "un",
                "initial_quantity": 1,
                "reason": "Seed autocomplete.",
            },
        )
        assert response.status_code == 201

    name_response = client.get(
        "/inventory/items/suggestions",
        headers=headers,
        params={"field": "name", "q": "s"},
    )
    assert name_response.status_code == 200
    name_payload = name_response.json()
    assert name_payload["field"] == "name"
    assert name_payload["q"] == "s"
    assert "Silicone bisnaga 200 ml" in name_payload["items"]
    assert "Silicone spray" in name_payload["items"]
    assert "Cabo de aço 10mm" not in name_payload["items"]

    brand_response = client.get(
        "/inventory/items/suggestions",
        headers=headers,
        params={"field": "brand", "q": "d"},
    )
    assert brand_response.status_code == 200
    assert brand_response.json()["items"] == ["Dow"]

    model_response = client.get(
        "/inventory/items/suggestions",
        headers=headers,
        params={"field": "model", "q": "c"},
    )
    assert model_response.status_code == 200
    assert "CA-10" in model_response.json()["items"]

    empty_response = client.get(
        "/inventory/items/suggestions",
        headers=headers,
        params={"field": "name", "q": ""},
    )
    assert empty_response.status_code == 200
    assert empty_response.json()["items"] == []

    category_response = client.get(
        "/inventory/items/suggestions",
        headers=headers,
        params={"field": "category_name", "q": "c"},
    )
    assert category_response.status_code == 200
    assert "Consumíveis" in category_response.json()["items"]

    location_response = client.get(
        "/inventory/items/suggestions",
        headers=headers,
        params={"field": "location_name", "q": "e"},
    )
    assert location_response.status_code == 200
    assert "Estoque" in location_response.json()["items"]

    forbidden = client.get(
        "/inventory/items/suggestions",
        headers=auth_headers(["platform:read"]),
        params={"field": "name", "q": "s"},
    )
    assert forbidden.status_code == 403


def test_creates_inventory_item_with_stock_and_audit_log(client: TestClient) -> None:
    headers = auth_headers(["inventory:item:create", "inventory:item:read", "audit:log:read"])

    response = client.post(
        "/inventory/items",
        headers=headers,
        json={
            "item_type": "consumable",
            "name": "Silicone bisnaga 200 ml",
            "brand": "Dow",
            "model": "200 ml",
            "category_name": "Consumíveis",
            "location_name": "Estoque",
            "unit": "un",
            "initial_quantity": 10,
            "minimum_stock_national": 2,
            "reason": "Carga inicial de teste.",
        },
    )

    assert response.status_code == 201
    item = response.json()
    assert item["name"] == "Silicone bisnaga 200 ml"
    assert item["stock_total"] == 10
    assert item["balances"][0]["quantity"] == 10

    logs_response = client.get("/audit-logs", headers=headers)
    assert logs_response.status_code == 200
    actions = [entry["action"] for entry in logs_response.json()["items"]]
    assert "inventory_item_created" in actions


def test_creates_item_with_zero_quantity_still_has_balance_row(client: TestClient) -> None:
    headers = auth_headers(["inventory:item:create", "inventory:item:read"])
    response = client.post(
        "/inventory/items",
        headers=headers,
        json={
            "item_type": "permanent_component",
            "name": f"ADCP sem quantidade {uuid.uuid4()}",
            "category_name": "Sensores",
            "location_name": "Paiol PNBOIA",
            "unit": "un",
            "initial_quantity": 0,
            "reason": "Cadastro sem quantidade inicial.",
        },
    )
    assert response.status_code == 201
    item = response.json()
    assert item["current_location_name"] == "Paiol PNBOIA"
    assert item["stock_total"] == 0
    assert len(item["balances"]) == 1
    assert item["balances"][0]["location_name"] == "Paiol PNBOIA"
    assert item["balances"][0]["quantity"] == 0


def test_updates_item_location_creates_balance_at_new_location(client: TestClient) -> None:
    headers = auth_headers(["inventory:item:create", "inventory:item:read", "inventory:item:update"])
    created = client.post(
        "/inventory/items",
        headers=headers,
        json={
            "item_type": "permanent_component",
            "name": f"ADCP troca local {uuid.uuid4()}",
            "category_name": "Sensores",
            "location_name": "Estoque",
            "unit": "un",
            "initial_quantity": 1,
            "reason": "Cadastro inicial.",
        },
    )
    assert created.status_code == 201
    item_id = created.json()["id"]

    updated = client.patch(
        f"/inventory/items/{item_id}",
        headers=headers,
        json={"location_name": "Paiol PNBOIA", "reason": "Atualização de local."},
    )
    assert updated.status_code == 200
    payload = updated.json()
    assert payload["current_location_name"] == "Paiol PNBOIA"
    locations = {balance["location_name"]: balance["quantity"] for balance in payload["balances"]}
    assert "Paiol PNBOIA" in locations
    assert locations["Estoque"] == 1


def test_updates_inventory_item_without_missing_greenlet(client: TestClient) -> None:
    """PATCH deve recarregar updated_at (onupdate) antes de serializar; evita 500 MissingGreenlet."""
    headers = auth_headers(
        ["inventory:item:create", "inventory:item:read", "inventory:item:update", "audit:log:read"]
    )

    create_response = client.post(
        "/inventory/items",
        headers=headers,
        json={
            "item_type": "permanent_component",
            "name": f"ADCP editavel {uuid.uuid4()}",
            "brand": "Nortek",
            "model": "AquaPro",
            "category_name": "Sensor",
            "location_name": "Laboratorio",
            "unit": "un",
            "initial_quantity": 1,
            "reason": "Cadastro para teste de edição.",
        },
    )
    assert create_response.status_code == 201
    item_id = create_response.json()["id"]
    previous_version = create_response.json()["row_version"]

    update_response = client.patch(
        f"/inventory/items/{item_id}",
        headers=headers,
        json={
            "name": "ADCP atualizado",
            "brand": "Nortek",
            "model": "Signature 500",
            "serial_number": "SN-EDIT-1",
            "condition_status": "manutencao",
            "category_name": "Sensor",
            "location_name": "Laboratorio",
            "unit": "un",
            "minimum_stock_national": 0,
            "minimum_stock_import": 0,
            "minimum_stock_maintenance": 0,
            "ideal_stock": 1,
            "reason": "Atualização cadastral de teste.",
        },
    )
    assert update_response.status_code == 200, update_response.text
    updated = update_response.json()
    assert updated["name"] == "ADCP atualizado"
    assert updated["model"] == "Signature 500"
    assert updated["serial_number"] == "SN-EDIT-1"
    assert updated["condition_status"] == "manutencao"
    assert updated["row_version"] == previous_version + 1
    assert updated["updated_at"] is not None

    detail = client.get(f"/inventory/items/{item_id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["name"] == "ADCP atualizado"

    logs_response = client.get("/audit-logs", headers=headers)
    assert logs_response.status_code == 200
    actions = [entry["action"] for entry in logs_response.json()["items"]]
    assert "inventory_item_updated" in actions


def test_requests_and_approves_stock_movement(client: TestClient) -> None:
    admin_headers = auth_headers(["*"], user_id=1, username="admin")
    item_response = client.post(
        "/inventory/items",
        headers=admin_headers,
        json={
            "item_type": "consumable",
            "name": f"Cabo teste {uuid.uuid4()}",
            "category_name": "Cabos",
            "location_name": "Estoque",
            "unit": "un",
            "initial_quantity": 5,
            "reason": "Carga inicial.",
        },
    )
    item = item_response.json()
    from_location_id = item["balances"][0]["location_id"]

    request_response = client.post(
        "/inventory/movements/request",
        headers=auth_headers(["inventory:movement:request"], user_id=8, username="campo"),
        json={
            "item_id": item["id"],
            "quantity": 2,
            "from_location_id": from_location_id,
            "to_location_name": "Campo",
            "reason": "Uso em operação de campo.",
        },
    )

    assert request_response.status_code == 201
    movement = request_response.json()
    assert movement["status"] == "pending"

    approve_response = client.post(
        f"/inventory/movements/{movement['id']}/approve",
        headers=admin_headers,
        json={"reason": "Saída autorizada."},
    )

    assert approve_response.status_code == 200
    assert approve_response.json()["status"] == "approved"

    detail_response = client.get(f"/inventory/items/{item['id']}", headers=admin_headers)
    balances = {balance["location_name"]: balance["quantity"] for balance in detail_response.json()["balances"]}
    assert balances["Estoque"] == 3
    assert balances["Campo"] == 2


def test_platform_detail_returns_hull_systems_and_linked_sensors(client: TestClient) -> None:
    async def seed() -> tuple[str, str]:
        async with AsyncSessionLocal() as session:
            platform = Platform(
                name=f"Boia AXYS {uuid.uuid4()}",
                platform_type="boia_fixa",
                manufacturer="AXYS",
                model="3M",
                operational_status="em_operacao",
                description="Plataforma em operação para teste.",
            )
            sensor = Sensor(
                sensor_type="meteorologico",
                family="Anemometro Gill",
                brand="Gill",
                model="WindSonic",
                serial_number=f"SN-{uuid.uuid4()}",
                operational_status="em_operacao",
            )
            session.add_all([platform, sensor])
            await session.flush()
            session.add_all(
                [
                    Hull(platform_id=platform.id, code=f"AX-{uuid.uuid4()}", model="AXYS 3M", status="em_operacao"),
                    PlatformSystem(platform_id=platform.id, name="Energia", status="operacional", notes="Baterias carregadas."),
                    SensorInstallation(sensor_id=sensor.id, platform_id=platform.id, status="ativo", notes="Topo do mastro."),
                ]
            )
            await session.commit()
            return str(platform.id), str(sensor.id)

    platform_id, sensor_id = run_async(seed())

    response = client.get(f"/platforms/{platform_id}", headers=auth_headers(["platform:read"]))

    assert response.status_code == 200
    payload = response.json()
    assert payload["hull"]["status"] == "em_operacao"
    assert payload["systems"][0]["name"] == "Energia"
    assert payload["sensors"][0]["id"] == sensor_id
    assert payload["sensors"][0]["installation_status"] == "ativo"


def test_sensor_detail_returns_current_platform(client: TestClient) -> None:
    async def seed() -> tuple[str, str]:
        async with AsyncSessionLocal() as session:
            platform = Platform(
                name=f"Boia Sensor {uuid.uuid4()}",
                platform_type="boia_fixa",
                operational_status="em_operacao",
            )
            sensor = Sensor(
                sensor_type="oceanografico",
                family="ADCP",
                brand="Nortek",
                model="Aquadopp",
                serial_number=f"ADCP-{uuid.uuid4()}",
                operational_status="em_operacao",
            )
            session.add_all([platform, sensor])
            await session.flush()
            session.add(SensorInstallation(sensor_id=sensor.id, platform_id=platform.id, status="ativo"))
            await session.commit()
            return str(sensor.id), platform.name

    sensor_id, platform_name = run_async(seed())

    response = client.get(f"/sensors/{sensor_id}", headers=auth_headers(["sensor:read"]))

    assert response.status_code == 200
    payload = response.json()
    assert payload["family"] == "ADCP"
    assert payload["current_platform"]["name"] == platform_name
    assert payload["installations"][0]["status"] == "ativo"


def test_checklist_can_be_created_updated_and_submitted(client: TestClient) -> None:
    headers = auth_headers(["checklist:submit"])

    create_response = client.post(
        "/checklists",
        headers=headers,
        json={
            "title": "Checklist AXYS",
            "template_name": "Operacional padrão",
            "platform_name": "Boia AXYS Campo",
            "total_steps": 4,
            "answers": {"energia.baterias_instaladas": True},
        },
    )

    assert create_response.status_code == 201
    checklist = create_response.json()
    assert checklist["status"] == "draft"
    assert checklist["current_step"] == 1

    update_response = client.patch(
        f"/checklists/{checklist['id']}",
        headers=headers,
        json={
            "current_step": 2,
            "answers": {
                "energia.baterias_instaladas": True,
                "energia.quantidade_baterias": 4,
            },
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["answers"]["energia.quantidade_baterias"] == 4

    submit_response = client.post(
        f"/checklists/{checklist['id']}/submit",
        headers=headers,
        json={"reason": "Checklist concluído em campo."},
    )
    assert submit_response.status_code == 200
    assert submit_response.json()["status"] == "submitted"


def test_sync_conflict_resolution_updates_action_status(client: TestClient) -> None:
    client_action_id = f"offline-{uuid.uuid4()}"

    async def seed() -> None:
        async with AsyncSessionLocal() as session:
            session.add(
                SyncAction(
                    client_action_id=client_action_id,
                    action_type="movement_request",
                    entity_type="stock_movement",
                    payload={"item": "Silicone", "requested_quantity": 4, "server_quantity": 2},
                    user_id=7,
                    username="operacao",
                    status="conflict",
                    error_message="Estoque alterado no servidor.",
                )
            )
            await session.commit()

    run_async(seed())
    headers = auth_headers(["sync:write"], user_id=7, username="operacao")

    conflicts_response = client.get("/sync/conflicts", headers=headers)

    assert conflicts_response.status_code == 200
    assert conflicts_response.json()["items"][0]["client_action_id"] == client_action_id

    resolve_response = client.post(
        "/sync/resolve-conflict",
        headers=headers,
        json={
            "client_action_id": client_action_id,
            "decision": "discard",
            "reason": "Solicitação descartada após conferência de estoque.",
        },
    )

    assert resolve_response.status_code == 200
    assert resolve_response.json()["status"] == "discarded"


def test_dashboard_summary_returns_aggregated_operational_counts(client: TestClient) -> None:
    user_id = 7

    async def seed_and_count() -> dict[str, int]:
        async with AsyncSessionLocal() as session:
            suffix = str(uuid.uuid4())
            category = InventoryCategory(name=f"Categoria dashboard {suffix}")
            location = Location(name=f"Local dashboard {suffix}")
            session.add_all([category, location])
            await session.flush()

            critical_item = InventoryItem(
                item_type="consumable",
                category_id=category.id,
                name=f"Item crítico dashboard {suffix}",
                current_location_id=location.id,
                minimum_stock_national=5,
            )
            healthy_item = InventoryItem(
                item_type="consumable",
                category_id=category.id,
                name=f"Item saudável dashboard {suffix}",
                current_location_id=location.id,
                minimum_stock_national=1,
            )
            platform_operation = Platform(
                name=f"Plataforma em operação {suffix}",
                platform_type="boia_fixa",
                operational_status="em_operacao",
            )
            platform_maintenance = Platform(
                name=f"Plataforma em manutenção {suffix}",
                platform_type="boia_fixa",
                operational_status="em_manutencao",
            )
            broken_sensor = Sensor(
                sensor_type="meteorologico",
                family=f"Sensor com alerta {suffix}",
                operational_status="avariado",
            )
            submitted_checklist = FieldChecklist(
                title=f"Checklist enviado {suffix}",
                template_name="Operacional",
                status="submitted",
                submitted_by_id=user_id,
                submitted_by_username="operacao",
            )
            draft_checklist = FieldChecklist(
                title=f"Checklist rascunho {suffix}",
                template_name="Operacional",
                status="draft",
                submitted_by_id=user_id,
                submitted_by_username="operacao",
            )
            session.add_all(
                [
                    critical_item,
                    healthy_item,
                    platform_operation,
                    platform_maintenance,
                    broken_sensor,
                    submitted_checklist,
                    draft_checklist,
                ]
            )
            await session.flush()
            session.add_all(
                [
                    StockBalance(item_id=critical_item.id, location_id=location.id, quantity=2),
                    StockBalance(item_id=healthy_item.id, location_id=location.id, quantity=3),
                    StockMovement(
                        item_id=critical_item.id,
                        quantity=1,
                        requested_by_id=user_id,
                        requested_by_username="operacao",
                        status="pending",
                        reason="Solicitação pendente de teste.",
                    ),
                    SyncAction(
                        client_action_id=f"pendente-{suffix}",
                        action_type="movement_request",
                        entity_type="stock_movement",
                        payload={},
                        user_id=user_id,
                        username="operacao",
                        status="pending",
                    ),
                    SyncAction(
                        client_action_id=f"conflito-{suffix}",
                        action_type="movement_request",
                        entity_type="stock_movement",
                        payload={},
                        user_id=user_id,
                        username="operacao",
                        status="conflict",
                    ),
                    Alert(
                        alert_type="estoque_minimo",
                        severity="critical",
                        entity_type="inventory_item",
                        entity_id=str(critical_item.id),
                        title=f"Alerta crítico dashboard {suffix}",
                        message="Estoque abaixo do mínimo.",
                        status="open",
                    ),
                ]
            )
            await session.commit()

            stock_totals = (
                select(
                    StockBalance.item_id.label("item_id"),
                    func.coalesce(func.sum(StockBalance.quantity), 0).label("stock_total"),
                )
                .group_by(StockBalance.item_id)
                .subquery()
            )

            return {
                "items_registered": int(
                    await session.scalar(
                        select(func.count())
                        .select_from(InventoryItem)
                        .where(InventoryItem.deleted_at.is_(None), InventoryItem.is_active.is_(True))
                    )
                    or 0
                ),
                "critical_stock": int(
                    await session.scalar(
                        select(func.count())
                        .select_from(InventoryItem)
                        .outerjoin(stock_totals, stock_totals.c.item_id == InventoryItem.id)
                        .where(
                            InventoryItem.deleted_at.is_(None),
                            InventoryItem.is_active.is_(True),
                            InventoryItem.minimum_stock_national > 0,
                            func.coalesce(stock_totals.c.stock_total, 0) < InventoryItem.minimum_stock_national,
                        )
                    )
                    or 0
                ),
                "pending_requests": int(
                    await session.scalar(select(func.count()).select_from(StockMovement).where(StockMovement.status == "pending"))
                    or 0
                ),
                "platforms_in_operation": int(
                    await session.scalar(
                        select(func.count())
                        .select_from(Platform)
                        .where(Platform.deleted_at.is_(None), Platform.operational_status == "em_operacao")
                    )
                    or 0
                ),
                "platforms_in_maintenance": int(
                    await session.scalar(
                        select(func.count())
                        .select_from(Platform)
                        .where(
                            Platform.deleted_at.is_(None),
                            Platform.operational_status.in_(["manutencao", "em_manutencao", "offline"]),
                        )
                    )
                    or 0
                ),
                "sensors_with_alert": int(
                    await session.scalar(
                        select(func.count())
                        .select_from(Sensor)
                        .where(Sensor.deleted_at.is_(None), Sensor.operational_status.in_(["avariado", "inconsistencia"]))
                    )
                    or 0
                ),
                "checklists_registered": int(
                    await session.scalar(select(func.count()).select_from(FieldChecklist)) or 0
                ),
                "checklists_submitted": int(
                    await session.scalar(
                        select(func.count()).select_from(FieldChecklist).where(FieldChecklist.status == "submitted")
                    )
                    or 0
                ),
                "offline_pending": int(
                    await session.scalar(
                        select(func.count())
                        .select_from(SyncAction)
                        .where(SyncAction.user_id == user_id, SyncAction.status == "pending")
                    )
                    or 0
                ),
                "offline_conflicts": int(
                    await session.scalar(
                        select(func.count())
                        .select_from(SyncAction)
                        .where(SyncAction.user_id == user_id, SyncAction.status == "conflict")
                    )
                    or 0
                ),
            }

    expected = run_async(seed_and_count())

    response = client.get("/dashboard/summary", headers=auth_headers(["*"], user_id=user_id))

    assert response.status_code == 200
    payload = response.json()
    for key, value in expected.items():
        assert payload[key] == value
    assert payload["critical_stock_items"][0]["stock_total"] < payload["critical_stock_items"][0]["minimum_stock_national"]
    assert payload["critical_alerts"][0]["severity"] == "critical"


def test_item_file_upload_list_download_and_delete(client: TestClient) -> None:
    headers = auth_headers(["inventory:item:create", "inventory:item:read", "inventory:item:update", "audit:log:read"])

    item_response = client.post(
        "/inventory/items",
        headers=headers,
        json={
            "item_type": "permanent_component",
            "name": f"Sensor com anexo {uuid.uuid4()}",
            "category_name": "Sensores",
            "location_name": "Laboratório",
            "unit": "un",
            "initial_quantity": 1,
            "reason": "Item para teste de upload.",
        },
    )
    assert item_response.status_code == 201
    item_id = item_response.json()["id"]

    png_bytes = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N"
        b"\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    upload_response = client.post(
        f"/inventory/items/{item_id}/files",
        headers=headers,
        data={"file_role": "foto", "notes": "Foto de identificação"},
        files={"file": ("sensor.png", png_bytes, "image/png")},
    )
    assert upload_response.status_code == 201, upload_response.text
    uploaded = upload_response.json()
    assert uploaded["file_role"] == "foto"
    assert uploaded["original_name"] == "sensor.png"
    assert uploaded["mime_type"] == "image/png"
    assert uploaded["size_bytes"] == len(png_bytes)
    entity_file_id = uploaded["id"]

    list_response = client.get(f"/inventory/items/{item_id}/files", headers=headers)
    assert list_response.status_code == 200
    listed = list_response.json()
    assert listed["total"] == 1
    assert listed["items"][0]["id"] == entity_file_id

    download_response = client.get(
        f"/inventory/items/{item_id}/files/{entity_file_id}/content",
        headers=headers,
    )
    assert download_response.status_code == 200
    assert download_response.content == png_bytes
    assert download_response.headers["content-type"].startswith("image/png")

    delete_response = client.request(
        "DELETE",
        f"/inventory/items/{item_id}/files/{entity_file_id}",
        headers=headers,
        json={"reason": "Arquivo de teste removido."},
    )
    assert delete_response.status_code == 200
    assert delete_response.json() == {"status": "ok"}

    after_delete = client.get(f"/inventory/items/{item_id}/files", headers=headers)
    assert after_delete.status_code == 200
    assert after_delete.json() == {"items": [], "total": 0}

    missing = client.get(
        f"/inventory/items/{item_id}/files/{entity_file_id}/content",
        headers=headers,
    )
    assert missing.status_code == 404


def test_item_file_rejects_invalid_image_type(client: TestClient) -> None:
    headers = auth_headers(["inventory:item:create", "inventory:item:read", "inventory:item:update"])
    item_response = client.post(
        "/inventory/items",
        headers=headers,
        json={
            "item_type": "consumable",
            "name": f"Item sem foto inválida {uuid.uuid4()}",
            "category_name": "Consumíveis",
            "location_name": "Estoque",
            "unit": "un",
            "initial_quantity": 1,
            "reason": "Teste MIME.",
        },
    )
    item_id = item_response.json()["id"]

    response = client.post(
        f"/inventory/items/{item_id}/files",
        headers=headers,
        data={"file_role": "foto"},
        files={"file": ("malware.exe", b"MZ fake", "application/octet-stream")},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "unsupported_image_type"


def test_platform_create_accepts_granular_or_legacy_permission(client: TestClient) -> None:
    granular = client.post(
        "/platforms",
        headers=auth_headers(["platform:create"]),
        json={"name": f"Boia granular {uuid.uuid4()}", "platform_type": "boia_fixa"},
    )
    assert granular.status_code == 201

    legacy = client.post(
        "/platforms",
        headers=auth_headers(["platform:update"]),
        json={"name": f"Boia legado {uuid.uuid4()}", "platform_type": "boia_fixa"},
    )
    assert legacy.status_code == 201

    denied = client.post(
        "/platforms",
        headers=auth_headers(["platform:read"]),
        json={"name": f"Boia sem perm {uuid.uuid4()}", "platform_type": "boia_fixa"},
    )
    assert denied.status_code == 403


def test_sensor_delete_soft_and_permission_legacy(client: TestClient) -> None:
    headers = auth_headers(["sensor:create", "sensor:read", "sensor:delete"])
    create_response = client.post(
        "/sensors",
        headers=headers,
        json={"sensor_type": "meteorologico", "family": f"Sensor del {uuid.uuid4()}"},
    )
    assert create_response.status_code == 201
    sensor_id = create_response.json()["id"]

    delete_response = client.request(
        "DELETE",
        f"/sensors/{sensor_id}",
        headers=headers,
        json={"reason": "Remoção de teste."},
    )
    assert delete_response.status_code == 200
    assert delete_response.json() == {"status": "ok"}

    missing = client.get(f"/sensors/{sensor_id}", headers=headers)
    assert missing.status_code == 404

    legacy_headers = auth_headers(["sensor:update", "sensor:read"])
    create_legacy = client.post(
        "/sensors",
        headers=legacy_headers,
        json={"sensor_type": "meteorologico", "family": f"Sensor legado {uuid.uuid4()}"},
    )
    assert create_legacy.status_code == 201
    legacy_id = create_legacy.json()["id"]
    delete_legacy = client.request(
        "DELETE",
        f"/sensors/{legacy_id}",
        headers=legacy_headers,
        json={"reason": "Remoção via legado update."},
    )
    assert delete_legacy.status_code == 200


def test_checklist_delete_any_status_with_reason(client: TestClient) -> None:
    headers = auth_headers(["checklist:create", "checklist:read", "checklist:submit", "checklist:delete"])
    create_response = client.post(
        "/checklists",
        headers=headers,
        json={
            "title": f"Checklist del {uuid.uuid4()}",
            "template_name": "campo",
            "total_steps": 1,
        },
    )
    assert create_response.status_code == 201
    checklist_id = create_response.json()["id"]

    submit_response = client.post(
        f"/checklists/{checklist_id}/submit",
        headers=headers,
        json={"reason": "Envio para teste de exclusão."},
    )
    assert submit_response.status_code == 200
    assert submit_response.json()["status"] == "submitted"

    delete_response = client.request(
        "DELETE",
        f"/checklists/{checklist_id}",
        headers=headers,
        json={"reason": "Exclusão de checklist submitted."},
    )
    assert delete_response.status_code == 200
    assert delete_response.json() == {"status": "ok"}

    missing = client.get(f"/checklists/{checklist_id}", headers=headers)
    assert missing.status_code == 404


def test_checklist_list_accepts_read_or_submit_permission(client: TestClient) -> None:
    only_read = client.get("/checklists", headers=auth_headers(["checklist:read"]))
    assert only_read.status_code == 200

    only_submit = client.get("/checklists", headers=auth_headers(["checklist:submit"]))
    assert only_submit.status_code == 200

    denied = client.get("/checklists", headers=auth_headers(["inventory:item:read"]))
    assert denied.status_code == 403


def test_locations_crud_and_autocomplete_permissions(client: TestClient) -> None:
    headers = auth_headers(
        [
            "location:read",
            "location:create",
            "location:update",
            "location:delete",
            "audit:log:read",
        ]
    )

    create_response = client.post(
        "/locations",
        headers=headers,
        json={"name": "Galpão A", "location_type": "estoque"},
    )
    assert create_response.status_code == 201
    location = create_response.json()
    assert location["name"] == "Galpão A"
    assert location["is_active"] is True
    location_id = location["id"]

    list_response = client.get("/locations", headers=headers, params={"q": "Gal"})
    assert list_response.status_code == 200
    assert list_response.json()["total"] >= 1
    assert any(item["id"] == location_id for item in list_response.json()["items"])

    # Operador de saída também pode listar locais para autocomplete.
    movement_list = client.get(
        "/locations",
        headers=auth_headers(["inventory:movement:request"]),
        params={"active_only": True},
    )
    assert movement_list.status_code == 200

    update_response = client.patch(
        f"/locations/{location_id}",
        headers=headers,
        json={"name": "Galpão A1", "reason": "Renomear local."},
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Galpão A1"

    conflict = client.post(
        "/locations",
        headers=headers,
        json={"name": "galpão a1", "location_type": "estoque"},
    )
    assert conflict.status_code == 409

    delete_response = client.request(
        "DELETE",
        f"/locations/{location_id}",
        headers=headers,
        json={"reason": "Inativar local de teste."},
    )
    assert delete_response.status_code == 200
    assert delete_response.json() == {"status": "ok"}

    active_only = client.get("/locations", headers=headers, params={"active_only": True})
    assert active_only.status_code == 200
    assert all(item["id"] != location_id for item in active_only.json()["items"])

    including_inactive = client.get("/locations", headers=headers, params={"active_only": False})
    assert including_inactive.status_code == 200
    assert any(item["id"] == location_id and item["is_active"] is False for item in including_inactive.json()["items"])


def _bearer(
    permissions: list[str],
    *,
    user_id: int,
    username: str,
    roles: list[str],
) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token_for(user_id=user_id, username=username, permissions=permissions, roles=roles)}",
    }


def _stock_at(client: TestClient, headers: dict[str, str], item_id: str, location_name: str) -> dict:
    detail = client.get(f"/inventory/items/{item_id}", headers=headers)
    assert detail.status_code == 200, detail.text
    return next(row for row in detail.json()["balances"] if row["location_name"] == location_name)


def test_withdrawal_custody_flow(client: TestClient) -> None:
    admin_headers = auth_headers(["*"], user_id=1, username="admin")
    requester = _bearer(
        ["inventory:withdrawal:request", "inventory:item:read"],
        user_id=8,
        username="campo",
        roles=["operacao"],
    )
    # Paiol comum não autoaprova; só admin do inventário (movement:approve ou *) pode.
    requester_star = _bearer(["inventory:withdrawal:approve"], user_id=8, username="campo", roles=["paiol"])
    paiol = _bearer(
        [
            "inventory:item:read",
            "inventory:custody:read",
            "inventory:withdrawal:approve",
            "inventory:withdrawal:deliver",
            "inventory:return:decide",
            "inventory:writeoff:decide",
        ],
        user_id=3,
        username="paiol",
        roles=["paiol"],
    )
    other = _bearer(
        ["inventory:withdrawal:request"],
        user_id=9,
        username="outro",
        roles=["operacao"],
    )

    consumable = client.post(
        "/inventory/items",
        headers=admin_headers,
        json={
            "item_type": "consumable",
            "name": f"Cabo paiol {uuid.uuid4()}",
            "category_name": "Cabos",
            "location_name": "Estoque",
            "unit": "un",
            "initial_quantity": 5,
            "reason": "Carga inicial.",
        },
    )
    assert consumable.status_code == 201, consumable.text
    consumable_id = consumable.json()["id"]
    consumable_location = consumable.json()["balances"][0]["location_id"]

    permanent = client.post(
        "/inventory/items",
        headers=admin_headers,
        json={
            "item_type": "permanent_component",
            "name": f"ADCP paiol {uuid.uuid4()}",
            "category_name": "Sensor",
            "location_name": "Estoque",
            "unit": "un",
            "initial_quantity": 1,
            "reason": "Carga inicial.",
        },
    )
    assert permanent.status_code == 201, permanent.text
    permanent_id = permanent.json()["id"]
    permanent_location = permanent.json()["balances"][0]["location_id"]

    created = client.post(
        "/inventory/withdrawals",
        headers=requester,
        json={
            "reason": "Saída para manutenção de campo.",
            "lines": [
                {"item_id": consumable_id, "quantity": 2, "from_location_id": consumable_location},
                {"item_id": permanent_id, "quantity": 1, "from_location_id": permanent_location},
            ],
        },
    )
    assert created.status_code == 201, created.text
    order = created.json()
    order_id = order["id"]
    assert order["status"] == "pending_approval"
    assert len(order["lines"]) == 2
    assert _stock_at(client, admin_headers, consumable_id, "Estoque") == {
        **_stock_at(client, admin_headers, consumable_id, "Estoque"),
        "quantity": 5,
        "reserved_quantity": 2,
    }
    assert _stock_at(client, admin_headers, permanent_id, "Estoque")["reserved_quantity"] == 1
    assert _stock_at(client, admin_headers, permanent_id, "Estoque")["quantity"] == 1

    self_approve = client.post(
        f"/inventory/withdrawals/{order_id}/approve",
        headers=requester_star,
        json={"reason": "Tentativa do próprio solicitante."},
    )
    assert self_approve.status_code == 403
    assert self_approve.json()["error"]["code"] == "self_decision_denied"

    early_deliver = client.post(
        f"/inventory/withdrawals/{order_id}/deliver",
        headers=paiol,
        json={"reason": "Entrega antes da aprovação."},
    )
    assert early_deliver.status_code == 409
    assert early_deliver.json()["error"]["code"] == "withdrawal_not_approved"

    extra = client.post(
        "/inventory/withdrawals",
        headers=requester,
        json={
            "reason": "Pedido extra para recusa.",
            "lines": [{"item_id": consumable_id, "quantity": 1, "from_location_id": consumable_location}],
        },
    )
    assert extra.status_code == 201, extra.text
    assert _stock_at(client, admin_headers, consumable_id, "Estoque")["reserved_quantity"] == 3
    rejected = client.post(
        f"/inventory/withdrawals/{extra.json()['id']}/reject",
        headers=paiol,
        json={"reason": "Sem necessidade operacional."},
    )
    assert rejected.status_code == 200, rejected.text
    assert rejected.json()["status"] == "rejected"
    assert _stock_at(client, admin_headers, consumable_id, "Estoque")["quantity"] == 5
    assert _stock_at(client, admin_headers, consumable_id, "Estoque")["reserved_quantity"] == 2
    assert any(entry["action"] == "withdrawal_rejected" and "paiol" in entry["actor_roles"] for entry in rejected.json()["audit_trail"])

    overflow = client.post(
        "/inventory/withdrawals",
        headers=requester,
        json={
            "reason": "Pedido acima do disponível.",
            "lines": [{"item_id": consumable_id, "quantity": 4, "from_location_id": consumable_location}],
        },
    )
    assert overflow.status_code == 409
    assert overflow.json()["error"]["code"] == "stock_insufficient"

    approved = client.post(
        f"/inventory/withdrawals/{order_id}/approve",
        headers=paiol,
        json={"reason": "Retirada autorizada pelo paiol."},
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "approved"
    assert _stock_at(client, admin_headers, consumable_id, "Estoque")["quantity"] == 5
    assert _stock_at(client, admin_headers, consumable_id, "Estoque")["reserved_quantity"] == 2

    delivered = client.post(
        f"/inventory/withdrawals/{order_id}/deliver",
        headers=paiol,
        json={"reason": "Material entregue em mãos."},
    )
    assert delivered.status_code == 200, delivered.text
    assert delivered.json()["status"] == "delivered"
    consumable_line = next(line for line in delivered.json()["lines"] if line["item_id"] == consumable_id)
    permanent_line = next(line for line in delivered.json()["lines"] if line["item_id"] == permanent_id)
    assert consumable_line["custody_quantity"] == 2
    assert permanent_line["custody_quantity"] == 1
    assert _stock_at(client, admin_headers, consumable_id, "Estoque")["quantity"] == 3
    assert _stock_at(client, admin_headers, consumable_id, "Estoque")["reserved_quantity"] == 0
    assert _stock_at(client, admin_headers, permanent_id, "Estoque")["quantity"] == 0

    hidden = client.get("/inventory/withdrawals", headers=other)
    assert hidden.status_code == 200
    assert all(item["id"] != order_id for item in hidden.json()["items"])
    denied = client.get(f"/inventory/withdrawals/{order_id}", headers=other)
    assert denied.status_code == 404

    partial_return = client.post(
        f"/inventory/withdrawals/{order_id}/lines/{consumable_line['id']}/return",
        headers=requester,
        json={"quantity": 1, "reason": "Sobra de cabo."},
    )
    assert partial_return.status_code == 201 or partial_return.status_code == 200, partial_return.text
    return_event = next(event for event in partial_return.json()["events"] if event["status"] == "pending")
    accepted_return = client.post(
        f"/inventory/custody-events/{return_event['id']}/accept",
        headers=paiol,
        json={"reason": "Devolução conferida."},
    )
    assert accepted_return.status_code == 200, accepted_return.text
    assert _stock_at(client, admin_headers, consumable_id, "Estoque")["quantity"] == 4
    assert next(line for line in accepted_return.json()["lines"] if line["item_id"] == consumable_id)["custody_quantity"] == 1

    writeoff = client.post(
        f"/inventory/withdrawals/{order_id}/lines/{consumable_line['id']}/writeoff",
        headers=requester,
        json={"quantity": 1, "reason": "Cabo consumido na manutenção."},
    )
    assert writeoff.status_code == 200, writeoff.text
    writeoff_event = next(event for event in writeoff.json()["events"] if event["event_type"] == "baixa" and event["status"] == "pending")
    accepted_writeoff = client.post(
        f"/inventory/custody-events/{writeoff_event['id']}/accept",
        headers=paiol,
        json={"reason": "Baixa de consumo confirmada."},
    )
    assert accepted_writeoff.status_code == 200, accepted_writeoff.text
    assert _stock_at(client, admin_headers, consumable_id, "Estoque")["quantity"] == 4
    assert next(line for line in accepted_writeoff.json()["lines"] if line["item_id"] == consumable_id)["custody_quantity"] == 0

    permanent_writeoff = client.post(
        f"/inventory/withdrawals/{order_id}/lines/{permanent_line['id']}/writeoff",
        headers=requester,
        json={"quantity": 1, "reason": "Tentar baixar permanente."},
    )
    assert permanent_writeoff.status_code == 409
    assert permanent_writeoff.json()["error"]["code"] == "writeoff_not_consumable"

    refused_return = client.post(
        f"/inventory/withdrawals/{order_id}/lines/{permanent_line['id']}/return",
        headers=requester,
        json={"quantity": 1, "reason": "Devolução do ADCP."},
    )
    assert refused_return.status_code == 200, refused_return.text
    refused_event = next(event for event in refused_return.json()["events"] if event["status"] == "pending")
    refusal = client.post(
        f"/inventory/custody-events/{refused_event['id']}/refuse",
        headers=paiol,
        json={"reason": "Equipamento ainda em uso."},
    )
    assert refusal.status_code == 200, refusal.text
    assert _stock_at(client, admin_headers, permanent_id, "Estoque")["quantity"] == 0
    assert next(line for line in refusal.json()["lines"] if line["item_id"] == permanent_id)["custody_quantity"] == 1
    assert any(entry["action"] == "return_refused" for entry in refusal.json()["audit_trail"])

    final_return = client.post(
        f"/inventory/withdrawals/{order_id}/lines/{permanent_line['id']}/return",
        headers=requester,
        json={"quantity": 1, "reason": "Devolução definitiva do ADCP."},
    )
    assert final_return.status_code == 200, final_return.text
    final_event = next(event for event in final_return.json()["events"] if event["status"] == "pending")
    closed = client.post(
        f"/inventory/custody-events/{final_event['id']}/accept",
        headers=paiol,
        json={"reason": "ADCP voltou ao paiol."},
    )
    assert closed.status_code == 200, closed.text
    assert closed.json()["status"] == "closed"
    assert _stock_at(client, admin_headers, permanent_id, "Estoque")["quantity"] == 1
    assert next(line for line in closed.json()["lines"] if line["item_id"] == permanent_id)["custody_quantity"] == 0

    actions = [entry["action"] for entry in closed.json()["audit_trail"]]
    for action in (
        "withdrawal_requested",
        "withdrawal_approved",
        "withdrawal_delivered",
        "return_requested",
        "return_accepted",
        "writeoff_requested",
        "writeoff_accepted",
        "return_refused",
    ):
        assert action in actions
    approved_entry = next(entry for entry in closed.json()["audit_trail"] if entry["action"] == "withdrawal_approved")
    assert approved_entry["actor_username"] == "paiol"
    assert "paiol" in approved_entry["actor_roles"]
    assert approved_entry["reason"] == "Retirada autorizada pelo paiol."

    history = client.get(f"/inventory/items/{consumable_id}/history", headers=admin_headers)
    assert history.status_code == 200
    history_actions = {entry["action"] for entry in history.json()["audit_logs"]}
    assert "withdrawal_requested" in history_actions
    movement_types = {entry["movement_type"] for entry in history.json()["movements"]}
    assert {"reserva", "entrega", "devolucao", "baixa"} <= movement_types
