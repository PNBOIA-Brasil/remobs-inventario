# Termo de Recebimento Provisório

## Contexto

Não havia geração de documento de recebimento. A única impressão do projeto era a etiqueta de QR Code (via `window.print()`). Faltava um termo imprimível para conferência do material recebido.

## Objetivo

Gerar um "Termo de Recebimento Provisório" imprimível a partir de uma nota fiscal recebida, com cabeçalho, itens recebidos e campos de assinatura.

## Escopo

- Frontend apenas, reaproveitando o padrão de impressão (`window.print()` em janela própria), sem nova dependência nem backend.

## Etapas

1. `frontend/src/receiptTerm.tsx` — componente do termo (cabeçalho da nota, tabela de itens recebidos com patrimônio/tipo/quantidade, total, observações e blocos de assinatura) + `printReceiptTerm(invoice)` que abre a janela e imprime.
2. `frontend/src/pages/ReceivedInvoicesPage.tsx` — botão "Imprimir termo de recebimento" no detalhe da nota (quando os itens já carregaram).

## Validações

- `tsc -b` sem erros; `vitest run tests/received-invoices-page.test.tsx` verde.

## Resultado

No detalhe de cada nota recebida, o usuário imprime o Termo de Recebimento Provisório (A4) com os dados da nota e os itens recebidos.

## Observação

Decisão de design (ponytail): documento em HTML para impressão (sem biblioteca de PDF no backend). "Baixar PDF" pode ser adicionado depois via "Salvar como PDF" do navegador ou gerando no backend, se necessário.
