# Número patrimonial e QR Code do item

## Contexto

O item já tinha o campo `patrimony_number`, opcional e sem unicidade. Os itens importados da planilha estavam sem patrimônio. A tela Escanear já achava itens por patrimônio digitado, e a retirada só aceitava materiais escolhidos em lista.

A prévia das telas foi aprovada pelo usuário no canvas de design `REMOBS — Patrimônio e QR Code`.

## Objetivo

- Todo item passa a ter um número patrimonial único, que o identifica no sistema.
- O cadastro gera o número e o QR Code do item.
- Na solicitação de retirada, os itens podem ser adicionados à lista pela leitura do QR Code.

## Decisões

- Formato gerado: `REM-` + 6 dígitos, em sequência (`REM-000001`). O prefixo `REM-` fica reservado ao sistema.
- Um item que já tem plaqueta pode receber o número existente no cadastro. Número repetido é recusado (409).
- Consumível: um número por cadastro de item, não por unidade física.
- O número não muda depois do cadastro: `patrimony_number` saiu do payload de edição e o campo fica bloqueado no formulário.
- O QR grava o link `/app/p/<número>`. A câmera do celular abre a ficha, e o leitor do app extrai o número.
- Leitura contínua na retirada: consumível lido de novo soma 1 à quantidade; permanente não entra duas vezes.

## Escopo

Backend:

- Migração `0007_item_patrimony_unique`: preenche `REM-NNNNNN` nos itens sem patrimônio, pela ordem de cadastro, e cria índice único. Duplicados já existentes interrompem a migração. O downgrade só remove o índice.
- `resolve_patrimony_number` no serviço de inventário; o `POST /inventory/items` gera ou valida o número.

Frontend:

- `QrCameraScanner`: câmera extraída da tela Escanear para reúso, com filtro que não repete a etiqueta parada diante da câmera.
- `ItemQrLabel` no detalhe do item: QR Code, número, impressão da etiqueta de 62 × 29 mm e download do PNG.
- Rota `/app/p/:code` resolve o patrimônio e abre a ficha.
- Solicitar retirada: botão "Escanear QR Code" com leitura contínua e campo para digitar o número de etiqueta danificada.
- Cache PWA `remobs-inventario-v21`.

Fora do escopo: folha A4 com etiquetas em lote e escolha do tamanho da etiqueta.

## Validações

- Backend: 38 testes aprovados, entre eles `test_patrimonio_gerado_unico_e_imutavel`.
- Migração em cópia do `dev.sqlite` (728 itens): `REM-000001` a `REM-000728`, índice único, downgrade e upgrade sem erro.
- Frontend: 24 arquivos, 64 testes aprovados; `tsc -b` sem erro. O `testTimeout` foi elevado para 20 s porque telas MUI passavam de 5 s com a suíte em paralelo.

## Publicação

1. Conferir, com o script de inspeção, se há patrimônio duplicado no banco de produção.
2. Build e push da imagem do backend para o ECR.
3. Migrar o banco com `run_migration_from_task_definition.py` e conferir `alembic_version = 0007_item_patrimony_unique`.
4. Registrar a task definition nova e atualizar o serviço ECS.
5. Build do frontend e deploy manual no Amplify (`prod`).

## Resultado

Implementado e validado localmente. Commit `d108ee4`.

Deploy autorizado pelo usuário em 2026-09-23 (profile `aws-remobs`, conta `220790920077`, `sa-east-1`):

| Etapa | Resultado |
| :--- | :--- |
| Checagem prévia (leitura) | 832 itens, 831 sem patrimônio, nenhum duplicado; um item já tinha o valor `000` e foi mantido |
| Imagem | `remobs-inventario-backend:prod-2026-09-23-patrimonio-qr` no ECR |
| Migração | `0007_item_patrimony_unique` aplicada; `REM-000001` a `REM-000831`; nenhum item sem patrimônio |
| ECS | task definition `remobs-inventario-backend:18` (cópia da `:17`, só a imagem trocada), rollout `COMPLETED`, `/healthz` 200; `InventoryItemUpdate` sem `patrimony_number` no OpenAPI |
| Amplify | app `d1oidnxd2f4saq`, branch `prod`, job `45` `SUCCEED`, bundle `index-DYl9f8kD.js`, `sw.js` `v21`, `/app/p/REM-000001` respondendo 200 |

Rollback: serviço ECS de volta para `remobs-inventario-backend:17` e republicação do job 44 no Amplify. Os números gerados permanecem no banco; o downgrade da migração só remove o índice único.
