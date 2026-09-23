# Admin do inventário aprova pedidos de retirada

## Contexto

Em 2026-09-22 a decisão do paiol ficou fora do papel `inventario-admin`: aprovar e recusar exigiam `inventory:withdrawal:approve`, que só o `inventario-paiol` tem. Como o admin também tem `inventory:withdrawal:request`, ele via apenas os próprios pedidos e não conseguia aprovar nenhum.

O usuário pediu que o admin também possa aprovar pedidos.

## Decisão

Aceitar `inventory:movement:approve`, que o `inventario-admin` já tem, como alternativa a `inventory:withdrawal:approve` para:

- aprovar e recusar pedidos (inclusive por linha);
- ver os pedidos de todos, para ter a fila de aprovação.

Não há mudança no `remobs-users` nem novo login obrigatório. Continuam só do paiol: entrega no balcão e decisão de devolução e baixa. Ninguém decide o próprio pedido.

## Alterações

- Backend: `APPROVE_PERMISSIONS` em `custody_service.py`; rotas `approve` e `reject` usam `require_any_permission`; `movement:approve` entra em `DECISION_PERMISSIONS` (visão de todos os pedidos).
- Frontend: `APPROVE_PERMISSIONS` em `navigation.ts`, usado em Pedidos e no detalhe; `movement:approve` passa a mostrar as filas do paiol no Início e em Pedidos.

## Validações

- Backend: 36 testes, incluindo `test_admin_do_inventario_ve_e_aprova_pedido_de_outro_mas_nao_entrega`.
- Frontend: `tsc -b` sem erro e 52 testes. Dois testes estouraram 5 s na suíte completa por carga da máquina e passaram isolados.

## Resultado

Implementado e testado localmente. Commit e deploy aguardam confirmação do usuário.
