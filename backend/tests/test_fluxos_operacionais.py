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
