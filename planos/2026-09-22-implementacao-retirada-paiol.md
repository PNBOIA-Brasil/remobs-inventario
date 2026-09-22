# Implementação do fluxo de retirada do paiol

## Contexto

O diagnóstico em `planos/2026-09-22-fluxo-retirada-paiol-devolucao-baixa.md` mostrou que a saída atual é unitária, aprovada por quem tem `inventory:movement:approve`, e transfere o saldo na hora. Faltam lista de materiais, perfil paiol, entrega, devolução, baixa de consumo e auditoria dessas etapas.

Este plano cobre a implementação, a ordem dos commits, o deploy em produção e o roteiro de teste. A regra de negócio continua a do diagnóstico. Nenhuma etapa abaixo foi executada.

## Objetivo

Publicar em produção o fluxo em que qualquer usuário do inventário pede uma lista de materiais, o paiol aprova e entrega, e depois aceita ou recusa devolução ou baixa, com histórico auditável.

## Escopo

- Backend do inventário: tabelas, API, auditoria e testes.
- Script de permissões do inventário: catálogo novo e role `paiol`.
- Frontend: pedido em lista, fila do paiol, devolução, baixa e histórico.
- Fallbacks SPA das rotas novas.
- Produção: migração Alembic, ECS, Amplify, role `paiol` e relogin.
- `remobs-users` e `remobs-user-front` não mudam de código. A role nasce pela API que o script do inventário já usa, e a tela de papéis já lista roles existentes.

## Fora deste plano

- Desligar os endpoints antigos `POST /inventory/movements/request`, `/approve` e `/reject`.
- Apagar pedidos antigos de saída.
- Baixa de componente permanente.
- Commit ou push sem confirmação explícita.

## Ordem de implementação

Cada commit entra só com a parte que já passa no teste indicado. O `CHANGELOG.md` é atualizado no mesmo commit. Mensagens em português.

### Commit 1 — modelo e migração

Mensagem: `feat: adiciona pedido de retirada, custódia e migração`

Arquivos:

- `backend/app/models/inventory.py` ou módulo novo de custódia, se o arquivo passar a misturar assuntos demais
- `backend/alembic/versions/0004_withdrawal_custody.py`
- `CHANGELOG.md`

A revisão Alembic precisa caber em `varchar(32)`. O identificador `0004_withdrawal_custody` atende. Não usar descrição longa como `revision`.

Tabelas aditivas, sem alterar o significado das saídas já gravadas:

- `withdrawal_orders`
- `withdrawal_lines`
- `custody_positions`
- `custody_events`

`stock_movements` ganha colunas nulas de referência ao pedido e à linha, e passa a aceitar `movement_type` `reserva`, `entrega`, `devolucao` e `baixa`. O valor `saida` continua válido.

Validação: `alembic upgrade head` e `alembic downgrade -1` no SQLite de teste; `upgrade head` de novo.

### Commit 2 — API, regras e testes

Mensagem: `feat: expõe aprovação, entrega, devolução e baixa com auditoria`

Arquivos:

- serviço de custódia
- `backend/app/routers/` da nova API
- schemas
- registro do router em `backend/app/main.py`
- `backend/tests/test_auth_inventory_contract.py` ou arquivo novo `backend/tests/test_withdrawal_custody.py`
- `CHANGELOG.md`

Endpoints:

- `POST /inventory/withdrawals`
- `GET /inventory/withdrawals`
- `GET /inventory/withdrawals/{id}`
- `POST /inventory/withdrawals/{id}/approve`
- `POST /inventory/withdrawals/{id}/reject`
- `POST /inventory/withdrawals/{id}/deliver`
- `POST /inventory/withdrawals/{id}/lines/{line_id}/return`
- `POST /inventory/withdrawals/{id}/lines/{line_id}/writeoff`
- `POST /inventory/custody-events/{id}/accept`
- `POST /inventory/custody-events/{id}/refuse`

Regras que o teste precisa provar:

- pedido com duas linhas fica `pending_approval`;
- solicitante não aprova, entrega, aceita nem recusa o próprio pedido, inclusive com permissão `*`;
- aprovação reserva saldo;
- segundo pedido acima do disponível falha;
- recusa libera a reserva;
- entrega tira a reserva, baixa o saldo do paiol e cria a posse;
- devolução parcial aceita devolve só o aceito ao paiol;
- baixa de consumo aceita não repõe o paiol;
- baixa de permanente responde erro de regra;
- recusa de devolução ou baixa não muda a posse;
- `audit_logs` contém ator, motivo e a ação de cada transição.

O teste antigo `test_requests_and_approves_stock_movement` continua passando.

Validação:

```text
python -m pytest tests/test_withdrawal_custody.py tests/test_auth_inventory_contract.py::test_requests_and_approves_stock_movement -q
```

### Commit 3 — permissões e papel paiol

Mensagem: `feat: registra permissões do paiol sem anexá-las ao admin`

Arquivos:

- `backend/scripts/register_inventory_permissions.py`
- teste do script, se já houver padrão de teste para ele; senão, o próprio script com `--skip-role-assign` documentado
- `CHANGELOG.md`

O catálogo completo continua podendo ir para `admin-inventario` só com a flag atual. O padrão novo não faz isso para as permissões de decisão.

Permissões:

| Código | Role |
|---|---|
| `inventory:withdrawal:request` | quem já possui `inventory:movement:request`, inclusive `admin-inventario` |
| `inventory:return:request` | a mesma lista |
| `inventory:writeoff:request` | a mesma lista |
| `inventory:custody:read` | essas roles e `paiol` |
| `inventory:item:read` | `paiol`, se ainda não tiver |
| `inventory:withdrawal:approve` | somente `paiol` |
| `inventory:withdrawal:deliver` | somente `paiol` |
| `inventory:return:decide` | somente `paiol` |
| `inventory:writeoff:decide` | somente `paiol` |

O script cria a role `paiol` se ela não existir e anexa só o bloco de decisão e leitura. Não copia o catálogo inteiro para essa role.

Validação local: executar o script com `--skip-role-assign` contra um mock ou revisar o diff do catálogo. O registro real ocorre no deploy, com token de administrador do `remobs-users`.

### Commit 4 — tela de pedido em lista

Mensagem: `feat: permite solicitar retirada de vários materiais`

Arquivos:

- página de solicitação, no lugar do formulário de um item
- serviço HTTP e tipos
- navegação: Operação visível com `inventory:withdrawal:request` ou `inventory:movement:request`
- `frontend/scripts/create-spa-fallbacks.mjs` com `app/withdrawals/new` se a rota for nova
- teste de componente da lista com dois itens
- `CHANGELOG.md`

A tela antiga de uma saída deixa de ser o caminho principal. Pedidos `stock_movements` ainda pendentes continuam aprováveis na mesma área, para não abandonar fila antiga.

Validação: `npm test` do frontend no teste novo e nos testes de origem da saída que continuarem válidos.

### Commit 5 — fila do paiol

Mensagem: `feat: adiciona fila do paiol para aprovar e entregar`

Arquivos:

- lista e detalhe do pedido
- ações Aprovar, Recusar e Entregar, cada uma com motivo digitado de pelo menos 3 caracteres
- botões só com a permissão correspondente
- teste de componente
- `CHANGELOG.md`

Validação: teste de frontend da fila. Usuário sem permissão de paiol não vê as ações.

### Commit 6 — devolução, baixa e histórico

Mensagem: `feat: permite decidir devolução ou baixa com histórico auditável`

Arquivos:

- ação do solicitante na posse entregue
- fila do paiol para aceitar ou recusar
- baixa desabilitada quando o item é permanente
- linha do tempo no pedido e no histórico do item
- fallbacks SPA das rotas de detalhe
- testes de componente
- `CHANGELOG.md`
- atualizar o resultado deste plano e do diagnóstico

Validação: `npm test` da área de movimentação e `python -m pytest tests/test_withdrawal_custody.py -q`.

### Commit 7 — cache PWA, só na véspera do deploy

Mensagem: `chore: incrementa o cache PWA para o fluxo do paiol`

Arquivo: `frontend/public/sw.js`, de `remobs-inventario-v11` para `remobs-inventario-v12`, e `CHANGELOG.md`.

Esse commit espera os seis anteriores aprovados. Não misturar com regra de negócio.

## Deploy em produção

Ambiente já usado neste repositório:

- profile AWS `aws-remobs`
- conta `220790920077`
- região `sa-east-1`
- cluster `remobs-inventario-cluster`
- serviço `remobs-inventario-backend`
- task definition atual de referência: `remobs-inventario-backend:13`
- Amplify app `d1oidnxd2f4saq`, branch `prod`
- API `https://api-inventario.remobs.com.br`
- front `https://inventario.remobs.com.br`
- usuários `https://api-controle-usuarios.remobs.com.br`

O container não roda Alembic na subida. A migração é manual e acontece antes de trocar a task definition.

O usuário do paiol é `foloni`. A role já foi criada no controle de usuários em 22/09/2026, antes do deploy da API de inventário. O JWT antigo não inclui o papel novo: `foloni` precisa sair e entrar de novo depois que a API de inventário estiver no ar.

### Passos

1. Confirmar os sete commits e o push da `main`.
2. Rodar a suíte local do commit 6 outra vez na `main`.
3. Build e push da imagem ECR, tag `prod-2026-09-22-fluxo-paiol`.
4. Migrar o banco com `backend/scripts/run_migration_from_task_definition.py`, apontando para a task definition **atual** (`remobs-inventario-backend:13`), que já tem `REMOBS_DATABASE_URL`. A migração só cria tabelas e colunas nulas. A API antiga continua no ar durante esse passo.
5. Conferir `alembic_version = 0004_withdrawal_custody` com `backend/scripts/inspect_database_from_task_definition.py`.
6. Registrar a task definition nova com a imagem do passo 3 e atualizar o serviço ECS. Esperar rollout `COMPLETED`.
7. `GET https://api-inventario.remobs.com.br/healthz` deve responder 200.
8. Conferir no OpenAPI os caminhos `/inventory/withdrawals` e `/inventory/custody-events/{id}/accept`.
9. Concluído em 22/09/2026 no controle de usuários (task `api-controle-usuarios-prod-task:13`). Os papéis ficaram com o prefixo `inventario`: `inventario-admin` (id 24, antes `admin-inventario`), `inventario-paiol` (id 31, antes `paiol`) e `inventario-usuario` (id 32, criado nesta data). O paiol tem leitura de item e custódia, aprovação, entrega e decisão de devolução e baixa.
10. Concluído para `inventario-admin`, que já solicitava saída: recebeu `inventory:withdrawal:request`, `inventory:return:request`, `inventory:writeoff:request` e `inventory:custody:read`. As permissões de decisão do paiol não foram anexadas a esse papel. Outras roles fora do inventário não foram alteradas.
11. Concluído em 22/09/2026: `foloni` (id 10) permanece em `inventario-admin` e `inventario-paiol`. `inventario-usuario` existe e ainda não tem usuário.
12. Build do frontend, fallbacks SPA e deploy manual no Amplify, branch `prod`.
13. Confirmar job `SUCCEED`, `sw.js` com `remobs-inventario-v12` e as rotas diretas do pedido sem 404.
14. Pedir relogin de quem solicita e de quem é paiol. O JWT antigo não traz as permissões novas.

### Rollback

- Serviço ECS volta para `remobs-inventario-backend:13`.
- Amplify republica o artefato do job 34, cache `v11`.
- As tabelas novas podem ficar. A API antiga não as lê.
- Não há `downgrade` em produção neste plano. Reverter o schema só com janela própria, se nenhum pedido novo tiver sido gravado.

## Passo a passo de teste

Usar dois logins depois do relogin: **Solicitante** (sem permissões de decisão) e **Paiol**. Escolher um consumível com saldo conhecido no paiol e um permanente com quantidade 1. Anotar saldo, reserva e posse antes de começar.

### A. Local, antes do push

1. Subir a migração em banco limpo de teste.
2. Rodar `python -m pytest tests/test_withdrawal_custody.py tests/test_auth_inventory_contract.py::test_requests_and_approves_stock_movement -q`.
3. Rodar os testes de frontend do pedido, da fila e da devolução.
4. Só seguir para o commit seguinte se o comando daquele commit passou.

### B. Produção, com os dois usuários

1. Solicitante abre Operação e cria um pedido com o consumível, quantidade 2, e o permanente, quantidade 1, e um motivo real.
2. Conferir que o pedido fica pendente, que o saldo ainda não saiu e que a reserva subiu nas duas linhas.
3. Solicitante abre o mesmo pedido e confirma que não há Aprovar, Entregar, Aceitar nem Recusar.
4. Paiol recusa um segundo pedido de teste, de quantidade pequena. A reserva desse segundo pedido volta a zero. O log mostra `withdrawal_rejected` com o usuário paiol e o motivo.
5. Paiol aprova o pedido principal. Status `approved`. Reserva permanece. Saldo físico do paiol ainda não cai.
6. Tentar outro pedido que ultrapasse o disponível. A API recusa por estoque.
7. Paiol confirma a entrega com motivo. Status `delivered`. Reserva zera, saldo do paiol cai e a posse do solicitante fica 2 no consumível e 1 no permanente.
8. Solicitante pede devolução de 1 unidade do consumível.
9. Paiol aceita. O paiol recupera 1. A posse do solicitante nesse consumível fica 1.
10. Solicitante pede baixa da unidade de consumo restante.
11. Paiol aceita. A posse vai a zero e o saldo do paiol não aumenta.
12. Solicitante tenta baixar o permanente. A tela não oferece baixa e a API recusa se o pedido for forçado.
13. Solicitante pede devolução do permanente. Paiol recusa. A posse continua 1 e o saldo do paiol não muda. O log mostra `return_refused`.
14. Solicitante pede de novo a devolução do permanente. Paiol aceita. A posse zera e o permanente volta ao local de origem.
15. Abrir o detalhe do pedido e o histórico de cada item. A linha do tempo mostra, com ator e motivo: pedido, aprovação, entrega, devolução aceita, baixa aceita, devolução recusada e devolução aceita.
16. Recarregar o PWA com cache limpo ou relogin e repetir a abertura do pedido. O `sw.js` servido é `remobs-inventario-v12`.

### C. Regressão curta

1. A saída antiga ainda lista pedidos `pending` anteriores, se existirem, e ainda aprova com `inventory:movement:approve`.
2. Cadastro de item, lista de inventário e detalhe com foto continuam abrindo.
3. `healthz` permanece 200 depois do roteiro.

## Critério de pronto

- Os sete commits estão na `main` e em produção.
- Task definition nova com rollout `COMPLETED` e Amplify `SUCCEED`.
- Papéis `inventario-admin` e `inventario-paiol` atribuídos a `foloni`, que só decide com o papel novo depois do relogin.
- O roteiro B fecha com os saldos e a posse esperados.
- O histórico do pedido contém as sete ações do passo 15.

## Resultado

Implementado e testado em 22/09/2026, sem commit e sem deploy.

A reserva entra na solicitação. A aprovação mantém essa reserva. A recusa devolve a reserva ao disponível. A entrega tira a reserva, baixa o saldo do paiol e passa o material à posse do solicitante. Essa escolha fecha a brecha de dois pedidos pendentes sobre o mesmo saldo e segue o roteiro de teste de produção deste plano.

Validação local:

- `python -m pytest tests/test_inventory_permission_catalog.py tests/test_auth_inventory_contract.py::test_withdrawal_custody_flow tests/test_auth_inventory_contract.py::test_requests_and_approves_stock_movement`
- Testes de frontend da origem da retirada, do pedido com dois materiais, da fila do paiol, do solicitante, do detalhe, do cache `v12` e dos fallbacks SPA.

Em 22/09/2026 os papéis do inventário no controle de usuários passaram a se chamar `inventario-admin` (id 24), `inventario-paiol` (id 31) e `inventario-usuario` (id 32). `foloni` (id 10) continua nos dois primeiros. `inventario-usuario` consulta inventário, locais, plataformas e sensores, envia checklist e solicita retirada, devolução e baixa; ainda não tem usuário. A API e o frontend do inventário ainda não foram publicados, então o papel de paiol só passa a valer na fila depois do deploy e de um novo login.

Commits e publicação do inventário em produção continuam pendentes de autorização.
