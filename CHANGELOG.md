# CHANGELOG

## [2026-09-23]

### Alterado
- O admin do inventário (`inventory:movement:approve`) passa a ver todos os pedidos de retirada e a aprovar ou recusar, inclusive por linha. Entrega e decisão de devolução e baixa continuam só com o paiol, e ninguém decide o próprio pedido. Sem permissão nova no `remobs-users`. Plano: `planos/2026-09-23-admin-aprova-pedidos.md`.
- Cache PWA `remobs-inventario-v13`.

## [2026-09-22] — Redesenho por fluxos

### Publicado
- Produção: banco migrado para `0006_acquisition_needs`, imagem `prod-2026-09-22-fluxos`, task definition `remobs-inventario-backend:14` (`COMPLETED`), Amplify job `35` `SUCCEED` com cache PWA `v12`. Inclui o fluxo do paiol, antes sem deploy. Detalhes e rollback em `planos/2026-09-22-redesenho-telas-por-fluxos.md`.

### Alterado
- Etapa 1: menu agrupado por intenção (Operação, Estoque, Campo, Administração), barra inferior mobile com Início, Pedidos, Itens e Menu, e Início por perfil: ações do dia, material com o usuário, pedidos em andamento e filas do paiol. Indicadores gerais ficam só para quem lê estoque.
- Etapa 2: “Operação” virou “Pedidos”, com abas por fila (Aprovar, Entregar, Devoluções, Meus pedidos, Comigo, Todos). O paiol aprova por material: pode liberar quantidade menor ou recusar uma linha (quantidade 0), e a diferença volta ao disponível. Se todas as linhas forem zeradas, o pedido fica recusado. A entrega ignora linhas recusadas e o pedido fecha quando as demais fecham. A lista de pedidos passa a trazer devoluções e baixas pendentes.
- Etapa 3: o pedido tem finalidade (consumo, empréstimo ou plataforma). Empréstimo exige data de devolução que não esteja no passado; plataforma exige destino. Pedidos, detalhe e Início mostram a finalidade e marcam empréstimo vencido, e o paiol vê a fila “Empréstimos vencidos”. Migração `0005_withdrawal_purpose` adiciona `purpose` (padrão `consumo`), `due_date` e `platform_id` em `withdrawal_orders`.
- Etapa 4: entrada de material como fluxo próprio. `POST /inventory/receipts` recebe origem (compra, doação ou transferência), documento, local e linhas; soma ao saldo, grava movimento `entrada` concluído por material, reavalia o alerta de mínimo e registra `receipt_registered` no histórico do item. Autorizado para quem tem `inventory:item:update` ou `inventory:withdrawal:deliver` (paiol), sem permissão nova. A tela “Receber material” (`/app/receipts/new`) permite cadastrar um material novo sem sair da entrada, para quem tem `inventory:item:create`.
- Etapa 5: necessidades de aquisição (`acquisition_needs`, migração `0006_acquisition_needs`). Saldo abaixo do mínimo nacional abre uma sugestão até o estoque ideal, sem duplicar enquanto houver uma aberta. Etapas: sugerida → aprovada → em compra → atendida, ou cancelada; a entrada abate primeiro o que está em compra e fecha a necessidade quando completa. API em `/inventory/acquisitions` (lista com `inventory:item:read`; criar, varrer e mudar etapa com `inventory:movement:approve`, sem permissão nova), com auditoria em cada mudança. Tela “Aquisições” com abas por etapa.
- Etapa 6: leitor de etiquetas em `/app/scan` (aba “Escanear” no mobile). Usa a câmera pela API nativa `BarcodeDetector` quando o navegador tem (QR, Code 128/39, EAN); sem ela, o código é digitado. Link ou id do item abre a ficha direto; patrimônio ou série exatos também; vários resultados viram lista. A busca `GET /inventory/items?q=` passa a procurar também em patrimônio e número de série.

## [2026-09-22]

### Adicionado
- Pedido de retirada com uma ou mais linhas, reserva na solicitação, aprovação e entrega pelo perfil paiol, devolução e baixa de consumo com aceite ou recusa.
- Histórico auditável do pedido e do item, com ator, papel e motivo.
- Permissões novas e role `paiol` no script de registro, sem conceder decisão de paiol à role `admin-inventario`.
- Telas de solicitação em lista, fila do paiol e detalhe com devolução, baixa e linha do tempo.
- Cache PWA `remobs-inventario-v12`.
- Proposta de redesenho das telas mobile e desktop orientada a fluxos (entrada, retirada e empréstimo, devolução, aquisição), com mapa de jornadas e mudanças de backend necessárias: `planos/2026-09-22-redesenho-telas-por-fluxos.md`.

### Documentado
- O fluxo antigo de saída unitária permanece para pedidos já pendentes.
- A reserva ocorre na solicitação, para dois pedidos não consumirem o mesmo saldo. A aprovação mantém a reserva; a recusa libera; a entrega baixa o saldo e cria a posse.
- Plano de correção: `planos/2026-09-22-fluxo-retirada-paiol-devolucao-baixa.md`.
- Plano de implementação, commits, deploy e roteiro de teste: `planos/2026-09-22-implementacao-retirada-paiol.md`.
- Deploy da API e do frontend de inventário ainda não executado.
- No controle de usuários, os papéis do inventário passaram a usar o prefixo `inventario`: `admin-inventario` virou `inventario-admin` (id 24) e `paiol` virou `inventario-paiol` (id 31). O papel `inventario-usuario` (id 32) foi criado para consulta e solicitação, ainda sem usuário associado. `foloni` permanece em `inventario-admin` e `inventario-paiol`.

## [2026-08-12]

### Publicado
- Deploy em produção da correção da origem na saída e do reparo de saldos; cache PWA `remobs-inventario-v11`.
- Backend: imagem ECR `prod-2026-08-12-origem-saida`, task definition `remobs-inventario-backend:13`, rollout `COMPLETED`.
- Frontend Amplify app `d1oidnxd2f4saq`, branch `prod`, job `34` `SUCCEED`.
- Plano de deploy: `planos/2026-08-12-deploy-origem-saida-sem-saldo.md`.

### Corrigido
- Solicitar saída passa a pré-preencher Origem com o **Local** do item mesmo quando não há linha de saldo (`stock_balances` vazio), usando a lista de Locais cadastrados.
- Cadastro de item sempre cria saldo no local (quantidade 0 quando a inicial é 0); edição de local cria saldo no novo local se ainda não existir.
- Causa em produção: ADCP `bfdf5c9c-d282-4293-85be-b43575dd19e8` está em Paiol PNBOIA, mas sem saldo — a origem ficava em branco.
- Plano: `planos/2026-08-12-correcao-origem-saida-sem-saldo.md`.

### Operação em produção
- Reparo de **61** permanentes ativos sem `stock_balances`: criado saldo quantidade 1 no local atual (em geral Paiol PNBOIA).
- Inclui o ADCP Nortek Signature 500 (`bfdf5c9c-d282-4293-85be-b43575dd19e8`).
- Script: `backend/scripts/repair_missing_stock_balances.py`.

### Documentado
- Avaliação de chaves primárias: manter UUID v4 nas entidades de inventário; não migrar para inteiro sequencial.
- Motivo: PWA/sync offline, dados e arquivos já em produção, e identificadores humanos já existentes (série, patrimônio, código do casco).
- Plano: `planos/2026-08-12-avaliacao-uuid-vs-int-sequencial.md`.

### Publicado
- Deploy em produção (ECS + Amplify) das entregas de Locais, origem na saída e visualização de imagem; cache PWA `remobs-inventario-v10`.
- Backend: imagem ECR `prod-2026-08-12-locais-saida`, task definition `remobs-inventario-backend:12`, rollout `COMPLETED`.
- Frontend Amplify app `d1oidnxd2f4saq`, branch `prod`, job `33` `SUCCEED` (inclui fallbacks SPA de `/app/locations`).
- Permissões `location:read|create|update|delete` criadas e anexadas à role `admin-inventario` (catálogo inventário 25/25).
- Plano de deploy: `planos/2026-08-12-deploy-locais-saida-producao.md`.

### Corrigido
- No detalhe do item, fotos anexadas passam a abrir em Dialog para visualização (clique na miniatura ou botão Visualizar), sem forçar download.
- Botão Baixar permanece apenas para documentos (não-imagem).
- Plano: `planos/2026-08-12-visualizar-imagem-item-sem-download.md`.
- Solicitar saída pré-preenche **Origem** com o local atual do item (`current_location_id`) quando houver saldo disponível nesse local; ao vir do detalhe, não reutiliza origem de outro item no rascunho.
- Plano: `planos/2026-08-12-preencher-origem-saida-local-item.md`.

### Adicionado
- CRUD de Locais (`/locations`) com listagem, cadastro, edição e inativação (`is_active=false`), auditoria e permissões `location:read|create|update|delete`.
- Menu **Locais** no frontend; autocomplete de destino (e origem por saldos) na solicitação de saída, enviando `to_location_id` quando o local existir.
- Campo **Local** no cadastro de itens passa a sugerir a partir da lista de Locais.
- Plano: `planos/2026-08-12-crud-locais-autocomplete-saida.md`.

## [2026-08-06]

### Corrigido
- Edição de item (`PATCH /inventory/items/{id}`) retornava **500** em produção por `sqlalchemy.exc.MissingGreenlet` ao serializar `updated_at` expirado após update assíncrono.
- `update_item` agora faz `flush` + `refresh` antes de `serialize_item`/auditoria; teste de regressão `test_updates_inventory_item_without_missing_greenlet`.
- Plano: `planos/2026-08-06-correcao-edit-item-missing-greenlet.md`.

### Publicado
- Backend ECS: imagem ECR `prod-2026-08-06-fix-edit-item`, task definition `remobs-inventario-backend:11`, rollout `COMPLETED` (1/1).
- Plano de deploy: `planos/2026-08-06-deploy-fix-edit-item-missing-greenlet.md`.

### Operação em produção
- Soft-delete de **533** componentes permanentes fora da allowlist (ACDC, LANTERNA, PAINEL SOLAR, ESTAÇÃO METEOROLÓGICA, PLUVIOMETRO, ANEMOMETRO).
- Permaneceram **31** permanentes ativos: 16 painéis solares, 6 lanternas, 3 anemômetros, 3 estações meteorológicas, 3 pluviômetros (nenhum ACDC cadastrado).
- Script: `backend/scripts/cleanup_permanent_items_allowlist.py`; plano: `planos/2026-08-06-apagar-permanentes-fora-lista-producao.md`.
- Consumíveis não foram alterados; exclusão foi soft-delete com auditoria.
- Restore de **11** itens ADCP soft-deletados (`is_active=true`, `deleted_at=null`) via `backend/scripts/restore_soft_deleted_adcp.py`; permanentes ativos após restore: **42**.
- Restore de **3** itens `Unidade de Comando` (MessenOcean UCMO) via `backend/scripts/restore_soft_deleted_by_name.py`; permanentes ativos após restore: **45**.

### Publicado
- Backend ECS: imagem ECR `prod-2026-08-06-crud-permissions`, task definition `remobs-inventario-backend:10`, rollout `COMPLETED`.
- Frontend Amplify app `d1oidnxd2f4saq`, branch `prod`, job `31` `SUCCEED`; cache PWA `remobs-inventario-v8`.
- Plano de deploy: `planos/2026-08-06-deploy-crud-completo-permissoes.md`.

### Adicionado
- CRUD completo de cadastros no inventário: edição de itens, plataformas e sensores; exclusão de sensores e checklists; botões Editar/Excluir nos detalhes e listagens com gate de permissão.
- Permissões granulares novas: `platform:create|delete`, `sensor:create|delete`, `checklist:read|create|update|delete` (além das existentes), com compatibilidade legada no backend (`*:update` / `checklist:submit` ainda autorizam create/delete/list por uma versão).
- Endpoint `DELETE /sensors/{id}` (soft delete + auditoria) e `DELETE /checklists/{id}` (hard delete com reason e auditoria, inclusive submitted).
- Rotas frontend de edição: `/inventory/:id/edit`, `/platforms/:id/edit`, `/sensors/:id/edit`.
- Script `register_inventory_permissions.py` atualizado para registrar o catálogo completo e anexar à role `admin-inventario` (merge com permissões já existentes da role).
- Em produção (`remobs_users`): 8 permissões novas criadas e anexadas à role `admin-inventario` (id 24); catálogo inventário 21/21 na role.
- Plano `planos/2026-08-06-crud-completo-permissoes-cadastros.md`.

### Adicionado
- Feedback visual global com Snackbar (`SnackbarProvider`) para ações mutáveis: anexar/baixar/remover arquivo, cadastros, exclusões, aprovação de movimentações, checklist, sync e inconsistência de sensor.
- Autocomplete rápido nos campos Nome, Marca, Modelo, Categoria e Local do cadastro de itens (`InventoryFormPage`), com sugestão a partir de 1 letra.
- Endpoint `GET /inventory/items/suggestions?field=name|brand|model|category_name|location_name&q=...&limit=20` com valores distintos por prefixo (case-insensitive), itens/categorias/locais ativos e limite baixo para baixa latência.
- Índices em `inventory_items.brand` e `inventory_items.model` (migração `0003_item_brand_model_idx`).
- Plano `planos/2026-08-06-autocomplete-campos-cadastro-itens.md`.

### Corrigido
- Upload de arquivos e imagens no detalhe do item de inventário, que existia apenas como botões estáticos sem backend nem integração.

### Adicionado
- Endpoints de anexos por item: `GET/POST /inventory/items/{id}/files`, `GET .../files/{entity_file_id}/content` e `DELETE .../files/{entity_file_id}`.
- Serviço de armazenamento local configurável (`REMOBS_STORAGE_LOCAL_PATH`, limite `REMOBS_STORAGE_MAX_BYTES`) com validação de papel (`foto`/`documento`), MIME e tamanho.
- UI de anexos no `InventoryDetailPage`: enviar foto/documento, listar, pré-visualizar imagens autenticadas, baixar e remover (soft delete com auditoria).
- Plano `planos/2026-08-06-correcao-upload-arquivos-imagens.md` e testes de contrato backend/frontend.
- Storage S3 no backend (`REMOBS_STORAGE_BACKEND=s3`) com bucket `inventario-remobs` (região `sa-east-1`, prefixo `remobs-inventario/`), dependência `boto3` e script `backend/scripts/provision_inventario_s3_bucket.py`.
- Role IAM `remobs-inventario-backend-task-role` com permissão de leitura/escrita/exclusão no prefixo do bucket; script de task definition atualizado para injetar envs S3 e `taskRoleArn`.
- Plano `planos/2026-08-06-bucket-s3-inventario-remobs.md`.

### Publicado
- Frontend Amplify app `d1oidnxd2f4saq`, branch `prod`, job `30` `SUCCEED` com feedback Snackbar nas ações; cache PWA `remobs-inventario-v7`.
- Plano de deploy: `planos/2026-08-06-deploy-feedback-snackbar.md`.
- Backend em produção: imagem ECR `prod-2026-08-06-autocomplete`, task definition `remobs-inventario-backend:9`, migração `0003_item_brand_model_idx`, serviço ECS estável com autocomplete de cadastro.
- Frontend Amplify job `29` `SUCCEED` (autocomplete); cache PWA `remobs-inventario-v6`.
- Plano de deploy: `planos/2026-08-06-deploy-autocomplete-cadastro-itens.md`.
- Backend em produção (upload S3 anterior): imagem ECR `prod-2026-08-06-s3-files`, task definition `remobs-inventario-backend:8` com `taskRoleArn` e storage S3 no bucket `inventario-remobs` (prefixo `remobs-inventario/`).
- Frontend Amplify job `28` `SUCCEED` (upload); plano `planos/2026-08-06-deploy-upload-s3-producao.md`.

## [2026-08-04]

### Adicionado
- Exclusão na listagem de inventário (`InventoryListPage`) com botão por item, confirmação e permissão `inventory:item:delete`, usando o endpoint já existente `DELETE /inventory/items/{id}`.
- Exclusão na listagem de plataformas (`PlatformsPage`) com botão por plataforma, confirmação e permissão `platform:update`.
- Endpoint `DELETE /platforms/{platform_id}` no backend, com soft delete (`deleted_at`), auditoria e motivo obrigatório.
- Métodos `deleteItem` e `deletePlatform` no serviço frontend `inventoryService`.
- Role `admin-inventario` criado em produção no controle de usuários REMOBS (`api-controle-usuarios.remobs.com.br` / banco `remobs_users`), com as 13 permissões do inventário: `inventory:item:read|create|update|delete`, `inventory:movement:request|approve`, `platform:read|update`, `sensor:read|update`, `checklist:submit`, `audit:log:read` e `sync:write`.
- Registro operacional em `planos/2026-08-04-criar-role-admin-inventario-producao.md` e `planos/2026-08-04-exclusao-listas-itens-plataformas.md`.

### Adicionado
- Importação de plataformas a partir da API de boias PNBOIA (`/v1/info/available_buoys`), com metadados (`buoy_id`, local, coordenadas, modo, tipo, endpoint) e marcador de origem `remobs-import:pnboia-buoy:{id}`.
- Serviço `backend/app/services/pnboia_platforms.py` e script `backend/scripts/import_pnboia_platforms.py` para sincronização idempotente.
- Filtro `active_only` em `GET /platforms` (padrão `true`) e switch “Somente ativas” na listagem de plataformas (padrão ligado).
- Enriquecimento via `/v1/info/metadata`: fabricante/modelo real da boia, casco (`hulls`), sistemas (Fundeio, Estrutura, Aquisição, Histórico) e sensores vinculados (`sensors` + `sensor_installations`), a partir de atributos de sensores e parâmetros da API.

### Publicado
- Backend em produção: imagem ECR `prod-2026-08-04-delete-lists`, task definition `remobs-inventario-backend:6`, serviço ECS `remobs-inventario-backend` no cluster `remobs-inventario-cluster` (profile `aws-remobs`, região `sa-east-1`).
- Frontend em produção no Amplify app `d1oidnxd2f4saq`, branch `prod`, job `25` com status `SUCCEED`; cache do service worker atualizado para `remobs-inventario-v3`.
- Carga em produção de 45 boias PNBOIA (8 ativas e 37 inativas) no banco `remobs_inventario`.
- Backend atualizado para task definition `remobs-inventario-backend:7` (imagem `prod-2026-08-04-pnboia-platforms`) e frontend Amplify job `26` SUCCEED com cache PWA `remobs-inventario-v4`.

## [2026-06-17]

### Corrigido
- Correção da listagem de inventário (`GET /inventory/items`), que excedia o tempo limite em produção após a carga das planilhas. A serialização passou a carregar categorias, locais e saldos em lote (`serialize_items_bulk`), eliminando o padrão N+1 que gerava milhares de consultas sequenciais ao RDS para 728 itens.

### Adicionado
- Script `backend/scripts/check_production_readonly.py` para validação somente leitura da produção, autenticando e contando os registros por endpoint sem registrar token ou credenciais.
- Componente `LoadingState` e feedback visual de carregamento em todas as telas que buscam dados (inventário, plataformas, sensores, operação, alertas, checklists, dashboard, sincronização, solicitação de saída e telas de detalhe), com spinner centralizado, mensagem e layout responsivo para telas pequenas.
- Indicador de progresso nos botões de envio dos formulários de item, sensor, plataforma e checklist, evitando envios duplicados durante a gravação.

### Corrigido
- Correção dos estados vazios das listas, que apareciam momentaneamente ("Nenhum item encontrado") enquanto os dados ainda estavam sendo carregados. Agora só são exibidos após o término do carregamento.

### Publicado
- Publicação do backend corrigido em produção: imagem `prod-2026-06-17-listagem` no ECR, revisão `remobs-inventario-backend:5` (a partir da `:4`, preservando variáveis e SSL do RDS) e atualização do serviço ECS `remobs-inventario-backend` no cluster `remobs-inventario-cluster`, com o profile AWS `aws-remobs` na região `sa-east-1`.
- Republicação do frontend no AWS Amplify de produção, branch `prod`, usando o profile AWS `aws-remobs`.
- Publicação do frontend com o feedback de carregamento no AWS Amplify de produção, branch `prod`, usando o profile AWS `aws-remobs`.

### Validado
- Em produção, `GET /inventory/items` voltou a responder (729 itens em regime estável de cerca de 1 segundo, ante o timeout anterior superior a 60 segundos), com os demais endpoints mantendo resposta 200.

## [2026-06-15]

### Adicionado
- Checklist de campo detalhado no frontend, com seções para operação, condições ambientais, equipe, embarcações, fotografias obrigatórias, inspeção técnica, problemas, solução e pós-campo.
- Exibição agrupada das respostas do checklist na tela de detalhe, com rótulos legíveis e valores booleanos apresentados como `Sim` ou `Não`.
- Teste automatizado para validar o preenchimento do checklist de campo detalhado e o payload enviado ao serviço de checklists.
- Fallbacks estáticos do SPA para as rotas diretas de cadastro de plataformas, cadastro de sensores, lista de checklists e novo checklist.
- Scripts operacionais para gerar e executar carga idempotente dos dados das planilhas em produção.

### Corrigido
- Correção do acesso direto em produção às rotas `/app/platforms/new/`, `/app/sensors/new/`, `/app/checklists/` e `/app/checklists/new/` no AWS Amplify.
- Correção do cache do PWA para forçar troca de versão do service worker e limpar caches antigos após novo deploy.
- Correção do dashboard operacional para consultar checklists e exibir indicadores de checklists registrados e enviados.
- Correção do dashboard operacional para carregar indicadores por resumo agregado no backend, evitando depender da listagem completa de itens após a carga das planilhas.

### Publicado
- Publicação manual do frontend atualizado no AWS Amplify de produção, branch `prod`, com o job `18`, usando o profile AWS `aws-remobs`.
- Republicação manual da correção de cache do PWA no AWS Amplify de produção, branch `prod`, com o job `19`, usando o profile AWS `aws-remobs`.
- Publicação manual da correção do dashboard de checklists no AWS Amplify de produção, branch `prod`, com o job `20`, usando o profile AWS `aws-remobs`.
- Carga em produção dos dados possíveis das planilhas, adicionando 728 itens de inventário, 113 plataformas, 218 sensores e 12 checklists.
- Integração da branch de trabalho na `main` e validação read-only das contagens do dashboard em produção.

### Analisado
- Análise das planilhas em `docs/` para identificar oportunidades de evolução do sistema de inventário, incluindo importação assistida de itens, estações, pendências, checklists de campo, ferramentas e catálogos auxiliares.

### Observado
- Foram registradas lacunas de saneamento nos dados das planilhas, incluindo quantidades ausentes no paiol, baixa cobertura de condição e movimentação no inventário de laboratório, duplicidades de série/TAG, contatos pouco estruturados e fórmulas de pendências que retornam erro quando lidas como valor calculado.

## [2026-06-09]

### Adicionado
- Formulários no frontend para cadastrar plataformas e sensores, com envio para os endpoints operacionais existentes.
- Botões de ação nas páginas de plataformas e sensores para usuários com permissões `platform:update` e `sensor:update`.
- Testes automatizados para validar a presença das ações de cadastro e o uso dos endpoints `POST /platforms` e `POST /sensors`.

### Corrigido
- Correção da ausência do fluxo de cadastro de plataformas e sensores no frontend.

### Publicado
- Publicação manual do frontend atualizado no AWS Amplify de produção, branch `prod`, usando o perfil AWS `aws-remobs`.

## [2026-06-08]

### Adicionado
- Backend FastAPI em `backend/`, com configuração por variáveis `REMOBS_*`, CORS, healthcheck, erro padronizado, SQLAlchemy assíncrono, autenticação JWT local compatível com `remobs-users` e autorização por permissões.
- Modelos, schemas, serviços e rotas iniciais para inventário, saldos, movimentações, auditoria, alertas, plataformas, sensores, arquivos/metadados e sincronização offline.
- Migração Alembic inicial para criação das tabelas principais no banco PostgreSQL dedicado, usando o schema padrão `public`, sem execução automática no RDS.
- Script auxiliar para registrar permissões do inventário no backend de usuários.
- Frontend React + TypeScript + Material UI em `frontend/`, com PWA básico, login integrado ao backend de usuários, rotas protegidas, layout mobile-first, navegação por permissão, inventário, movimentações, alertas, plataformas, sensores, checklists e sincronização.
- Ambiente de produção do frontend configurado para usar o autenticador em `https://api-controle-usuarios.remobs.com.br`.
- Testes automatizados de backend para JWT, permissões, inventário, movimentações e auditoria.
- Teste automatizado de frontend para navegação por permissão.
- Testes automatizados de frontend para configuração das APIs e resolução da URL completa do login.
- Plano de produção AWS para ECS/Fargate, ECR, Amplify, banco dedicado no RDS existente, load balancer já implementado e DNS `inventario.remobs.com.br`.
- Dockerfile e `.dockerignore` do backend para publicação em ECS/Fargate.
- Build spec `amplify.yml` para deploy do frontend no AWS Amplify usando o diretório `frontend/`.
- Configuração de produção do frontend para apontar a API de inventário para `https://api-inventario.remobs.com.br`.
- Recursos AWS iniciais de produção: repositório ECR `remobs-inventario-backend`, imagem publicada com tags `prod-2026-06-08-inicial` e `latest`, security group da task, target group, log group, certificado ACM validado e regra HTTPS no load balancer existente.
- Scripts de provisionamento do banco dedicado do inventário a partir das configurações existentes do ECS, sem imprimir segredos.
- Provisionamento do banco dedicado `remobs_inventario` no RDS existente e do usuário `remobs_inventario_app`, validado por conexão real e criação/remoção de tabela de teste.
- Nova imagem `prod-2026-06-08-banco` publicada no ECR e task definition `remobs-inventario-backend:2` registrado com `REMOBS_DATABASE_SSL=require`.
- Serviço ECS/Fargate `remobs-inventario-backend` criado no cluster existente, com target group saudável no load balancer compartilhado.
- Registros DNS públicos criados para `api-inventario.remobs.com.br` e `inventario.remobs.com.br`.
- App AWS Amplify `remobs-inventario-frontend` criado e publicado na branch `prod`.
- Script `backend/scripts/smoke_production.py` para validação autenticada de produção sem registrar token ou credenciais no código.
- Script `frontend/scripts/create-spa-fallbacks.mjs` para gerar fallbacks estáticos das rotas do SPA no artefato do Amplify.
- Contratos backend e telas frontend para checklists de campo, detalhe de plataforma, detalhe de sensor e resolução de conflitos offline.
- Dashboard operacional completo com indicadores de estoque crítico, plataformas, sensores, solicitações pendentes e sincronização.
- Inventário com busca, filtros rápidos, cadastro ampliado, detalhe técnico e histórico.
- Solicitação de saída com validação de estoque, seleção de origem, rascunho local e confirmação antes do envio.

### Alterado
- Atualização da configuração local do ecossistema para os caminhos reais disponíveis no ambiente de desenvolvimento atual.
- Atualização do `.gitignore` para ignorar artefatos Python e bancos SQLite locais de teste.
- Centralização da configuração de URLs das APIs do frontend, com normalização de barras finais e fallback seguro para o autenticador de produção.
- Configuração de fallback local para a API do inventário em `http://127.0.0.1:8000`, evitando chamadas acidentais à própria origem do Vite.
- Ajuste do plano de produção AWS para não criar schema dedicado, não criar novo load balancer, não criar novo RDS e restringir custos novos a ECS/Fargate, ECR e Amplify.
- Ajuste do backend e da migration inicial para usar banco PostgreSQL dedicado com schema padrão `public`, sem criação do schema `inventario`.
- Suporte do backend à variável `REMOBS_DATABASE_SSL=require` para conexão PostgreSQL criptografada em produção.
- Ajuste do `alembic.ini` para resolver caminhos a partir do próprio arquivo, permitindo execução local e no container.
- Publicação do backend em ECS usando o banco dedicado `remobs_inventario` e o usuário próprio `remobs_inventario_app`.
- Ajuste da tela de login para declarar autocomplete de usuário e senha.
- Remoção do planejamento de telas administrativas e de recuperação de senha da documentação operacional do inventário.

### Corrigido
- Correção do login do frontend para evitar chamadas para a própria origem do Vite, garantindo o uso de `https://api-controle-usuarios.remobs.com.br/auth/login`.
- Correção da URL padrão do cliente de inventário para impedir que rotas como `/inventory/items` sejam resolvidas em `http://127.0.0.1:5173`.
- Correção das rotas diretas do frontend no Amplify, incluindo `/login/`, `/app/home/` e `/app/inventory/`, por meio de fallbacks estáticos do SPA.
- Correção do `404` de favicon na aplicação publicada.

### Observado
- A regra temporária de acesso ao RDS pelo IP local foi removida ao final do provisionamento.
- A migration inicial foi executada no banco dedicado após autorização do usuário e validada pela presença das tabelas esperadas.
- O frontend publicado foi validado em navegador real nos viewports 360px, 390px, 430px e 1440px, sem erros ou warnings de console.
- O smoke test de produção validou login, `/users/me`, inventário, criação e remoção de item de teste, histórico, movimentação rejeitada, auditoria, alertas, plataformas, sensores e sync.

## [2026-06-03]

### Adicionado
- Download de todas as 25 telas do Google Stitch (mobile, desktop e assets) no diretório local `telas/` em formato HTML/SVG.
- Criação do arquivo de configurações reais `.config` e do modelo de referência `.config.example` com o mapeamento de caminhos do ecossistema REMOBS.
- Criação do arquivo de diretrizes operacionais `AGENTS.md` em português do Brasil, contendo as instruções do projeto, diretrizes Clean Code, padrões de desenvolvimento e uma tabela dinâmica referenciando todas as 25 telas locais com links clicáveis e seus Stitch IDs correspondentes.
- Geração das versões desktop de todas as 10 telas funcionais (Lista de Inventário, Dashboard, Login, Solicitar Saída, Detalhes do Sensor, Adicionar Item, Detalhes da Plataforma, Field Checklist, Offline Sync e Audit Logs) no projeto Stitch `15941217647782050586`, seguindo layouts responsivos com sidebars, grids de 12 colunas, visualização master-detail e tabelas de dados.
- Geração das 3 telas mobile restantes (Field Checklist Form, Offline Sync and Conflict Resolution, e Audit Logs) no projeto Stitch.
