# QR Code da retirada

## Contexto

Ao solicitar uma retirada, o pedido não tinha um identificador curto nem um meio rápido de ser localizado no paiol. O usuário pediu que a solicitação já gere um QR Code com o código da retirada, visível no desktop e no mobile. Os previews foram aprovados no canvas de design antes da implementação.

## Objetivo

Exibir o QR Code e o código da retirada logo após a solicitação, enquanto o pedido aguarda aprovação ou entrega.

## Escopo e decisões

- Somente frontend. Sem migração de banco e sem mudança no backend.
- Código curto derivado do UUID do pedido: `RET-` seguido dos 8 primeiros caracteres (ex.: `RET-8F3A9C2E`). Evita campo novo e coluna no banco.
- O QR codifica a URL do próprio pedido (`/app/withdrawals/<id>`): quem lê no paiol abre direto a tela de aprovação e entrega.
- Biblioteca `qrcode.react` (QR gerado no navegador, funciona offline).
- O cartão aparece nos status `pending_approval` e `approved`; some após entrega ou recusa. O código aparece sempre no cabeçalho do pedido.
- Após solicitar, o usuário é levado ao detalhe do pedido criado, onde já vê o QR.
- Ações: tela cheia (para leitura no balcão), copiar código e baixar PNG. Compartilhar e imprimir ficaram de fora.

## Etapas

1. Instalar `qrcode.react`.
2. Criar `withdrawalCode` em `withdrawalLabels.ts`.
3. Criar o componente `WithdrawalQrCard` e usá-lo em `WithdrawalDetailPage`.
4. Redirecionar para o pedido criado em `MovementRequestPage`.
5. Atualizar o cache PWA para `remobs-inventario-v17`.
6. Testes, build, commit e deploy do frontend no Amplify.

## Validações

- `vitest`: 55 testes passando, incluindo o novo caso do QR no detalhe.
- `tsc -b` sem erro e `npm run build` concluído.

## Resultado

Implementado. Publicação registrada no `CHANGELOG.md`.

## Publicação

| Item | Valor |
|------|-------|
| Amplify | app `d1oidnxd2f4saq`, branch `prod`, job `40` `SUCCEED`, bundle `index-BVLoAyPa.js`, `sw.js` `v17` |
| Backend e banco | sem alteração |

Rollback: republicação do job 39 no Amplify.
