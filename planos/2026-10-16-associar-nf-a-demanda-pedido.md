# Associar a nota fiscal a uma demanda/pedido de aquisição

## Contexto

A entrada de material abate necessidades de aquisição automaticamente por `item_id` (heurística por etapa e FIFO), mas não havia vínculo explícito e consultável entre a nota fiscal recebida e o pedido (necessidade) que ela atende. O único traço era o `acquisition_ids` no metadado do log de auditoria.

## Objetivo

Permitir vincular a nota fiscal (recebimento) a um pedido de aquisição específico, iniciando o recebimento a partir do pedido, gravando o vínculo e abatendo aquele pedido com preferência.

## Escopo

- Backend: coluna de vínculo, campo no recebimento, preferência na alocação, exposição na leitura.
- Frontend: iniciar o recebimento a partir do pedido (Aquisições), banner de vínculo nas telas de recebimento e exibição na lista de notas recebidas.

## Etapas

1. Migração `0010_invoice_acquisition_need`: `received_invoices.acquisition_need_id` (sem FK, como `stock_movements.invoice_id`) + índice.
2. `ReceivedInvoice.acquisition_need_id` no modelo; `ReceiptCreate.need_id`; `ReceivedInvoiceSummary.acquisition_need_id` e `acquisition_process_number`.
3. `allocate_receipt(prefer_need_id=...)`: o pedido escolhido é abatido primeiro.
4. `register_receipt`: valida o pedido, grava `acquisition_need_id` na nota e passa a preferência à alocação.
5. `summarize_invoices`: traz o número do processo do pedido vinculado.
6. Frontend: Aquisições (etapa "em compra") ganha "Receber por NF" e "Entrada manual" que levam o pedido (`?need=` + rótulo via state); `InvoiceReceiptPage` e `ReceiptPage` leem o pedido, mostram banner e enviam `need_id`; `ReceivedInvoicesPage` mostra um chip "Pedido …".

## Validações

- Backend: `pytest` — 50 testes verdes, incluindo `test_recebimento_por_nota_vincula_pedido_de_aquisicao` (vínculo gravado e pedido abatido em 3).
- `alembic heads` — head único `0010_invoice_acquisition_need`, cadeia linear.
- Frontend: `tsc -b` sem erros.

## Resultado

A partir de um pedido "em compra", o usuário recebe por nota fiscal (ou manual) com o pedido já vinculado; a nota guarda o pedido, a alocação abate aquele pedido primeiro e a lista de notas recebidas mostra o processo vinculado.

## Observação

O vínculo persistido fica na nota fiscal (`received_invoices`); na entrada manual sem nota, o `need_id` apenas direciona a alocação.
