# Folha A4 de etiquetas em lote e QR Code na lista de itens

## Contexto

O detalhe do item já imprime a etiqueta individual (62 × 29 mm) com o QR Code do patrimônio. A folha A4 com etiquetas em lote ficou fora da entrega anterior (`planos/2026-09-23-patrimonio-qr-code-item.md`), e a lista de itens não mostrava o QR Code.

## Objetivo

- Imprimir, a partir da lista de itens, uma folha A4 com as etiquetas dos itens selecionados.
- Exibir o QR Code e o número patrimonial de cada item na lista.

## Decisões

- Folha A4 com margem de 10 mm e grade de 3 × 9 etiquetas de 62 × 29 mm, com 2 mm entre elas: 27 por página, com linha tracejada de corte. Com mais itens, a impressão continua em novas páginas.
- A etiqueta é a mesma da impressão individual: QR Code, `REMOBS`, número e nome do item.
- A impressão abre uma janela própria e renderiza as etiquetas com React e `QRCodeSVG`. O nome do item entra como texto, sem HTML montado à mão.
- A seleção fica na lista: caixa de seleção por item e ação para marcar ou desmarcar todos os itens visíveis (respeitando busca e filtro).
- Sem mudança de backend, contrato ou banco.

## Etapas

1. Módulo `labelPrint.tsx` com `itemQrUrl`, a folha de etiquetas e `printLabels(itens, "a4" | "individual")`.
2. `ItemQrLabel` passa a usar `printLabels` para a etiqueta individual.
3. Lista de itens: QR Code e número em cada item, seleção e botão "Imprimir etiquetas".
4. Testes da folha (paginação e conteúdo) e da seleção na lista.
5. Cache PWA `remobs-inventario-v22`.

## Validações

- `tests/label-print.test.tsx`: 28 itens geram duas páginas (27 + 1) com QR, número e nome; janela bloqueada retorna aviso; a lista mostra o QR de cada item, imprime só os selecionados e marca/desmarca os visíveis.
- Suíte completa do frontend: 25 arquivos, 67 testes aprovados; `tsc -b` e `npm run build` sem erro.
- Conferência visual da folha renderizada no navegador: grade 3 × 9 na primeira página e continuação na seguinte; nome longo cortado em três linhas.

## Resultado

Implementado e validado localmente. Commit `3d183ec`.

Deploy autorizado pelo usuário em 2026-09-23 (profile `aws-remobs`, conta `220790920077`, `sa-east-1`), somente frontend: Amplify app `d1oidnxd2f4saq`, branch `prod`, job `46` `SUCCEED`, bundle `index-C0ffVh9a.js`, `sw.js` `v22`, `/app/inventory` respondendo 200. Backend e banco sem alteração.

Rollback: republicação do job 45 no Amplify.
