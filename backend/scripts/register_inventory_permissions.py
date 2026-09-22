from __future__ import annotations

import argparse
import os
from typing import Iterable

import httpx


PERMISSIONS: list[tuple[str, str]] = [
    ("inventory:item:read", "Consultar itens do inventário"),
    ("inventory:item:create", "Cadastrar itens do inventário"),
    ("inventory:item:update", "Editar itens do inventário"),
    ("inventory:item:delete", "Inativar itens do inventário"),
    ("inventory:movement:request", "Solicitar saída de material"),
    ("inventory:movement:approve", "Aprovar ou reprovar saída de material"),
    ("inventory:withdrawal:request", "Solicitar retirada de uma lista de materiais"),
    ("inventory:withdrawal:approve", "Aprovar ou recusar retirada do paiol"),
    ("inventory:withdrawal:deliver", "Entregar material reservado do paiol"),
    ("inventory:return:request", "Solicitar devolução de material"),
    ("inventory:return:decide", "Aceitar ou recusar devolução"),
    ("inventory:writeoff:request", "Solicitar baixa de material de consumo"),
    ("inventory:writeoff:decide", "Aceitar ou recusar baixa de consumo"),
    ("inventory:custody:read", "Consultar pedidos de retirada e posse"),
    ("location:read", "Consultar locais"),
    ("location:create", "Cadastrar locais"),
    ("location:update", "Editar locais"),
    ("location:delete", "Inativar locais"),
    ("platform:read", "Consultar plataformas"),
    ("platform:create", "Cadastrar plataformas"),
    ("platform:update", "Editar plataformas"),
    ("platform:delete", "Excluir plataformas"),
    ("sensor:read", "Consultar sensores"),
    ("sensor:create", "Cadastrar sensores"),
    ("sensor:update", "Editar sensores"),
    ("sensor:delete", "Excluir sensores"),
    ("checklist:read", "Consultar checklists de campo"),
    ("checklist:create", "Criar rascunhos de checklist"),
    ("checklist:update", "Editar rascunhos de checklist"),
    ("checklist:delete", "Excluir checklists de campo"),
    ("checklist:submit", "Enviar checklists de campo"),
    ("audit:log:read", "Consultar logs de auditoria"),
    ("sync:write", "Sincronizar ações offline"),
]

DEFAULT_ROLE_NAME = "inventario-admin"
PAIOL_ROLE_NAME = "inventario-paiol"
USER_ROLE_NAME = "inventario-usuario"

# Decisão do paiol não entra na role administrativa. A role paiol recebe só este bloco.
PAIOL_DECISION_CODES = {
    "inventory:withdrawal:approve",
    "inventory:withdrawal:deliver",
    "inventory:return:decide",
    "inventory:writeoff:decide",
}
PAIOL_ROLE_CODES = [
    "inventory:item:read",
    "inventory:custody:read",
    *sorted(PAIOL_DECISION_CODES),
]
REQUEST_GRANT_CODES = {
    "inventory:withdrawal:request",
    "inventory:return:request",
    "inventory:writeoff:request",
    "inventory:custody:read",
}
USER_ROLE_CODES = [
    "inventory:item:read",
    "location:read",
    "platform:read",
    "sensor:read",
    "checklist:read",
    "checklist:submit",
    "inventory:movement:request",
    "inventory:withdrawal:request",
    "inventory:return:request",
    "inventory:writeoff:request",
    "inventory:custody:read",
    "sync:write",
]


def codes_for_admin(permissions: Iterable[tuple[str, str]] = PERMISSIONS) -> list[str]:
    return [code for code, _ in permissions if code not in PAIOL_DECISION_CODES]


def merged_request_grants(existing_codes: set[str]) -> set[str] | None:
    """Inclui permissões de pedido nas roles que já solicitam saída. Não concede decisão."""
    if "inventory:movement:request" not in existing_codes and "inventory:withdrawal:request" not in existing_codes:
        return None
    if REQUEST_GRANT_CODES <= existing_codes:
        return None
    return set(existing_codes) | set(REQUEST_GRANT_CODES)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Registra permissões do inventário no remobs-users e anexa a uma role.")
    parser.add_argument("--auth-api", default=os.getenv("REMOBS_AUTH_API_BASE_URL", "http://localhost:8015"))
    parser.add_argument("--token", default=os.getenv("REMOBS_ADMIN_TOKEN"))
    parser.add_argument(
        "--role-name",
        default=os.getenv("REMOBS_INVENTORY_ADMIN_ROLE", DEFAULT_ROLE_NAME),
        help="Role que receberá o catálogo administrativo (padrão: inventario-admin).",
    )
    parser.add_argument(
        "--skip-role-assign",
        action="store_true",
        help="Apenas registra permissões, sem anexar à role.",
    )
    parser.add_argument(
        "--paiol-role-name",
        default=os.getenv("REMOBS_PAIOL_ROLE", PAIOL_ROLE_NAME),
        help="Role do responsável pelo paiol (padrão: inventario-paiol).",
    )
    parser.add_argument(
        "--skip-request-grant",
        action="store_true",
        help="Não copia as permissões de pedido para roles que já solicitam saída.",
    )
    return parser.parse_args()


async def register_permissions(client: httpx.AsyncClient, permissions: Iterable[tuple[str, str]]) -> None:
    for code, description in permissions:
        response = await client.post("/permissions", json={"code": code, "description": description})
        if response.status_code in {200, 201}:
            print(f"{code}: created/updated")
            continue
        if response.status_code == 409:
            print(f"{code}: already exists")
            continue
        raise RuntimeError(f"Falha ao registrar {code}: {response.status_code} {response.text}")


async def find_role_id(client: httpx.AsyncClient, role_name: str) -> int | None:
    response = await client.get("/roles")
    if response.status_code != 200:
        raise RuntimeError(f"Falha ao listar roles: {response.status_code} {response.text}")
    for role in response.json():
        if role.get("name") == role_name:
            return int(role["id"])
    return None


async def ensure_role(client: httpx.AsyncClient, role_name: str) -> int:
    role_id = await find_role_id(client, role_name)
    if role_id is not None:
        print(f"role {role_name}: exists id={role_id}")
        return role_id

    response = await client.post("/roles", json={"name": role_name})
    if response.status_code not in {200, 201}:
        raise RuntimeError(f"Falha ao criar role {role_name}: {response.status_code} {response.text}")
    created_id = int(response.json()["id"])
    print(f"role {role_name}: created id={created_id}")
    return created_id


async def assign_role_permissions(client: httpx.AsyncClient, role_id: int, permission_codes: list[str]) -> None:
    # O endpoint de assign substitui o conjunto de permissões da role.
    # Para não remover permissões não-inventário, mescla com as já existentes.
    current = await client.get(f"/roles/{role_id}")
    if current.status_code != 200:
        raise RuntimeError(f"Falha ao ler role {role_id}: {current.status_code} {current.text}")
    existing_codes = {item["code"] for item in current.json().get("permissions") or []}
    merged = sorted(existing_codes.union(permission_codes))
    response = await client.post(f"/roles/{role_id}/permissions", json={"permission_codes": merged})
    if response.status_code not in {200, 201}:
        raise RuntimeError(f"Falha ao anexar permissões na role {role_id}: {response.status_code} {response.text}")
    print(f"role id={role_id}: assigned {len(permission_codes)} inventory permissions (total {len(merged)})")


async def grant_request_permissions(client: httpx.AsyncClient) -> None:
    response = await client.get("/roles")
    if response.status_code != 200:
        raise RuntimeError(f"Falha ao listar roles: {response.status_code} {response.text}")
    for role in response.json():
        role_id = int(role["id"])
        current = await client.get(f"/roles/{role_id}")
        if current.status_code != 200:
            raise RuntimeError(f"Falha ao ler role {role_id}: {current.status_code} {current.text}")
        existing_codes = {item["code"] for item in current.json().get("permissions") or []}
        merged = merged_request_grants(existing_codes)
        if merged is None:
            continue
        await assign_role_permissions(client, role_id, sorted(merged))
        print(f"role {role.get('name')}: permissões de pedido atualizadas")


async def run(
    auth_api: str,
    token: str,
    role_name: str,
    skip_role_assign: bool,
    paiol_role_name: str,
    skip_request_grant: bool,
    user_role_name: str = USER_ROLE_NAME,
) -> None:
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(base_url=auth_api.rstrip("/"), headers=headers, timeout=30) as client:
        await register_permissions(client, PERMISSIONS)
        if skip_role_assign:
            print("skip role assign")
            return
        role_id = await ensure_role(client, role_name)
        await assign_role_permissions(client, role_id, codes_for_admin())
        paiol_role_id = await ensure_role(client, paiol_role_name)
        await assign_role_permissions(client, paiol_role_id, PAIOL_ROLE_CODES)
        user_role_id = await ensure_role(client, user_role_name)
        await assign_role_permissions(client, user_role_id, USER_ROLE_CODES)
        if not skip_request_grant:
            await grant_request_permissions(client)


def main() -> None:
    args = parse_args()
    if not args.token:
        raise SystemExit("Informe REMOBS_ADMIN_TOKEN ou --token.")

    import asyncio

    asyncio.run(
        run(
            args.auth_api,
            args.token,
            args.role_name,
            args.skip_role_assign,
            args.paiol_role_name,
            args.skip_request_grant,
        )
    )


if __name__ == "__main__":
    main()
