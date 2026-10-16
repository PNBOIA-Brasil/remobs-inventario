# Modelo de cautela para emprestar ao Navio

## Contexto

O fluxo de empréstimo/custódia já existe (retirada com finalidade empréstimo ou plataforma, posse, devolução e baixa), mas não havia um documento de "cautela" para o recebedor assinar ao levar material — por exemplo, para o Navio.

## Objetivo

Gerar um "Termo de Cautela" imprimível a partir do pedido de retirada de empréstimo ou plataforma (destino como o Navio, cadastrado como plataforma).

## Escopo

- Frontend apenas, reaproveitando a impressão em janela própria e os dados do pedido. Sem migração nem novo conceito de dados: o Navio é uma plataforma de destino.

## Etapas

1. `frontend/src/custodyTerm.tsx` — componente do termo (código do pedido, solicitante, finalidade, destino/plataforma, devolução prevista, entrega, itens em cautela, declaração e assinaturas) + `printCustodyTerm(order)`.
2. `frontend/src/pages/WithdrawalDetailPage.tsx` — botão "Imprimir cautela" no pedido quando a finalidade é empréstimo ou plataforma e o pedido está aprovado ou entregue.

## Validações

- `tsc -b` sem erros; `vitest run tests/withdrawal-detail.test.tsx` verde.

## Resultado

Para uma retirada de empréstimo ou destinada a uma plataforma (o Navio cadastrado como plataforma), o usuário imprime o Termo de Cautela com os itens e a declaração para assinatura.

## Observação

Decisão de design (ponytail): o Navio é representado como plataforma de destino; a cautela sai do próprio pedido. Se for preciso um tipo "Navio" distinto ou campos específicos, pode virar uma evolução futura.
