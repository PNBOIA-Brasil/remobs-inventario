# Escanear o QR Code da retirada

## Contexto

O QR Code da retirada codifica a URL `/app/withdrawals/<id>`. A tela Escanear extraía qualquer UUID do código lido e navegava para `/app/inventory/<id>`, abrindo uma ficha de material inexistente em vez do pedido.

## Objetivo

Ao ler o QR Code da retirada na tela Escanear (mobile), abrir diretamente o pedido, que já exibe as ações da etapa em que ele se encontra (aprovar, entregar, devolução, baixa etc.).

## Escopo

- Somente frontend (`ScanPage`). Sem alteração de backend, contrato ou banco.
- Link de retirada lido pela câmera ou colado no campo abre `/app/withdrawals/<id>`.
- Código curto `RET-XXXXXXXX` digitado é procurado entre as retiradas visíveis ao usuário (`GET /inventory/withdrawals`); se não houver correspondência, a tela avisa.
- Etiquetas de material continuam com o comportamento anterior.
- Cache PWA `remobs-inventario-v18`.

## Validações

- `tests/scan-page.test.tsx`: QR da retirada, código RET- encontrado e não encontrado.
- Suíte completa do frontend: 24 arquivos, 58 testes aprovados; `tsc` sem erros.

## Resultado

Implementado e validado localmente. Commit `425f5ee`.

Deploy autorizado pelo usuário em 2026-09-23 (profile `aws-remobs`, `sa-east-1`), por upload manual do `dist`:

| Destino | Resultado |
| :--- | :--- |
| Amplify | app `d1oidnxd2f4saq`, branch `prod`, job `41` `SUCCEED`, bundle `index-DReM2KDq.js`, `sw.js` `v18`, `/app/scan` respondendo 200 |

Rollback: republicação do job 40 no Amplify.
