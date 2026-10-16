# Sincronizar plataformas com a API PNBOIA (com confirmação)

## Contexto

A importação de plataformas da API de boias PNBOIA só existia como script de linha de comando (`import_pnboia_platforms.py`), que grava direto no banco. Não havia botão na aplicação nem um fluxo em que o usuário confere os dados antes de gravar.

## Objetivo

Adicionar um botão na tela de Plataformas que consulta a API PNBOIA, mostra as plataformas retornadas para o usuário conferir e grava apenas as confirmadas (criando as novas e atualizando as existentes de mesmo nome).

## Escopo

- Backend: rota de pré-visualização (busca na API, sem gravar) e rota de gravação das confirmadas, reaproveitando `fetch_platform_payloads`.
- Frontend: botão "Sincronizar PNBOIA" e diálogo de conferência na tela de Plataformas.
- Nível de plataforma (nome, tipo, fabricante, modelo, status, descrição). O enriquecimento profundo (casco, sistemas, sensores) continua pelo script CLI.

## Etapas

1. `GET /platforms/pnboia/preview` — chama `fetch_platform_payloads(include_metadata=False)` em thread, devolve as plataformas com `exists` (casadas por nome) e avisos de leitura; permissão `platform:create` ou `platform:update`.
2. `POST /platforms/pnboia/sync` — grava a lista confirmada: cria as novas e atualiza as existentes por nome; auditoria em cada uma.
3. Schemas `PnboiaPreviewItem`, `PnboiaPreviewRead`, `PnboiaSyncRequest`, `PnboiaSyncResult`.
4. Frontend: `previewPnboiaPlatforms()` / `syncPnboiaPlatforms()`; botão + diálogo com seleção por plataforma ("nova" ou "atualiza") e gravação após confirmação.

## Validações

- Backend: `pytest` — 53 testes verdes, incluindo `test_sincroniza_plataformas_pnboia` (preview marca exists, sync cria e depois atualiza; API simulada).
- Frontend: `tsc -b` sem erros; suíte `vitest` verde (75 testes).

## Resultado

Na tela de Plataformas, "Sincronizar PNBOIA" busca as boias da API, lista o que será criado/atualizado e grava só o que o usuário confirmar.

## Observação

Decisão de design (ponytail): sincronização em nível de plataforma, casada por nome (o modelo `platforms` não tem id externo). O preview não grava; o enriquecimento completo (casco/sistemas/sensores) segue no script CLI existente.
