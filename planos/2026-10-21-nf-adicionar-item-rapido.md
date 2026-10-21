# Recebimento por nota fiscal: adicionar item rápido

## Contexto

Pedido de 2026-10-21: "Adicionar item rápido receber por NF". As demais entregas da lista (consumível sem patrimônio, agrupar itens, item novo por padrão, nome/número de série, foto do item, NF ligada ao pedido, Termo de Recebimento Provisório, relatório mensal, Termo de Cautela, sincronização PNBOIA) já estavam em produção desde 2026-10-17 (ECS `:22`, Amplify job 50).

Faltava: a conferência por nota só tinha as linhas que a leitura encontrou. Item que a leitura perdeu não entrava, e nota lida sem itens bloqueava a conferência.

## Objetivo

Botão "Adicionar item que não foi lido" nas etapas Dados e Revisão: nome, quantidade na nota e unidade. A linha entra na conferência como as outras (padrão "cadastrar item novo" para quem pode criar), sem divergência de quantidade.

## Escopo

- Frontend apenas: `frontend/src/pages/InvoiceReceiptPage.tsx` (`manualLine`, diálogo, `addLine`).
- Cache PWA `remobs-inventario-v27`.
- Sem backend, rota, schema ou migração.

## Validações

- `vitest run` — 29 arquivos, 77 testes verdes (novo: `manualLine` e fluxo nota sem itens → adicionar → conferência).
- `npm run build` ok; `pytest` backend verde.
