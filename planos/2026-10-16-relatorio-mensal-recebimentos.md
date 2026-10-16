# Relatório mensal de recebimentos com data informada

## Contexto

A tela de notas fiscais recebidas listava tudo (500 mais recentes) com busca textual, sem filtro por período nem exportação, e a data de recebimento era automática (momento do registro). Não dava para tirar o relatório dos recebimentos de um mês com a data real de chegada.

## Objetivo

Permitir informar a data de recebimento e gerar o relatório dos recebimentos de um mês, com exportação.

## Escopo

- Backend: data de recebimento no registro e filtro por período na listagem.
- Frontend: campo de data nas telas de recebimento; filtro por mês, resumo e export CSV na tela de notas recebidas.

## Etapas

1. `ReceiptCreate.received_date` (data); `register_receipt` usa a data informada (meia-noite UTC) como `received_at`, senão o momento do registro.
2. `GET /inventory/receipts/invoices` aceita `date_from`/`date_to` e filtra por `received_at`.
3. Frontend: `listReceivedInvoices({dateFrom,dateTo})` e `ReceiptPayload.received_date`.
4. `ReceiptPage` e `InvoiceReceiptPage` ganham o campo "Data de recebimento" (padrão hoje) e enviam `received_date`.
5. `ReceivedInvoicesPage`: filtro "Mês de recebimento" (recarrega por período), resumo (notas, unidades, valor) e botão "Exportar CSV" das notas visíveis.

## Validações

- Backend: `pytest` — suíte verde, incluindo `test_recebimento_com_data_informada_entra_no_relatorio_do_mes` (nota de 15/03 aparece no filtro de março e não no de abril).
- Frontend: `vitest run tests/received-invoices-page.test.tsx` verde; `tsc -b` sem erros.

## Resultado

O usuário informa a data de recebimento; na tela de notas, escolhe o mês para ver o relatório dos recebimentos do período, com totais e exportação em CSV (separador `;`, com BOM para Excel pt-BR).
