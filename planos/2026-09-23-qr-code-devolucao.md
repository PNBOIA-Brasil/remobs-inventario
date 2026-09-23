# QR Code da devolução

## Contexto

A retirada já gera QR Code (`/app/withdrawals/<id>`) e código curto `RET-XXXXXXXX` para o paiol abrir o pedido pela tela Escanear. A devolução, porém, não tinha QR próprio: o responsável pelo paiol precisava localizar o pedido manualmente para aceitar ou recusar a devolução pendente.

## Objetivo

Cada pedido de devolução gera um novo QR Code. O responsável pelo paiol lê o código na tela Escanear e cai no pedido com a devolução destacada, pronta para aceitar ou recusar.

## Escopo

- Somente frontend. Sem alteração de backend, contrato ou banco: a devolução já é um evento de custódia (`events`) do pedido, e a listagem de retiradas já traz os eventos.
- `WithdrawalQrCard` passa a receber caminho, código, título, instrução e rótulo, servindo à retirada e à devolução.
- Devolução pendente mostra, ao solicitante (ou ao admin do inventário), o QR Code da devolução com a URL `/app/withdrawals/<pedido>?devolucao=<evento>` e o código curto `DEV-XXXXXXXX` (8 primeiros caracteres do id do evento).
- Tela Escanear: o link lido preserva o parâmetro `devolucao`; o código `DEV-` digitado é procurado entre os eventos das retiradas visíveis ao usuário.
- Detalhe do pedido: a devolução indicada em `?devolucao=` fica destacada, rola para a vista e exibe aviso para conferência. As permissões de aceitar/recusar não mudam.
- Baixa não recebe QR (fora do pedido).
- Cache PWA `remobs-inventario-v20`.

## Validações

- `tests/scan-page.test.tsx`: link da devolução preserva o evento; código `DEV-` digitado abre o pedido.
- `tests/withdrawal-detail.test.tsx`: devolução pendente exibe o QR `DEV-5D4C3B2A`.
- Suíte completa do frontend: 24 arquivos, 61 testes aprovados; `tsc -b` sem erros.

## Resultado

Implementado e validado localmente. Commit `9622a8e`.

Deploy autorizado pelo usuário em 2026-09-23 (profile `aws-remobs`, `sa-east-1`), por upload manual do `dist`:

| Destino | Resultado |
| :--- | :--- |
| Amplify | app `d1oidnxd2f4saq`, branch `prod`, job `44` `SUCCEED`, bundle `index-BxLO3gZC.js`, `sw.js` `v20`, `/app/scan` respondendo 200 |

Rollback: republicação do job 43 no Amplify.
