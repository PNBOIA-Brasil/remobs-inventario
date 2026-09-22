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
