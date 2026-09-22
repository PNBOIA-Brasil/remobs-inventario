# AGENTS.md - Diretrizes Operacionais do Projeto remobs-inventario

Este documento define as instruções operacionais para agentes e colaboradores que atuam neste repositório do projeto REMOBS.

Todo o conteúdo, documentação auxiliar, planos de execução e registros de alteração deste projeto devem ser escritos em português do Brasil, com correção gramatical, clareza e objetividade.

## Objetivo

Este repositório deve atuar de forma integrada com os projetos relacionados do ecossistema REMOBS (Controle de Material e Acompanhamento de Plataformas Fixas e Móveis).

Os projetos envolvidos, assim como o caminho base do ecossistema, devem ser obtidos exclusivamente a partir do arquivo `.config`.

## Regra de Leitura Obrigatória

Antes de executar qualquer tarefa que envolva este projeto ou qualquer integração com os projetos relacionados, é obrigatório:

1. Ler este `AGENTS.md`
2. Ler o arquivo `.config` deste repositório
3. Ler o `AGENTS.md` de cada projeto envolvido na tarefa

Os caminhos dos projetos envolvidos não devem ser publicados em documentação versionada deste repositório. Eles devem ser lidos do `.config` no momento da execução.

Se uma tarefa afetar apenas um dos projetos relacionados, ainda assim deve ser validado se existem regras compartilhadas que impactam a atividade.

## Arquivos de Configuração Obrigatórios

Este repositório deve manter os seguintes arquivos:

- `.config`: configuração real do ambiente local
- `.config.example`: modelo de referência para configuração

Esses arquivos devem informar, no mínimo:

- O caminho base do ecossistema (`BASE_PATH`)
- O caminho do projeto `remobs-inventario` (`REMOBS_INVENTARIO_PATH`)
- O caminho do projeto `remobs-permissoes` (`REMOBS_PERMISSOES_PATH`)
- O caminho do projeto `remobs-users` (`REMOBS_USERS_PATH`)
- O caminho do projeto `remobs-user-front` (`REMOBS_USER_FRONT_PATH`)

## Hierarquia de Instruções

As instruções devem ser aplicadas nesta ordem:

1. Regras explícitas da tarefa solicitada pelo usuário
2. Regras deste repositório em `AGENTS.md`
3. Regras dos projetos envolvidos, conforme seus respectivos `AGENTS.md`
4. Boas práticas técnicas e documentação oficial atual das bibliotecas utilizadas

Em caso de conflito entre instruções dos projetos relacionados, deve-se:

1. Respeitar o escopo técnico do projeto afetado
2. Manter compatibilidade entre frontend e backend
3. Registrar a decisão no plano da tarefa e no changelog, quando aplicável

## Padrões Obrigatórios de Desenvolvimento

Todo projeto e toda alteração devem seguir:

- Clean Architecture
- Clean Code
- Princípios de separação de responsabilidades
- Padrões e convenções já adotados em cada projeto
- Boas práticas específicas da stack de cada projeto (React + TypeScript + Material UI + PWA)

Também é obrigatório:

- Seguir a documentação atual das versões das bibliotecas e frameworks efetivamente utilizados
- Evitar implementar soluções baseadas em APIs obsoletas quando houver alternativa compatível já adotada no projeto
- Preservar consistência com a arquitetura existente antes de introduzir novos padrões

## Integração com Projetos Relacionados

Os projetos relacionados obrigatórios do ecossistema REMOBS são:

- `remobs-inventario`: gerenciamento de materiais (estoque, consumíveis, permanentes, cascos, sensores) e plataformas.
- `remobs-permissoes`: gerenciamento de papéis e permissões (Developer, Admin, Operação, DGAes).
- `remobs-users`: API de backend para gerenciamento de usuários e controle de acesso.
- `remobs-user-front`: painel administrativo de gestão de usuários e logs de auditoria.

Ao trabalhar em fluxos que envolvam frontend e backend:

- Ler as instruções do projeto de frontend definido no `.config` quando houver impacto no frontend
- Ler as instruções do projeto de backend definido no `.config` quando houver impacto no backend
- Garantir compatibilidade contratual entre interface, rotas, payloads e tratamento de erros
- Respeitar as convenções de versionamento e documentação já praticadas em cada projeto

## Planos de Execução

Toda tarefa deve possuir um plano de execução em `planos/`, em português do Brasil e com redação gramaticalmente correta.

Regras para os planos:

- Criar um arquivo por tarefa
- Usar nomes descritivos e legíveis
- Registrar contexto, objetivo, escopo, etapas, validações e resultado
- Atualizar o plano ao longo da execução quando houver mudança relevante de abordagem

Formato sugerido de nome de arquivo:

- `planos/AAAA-MM-DD-descricao-da-tarefa.md`

## Changelog Obrigatório

Toda alteração deve ser registrada em changelog em português do Brasil, com correção gramatical.

Este repositório deve manter o arquivo:

- `CHANGELOG.md`

Regras do changelog:

- Registrar o que foi alterado de forma objetiva
- Informar a data da alteração
- Descrever impacto funcional, estrutural ou documental quando houver
- Manter o texto em português do Brasil

## Telas do Sistema

As seguintes telas foram projetadas, geradas no Google Stitch (projeto `15941217647782050586`) e baixadas localmente para referência no diretório `telas/`:

| Título da Tela | Dispositivo | Stitch ID | Arquivo Local |
| :--- | :--- | :--- | :--- |
| Adicionar Item - REMOBS | MOBILE | `ade405fc1eda4e1899b2f996a8ae941e` | [Adicionar_Item_-_REMOBS_mobile.html](file:///c:/Users/remob/Desktop/desenvolvimento/remobs-inventario/telas/Adicionar_Item_-_REMOBS_mobile.html) |
| Audit Log Viewer - REMOBS | MOBILE | `46b4d844f61441ddbbc627b6aac84002` | [Audit_Log_Viewer_-_REMOBS_mobile.html](file:///c:/Users/remob/Desktop/desenvolvimento/remobs-inventario/telas/Audit_Log_Viewer_-_REMOBS_mobile.html) |
| Audit Logs - REMOBS | MOBILE | `a3b847a777f34bdcbb42ea25e530eea4` | [Audit_Logs_-_REMOBS_mobile.html](file:///c:/Users/remob/Desktop/desenvolvimento/remobs-inventario/telas/Audit_Logs_-_REMOBS_mobile.html) |
| Checklist Operacional - Etapa 2 de 4 | MOBILE | `d273519209ab476ab5c1400417b91739` | [Checklist_Operacional_-_Etapa_2_de_4_mobile.html](file:///c:/Users/remob/Desktop/desenvolvimento/remobs-inventario/telas/Checklist_Operacional_-_Etapa_2_de_4_mobile.html) |
| Detalhes da Plataforma - Boia 01 | MOBILE | `ded2327349aa4f3cbe3842eb8fd7fbed` | [Detalhes_da_Plataforma_-_Boia_01_mobile.html](file:///c:/Users/remob/Desktop/desenvolvimento/remobs-inventario/telas/Detalhes_da_Plataforma_-_Boia_01_mobile.html) |
| Field Checklist Form - REMOBS | MOBILE | `f18468b9f00a44da948a428971c0f6bc` | [Field_Checklist_Form_-_REMOBS_mobile.html](file:///c:/Users/remob/Desktop/desenvolvimento/remobs-inventario/telas/Field_Checklist_Form_-_REMOBS_mobile.html) |
| Offline Sync and Conflict Resolution | MOBILE | `7cfb329a2ea444f9a118c5532591c073` | [Offline_Sync_and_Conflict_Resolution_mobile.html](file:///c:/Users/remob/Desktop/desenvolvimento/remobs-inventario/telas/Offline_Sync_and_Conflict_Resolution_mobile.html) |
| REMOBS - Detalhes do Sensor | MOBILE | `15f35e6457694eed9bba966b2ed4a9f5` | [REMOBS_-_Detalhes_do_Sensor_mobile.html](file:///c:/Users/remob/Desktop/desenvolvimento/remobs-inventario/telas/REMOBS_-_Detalhes_do_Sensor_mobile.html) |
| REMOBS Dashboard | MOBILE | `911e2c27f1f44cd7a34a67695f366dbf` | [REMOBS_Dashboard_mobile.html](file:///c:/Users/remob/Desktop/desenvolvimento/remobs-inventario/telas/REMOBS_Dashboard_mobile.html) |
| REMOBS Inventory List | MOBILE | `ed78b955d74e453db9308f16ba63c8d4` | [REMOBS_Inventory_List_mobile.html](file:///c:/Users/remob/Desktop/desenvolvimento/remobs-inventario/telas/REMOBS_Inventory_List_mobile.html) |
| REMOBS Login | MOBILE | `a89da8965c7f4ce3974869b54cdf3a09` | [REMOBS_Login_mobile.html](file:///c:/Users/remob/Desktop/desenvolvimento/remobs-inventario/telas/REMOBS_Login_mobile.html) |
| Solicitar Saída - REMOBS | MOBILE | `9c136294b51342728e16bb9d159787b2` | [Solicitar_Saida_-_REMOBS_mobile.html](file:///c:/Users/remob/Desktop/desenvolvimento/remobs-inventario/telas/Solicitar_Saida_-_REMOBS_mobile.html) |
| Sync & Conflict Resolution | MOBILE | `d6683311494e4363aedc0d9f8cab148f` | [Sync_Conflict_Resolution_mobile.html](file:///c:/Users/remob/Desktop/desenvolvimento/remobs-inventario/telas/Sync_Conflict_Resolution_mobile.html) |
| Adicionar Item - Desktop View | DESKTOP | `44164cdc4c8949f693288025944090b9` | [Adicionar_Item_-_Desktop_View_desktop.html](file:///c:/Users/remob/Desktop/desenvolvimento/remobs-inventario/telas/Adicionar_Item_-_Desktop_View_desktop.html) |
| Admin Audit Log - Master-Detail View | DESKTOP | `610550101d1943788b50b537f1620ba2` | [Admin_Audit_Log_-_Master-Detail_View_desktop.html](file:///c:/Users/remob/Desktop/desenvolvimento/remobs-inventario/telas/Admin_Audit_Log_-_Master-Detail_View_desktop.html) |
| Detalhes do Sensor - Desktop View | DESKTOP | `13d1975d32b44b2d8197de1db9f77825` | [Detalhes_do_Sensor_-_Desktop_View_desktop.html](file:///c:/Users/remob/Desktop/desenvolvimento/remobs-inventario/telas/Detalhes_do_Sensor_-_Desktop_View_desktop.html) |
| Field Checklist - Desktop View | DESKTOP | `1c452fe580494fa2b2e5107049f6b23a` | [Field_Checklist_-_Desktop_View_desktop.html](file:///c:/Users/remob/Desktop/desenvolvimento/remobs-inventario/telas/Field_Checklist_-_Desktop_View_desktop.html) |
| Lista de Inventário - Desktop | DESKTOP | `34dbedab48f344bd9e82a78c54dae17e` | [Lista_de_Inventario_-_Desktop_desktop.html](file:///c:/Users/remob/Desktop/desenvolvimento/remobs-inventario/telas/Lista_de_Inventario_-_Desktop_desktop.html) |
| Platform Detail - Desktop View | DESKTOP | `cf020e140b5f475693b65cb7a3abe410` | [Platform_Detail_-_Desktop_View_desktop.html](file:///c:/Users/remob/Desktop/desenvolvimento/remobs-inventario/telas/Platform_Detail_-_Desktop_View_desktop.html) |
| Platform Detail - Desktop View | DESKTOP | `a5de68c449d54bfa8292fd8973361946` | [Platform_Detail_-_Desktop_View_desktop.html](file:///c:/Users/remob/Desktop/desenvolvimento/remobs-inventario/telas/Platform_Detail_-_Desktop_View_desktop.html) |
| REMOBS Dashboard - Desktop View | DESKTOP | `6f0a7328c63d4ea8b3656bffb6218abc` | [REMOBS_Dashboard_-_Desktop_View_desktop.html](file:///c:/Users/remob/Desktop/desenvolvimento/remobs-inventario/telas/REMOBS_Dashboard_-_Desktop_View_desktop.html) |
| REMOBS Login - Desktop View | DESKTOP | `8dcaece5ea8d4018b5216824a064d0eb` | [REMOBS_Login_-_Desktop_View_desktop.html](file:///c:/Users/remob/Desktop/desenvolvimento/remobs-inventario/telas/REMOBS_Login_-_Desktop_View_desktop.html) |
| REMOBS Sync Dashboard - Desktop View | DESKTOP | `797e39ec4a0a48389b51f0bcd69d84f1` | [REMOBS_Sync_Dashboard_-_Desktop_View_desktop.html](file:///c:/Users/remob/Desktop/desenvolvimento/remobs-inventario/telas/REMOBS_Sync_Dashboard_-_Desktop_View_desktop.html) |
| Solicitar Saída - Desktop View | DESKTOP | `7dde335b3eda4b72805e7bb804830cfb` | [Solicitar_Saida_-_Desktop_View_desktop.html](file:///c:/Users/remob/Desktop/desenvolvimento/remobs-inventario/telas/Solicitar_Saida_-_Desktop_View_desktop.html) |
| REMOBS Logo | ASSET | `8ba13896e2354526ae103e151f933cff` | [REMOBS_Logo_asset.svg](file:///c:/Users/remob/Desktop/desenvolvimento/remobs-inventario/telas/REMOBS_Logo_asset.svg) |

## Git e Versionamento

Nunca crie commit sem confirmação explícita do usuário.

Após a confirmação do usuário:

- O commit deve ser escrito em português do Brasil
- A mensagem deve ter redação clara e gramaticalmente correta
- O changelog deve estar atualizado antes do commit

## Convenções Gerais de Escrita

Tudo o que for produzido neste projeto deve estar em português do Brasil:

- `AGENTS.md`
- arquivos em `planos/`
- changelog
- mensagens descritivas de alteração
- documentação complementar
- mensagens de commit, quando autorizadas

## Checklist Operacional por Tarefa

Antes de iniciar:

1. Ler este `AGENTS.md`
2. Ler o `.config`
3. Ler o `AGENTS.md` dos projetos envolvidos
4. Criar o plano da tarefa em `planos/`

Durante a execução:

1. Seguir Clean Architecture, Clean Code e as melhores práticas da stack
2. Consultar a documentação atual das bibliotecas utilizadas
3. Atualizar o plano da tarefa se houver mudança relevante

Antes de concluir:

1. Atualizar `CHANGELOG.md`
2. Validar se toda a documentação está em pt-BR
3. Solicitar confirmação do usuário antes de criar commit

