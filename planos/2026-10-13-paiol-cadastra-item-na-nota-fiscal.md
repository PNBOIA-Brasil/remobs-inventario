# Paiol cadastra item novo no recebimento por nota fiscal

## Contexto

A usuária Giovanna relatou que, ao receber material por nota fiscal, a opção de cadastrar um item novo não aparece.

Na tela `InvoiceReceiptPage`, a opção "Não está no estoque: cadastrar item novo" só é exibida para quem tem `inventory:item:create`, e o `POST /inventory/items` exige a mesma permissão. A role `inventario-paiol` dá acesso à tela (por `inventory:withdrawal:deliver`), mas não incluía `inventory:item:create`.

Indício em produção (logs do backend, 10 a 13/10/2026): cinco leituras de nota com resposta 200 e nenhum registro de entrada no período. Os logs não identificam o usuário, e as roles da Giovanna não foram consultadas no banco do `remobs-users`.

## Objetivo

Permitir que o perfil `inventario-paiol` cadastre itens novos durante o recebimento por nota fiscal.

## Escopo

- `backend/scripts/register_inventory_permissions.py`: incluir `inventory:item:create` em `PAIOL_ROLE_CODES`.
- `backend/tests/test_inventory_permission_catalog.py`: cobrir a nova permissão.
- Fora do escopo: frontend, rotas do backend e migrações. Não há deploy de código; a mudança é de dados no `remobs-users`.

## Decisão

Definida pelo usuário em 13/10/2026: o perfil do paiol deve poder fazer essa operação. Efeito colateral aceito: a role passa a ver também o botão "Novo item" na lista de itens e o cadastro rápido em "Receber material", que usam a mesma permissão.

## Etapas

1. Alterar o catálogo e o teste. — concluído
2. Rodar os testes do catálogo. — concluído
3. Aplicar em produção: anexar `inventory:item:create` à role `inventario-paiol` no `remobs-users`. — pendente
4. Pedir à usuária que saia e entre de novo, para renovar o token, e confirmar que a opção aparece. — pendente

## Validações

- `pytest tests/test_inventory_permission_catalog.py`.
- Em produção: a role `inventario-paiol` lista `inventory:item:create` e a usuária vê a opção na etapa de conferência da nota.

## Resultado

Catálogo e teste atualizados. Aplicação em produção pendente.
