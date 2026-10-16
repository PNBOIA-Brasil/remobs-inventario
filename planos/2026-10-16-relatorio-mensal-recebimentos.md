# Relatório mensal de recebimentos com data informada

## Contexto

A tela de notas fiscais recebidas listava tudo (500 mais recentes) com busca textual, sem filtro por período nem exportação, e a data de recebimento era automática (momento do registro). Não dava para tirar o relatório dos recebimentos de um mês com a data real de chegada.

## Objetivo

Permitir informar a data de recebimento e gerar o relatório dos recebimentos de um mês, com exportação.

## Escopo

- Backend: data de recebimento no registro e filtro por período na listagem.
- Frontend: campo de data no recebimento por nota fiscal; filtro por mês, resumo e export CSV na tela de notas recebidas.

## Etapas

1. `ReceiptCreate.received_date` (data); `register_receipt` usa o momento do registro quando a data é hoje (ou ausente) e o meio-dia de Brasília para dia passado — meia-noite UTC aparecia como o dia anterior no Brasil.
2. `GET /inventory/receipts/invoices` aceita `date_from`/`date_to` e filtra por `received_at` com limites no fuso de Brasília.
3. Frontend: `listReceivedInvoices({dateFrom,dateTo})` e `ReceiptPayload.received_date`.
4. `InvoiceReceiptPage` ganha o campo "Data de recebimento" (padrão hoje, data local) e envia `received_date`. A entrada manual não tem o campo: sem nota fiscal não há registro em `received_invoices` nem entra no relatório.
5. `ReceivedInvoicesPage`: filtro "Mês de recebimento" (recarrega por período), resumo (notas, unidades, valor) e botão "Exportar CSV" das notas visíveis.

## Validações

- Backend: `pytest` — suíte verde, incluindo `test_recebimento_com_data_informada_entra_no_relatorio_do_mes` (nota de 31/03, borda do mês, aparece no filtro de março e não no de abril). CSV com vírgula decimal e células iniciadas por `=`, `+`, `-` ou `@` neutralizadas.
- Frontend: `vitest run tests/received-invoices-page.test.tsx` verde; `tsc -b` sem erros.

## Resultado

O usuário informa a data de recebimento; na tela de notas, escolhe o mês para ver o relatório dos recebimentos do período, com totais e exportação em CSV (separador `;`, com BOM para Excel pt-BR).
