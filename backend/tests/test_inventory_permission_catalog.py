from scripts.register_inventory_permissions import (
    DEFAULT_ROLE_NAME,
    PAIOL_DECISION_CODES,
    PAIOL_ROLE_CODES,
    PAIOL_ROLE_NAME,
    USER_ROLE_CODES,
    USER_ROLE_NAME,
    codes_for_admin,
    merged_request_grants,
)


def test_inventory_role_names_use_inventario_prefix() -> None:
    assert DEFAULT_ROLE_NAME == "inventario-admin"
    assert PAIOL_ROLE_NAME == "inventario-paiol"
    assert USER_ROLE_NAME == "inventario-usuario"
    assert set(PAIOL_DECISION_CODES).isdisjoint(USER_ROLE_CODES)
    assert "inventory:withdrawal:request" in USER_ROLE_CODES
    assert "inventory:item:create" not in USER_ROLE_CODES


def test_admin_catalog_excludes_paiol_decisions() -> None:
    admin_codes = set(codes_for_admin())
    assert PAIOL_DECISION_CODES.isdisjoint(admin_codes)
    assert "inventory:withdrawal:request" in admin_codes
    assert "inventory:movement:approve" in admin_codes


def test_paiol_role_receives_only_decision_and_read() -> None:
    assert set(PAIOL_DECISION_CODES) <= set(PAIOL_ROLE_CODES)
    assert "inventory:item:read" in PAIOL_ROLE_CODES
    assert "inventory:custody:read" in PAIOL_ROLE_CODES
    assert "inventory:withdrawal:request" not in PAIOL_ROLE_CODES
    assert "inventory:item:update" not in PAIOL_ROLE_CODES


def test_request_grant_extends_roles_that_already_request_movement() -> None:
    merged = merged_request_grants({"inventory:movement:request", "inventory:item:read"})
    assert merged is not None
    assert "inventory:withdrawal:request" in merged
    assert "inventory:return:request" in merged
    assert "inventory:writeoff:request" in merged
    assert "inventory:custody:read" in merged
    assert "inventory:withdrawal:approve" not in merged
    assert merged_request_grants({"inventory:item:read"}) is None
    assert merged_request_grants(merged) is None
