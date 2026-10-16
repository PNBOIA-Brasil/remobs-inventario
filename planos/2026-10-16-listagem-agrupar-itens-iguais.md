# Listagem de itens: agrupar iguais com quantidade

## Contexto

A listagem mostra um card por registro `InventoryItem`. Como cada peça de um item permanente é um registro próprio (mesmo nome/marca/modelo, patrimônio diferente), receber 10 peças iguais gerava 10 cards. Não havia visão agregada por item.

## Objetivo

Oferecer uma visão que agrupa itens iguais (mesmo tipo, nome, marca e modelo) e mostra a quantidade de unidades e o saldo somado, sem perder a visão detalhada por unidade.

## Escopo

- Frontend apenas. Agrupamento no cliente sobre a lista já carregada; sem mudança de backend.

## Etapas

1. `frontend/src/inventoryGrouping.ts` — função pura `groupIdenticalItems` (chave tipo+nome+marca+modelo; soma unidades e saldo; marca crítico se alguma unidade está abaixo do mínimo).
2. `frontend/src/pages/InventoryListPage.tsx` — toggle "Agrupar iguais"; na visão agrupada, um card por grupo com contagem de unidades e saldo total; clicar no grupo preenche a busca com o nome e volta à visão detalhada. Seleção e impressão de etiquetas (por unidade) só aparecem na visão detalhada.
3. Teste `frontend/tests/inventory-grouping.test.ts`.

## Validações

- `vitest run tests/inventory-grouping.test.ts tests/inventory-list-delete.test.tsx` — 3 verdes; `tsc -b` sem erros.
- Toggle desligado por padrão: a listagem continua idêntica à atual.

## Resultado

Com "Agrupar iguais" ligado, itens idênticos aparecem numa só linha com a quantidade; o detalhe por unidade (patrimônio, QR, exclusão, etiquetas) segue na visão padrão.
