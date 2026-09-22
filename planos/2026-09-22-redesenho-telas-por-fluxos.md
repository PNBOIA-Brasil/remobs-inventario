# Redesenho das telas por fluxos

## Contexto

As telas atuais seguem os cadastros (item, local, plataforma, sensor, movimentação), e não as tarefas do dia a dia. O sistema precisa controlar entrada, saída, cadastro e empréstimo de material, além de necessidades de aquisição e gestão do estoque.

Levantamento do código em 2026-09-22:

- A retirada com custódia já existe (`/withdrawals`): pedido com várias linhas, aprovação e entrega pelo Paiol, devolução e baixa com aceite.
- Não existe fluxo de entrada: o saldo entra pelo cadastro ou pela edição do item.
- Não existe empréstimo com prazo: a posse não tem data prevista de devolução.
- Não existe necessidade de aquisição. O alerta de estoque mínimo usa só `minimum_stock_national`; `ideal_stock` e os demais mínimos não são usados.
- A paleta do código (teal `#0f766e`) difere da paleta dos mockups do Stitch (roxo `#6b38d4`). O redesenho adota a paleta do código.

## Objetivo

Redesenhar as telas mobile e desktop em torno de quatro jornadas e propor as mudanças de produto necessárias para sustentá-las.

## Entrega

Canvas de design (privado, compartilhável pelo menu Compartilhar): https://claude.ai/artifact/8Si37h4haLVsuHEgenGG9o

- Mapa das jornadas e da nova navegação.
- Mobile: Início, Escanear, Novo pedido (carrinho), Status do pedido, Devolver, Receber material.
- Desktop: Painel do Paiol, Pedidos com aprovação por linha, Itens e saldos, Ficha do item, Necessidades de aquisição.
- Componentes: barra de abas mobile e menu lateral desktop.

## Jornadas

1. **Entrada**: escanear ou buscar → cadastro rápido se o item for novo → quantidade e local → conferência com a nota → saldo sobe e a necessidade é baixada.
2. **Retirada e empréstimo**: carrinho → finalidade (consumo, empréstimo com prazo, plataforma) → aprovação por linha → entrega pelo código do pedido → material em “Comigo”.
3. **Devolução e baixa**: “Comigo” → marcar itens e estado (em ordem, avariado, consumido, extraviado) → conferência no balcão → saldo, manutenção ou baixa.
4. **Reposição e aquisição**: alerta de nível → necessidade sugerida até o ideal → priorização → compra → entrada fecha o ciclo.

## Princípios de UX aplicados

- **Tarefa antes de entidade**: a tela inicial pergunta “o que você vai fazer?”; cadastros vão para Administração.
- **Escanear primeiro**: botão central no mobile; a etiqueta leva ao item e às ações permitidas ao perfil.
- **Início por perfil**: o usuário vê o que está com ele e seus pedidos; o Paiol vê filas (“Precisa de você”).
- **Um lugar por objeto de trabalho**: “Movimentações” e “Solicitar retirada” viram “Pedidos”, do envio à devolução.
- **Cadastro progressivo**: o item novo é cadastrado dentro de Receber só com nome, tipo e unidade; o restante fica na ficha.
- **Modo tarefa sem distração**: fluxos de criação escondem a barra de abas e mantêm a ação principal fixa no rodapé.
- **Estado sempre visível**: linha do tempo no pedido, nível com marca do mínimo, chips de prazo e de status.
- **Prevenção de erro**: quantidade limitada ao saldo, aviso de falta de saldo na aprovação, motivo obrigatório na recusa.
- **Menu desktop por intenção**: Operação, Estoque, Campo e Administração, com contadores de pendência.
- **Acessibilidade**: alvos de toque de 44 px ou mais, contraste AA, rótulos reais em campos e botões de ícone.

## Mudanças de backend necessárias

1. **Entrada como fluxo** (`ReceiptOrder` ou movimento `entrada` com origem, documento e linhas), em vez de alterar saldo pela edição do item.
2. **Finalidade e prazo no pedido**: `purpose` (consumo, emprestimo, plataforma), `due_date` e `platform_id` em `WithdrawalOrder`; lembrete e alerta de vencimento.
3. **Estado na devolução**: `condition` no `CustodyEvent` (ok, avariado, extraviado); avariado vai para o local de manutenção.
4. **Necessidades de aquisição**: entidade com status `sugerida → aprovada → em_compra → atendida`, criada a partir do alerta de estoque mínimo, com quantidade até `ideal_stock` e baixa automática pela entrada.
5. **Busca por código**: endpoint único para patrimônio, série, código de barras e número de pedido, usado pelo leitor.
6. **Contadores por fila** para o Painel e o menu (aprovar, entregar, conferir devoluções, abaixo do mínimo).

## Ordem sugerida

1. Navegação nova e Início por perfil (só frontend, reaproveita as rotas atuais).
2. Pedidos unificados com aprovação por linha (já suportado pelo backend).
3. Finalidade e prazo de empréstimo.
4. Entrada como fluxo, com cadastro rápido.
5. Necessidades de aquisição.
6. Leitor de etiquetas.

## Validações

- Canvas publicado com 14 artboards. Não houve renderização nem teste automatizado das telas; revisão visual fica com o usuário.
- Nenhum código de produção foi alterado nesta tarefa.

## Resultado

Proposta de design entregue para revisão. A implementação depende de aprovação e será planejada por etapa.

## Execução e publicação (2026-09-22)

Autorizado pelo usuário: implementar as seis etapas em sequência, com um commit por etapa, e publicar em produção (profile `aws-remobs`, conta `220790920077`, `sa-east-1`). O fluxo de retirada do paiol, que estava implementado e sem commit, foi commitado antes, conforme `planos/2026-09-22-implementacao-retirada-paiol.md`.

Decisões:

- Nenhuma permissão nova no `remobs-users`. Entrada: `inventory:item:update` ou `inventory:withdrawal:deliver`. Aquisição: leitura com `inventory:item:read`; decisão com `inventory:movement:approve`. Não há relogin obrigatório por causa destas etapas.
- A aprovação por linha não existia no backend e foi adicionada (`lines` opcional no `approve`).
- Estado na devolução (avariado, extraviado) ficou fora: não estava entre as seis etapas.
- Cache PWA mantido em `remobs-inventario-v12`, que já troca o `v11` de produção.

Commits: `182fec0` (etapa 1), `2b6c5ff` (2), `7f9f73d` (3), `cff34df` (4), `28290cf` (5), `690d9e2` (6).

Validação local: backend 35 testes, frontend 51 testes e `tsc -b` sem erro; migrações `0005` e `0006` com upgrade, downgrade e upgrade em SQLite.

Publicação:

| Item | Valor |
|------|-------|
| Banco | `0003_item_brand_model_idx` → `0006_acquisition_needs` (23 tabelas) |
| Imagem ECR | `prod-2026-09-22-fluxos` |
| Task definition | `remobs-inventario-backend:14`, rollout `COMPLETED` |
| API | `healthz` 200; `/inventory/receipts` e `/inventory/acquisitions` no OpenAPI |
| Amplify | app `d1oidnxd2f4saq`, branch `prod`, job `35` `SUCCEED`, bundle `index-BAGZLMrd.js`, `sw.js` `v12` |

Rollback: serviço ECS de volta para `remobs-inventario-backend:13` e republicação do job 34 no Amplify. As tabelas e colunas novas são aditivas e podem ficar.

Pendência encontrada, anterior a este deploy: acesso direto a rotas com id (`/app/inventory/<id>`, `/app/withdrawals/<id>`) responde 404 sem corpo, apesar da regra `404-200` do Amplify. A navegação dentro do app funciona. A correção é uma regra de reescrita no Amplify e depende de autorização.

Roteiro de teste em produção: seguir a seção B de `planos/2026-09-22-implementacao-retirada-paiol.md` e, em seguida, registrar uma entrada de um item com necessidade aberta e conferir a baixa em “Aquisições”.
