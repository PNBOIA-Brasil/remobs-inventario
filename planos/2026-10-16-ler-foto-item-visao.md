# Ler a foto do item para preencher o cadastro

## Contexto

A leitura por visão (Amazon Bedrock, modelo Qwen3-VL) só existia para a nota fiscal. No cadastro de item, todos os campos eram digitados à mão, mesmo quando o item tem etiqueta/plaqueta legível numa foto.

## Objetivo

Ler uma foto do item pelo modelo de visão e preencher os campos do cadastro (nome, marca, modelo, categoria, unidade, número de série e descrição), para o usuário conferir e salvar.

## Escopo

- Backend: função de leitura reaproveitando o cliente de visão já existente e uma rota para a foto do item.
- Frontend: botão "Preencher pela foto do item" no formulário de novo item.

## Etapas

1. `ItemPhotoRead` em `schemas/inventory.py`.
2. `read_item_photo(mime, content)` em `services/invoice_reader.py` (mesmo cliente Bedrock, prompt próprio para campos do item).
3. Rota `POST /inventory/items/read-photo` (imagem) com permissão `inventory:item:create` ou `inventory:item:update`, lendo em thread para não bloquear o loop.
4. Frontend: `inventoryService.readItemPhoto(file)` e botão no `InventoryFormPage` que envia a foto e pré-preenche os campos lidos.

## Validações

- Backend: `pytest` — 52 testes verdes, incluindo `test_le_foto_do_item_preenche_campos` (visão simulada; preenche campos e exige permissão).
- Frontend: `tsc -b` sem erros; `vitest run tests/inventory-form-suggestions.test.tsx` verde.

## Resultado

No cadastro de item novo, o usuário tira/escolhe uma foto, o sistema lê e preenche os campos; o usuário confere e salva. A leitura reaproveita a mesma infraestrutura de visão da nota fiscal.

## Observação

A qualidade depende do modelo e da foto; todos os campos são conferíveis e editáveis antes de salvar. Sem migração nem nova dependência.
