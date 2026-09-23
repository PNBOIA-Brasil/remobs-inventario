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

Implementado e validado localmente. Pendente: commit e deploy, mediante confirmação do usuário.
