# Consumível não exige número patrimonial

## Contexto

Desde a migração `0007_item_patrimony_unique`, todo item cadastrado recebia um número patrimonial (`REM-NNNNNN`), inclusive consumíveis. O número patrimonial serve para rastrear peças permanentes individualmente (etiqueta/QR Code); consumíveis são fungíveis e controlados por saldo, então não precisam de patrimônio.

## Objetivo

Deixar de gerar/exigir número patrimonial para itens do tipo `consumable`, mantendo o comportamento atual para `permanent_component`.

## Escopo

- Backend: no cadastro de item (`POST /inventory/items`), não gerar patrimônio quando `item_type == "consumable"`.
- Frontend: esconder o campo "Patrimônio" no formulário quando o tipo for consumível e não exibir "Patrimônio None" na mensagem de sucesso.
- Não alterar o recebimento por nota fiscal (já cria patrimônio apenas para unidades permanentes).

## Etapas

1. `backend/app/routers/inventory.py` — `create_item`: `patrimony_number = None` para consumível; permanente continua chamando `resolve_patrimony_number`.
2. `frontend/src/pages/InventoryFormPage.tsx` — campo "Patrimônio" só para `permanent_component`; mensagem de sucesso condicional ao patrimônio.
3. Teste `backend/tests/test_auth_inventory_contract.py::test_consumable_has_no_patrimony_but_permanent_does`.

## Validações

- `pytest tests/test_auth_inventory_contract.py` — 25 testes verdes (inclui o novo).
- Banco e frontend já aceitavam patrimônio nulo (`patrimony_number` é `nullable`; lista/QR já são condicionais).

## Resultado

Consumível novo é cadastrado sem patrimônio; permanente continua recebendo `REM-`.

## Pendências / fora de escopo

- Consumíveis já existentes em produção (numerados pela `0007`) mantêm o `REM-` atual. Removê-los exigiria migração de dados em produção — decisão do usuário, não executada aqui.
