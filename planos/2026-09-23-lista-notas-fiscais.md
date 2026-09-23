# Tela de notas fiscais recebidas

## Contexto

Com o recebimento por nota fiscal (`planos/2026-09-23-recebimento-nota-fiscal.md`), os arquivos da nota ficam no S3 e cada movimento de entrada guarda o `invoice_id`. O cabeçalho conferido (fornecedor, CNPJ, número, emissão, total) não era gravado. O usuário pediu uma tela para listar as notas fiscais recebidas.

## Objetivo

Listar as notas recebidas, com busca, detalhe dos itens que entraram por cada nota e download do arquivo.

## Decisões

- **Tabela `received_invoices`** (migração `0009_received_invoices`): cabeçalho conferido, origem, local, observações (com as divergências), quem recebeu e quando. O `id` é o mesmo `invoice_id` dos arquivos e dos movimentos. A linha é criada ao registrar a entrada com nota. A migração preenche uma linha para cada `invoice_id` já usado em movimentos, com o número tirado do texto do movimento.
- **Nota registrada uma vez só.** Registrar de novo o mesmo `invoice_id` responde 409.
- **Aviso de nota repetida.** A leitura procura uma nota já recebida pela chave de acesso ou, sem ela, pelo CNPJ e número (comparando só dígitos) e devolve `already_received`. A etapa Dados mostra o aviso, sem bloquear.
- **Rotas:** `GET /inventory/receipts/invoices` (até 500, da mais recente para a mais antiga) e `GET /inventory/receipts/invoices/{id}` (com os itens recebidos), com permissão `inventory:item:read`. A busca é feita na tela (número, fornecedor sem acento, CNPJ ou chave por dígitos); busca e paginação no servidor ficam para quando passar de 500 notas.
- **Entrada** aceita também `invoice_series`, `supplier_name`, `issue_date`, `total_value` e `access_key`, enviados pelo assistente.
- **Tela** `/app/receipts/invoices` ("Notas fiscais", grupo Estoque): lista em acordeão com número, série, total, fornecedor, data, quem recebeu, local, unidades e divergência; ao abrir, mostra CNPJ, emissão, chave, observações, botão "Baixar nota fiscal" e os itens recebidos, com link para a ficha.
- **Menu:** o item ativo passa a ser escolhido por segmento de caminho; antes, `/app/receipts/invoices` casaria com "Receber por nota fiscal" (`/app/receipts/invoice`).

## Validações

- Backend: 48 testes; o novo teste cobre lista, totais, detalhe, 404, bloqueio de nota repetida e aviso na releitura com número formatado diferente.
- Migração 0009: upgrade, downgrade e upgrade numa cópia do `dev.sqlite`, com backfill de uma nota ligada a dois movimentos.
- Frontend: 69 testes (novo `received-invoices-page.test.tsx`: filtro por CNPJ e por nome sem acento, detalhe e download) e `tsc -b` sem erro.
- Teste local no navegador: título "Notas fiscais" na barra, lista, detalhe com itens e divergências.
- Cache PWA `remobs-inventario-v25`.

## Resultado

Implementado e validado localmente. Commit `bfe9fc6`.

Publicação autorizada pelo usuário em 2026-09-23 (profile `aws-remobs`, conta `220790920077`, `sa-east-1`):

| Etapa | Resultado |
| :--- | :--- |
| Migração | `0009_received_invoices` aplicada no RDS de produção |
| Imagem | `remobs-inventario-backend:prod-2026-09-23-notas-recebidas` no ECR |
| ECS | task definition `remobs-inventario-backend:21` (cópia da `:20`, só a imagem trocada), rollout `COMPLETED`, `/healthz` 200, rotas novas no OpenAPI e `401` sem token |
| Amplify | job `49` `SUCCEED`, bundle `index-Df0KDfMU.js`, `sw.js` `v25`, `/app/receipts/invoices` 200 |

Rollback: ECS de volta para `remobs-inventario-backend:20` e republicação do job 48 no Amplify; a tabela `received_invoices` pode ficar.
