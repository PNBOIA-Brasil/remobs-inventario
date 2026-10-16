# Recebimento por nota fiscal: separar nome e número de série

## Contexto

Ao ler a nota fiscal, a descrição de cada linha era copiada inteira (`description`) e usada como nome do item no cadastro rápido. Não havia separação entre o nome do produto, o número de série/lote e o resto da descrição. O cadastro de item já tem campo `serial_number`, mas o fluxo da nota nunca o preenchia.

## Objetivo

Fazer a leitura separar, por linha, o nome limpo do produto e o número de série/lote, e levar esses dados ao cadastro rápido do item.

## Escopo

- Backend: prompt do leitor de visão e schema da linha lida.
- Frontend: tipo da linha, decisão inicial, campo "Número de série" no cadastro rápido e envio ao criar o item.

## Etapas

1. `backend/app/services/invoice_reader.py` — o prompt passa a pedir, por linha, `name` (nome limpo, sem código/série/quantidade) e `serial_number` (série ou lote quando aparecer), mantendo `description` como o texto cru.
2. `backend/app/schemas/receipt.py` — `InvoiceLine` ganha `name` e `serial_number` (opcionais, com default nulo).
3. `frontend/src/services/inventoryService.ts` — `InvoiceLine` ganha `name?` e `serial_number?`.
4. `frontend/src/pages/InvoiceReceiptPage.tsx` — `Decision.newSerial`; `initialDecision` usa `name || description` para o nome e preenche `newSerial`; novo campo "Número de série" no cadastro rápido; o `createItem` envia `serial_number`.

## Validações

- Backend: `pytest` — 49 testes verdes (schema aditivo não quebra nada).
- Frontend: `vitest run tests/invoice-initial-decision.test.ts tests/invoice-receipt-page.test.tsx` — 5 verdes; `tsc -b` sem erros.

## Resultado

O cadastro rápido na conferência da nota abre com o nome limpo e o número de série já preenchidos quando a leitura os separa; o usuário ajusta se precisar.

## Observação

A qualidade da separação depende do modelo de visão; os campos são conferidos e editáveis pelo usuário antes de gravar.
