# Recebimento de material por nota fiscal

## Contexto

O recebimento (`/app/receipts/new`) exigia digitar cada material da nota. O usuário pediu que a nota fiscal, em foto ou PDF, fosse lida pelo sistema e que os itens fossem incluídos em etapas, com a confirmação do usuário na identificação de cada item e foto opcional do material.

A prévia de design foi aprovada no canvas "Recebimento por Nota Fiscal" (7 telas mobile e 1 desktop).

## Objetivo

Receber o material a partir da nota fiscal em quatro etapas — Nota, Dados, Itens e Revisão — com leitura automática, sugestão do item do estoque, conferência item a item, foto opcional e registro da entrada com as divergências.

## Decisões

- **Leitura por IA na AWS.** O usuário pediu a conta de IA (`aws-remobs-ia`, `543483798724`, `sa-east-1`). Claude não está liberado nessa conta; foi escolhido o modelo de visão `qwen.qwen3-vl-235b-a22b` (on-demand em `sa-east-1`), chamado pela Converse API do Bedrock. O modelo fica configurável em `REMOBS_INVOICE_AI_MODEL_ID`.
- **PDF vira imagem no backend.** O Qwen3-VL não aceita documento na Converse API; o backend renderiza cada página do PDF com `pypdfium2` e reduz fotos e páginas a JPEG de até 2000 px com `Pillow` (o Bedrock recusa imagens acima de 3,75 MB). Novas dependências de backend: `pypdfium2` e `Pillow`.
- **Acesso entre contas.** O backend roda na conta `220790920077` e assume a role `remobs-inventario-invoice-reader` da conta de IA (`REMOBS_INVOICE_AI_ROLE_ARN`), sem chave estática.
- **Quantidade conferida.** A nota usa vírgula decimal ("50,000" = 50). O prompt explica o formato e, quando a quantidade não fecha com valor total ÷ valor unitário, o backend recalcula.
- **Sugestões.** Similaridade de texto (stdlib `difflib` e palavras em comum) com o nome dos itens ativos, uma sugestão por nome. O código do produto do fornecedor fica gravado no log de auditoria da entrada; na próxima nota do mesmo CNPJ, o item vinculado aparece primeiro como "Já vinculado". Não foi criada tabela nova nem migração.
- **Arquivos da nota.** Os arquivos lidos ficam guardados como `entity_type = invoice` e o `invoice_id` vai para os metadados da entrada. Leituras abandonadas também ficam guardadas.
- **Foto do recebimento.** Nova rota `POST /inventory/receipts/photos`, só para imagem e com as permissões de recebimento, para que o paiol (que entrega mas não edita item) possa anexar a foto.
- **Divergências.** Quantidade diferente da nota e "Item não veio" entram no texto da entrada ("Divergências: …"), visível no histórico de movimentos.

## Escopo

Backend:

- `app/services/invoice_reader.py`: páginas em JPEG, chamada ao Bedrock, validação da resposta, conferência de quantidade e sugestões.
- `app/routers/receipts.py`: `POST /inventory/receipts/invoice/read` e `POST /inventory/receipts/photos`.
- `app/schemas/receipt.py`: `InvoiceRead`, `InvoiceReadResponse`; `ReceiptCreate` com `invoice_id`, `supplier_cnpj` e `supplier_code` por linha.
- `app/services/receipt_service.py`: metadados da nota na auditoria.
- `app/core/config.py`: `invoice_ai_model_id`, `invoice_ai_region`, `invoice_ai_role_arn`.

Frontend:

- `pages/InvoiceReceiptPage.tsx` em `/app/receipts/invoice`, com o item de menu "Receber por nota fiscal".
- `services/inventoryService.ts`: `readInvoice` e `uploadReceiptPhoto`.
- Cache PWA `remobs-inventario-v23`.

## Etapas

1. Prévia de design no canvas e aprovação do usuário.
2. Teste do modelo no Bedrock com uma DANFE sintética (PNG e PDF).
3. Backend, testes e conferência de quantidade.
4. Assistente no frontend.
5. Teste ponta a ponta local com o Bedrock real.
6. IAM entre contas, deploy do backend (ECS) e do frontend (Amplify).

## Validações

- Backend: 44 testes aprovados; o arquivo novo `tests/test_recebimento_nota.py` cobre páginas JPEG, resposta do modelo, conferência de quantidade, permissões, sugestões, vínculo aprendido e foto só de imagem.
- Frontend: `tsc -b` e `npm run build` sem erro.
- Bedrock real (`aws-remobs-ia`): a DANFE sintética em PNG foi lida em 13,6 s e em PDF em 11,6 s, com cabeçalho, 6 de 6 linhas e quantidades corretas.
- Teste ponta a ponta local (backend com cópia do `dev.sqlite`, Bedrock real e auth simulado): leitura, conferência com foto, busca, item novo, "Item não veio", divergência, registro, foto anexada, arquivos da nota guardados e, na segunda leitura, sugestão "Já vinculado".

## Resultado

Implementado e validado localmente. Commit `b3e619e`.

Deploy autorizado pelo usuário em 2026-09-23:

| Etapa | Resultado |
| :--- | :--- |
| IAM na conta de IA (`aws-remobs-ia`, `543483798724`) | role `remobs-inventario-invoice-reader`, confiança só na task role do backend, política inline `bedrock-invoke-qwen3-vl` (só `bedrock:InvokeModel` no `qwen.qwen3-vl-235b-a22b` em `sa-east-1`) |
| IAM na conta do app (`aws-remobs`, `220790920077`) | política inline `assume-invoice-reader-ia` na `remobs-inventario-backend-task-role` (só `sts:AssumeRole` na role acima) |
| Imagem | `remobs-inventario-backend:prod-2026-09-23-nota-fiscal` no ECR |
| ECS | task definition `remobs-inventario-backend:19` (cópia da `:18` com a imagem nova e as variáveis `REMOBS_INVOICE_AI_*`), rollout `COMPLETED`, `/healthz` 200, rotas novas no OpenAPI e `401` sem token |
| Teste em produção | task avulsa com a `:19` leu uma nota de teste pelo Bedrock via role entre contas (`SMOKE 000123 1 [('CABO PP 3X2,5MM RL', 2.0)]`), sem tocar no banco |
| Amplify | app `d1oidnxd2f4saq`, branch `prod`, job `47` `SUCCEED`, bundle `index-CQS0u9we.js`, `sw.js` `v23`, `/app/receipts/invoice` 200 |

Sem migração de banco. Rollback: serviço ECS de volta para `remobs-inventario-backend:18` e republicação do job 46 no Amplify. As políticas IAM podem ficar; sem elas, só a leitura da nota falha (erro 502 tratado na tela).

## Segunda etapa — unidade por peça e download da nota

Pedido do usuário após a primeira publicação: permanente sempre cadastra uma unidade nova por peça, e a nota fiscal fica guardada no S3 e pode ser baixada.

Decisões:

- **Permanente no backend.** Em toda entrada (por nota ou manual), cada peça de um permanente vira um item novo com patrimônio próprio, copiando nome, categoria, marca, modelo, unidade e descrição do item informado; o item informado não recebe saldo. Um permanente cadastrado e nunca movimentado, sem saldo, é usado como a primeira peça, para o cadastro rápido não deixar item vazio. Cada unidade tem o seu movimento de 1 unidade. O vínculo com o código do fornecedor aponta para o item informado (`linked_item_id`).
- **Resposta da entrada** traz `items` (unidades novas incluídas), usados para as etiquetas e para anexar a foto a cada unidade.
- **Nota no S3.** A produção já usa `REMOBS_STORAGE_BACKEND=s3` (bucket `inventario-remobs`, prefixo `remobs-inventario/invoice/<id>/`). Migração `0008_movement_invoice` adiciona `stock_movements.invoice_id`. Novas rotas `GET /inventory/receipts/invoices/{id}/files` e `.../files/{file_id}/content` (permissão `inventory:item:read`).
- **Download.** Botão "Baixar nota fiscal" na tela de conclusão e "Nota fiscal" em cada entrada com nota no histórico do item.
- `invoice_number` na entrada preenche o número da nota nas unidades novas.

Validações: backend com 47 testes (unidade por peça, primeira peça recém-cadastrada, nota guardada e baixada pelo movimento); migração 0008 com upgrade, downgrade e upgrade numa cópia do `dev.sqlite`; frontend com 68 testes (novo `invoice-receipt-page.test.tsx`: unidade por peça, foto em cada unidade e payload da entrada) e build sem erro. O teste de cache do service worker, que esperava `v22`, foi corrigido: na primeira publicação a suíte do frontend não foi executada. Cache PWA `remobs-inventario-v24`.
