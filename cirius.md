# Cirius — AI App & Site Builder

> Documentação técnica completa do sistema Cirius, incluindo fluxos, edge functions, hooks, CRUDs, integrações e status de cada componente.

---

## 📋 Visão Geral

O **Cirius** é um construtor de apps/sites automatizado por IA. O usuário descreve o que quer, e o sistema:
1. Gera um **PRD** (Product Requirements Document) com tarefas
2. Executa cada tarefa via **motores de IA** (Brainchain, OpenRouter, AI Gateway, Brain pessoal)
3. **Deploya** o resultado em GitHub, Vercel, Netlify e/ou Supabase externo

**Tudo é real.** Nenhum endpoint é simulado. Cada deploy faz chamadas reais às APIs dos provedores.

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                       │
│                                                             │
│  CiriusDashboard → CiriusNew → CiriusProject → CiriusEditor│
│  CiriusIntegrations                                         │
└──────┬──────────────┬──────────────┬──────────────┬─────────┘
       │              │              │              │
       ▼              ▼              ▼              ▼
┌─────────────┐ ┌───────────┐ ┌──────────┐ ┌──────────────────┐
│ cirius-     │ │ cirius-   │ │ cirius-  │ │ cirius-oauth-    │
│ generate    │ │ status    │ │ deploy   │ │ callback         │
│ (873 lines) │ │ (82 lines)│ │(277 lin) │ │ (197 lines)      │
└──────┬──────┘ └───────────┘ └────┬─────┘ └──────────────────┘
       │                           │
       ▼                           ▼
┌──────────────────┐    ┌──────────────────────────┐
│ Motores de IA    │    │ APIs Externas            │
│ • Brainchain     │    │ • GitHub API             │
│ • OpenRouter     │    │ • Vercel API             │
│ • AI Gateway     │    │ • Netlify API            │
│ • Brain pessoal  │    │ • Supabase Externo       │
└──────────────────┘    └──────────────────────────┘
```

---

## 📁 Estrutura de Arquivos

### Frontend (Páginas)
| Arquivo | Rota | Função |
|---------|------|--------|
| `src/pages/CiriusDashboard.tsx` | `/cirius` | Lista todos os projetos do usuário |
| `src/pages/CiriusNew.tsx` | `/cirius/new` | Wizard 3 etapas para criar novo projeto |
| `src/pages/CiriusProject.tsx` | `/cirius/project/:id` | Detalhes do projeto, tarefas, logs, deploy |
| `src/pages/CiriusEditor.tsx` | `/cirius/editor/:id` | Editor IDE com preview ao vivo |
| `src/pages/CiriusIntegrations.tsx` | `/cirius/integrations` | Conexão OAuth com GitHub/Vercel/Netlify + Supabase manual |

### Frontend (Componentes do Editor)
| Arquivo | Função |
|---------|--------|
| `src/components/cirius-editor/SplitModeEditor.tsx` | Layout split (Chat + Preview) |
| `src/components/cirius-editor/IslandLeft.tsx` | Barra superior esquerda (nome, domínio, SEO) |
| `src/components/cirius-editor/IslandCenter.tsx` | Seletor desktop/tablet/mobile |
| `src/components/cirius-editor/IslandRight.tsx` | Ações (histórico, build, arquivos, deploy) |
| `src/components/cirius-editor/BottomIsland.tsx` | Input de prompt + modos |
| `src/components/cirius-editor/PreviewArea.tsx` | Iframe de preview (live URL ou srcDoc) |
| `src/components/cirius-editor/TaskBubbles.tsx` | Bolhas flutuantes de tarefas em execução |
| `src/components/cirius-editor/CmdPanel.tsx` | Painel CMD (⌘K) com código e chat |
| `src/components/cirius-editor/DrawerDeploy.tsx` | Drawer de deploy (GitHub/Vercel/Netlify/Supabase) |
| `src/components/cirius-editor/DrawerFiles.tsx` | Visualizador de arquivos gerados |
| `src/components/cirius-editor/DrawerSEO.tsx` | Análise SEO |
| `src/components/cirius-editor/DrawerBuild.tsx` | Logs de build em tempo real |
| `src/components/cirius-editor/DrawerChain.tsx` | Visualização da cadeia de tarefas do PRD |

### Edge Functions (Backend)
| Função | Arquivo | Descrição |
|--------|---------|-----------|
| `cirius-generate` | `supabase/functions/cirius-generate/index.ts` | **Core** — Orquestra todo o pipeline (init, PRD, código, captura, estado) |
| `cirius-status` | `supabase/functions/cirius-status/index.ts` | Polling leve — lista projetos ou retorna estado de um projeto |
| `cirius-deploy` | `supabase/functions/cirius-deploy/index.ts` | Deploy real para GitHub, Vercel, Netlify, Supabase |
| `cirius-oauth-callback` | `supabase/functions/cirius-oauth-callback/index.ts` | Callback OAuth — troca code por token e salva na DB |

---

## 🗄️ Tabelas no Banco de Dados

### `cirius_projects`
Tabela principal — armazena cada projeto criado pelo usuário.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | ID do projeto |
| `user_id` | UUID | Dono do projeto |
| `name` | TEXT | Nome do projeto |
| `description` | TEXT | Descrição fornecida pelo usuário |
| `template_type` | TEXT | `landing`, `app`, `dashboard`, `ecommerce`, `custom` |
| `features` | JSON | Array de features selecionadas |
| `source_url` | TEXT | URL de referência (inspiração) |
| `status` | TEXT | `draft`, `generating_prd`, `generating_code`, `deploying`, `live`, `failed`, `paused` |
| `prd_json` | JSON | PRD gerado (tasks + design) |
| `source_files_json` | JSON | Código fonte capturado (path → conteúdo) |
| `files_fingerprint` | TEXT | Hash dos arquivos para detectar mudanças |
| `progress_pct` | INT | Progresso 0-100 |
| `current_step` | TEXT | Etapa atual |
| `generation_engine` | TEXT | Motor usado (brainchain, openrouter, brain, gateway) |
| `error_message` | TEXT | Mensagem de erro se falhou |
| `lovable_project_id` | UUID | ID do projeto Lovable vinculado (para preview live) |
| `brain_project_id` | UUID | ID do Brain pessoal vinculado |
| `orchestrator_project_id` | UUID FK | Referência ao orchestrator_projects |
| `github_repo` | TEXT | `owner/repo` no GitHub |
| `github_url` | TEXT | URL do repositório |
| `vercel_project_id` | TEXT | ID do projeto Vercel |
| `vercel_url` | TEXT | URL de deploy Vercel |
| `netlify_site_id` | TEXT | ID do site Netlify |
| `netlify_url` | TEXT | URL de deploy Netlify |
| `supabase_project_id` | TEXT | Ref do projeto Supabase externo |
| `supabase_url` | TEXT | URL do projeto Supabase |
| `preview_url` | TEXT | URL de preview (fallback) |
| `deployed_at` | TIMESTAMPTZ | Data do último deploy |
| `generation_started_at` | TIMESTAMPTZ | Início da geração |
| `generation_ended_at` | TIMESTAMPTZ | Fim da geração |

### `cirius_generation_log`
Log detalhado de cada etapa do pipeline, usado para debugging e UI de progresso.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | - |
| `project_id` | UUID FK | Referência ao cirius_projects |
| `step` | TEXT | Ex: `init`, `prd`, `prd_brain_send`, `code_task_0`, `deploy_github` |
| `status` | TEXT | `started`, `completed`, `failed`, `retrying`, `info` |
| `level` | TEXT | `info`, `warning`, `error` |
| `message` | TEXT | Descrição legível |
| `duration_ms` | INT | Tempo de execução |
| `error_msg` | TEXT | Mensagem de erro detalhada |
| `input_json` | JSON | Dados de entrada |
| `output_json` | JSON | Dados de saída |
| `metadata` | JSON | Metadados extras (engine, task_count, etc) |
| `retry_count` | INT | Contagem de retentativas |

### `cirius_integrations`
Tokens OAuth e credenciais de integração por usuário/provider.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | - |
| `user_id` | UUID | Dono |
| `provider` | TEXT | `github`, `vercel`, `netlify`, `supabase` |
| `access_token_enc` | TEXT | Token de acesso (server-side only) |
| `refresh_token_enc` | TEXT | Refresh token |
| `service_key_enc` | TEXT | Service key (Supabase) |
| `project_ref` | TEXT | Ref do projeto Supabase |
| `account_login` | TEXT | Username/email da conta conectada |
| `account_id` | TEXT | ID da conta no provider |
| `is_active` | BOOL | Se a integração está ativa |
| `token_expires_at` | TIMESTAMPTZ | Expiração do token |
| `scopes` | TEXT[] | Escopos OAuth |

### `cirius_templates`
Templates pré-definidos para criar projetos rapidamente.

---

## 🔄 Fluxos Detalhados

### Fluxo 1: Criar Projeto (`CiriusNew → cirius-generate`)

```
1. Usuário preenche wizard (3 etapas):
   - Tipo (landing/app/dashboard/ecommerce/custom)
   - Detalhes (nome, descrição, URL referência)
   - Features (auth, CRUD, dashboard, etc)

2. Frontend chama: cirius-generate { action: "init", config: {...} }
   → Cria registro em cirius_projects (status: draft)
   → Loga em cirius_generation_log

3. Frontend chama: cirius-generate { action: "generate_prd", project_id }
   → Tenta gerar PRD sequencialmente:
     a) Brain pessoal (envia prompt + captura resposta via mining)
     b) AI Gateway (Gemini 2.5 Flash)
     c) OpenRouter (Claude Sonnet 4)
   → Cada tentativa é logada com duração e resultado
   → PRD retornado: { tasks: [...], design: { primary_color, font, style, pages, tables } }
   → Salvo em cirius_projects.prd_json

4. Frontend chama: cirius-generate { action: "generate_code", project_id }
   → Cria orchestrator_project + orchestrator_tasks
   → Vincula cirius_projects.orchestrator_project_id
   → Retorna { started: true, engine: "orchestrator" }
   → orchestrator-tick executa as tarefas via Brainchain
```

### Fluxo 2: Geração de Código via Orquestrador

```
1. cirius-generate (action: generate_code) registra tarefas no orchestrator_projects/tasks
2. orchestrator-tick (CRON ou manual) pega tarefas pendentes e executa sequencialmente:
   a) Brainchain pool (conta disponível → envia prompt)
   b) OpenRouter Claude (fallback)
   c) Brain pessoal (fallback final)
3. Cada task tem intent "security_fix_v2" (canal gratuito Lovable)
4. Ao completar, orchestrator-tick atualiza status da task
5. cirius-status detecta quando orchestrator está "completed" e reconcilia para "live"
```

### Fluxo 3: Deploy Real (`cirius-deploy`)

#### GitHub Deploy
```
1. Busca integração do usuário (cirius_integrations WHERE provider="github")
2. Cria repositório via GitHub API (POST /user/repos)
3. Para cada arquivo em source_files_json:
   - PUT /repos/:owner/:repo/contents/:path (com base64 do conteúdo)
4. Salva github_repo e github_url no projeto
5. Tudo é REAL — cria repos e faz push de arquivos via API
```

#### Vercel Deploy
```
1. Busca integração do usuário (cirius_integrations WHERE provider="vercel")
2. REQUER GitHub conectado primeiro (usa github_repo)
3. POST /v9/projects na Vercel API vinculando ao repo GitHub
4. Salva vercel_project_id e vercel_url
5. REAL — cria projeto Vercel vinculado ao GitHub
```

#### Netlify Deploy
```
1. Busca integração (cirius_integrations WHERE provider="netlify")
2. POST /api/v1/sites na Netlify API
3. Salva netlify_site_id e netlify_url
4. REAL — cria site na Netlify
```

#### Supabase Deploy
```
1. Busca integração (cirius_integrations WHERE provider="supabase")
2. Para cada arquivo .sql em source_files_json/supabase/migrations/:
   - Executa via RPC (exec_sql) no projeto Supabase externo
3. Salva supabase_project_id e supabase_url
4. REAL — executa migrations SQL no Supabase do usuário
```

### Fluxo 4: OAuth (`cirius-generate → cirius-oauth-callback`)

```
1. Frontend chama: cirius-generate { action: "oauth_state", provider: "github" }
2. Backend gera state HMAC-signed: { user_id, ts, sig }
3. Busca Client ID do api_key_vault (Admin > Integrações) ou env vars
4. Retorna auth_url com redirect para cirius-oauth-callback
5. Usuário autoriza no GitHub/Vercel/Netlify
6. cirius-oauth-callback:
   - Valida state (HMAC + timestamp 10min)
   - Troca code por access_token via API do provider
   - Busca dados da conta (login, ID)
   - Upsert em cirius_integrations
   - Redireciona para /cirius/integrations?connected={provider}
```

### Fluxo 5: Preview no Editor (`CiriusEditor`)

```
1. Preview LIVE (prioridade):
   - Se lovable_project_id ou brain_project_id existe:
     URL = https://id-preview--{projectId}.lovable.app
   - Renderiza no iframe com URL real
   
2. Preview ESTÁTICO (fallback):
   - Se source_files_json contém index.html:
     Renderiza via srcDoc no iframe
   
3. Preview NENHUM:
   - Se projeto não tem lovable_project_id nem source files:
     NÃO tem preview (é o caso se geração ainda não completou)

NOTA IMPORTANTE: O preview live só funciona se o projeto tem um
lovable_project_id vinculado. Projetos gerados via Brainchain/OpenRouter
que não passam pelo Lovable diretamente NÃO terão preview live.
O preview estático (srcDoc) funciona para projetos que já capturaram
o source code mas é limitado (sem SPA routing, sem backend).
```

---

## ⚡ Edge Functions — Referência Completa

### `cirius-generate` (873 linhas)

**Actions disponíveis:**

| Action | Params | O que faz |
|--------|--------|-----------|
| `init` | `config: { name, description, template_type, source_url, features }` | Cria projeto (status: draft) |
| `generate_prd` | `project_id` | Gera PRD via Brain → Gateway → OpenRouter |
| `generate_code` | `project_id` | Registra tarefas no Orquestrador |
| `capture` | `project_id, lovable_project_id?` | Captura source-code de projeto Lovable |
| `status` | `project_id` | Status detalhado + logs + orquestrador |
| `debug_log` | `project_id` | Dump completo do pipeline para debugging |
| `pause` | `project_id` | Pausa geração |
| `resume` | `project_id` | Retoma geração |
| `cancel` | `project_id` | Cancela (marca como failed) |
| `oauth_state` | `provider` | Gera state HMAC-signed para OAuth |
| `save_supabase_integration` | `supabase_url, service_key` | Salva integração Supabase manual |
| `build_prompt` | `project_id, prompt` | Envia prompt individual para execução |

**Motores de IA (ordem de prioridade):**

| Motor | Como funciona | Quando é usado |
|-------|---------------|----------------|
| **Brain pessoal** | Envia prompt para o projeto Lovable do usuário via venus-chat, depois captura resposta via polling de /chat/latest-message e /source-code | PRD (primeiro), Code (terceiro) |
| **Brainchain pool** | Envia para pool de contas compartilhadas via brainchain-send | Code (primeiro) |
| **AI Gateway** | Lovable AI Gateway (Gemini 2.5 Flash) | PRD (segundo) |
| **OpenRouter** | Claude Sonnet 4 via OpenRouter API | PRD (terceiro), Code (segundo) |

### `cirius-status` (82 linhas)

| Action | Params | Retorna |
|--------|--------|---------|
| `list` | — | Array de projetos do usuário |
| `get` | `project_id` | Projeto + logs + deploy URLs + auto-reconciliação |

**Auto-reconciliação:** Se o orquestrador está "completed" mas o Cirius ainda está "generating_code", o endpoint atualiza automaticamente para "live" (status 100%).

### `cirius-deploy` (277 linhas)

| Action | Params | O que faz |
|--------|--------|-----------|
| `github` | `project_id` | Cria repo + push de todos os arquivos |
| `vercel` | `project_id` | Cria projeto Vercel vinculado ao GitHub repo |
| `netlify` | `project_id` | Cria site na Netlify |
| `supabase` | `project_id` | Aplica migrations SQL no projeto Supabase externo |

**Todas as ações são REAIS — fazem chamadas diretas às APIs dos provedores.**

### `cirius-oauth-callback` (197 linhas)

Processa callbacks OAuth para GitHub, Vercel e Netlify:
- Valida state HMAC-signed com expiração de 10 minutos
- Troca authorization code por access token
- Busca dados da conta (login, email, ID)
- Salva credenciais encriptadas em cirius_integrations
- Redireciona de volta para a aplicação

---

## 🔐 Segurança

### Tokens e Credenciais
- **Tokens OAuth** são armazenados server-side em `cirius_integrations` (nunca expostos ao frontend)
- **Service keys** do Supabase são armazenados server-side (campo `service_key_enc`)
- **OAuth state** usa HMAC-SHA256 com timestamp de 10 minutos para prevenir CSRF
- **OAuth Client IDs/Secrets** são buscados do `api_key_vault` (Admin > Integrações) com fallback para env vars

### RLS
- `cirius_projects` — RLS por `user_id`
- `cirius_integrations` — RLS por `user_id` (frontend só seleciona campos não-sensíveis)
- `cirius_generation_log` — Acessível via service_role nas edge functions

### Frontend Security
- `CiriusIntegrations.tsx` seleciona apenas `provider, account_login, is_active, updated_at` (sem tokens)
- Service key do Supabase é enviada ao edge function para armazenamento, nunca ficando no localStorage

---

## 🔗 Dependências Entre Sistemas

### Para PRD funcionar:
1. **Brain pessoal**: Usuário precisa ter `user_brain_projects` + `lovable_accounts` com token ativo
2. **AI Gateway**: `LOVABLE_API_KEY` configurada ✅
3. **OpenRouter**: `OPENROUTER_API_KEY` configurada ✅

### Para Code Generation funcionar:
1. **Brainchain**: Contas ativas em `brainchain_accounts` com tokens válidos
2. **Orquestrador**: Tabelas `orchestrator_projects` e `orchestrator_tasks`
3. **orchestrator-tick**: Edge function CRON que processa tarefas pendentes

### Para Deploy funcionar:
1. **GitHub**: Usuário conectado via OAuth (Client ID/Secret em api_key_vault ou env)
2. **Vercel**: Usuário conectado via OAuth + GitHub repo já criado
3. **Netlify**: Usuário conectado via OAuth
4. **Supabase**: Integração manual com URL + service_key

### Para Preview Live funcionar:
1. Projeto precisa ter `lovable_project_id` (ID de um projeto real no Lovable)
2. Esse projeto precisa existir e estar acessível
3. **Se o projeto foi gerado via Brainchain/OpenRouter sem vínculo Lovable, NÃO haverá preview live**
4. Nesse caso, o preview estático (srcDoc do index.html) é o fallback

---

## ❓ FAQ / Status Atual

### "A landing page que criei tem preview?"
**Depende de como foi gerada.** Se o motor usou Brainchain que escreveu código em um projeto Lovable real, terá preview live via `lovable_project_id`. Se usou OpenRouter/Gateway (que retornam código como texto), o código fica em `source_files_json` e o preview é estático (srcDoc) ou inexistente.

### "O deploy é real?"
**SIM.** Todas as ações de deploy fazem chamadas reais às APIs:
- GitHub: Cria repos e faz push via GitHub REST API
- Vercel: Cria projetos via Vercel API
- Netlify: Cria sites via Netlify API
- Supabase: Executa SQL via RPC no projeto externo

### "Onde ficam as chaves do GitHub/Vercel para OAuth?"
1. **api_key_vault** (Admin > Integrações) — tabela centralizada
2. **Env vars** como fallback: `CIRIUS_GITHUB_CLIENT_ID`, `CIRIUS_GITHUB_CLIENT_SECRET`
3. Para Vercel/Netlify: precisa configurar Client ID e Client Secret no api_key_vault (providers: `vercel`, `netlify`)

### "Onde vejo os logs de geração?"
- **CiriusProject** (`/cirius/project/:id`): Mostra tarefas e status em tempo real
- **DrawerBuild** (no Editor): Mostra logs de build
- **debug_log** action: Dump completo do pipeline (cirius_generate + orchestrator + brainchain)
- **cirius_generation_log** table: Todos os logs históricos

### "O que é o Orquestrador?"
É o sistema que executa as tarefas do PRD sequencialmente. Cada tarefa é registrada em `orchestrator_tasks` e processada pelo `orchestrator-tick` (CRON). O orquestrador tenta cada motor (Brainchain → OpenRouter → Brain) e registra resultados em `orchestrator_logs`.

---

## 📊 Diagrama de Status do Projeto

```
draft → generating_prd → draft (com PRD) → generating_code → live
  │          │                                    │
  │          ▼                                    ▼
  │        failed                              paused → generating_code (resume)
  │                                               │
  │                                               ▼
  └───────────────────────────────────────────  failed (cancel)
```

---

## 🛠️ Configuração Necessária

### Segredos Obrigatórios (já configurados)
- `OPENROUTER_API_KEY` — Para OpenRouter (Claude) ✅
- `LOVABLE_API_KEY` — Para AI Gateway ✅
- `CIRIUS_GITHUB_CLIENT_ID` — Client ID do GitHub OAuth App ✅
- `CIRIUS_GITHUB_CLIENT_SECRET` — Client Secret do GitHub OAuth App ✅

### Segredos Opcionais (para Vercel/Netlify OAuth)
- Configurar no `api_key_vault` (Admin > Integrações > Vercel/Supabase Ext.):
  - **Vercel**: Provider `vercel`, campo `api_key_encrypted` = Client ID, `extra_config.client_secret` = Client Secret
  - **Netlify**: Provider `netlify`, mesma estrutura

### Tabelas Necessárias
- `cirius_projects` ✅
- `cirius_generation_log` ✅
- `cirius_integrations` ✅
- `cirius_templates` ✅
- `orchestrator_projects` ✅
- `orchestrator_tasks` ✅
- `orchestrator_logs` ✅
- `brainchain_accounts` ✅
- `brainchain_queue` ✅
- `api_key_vault` ✅
- `lovable_accounts` ✅
- `user_brain_projects` ✅
