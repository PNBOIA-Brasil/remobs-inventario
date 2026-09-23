# Carregamento nos diálogos de confirmação de pedido

## Contexto
Ao clicar em Confirmar nos diálogos do fluxo de pedidos, a requisição demorava e os botões continuavam habilitados, dando a impressão de que nada havia acontecido e permitindo cliques repetidos.

## Objetivo
Exibir carregamento e bloquear as ações do diálogo enquanto a requisição estiver em andamento.

## Escopo
- `frontend/src/components/ReasonDialog.tsx`: usado por `MovementsPage` e `WithdrawalDetailPage` (aprovar, recusar, entregar, custódia, devolução e baixa).
- `frontend/src/pages/MovementRequestPage.tsx`: diálogo "Confirmar retirada".
- `frontend/src/pages/AcquisitionsPage.tsx`: diálogos de decisão e nova necessidade, botão "Gerar sugestões".
- `frontend/src/pages/ReceiptPage.tsx`: cadastro rápido e botão de registrar entrada.
- `frontend/public/sw.js`: cache PWA `v16`.

## Etapas
1. `ReasonDialog` passa a aguardar a `Promise` de `onConfirm`, com estado interno `submitting`.
2. Durante o envio: botão Confirmar com `loading` nativo do MUI 7, Cancelar e campo de motivo desabilitados, e fechamento por clique fora ou Esc bloqueado.
3. Mesmo comportamento no diálogo de confirmar retirada, com o estado `sending`.

## Validações
- `npx tsc -b` sem erros, `npm run build` ok, 54 testes do frontend passando.
- Teste manual: confirmar uma decisão e observar o indicador de carregamento e os botões desabilitados até a resposta; em caso de erro, o diálogo permanece aberto e reabilitado.

## Resultado
Implementado. Sem mudança de contrato com o backend.
