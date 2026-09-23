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

Autorizado pelo usuário em 2026-09-23. Commits `595d9c6` (regra) e `5222874` (cache PWA `v13`), com push.

| Item | Valor |
|------|-------|
| Imagem ECR | `prod-2026-09-23-admin-aprova` |
| Task definition | `remobs-inventario-backend:15`, rollout `COMPLETED`, `healthz` 200 |
| Amplify | job `36` `SUCCEED`, bundle `index-BLLHr6c1.js`, `sw.js` `v13` |
| Banco | sem migração |

Rollback: serviço ECS de volta para `remobs-inventario-backend:14` e republicação do job 35 no Amplify.

## Autoaprovação pelo admin (2026-09-23)

O usuário `jefferson` não via o botão de aprovar no pedido `cbb7f142-e08a-430e-a51a-721d9a34fc9c` porque o pedido era dele. A regra do paiol impedia qualquer pessoa, inclusive com `*`, de decidir o próprio pedido. O histórico estava gravando (`withdrawal_requested` com ator e papéis).

Decisão do usuário: o admin do inventário (`inventory:movement:approve` ou `*`) pode aprovar ou recusar o próprio pedido, com registro próprio no histórico.

- Backend: `_self_approval` libera a decisão para o admin e grava `withdrawal_self_approved` ou `withdrawal_self_rejected`, com ator, papéis e motivo. Paiol comum continua sem autoaprovar. Entrega do próprio pedido continua bloqueada.
- Frontend: botão Aprovar e Recusar na lista e no detalhe para o admin, inclusive no próprio pedido; fila “Aprovar” e contador do Início incluem os pedidos dele. Quem não pode decidir vê o motivo: “Aguardando outro aprovador: você não aprova o próprio pedido” ou “Aguardando o paiol ou o admin do inventário”.
- Histórico: rótulos “Retirada autoaprovada pelo admin” e “Retirada recusada pelo próprio admin”.
- Cache PWA `remobs-inventario-v14`.

Validação: backend 36 testes; frontend `tsc -b` e 53 testes.
