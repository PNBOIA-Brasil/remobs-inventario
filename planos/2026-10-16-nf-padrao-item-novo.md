# Recebimento por nota fiscal: "cadastrar item novo" como padrão

## Contexto

Na conferência item a item do recebimento por nota fiscal, o padrão era: sugerir o item existente quando a leitura tinha confiança alta (vínculo por código do fornecedor ou similaridade ≥ 0,6); sem confiança, nada ficava pré-selecionado e o usuário era obrigado a escolher manualmente ("Escolha o item do estoque ou cadastre um novo").

O fluxo do paiol costuma receber material que ainda não está no estoque, então o caminho mais comum é cadastrar item novo. Forçar a escolha manual a cada linha era atrito.

## Objetivo

Quando não houver sugestão confiável, deixar "cadastrar item novo" como opção pré-selecionada por padrão (para quem tem permissão de criar item), mantendo a sugestão confiável quando existir.

## Escopo

- Frontend apenas, `frontend/src/pages/InvoiceReceiptPage.tsx`.
- Sem mudança de backend, rota, schema ou banco.

## Etapas

1. `initialDecision` recebe `canCreate` e define `choice = sure ? best.item_id : (canCreate ? "new" : null)`.
2. Chamada em `setDecisions(...)` passa `canCreate`.
3. Teste puro `frontend/tests/invoice-initial-decision.test.ts`.

## Validações

- `vitest run tests/invoice-initial-decision.test.ts tests/invoice-receipt-page.test.tsx` — 4 testes verdes.
- Sem sugestão confiável + pode criar → padrão `new`; sem permissão → `null` (inalterado); sugestão confiável → item sugerido.

## Resultado

A conferência abre já em "cadastrar item novo" quando a nota não casa com o estoque e o usuário pode criar, com nome e unidade preenchidos.
