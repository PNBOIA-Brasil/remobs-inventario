"""Fluxos do redesenho: aprovação por linha, finalidade, entrada, aquisição e leitura de etiqueta."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from test_auth_inventory_contract import _bearer, _stock_at, auth_headers, client, database_schema  # noqa: F401

ADMIN = auth_headers(["*"], user_id=1, username="admin")
REQUESTER = _bearer(["inventory:withdrawal:request", "inventory:item:read"], user_id=8, username="campo", roles=["operacao"])
PAIOL = _bearer(
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


def _item(client: TestClient, *, quantity: int, item_type: str = "consumable", **extra) -> tuple[str, str]:
    response = client.post(
        "/inventory/items",
        headers=ADMIN,
        json={
            "item_type": item_type,
            "name": f"Item fluxo {uuid.uuid4()}",
            "category_name": "Fluxo",
            "location_name": "Paiol fluxo",
            "unit": "un",
            "initial_quantity": quantity,
            "reason": "Carga inicial.",
            **extra,
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    return body["id"], body["balances"][0]["location_id"]


def _order(client: TestClient, lines: list[tuple[str, str, int]], **extra) -> dict:
    response = client.post(
        "/inventory/withdrawals",
        headers=REQUESTER,
        json={
            "reason": "Manutenção de campo.",
            "lines": [{"item_id": i, "from_location_id": loc, "quantity": q} for i, loc, q in lines],
            **extra,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_aprova_por_linha_parcial_e_recusa(client: TestClient) -> None:
    a_id, a_loc = _item(client, quantity=5)
    b_id, b_loc = _item(client, quantity=4)
    order = _order(client, [(a_id, a_loc, 3), (b_id, b_loc, 2)])
    line_a = next(line for line in order["lines"] if line["item_id"] == a_id)
    line_b = next(line for line in order["lines"] if line["item_id"] == b_id)

    too_much = client.post(
        f"/inventory/withdrawals/{order['id']}/approve",
        headers=PAIOL,
        json={"reason": "Excesso.", "lines": [{"line_id": line_a["id"], "quantity": 4}]},
    )
    assert too_much.status_code == 422

    approved = client.post(
        f"/inventory/withdrawals/{order['id']}/approve",
        headers=PAIOL,
        json={
            "reason": "Parcial por saldo.",
            "lines": [{"line_id": line_a["id"], "quantity": 1}, {"line_id": line_b["id"], "quantity": 0}],
        },
    )
    assert approved.status_code == 200, approved.text
    body = approved.json()
    assert body["status"] == "approved"
    statuses = {line["item_id"]: (line["status"], line["quantity"]) for line in body["lines"]}
    assert statuses == {a_id: ("reserved", 1), b_id: ("rejected", 2)}
    assert _stock_at(client, ADMIN, a_id, "Paiol fluxo")["reserved_quantity"] == 1
    assert _stock_at(client, ADMIN, b_id, "Paiol fluxo")["reserved_quantity"] == 0

    delivered = client.post(f"/inventory/withdrawals/{order['id']}/deliver", headers=PAIOL, json={"reason": "Entregue."})
    assert delivered.status_code == 200, delivered.text
    assert _stock_at(client, ADMIN, a_id, "Paiol fluxo")["quantity"] == 4
    assert _stock_at(client, ADMIN, b_id, "Paiol fluxo")["quantity"] == 4

    writeoff = client.post(
        f"/inventory/withdrawals/{order['id']}/lines/{line_a['id']}/writeoff",
        headers=REQUESTER,
        json={"quantity": 1, "reason": "Consumido."},
    )
    event_id = writeoff.json()["events"][0]["id"]
    listed = client.get("/inventory/withdrawals", headers=PAIOL).json()["items"]
    assert any(event["id"] == event_id for item in listed for event in item["events"])
    closed = client.post(f"/inventory/custody-events/{event_id}/accept", headers=PAIOL, json={"reason": "Conferido."})
    assert closed.json()["status"] == "closed"


def test_aprovacao_com_todas_as_linhas_zeradas_recusa_o_pedido(client: TestClient) -> None:
    a_id, a_loc = _item(client, quantity=2)
    order = _order(client, [(a_id, a_loc, 2)])
    response = client.post(
        f"/inventory/withdrawals/{order['id']}/approve",
        headers=PAIOL,
        json={"reason": "Sem necessidade.", "lines": [{"line_id": order["lines"][0]["id"], "quantity": 0}]},
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "rejected"
    assert _stock_at(client, ADMIN, a_id, "Paiol fluxo")["reserved_quantity"] == 0


def test_finalidade_emprestimo_exige_prazo_e_plataforma_exige_destino(client: TestClient) -> None:
    from datetime import date, timedelta

    a_id, a_loc = _item(client, quantity=3)
    line = [{"item_id": a_id, "from_location_id": a_loc, "quantity": 1}]

    sem_prazo = client.post("/inventory/withdrawals", headers=REQUESTER, json={"reason": "Empréstimo.", "lines": line, "purpose": "emprestimo"})
    assert sem_prazo.status_code == 422
    assert sem_prazo.json()["error"]["code"] == "due_date_required"

    passado = (date.today() - timedelta(days=1)).isoformat()
    vencido = client.post(
        "/inventory/withdrawals",
        headers=REQUESTER,
        json={"reason": "Empréstimo.", "lines": line, "purpose": "emprestimo", "due_date": passado},
    )
    assert vencido.status_code == 422

    prazo = (date.today() + timedelta(days=3)).isoformat()
    ok = client.post(
        "/inventory/withdrawals",
        headers=REQUESTER,
        json={"reason": "Empréstimo.", "lines": line, "purpose": "emprestimo", "due_date": prazo},
    )
    assert ok.status_code == 201, ok.text
    assert (ok.json()["purpose"], ok.json()["due_date"]) == ("emprestimo", prazo)

    sem_destino = client.post("/inventory/withdrawals", headers=REQUESTER, json={"reason": "Instalação.", "lines": line, "purpose": "plataforma"})
    assert sem_destino.status_code == 422

    platform = client.post("/platforms", headers=ADMIN, json={"name": f"Boia fluxo {uuid.uuid4()}", "platform_type": "boia"})
    assert platform.status_code == 201, platform.text
    destino = client.post(
        "/inventory/withdrawals",
        headers=REQUESTER,
        json={"reason": "Instalação.", "lines": line, "purpose": "plataforma", "platform_id": platform.json()["id"]},
    )
    assert destino.status_code == 201, destino.text
    assert destino.json()["platform_name"] == platform.json()["name"]
    assert destino.json()["due_date"] is None

    padrao = _order(client, [(a_id, a_loc, 1)])
    assert padrao["purpose"] == "consumo"


def test_entrada_soma_saldo_grava_movimento_e_historico(client: TestClient) -> None:
    item_id, loc = _item(client, quantity=1, minimum_stock_national=5)

    campo = client.post(
        "/inventory/receipts",
        headers=REQUESTER,
        json={"origin": "compra", "location_id": loc, "lines": [{"item_id": item_id, "quantity": 1}]},
    )
    assert campo.status_code == 403

    duplicada = client.post(
        "/inventory/receipts",
        headers=PAIOL,
        json={"origin": "compra", "location_id": loc, "lines": [{"item_id": item_id, "quantity": 1}] * 2},
    )
    assert duplicada.status_code == 422

    response = client.post(
        "/inventory/receipts",
        headers=PAIOL,
        json={
            "origin": "compra",
            "document": "NF 004.221",
            "location_id": loc,
            "notes": "Conferido com a nota.",
            "lines": [{"item_id": item_id, "quantity": 6}],
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["total_quantity"] == 6
    movement = body["movements"][0]
    assert (movement["movement_type"], movement["status"], movement["to_location_id"]) == ("entrada", "completed", loc)
    assert movement["reason"] == "Compra · documento NF 004.221. Conferido com a nota."
    assert _stock_at(client, ADMIN, item_id, "Paiol fluxo")["quantity"] == 7

    history = client.get(f"/inventory/items/{item_id}/history", headers=ADMIN).json()
    assert any(entry["action"] == "receipt_registered" for entry in history["audit_logs"])


def _needs_for(client: TestClient, item_id: str) -> list[dict]:
    response = client.get("/inventory/acquisitions", headers=REQUESTER)
    assert response.status_code == 200, response.text
    return [need for need in response.json()["items"] if need["item_id"] == item_id]


def test_aquisicao_sugerida_pelo_minimo_segue_etapas_e_fecha_na_entrada(client: TestClient) -> None:
    item_id, loc = _item(client, quantity=2, minimum_stock_national=5, ideal_stock=10)
    [need] = _needs_for(client, item_id)
    assert (need["status"], need["quantity"], need["origin"], need["priority"]) == ("sugerida", 8, "automatica", "media")

    # Nova queda de saldo não duplica a sugestão aberta.
    order = _order(client, [(item_id, loc, 1)])
    client.post(f"/inventory/withdrawals/{order['id']}/approve", headers=PAIOL, json={"reason": "Ok."})
    client.post(f"/inventory/withdrawals/{order['id']}/deliver", headers=PAIOL, json={"reason": "Ok."})
    assert len(_needs_for(client, item_id)) == 1

    forbidden = client.patch(f"/inventory/acquisitions/{need['id']}", headers=PAIOL, json={"status": "aprovada", "reason": "Ok."})
    assert forbidden.status_code == 403
    skip = client.patch(f"/inventory/acquisitions/{need['id']}", headers=ADMIN, json={"status": "atendida", "reason": "Pular."})
    assert skip.status_code == 409

    for step in ("aprovada", "em_compra"):
        moved = client.patch(
            f"/inventory/acquisitions/{need['id']}",
            headers=ADMIN,
            json={"status": step, "process_number": "PROC-7", "reason": f"Etapa {step}."},
        )
        assert moved.status_code == 200, moved.text
    assert moved.json()["process_number"] == "PROC-7"

    partial = client.post(
        "/inventory/receipts",
        headers=PAIOL,
        json={"origin": "compra", "location_id": loc, "lines": [{"item_id": item_id, "quantity": 3}]},
    )
    assert partial.status_code == 201, partial.text
    [need] = _needs_for(client, item_id)
    assert (need["status"], need["received_quantity"]) == ("em_compra", 3)

    client.post(
        "/inventory/receipts",
        headers=PAIOL,
        json={"origin": "compra", "location_id": loc, "lines": [{"item_id": item_id, "quantity": 5}]},
    )
    needs = _needs_for(client, item_id)
    assert [(n["status"], n["received_quantity"]) for n in needs] == [("atendida", 8)]


def test_aquisicao_manual_e_varredura(client: TestClient) -> None:
    item_id, _ = _item(client, quantity=0)
    created = client.post(
        "/inventory/acquisitions",
        headers=ADMIN,
        json={"item_id": item_id, "quantity": 4, "priority": "alta", "reason": "Reposição planejada."},
    )
    assert created.status_code == 201, created.text
    assert (created.json()["status"], created.json()["origin"]) == ("aprovada", "manual")
    assert client.post("/inventory/acquisitions/suggest", headers=ADMIN).status_code == 200
    assert len(_needs_for(client, item_id)) == 1


def test_busca_de_itens_acha_por_patrimonio_e_serie(client: TestClient) -> None:
    patrimonio = f"PAT-{uuid.uuid4().hex[:8]}"
    serie = f"SN-{uuid.uuid4().hex[:8]}"
    item_id, _ = _item(client, quantity=1, item_type="permanent_component", patrimony_number=patrimonio, serial_number=serie)

    for code in (patrimonio, serie.lower()):
        found = client.get("/inventory/items", headers=REQUESTER, params={"q": code}).json()["items"]
        assert [item["id"] for item in found] == [item_id]


def test_admin_do_inventario_ve_e_aprova_pedido_de_outro_mas_nao_entrega(client: TestClient) -> None:
    gestor = _bearer(
        ["inventory:item:read", "inventory:movement:approve", "inventory:withdrawal:request"],
        user_id=24,
        username="gestor",
        roles=["inventario-admin"],
    )
    a_id, a_loc = _item(client, quantity=3)
    order = _order(client, [(a_id, a_loc, 1)])

    listed = client.get("/inventory/withdrawals", headers=gestor).json()["items"]
    assert any(item["id"] == order["id"] for item in listed)

    approved = client.post(f"/inventory/withdrawals/{order['id']}/approve", headers=gestor, json={"reason": "Aprovado pela gestão."})
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "approved"
    assert client.post(f"/inventory/withdrawals/{order['id']}/deliver", headers=gestor, json={"reason": "Tentativa."}).status_code == 403

    own = client.post(
        "/inventory/withdrawals",
        headers=gestor,
        json={"reason": "Pedido do gestor.", "lines": [{"item_id": a_id, "from_location_id": a_loc, "quantity": 1}]},
    ).json()
    assert client.post(f"/inventory/withdrawals/{own['id']}/reject", headers=gestor, json={"reason": "Próprio."}).status_code == 403
