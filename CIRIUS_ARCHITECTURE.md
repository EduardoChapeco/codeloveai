# CIRIUS — Arquitetura Completa do Sistema de Geração de Projetos

> **Nome do sistema:** Cirius  
> **Objetivo:** Gerador de sites, landing pages e aplicações web usando Brain/Brainchain como fornecedor de inteligência, com deploy automatizado para Supabase/Vercel/GitHub.  
> **Data:** 2026-03-02  

---

## 1. VISÃO GERAL — O QUE JÁ TEMOS HOJE

O ecossistema Starble possui uma infraestrutura completa de IA e automação composta por **4 camadas principais**:

```
┌──────────────────────────────────────────────────────────────────┐
│                       CIRIUS (Camada Nova)                       │
│   Gerador de Projetos — Orquestra tudo abaixo para criar apps   │
├──────────────────────────────────────────────────────────────────┤
│                    CAMADA 1: BRAIN (Pessoal)                     │
│   IA especializada por usuário — cada um tem seu Brain project   │
├──────────────────────────────────────────────────────────────────┤
│                  CAMADA 2: BRAINCHAIN (Pool)                     │
│   Pool compartilhado de contas mestres Lovable                   │
├──────────────────────────────────────────────────────────────────┤
│               CAMADA 3: ORQUESTRADOR AGÊNTICO                   │
│   Execução sequencial de tarefas com PRD + cron                  │
├──────────────────────────────────────────────────────────────────┤
│            CAMADA 4: INFRAESTRUTURA DE SUPORTE                   │
│   Venus-Chat, API Key Router, StarCrawl, Gemini-Chat            │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. CAMADA 1: BRAIN — IA Especializada Pessoal

### 2.1 O que é

O Brain é um **projeto Lovable dedicado** criado automaticamente para cada usuário. Funciona como um "cérebro" especializado que recebe prompts, processa via Lovable AI e retorna respostas técnicas.

### 2.2 Edge Functions

| Função | Arquivo | Descrição |
|--------|---------|-----------|
| `brain` | `supabase/functions/brain/index.ts` + `helpers.ts` | **Core do Brain.** Gerencia criação, envio de mensagens, captura de respostas e bootstrap. |
| `brain-capture-cron` | `supabase/functions/brain-capture-cron/index.ts` | **Cron de bootstrap.** Executa as 13 fases de configuração do Brain project sequencialmente. |
| `get-brain-output` | `supabase/functions/get-brain-output/index.ts` | **API de leitura.** Retorna outputs do Brain (respostas processadas). |

### 2.3 Tabelas do Brain

| Tabela | Uso |
|--------|-----|
| `user_brain_projects` | Registro de Brains por usuário (project_id, workspace_id, status, skills, phase) |
| `loveai_conversations` | Histórico de conversas (user_message, ai_response, status, target_project_id) |
| `brain_outputs` | Respostas processadas e limpas (skill, request, response, brain_project_id) |
| `lovable_accounts` | Tokens de autenticação Lovable por usuário (token_encrypted, refresh_token) |

### 2.4 Actions do Brain (`/functions/v1/brain`)

```
POST { action: "status" }        → Verifica se Brain está ativo
POST { action: "setup", skills: ["code", "design"] }  → Cria novo Brain
POST { action: "send", message: "...", brain_type: "code" }  → Envia prompt
POST { action: "capture", conversation_id: "..." }  → Captura resposta pendente
POST { action: "history", limit: 50 }  → Lista conversas
POST { action: "list" }          → Lista todos os Brains do usuário
POST { action: "reset" }         → Reseta todos os Brains
POST { action: "delete", brain_id: "..." }  → Deleta Brain específico
POST { action: "bootstrap" }     → Inicia bootstrap manual
POST { action: "review_code", project_id: "..." }  → Code review via Brain
```

### 2.5 Skills Disponíveis

| Skill | Persona |
|-------|---------|
| `general` | Assistente Geral Sênior (PhD CS MIT, MBA Harvard) |
| `design` | Arquiteto de Design & UX (PhD HCI MIT Media Lab) |
| `code` | Engenheiro de Software Principal (PhD Stanford) |
| `scraper` | Especialista em Extração de Dados (PhD CMU) |
| `migration` | Arquiteto de Dados & Migrações (PhD UC Berkeley) |
| `data` | Cientista de Dados Sênior (PhD ML Stanford) |
| `devops` | Engenheiro DevOps/SRE Principal (PhD MIT) |
| `security` | Engenheiro de Segurança (PhD Cybersecurity MIT) |
| `code_review` | Code Reviewer & Auditor Principal |

### 2.6 Fluxo de Envio/Captura

```
1. Usuário envia mensagem → brain (action: send)
2. Brain monta prompt com persona + protocolo obrigatório
3. Prompt é enviado via venus-chat para o Lovable project do Brain
4. Quick capture: polling de 25s em /chat/latest-message + /source-code (update.md)
5. Se capturado inline → retorna resposta imediata
6. Se não → retorna conversation_id para polling posterior via capture
7. Resposta é limpa (remove boilerplate, bootstrap markers) e salva em brain_outputs
```

### 2.7 Bootstrap (13 Fases)

O Brain project passa por 13 fases de configuração automática via `brain-capture-cron`:

| Fase | O que cria |
|------|------------|
| 1 | `.lovable/plan.md` + `src/INSTRUCTIONS.md` + `src/config.json` |
| 2 | Verificação de arquivos core |
| 3 | `src/response-templates.md` |
| 4 | `src/capabilities.json` |
| 5 | `src/security-guardrails.md` |
| 6 | `src/error-handlers.md` |
| 7 | `src/output-formats.ts` |
| 8 | Rule Zero (proteção contra auto-destruição) |
| 9 | `src/skills-injection.md` |
| 10 | Protocolo de Memória Ativa no INSTRUCTIONS.md |
| 11 | Interface visual terminal/CMD |
| 12 | Melhorias de UI (loading, copy, markdown) |
| 13 | Finalização e auto-teste |

### 2.8 Protocolo de Resposta

O Brain opera em **canal duplo**:
- **Arquivo `src/update.md`**: Resposta completa com frontmatter (status, timestamp, task)
- **Chat Lovable**: Resumo breve da ação

A captura prioriza `latest-message` como fonte primária e `update.md` como secundária.

---

## 3. CAMADA 2: BRAINCHAIN — Pool Compartilhado de Contas Mestres

### 3.1 O que é

O Brainchain é um **pool de contas Lovable** que permite compartilhar recursos de IA entre múltiplos usuários sem que cada um precise de sua própria conta. É o "motor de força bruta" — muitas contas, round-robin, com renovação automática de tokens.

### 3.2 Edge Functions

| Função | Arquivo | Descrição |
|--------|---------|-----------|
| `brainchain-send` | `supabase/functions/brainchain-send/index.ts` | **Envio de mensagens.** Seleciona conta do pool, marca como busy, envia via Lovable API, faz polling por resposta. |
| `brainchain-admin` | `supabase/functions/brainchain-admin/index.ts` | **Administração.** CRUD de contas, import em batch, toggle ativo/inativo, pool status, auto-registro via extensão. |
| `brainchain-token-manager` | `supabase/functions/brainchain-token-manager/index.ts` | **Renovação de tokens.** Cron job que renova access_tokens via Firebase Identity Toolkit para contas próximas da expiração. |
| `brainchain-status` | `supabase/functions/brainchain-status/index.ts` | **Status de fila.** Consulta status de mensagem enfileirada (pending/processing/done/error/timeout). |

### 3.3 Tabelas do Brainchain

| Tabela | Uso |
|--------|-----|
| `brainchain_accounts` | Pool de contas (email, access_token, refresh_token, brain_type, is_busy, error_count, brain_project_id) |
| `brainchain_queue` | Fila de mensagens (message, status, account_id, response, error_msg) |
| `brainchain_usage` | Log de uso (user_id, brain_type, account_id, duration_ms, success) |

### 3.4 Fluxo do Brainchain-Send

```
1. Recebe mensagem + brain_type + user_id
2. selectAccount(): busca conta livre, ativa, com menos erros, por tipo (fallback: general)
   - Contas presas há >3min são liberadas automaticamente
3. Marca conta como is_busy = true
4. Cria registro na fila (brainchain_queue)
5. ensureValidToken(): verifica/renova access_token via Firebase
6. Monta payload Lovable API (com intent/headers padrão)
7. Envia POST /projects/{id}/chat
8. Polling de resposta (15 tentativas × 3s = 45s máx)
   - Busca em /projects/{id}/latest-message
   - Verifica se resposta é nova (id ≠ msgId) e tem >20 chars
9. Libera conta (is_busy = false)
10. Retorna resposta ou status "pending" para polling via brainchain-status
```

### 3.5 Actions do Brainchain-Admin

```
POST { action: "list_accounts" }       → Lista todas as contas do pool (requer admin)
POST { action: "upsert_account", ... } → Cria/atualiza conta (requer admin)
POST { action: "import_accounts", accounts: [...] } → Import em batch (requer admin)
POST { action: "toggle_account", id, is_active } → Ativa/desativa (requer admin)
POST { action: "delete_account", id }  → Remove conta (requer admin)
POST { action: "force_release", id }   → Libera conta presa (requer admin)
POST { action: "pool_status" }         → Status do pool por tipo (requer admin)
POST { action: "register_from_extension", ... } → Auto-registro via extensão Chrome
```

### 3.6 Auto-Registro via Extensão

A extensão "Starble Token Harvester" captura sessões Lovable automaticamente e registra no pool:
- Header `x-extension-secret` com `BRAINCHAIN_EXTENSION_SECRET`
- Faz upsert por email/refresh_token
- Atualiza tokens, reseta error_count, marca como ativo

### 3.7 Renovação de Tokens (Cron)

O `brainchain-token-manager` roda periodicamente:
- Busca contas com `access_expires_at < agora + 10min` ou null
- Renova via `https://securetoken.googleapis.com/v1/token` (Firebase Identity Toolkit)
- Atualiza access_token, refresh_token, expires_at
- Incrementa error_count em caso de falha

### 3.8 Diferença entre Brain e Brainchain

| Aspecto | Brain | Brainchain |
|---------|-------|------------|
| **Escopo** | Um Brain por usuário | Pool compartilhado |
| **Autenticação** | Token do próprio usuário | Tokens de contas mestres |
| **Projeto Lovable** | Projeto dedicado com bootstrap completo | Projetos pré-configurados no pool |
| **Skills** | Configurável por Brain (design, code, etc.) | Configurável por conta (brain_type) |
| **Uso ideal** | Tarefas longas, especializadas, com contexto | Tarefas rápidas, paralelizáveis, sem contexto prévio |
| **Custo** | Token do usuário | Tokens do pool (custo da plataforma) |

---

## 4. CAMADA 3: ORQUESTRADOR AGÊNTICO

### 4.1 O que é

O Agentic Orchestrator é um sistema de **execução sequencial de tarefas** que decompõe um objetivo complexo (PRD) em tarefas atômicas e as executa uma a uma via Lovable API.

### 4.2 Edge Functions

| Função | Arquivo | Descrição |
|--------|---------|-----------|
| `agentic-orchestrator` | `supabase/functions/agentic-orchestrator/index.ts` | **Engine principal.** Cria projetos, gera PRD, executa tarefas. |
| `orchestrator-tick` | `supabase/functions/orchestrator-tick/index.ts` | **Cron de progresso.** Detecta conclusão de tarefas e despacha a próxima. |
| `orchestrator-prd` | `supabase/functions/orchestrator-prd/index.ts` | **Geração de PRD.** Endpoint auxiliar para geração de PRD via IA. |

### 4.3 Tabelas do Orquestrador

| Tabela | Uso |
|--------|-----|
| `orchestrator_projects` | Projetos do orquestrador (client_prompt, status, lovable_project_id, prd_json, source_fingerprint) |
| `orchestrator_tasks` | Tarefas individuais (title, prompt, intent, status, task_index, stop_condition) |
| `orchestrator_logs` | Logs detalhados por projeto/tarefa |

### 4.4 Fluxo Completo

```
1. Usuário envia client_prompt (ex: "Criar landing page de fintech")
2. action: start
   a. Resolve token Lovable do usuário (lovable_accounts)
   b. Gera PRD via Lovable AI Gateway (Gemini 2.5 Flash) ou OpenRouter
   c. PRD retorna 3-7 tarefas com title, intent, prompt, stop_condition
   d. Cria orchestrator_project (status: paused)
   e. Insere orchestrator_tasks (status: pending)

3. action: execute_next (chamado manual ou via tick)
   a. Ghost-create: cria projeto Lovable vazio + cancela mensagem inicial
   b. Captura source_fingerprint (antes da execução)
   c. Envia prompt via venus-chat (fire-and-forget)
   d. Marca task como "running", project como "executing"

4. orchestrator-tick (cron)
   FASE 1 — Projetos "executing":
   a. Detecta conclusão por fingerprint (source-code mudou) ou streaming (não está mais em stream)
   b. Timeout: 5min → force complete
   c. Marca task como "completed", project volta para "paused"
   
   FASE 2 — Projetos "paused":
   a. Verifica se há tasks pendentes
   b. Se sim: chama execute_next
   c. Se não: marca project como "completed"
   d. Inter-task delay: 40s (breathing room)
```

### 4.5 PRD Generation

O PRD é gerado via IA com o seguinte esquema:

```json
{
  "tasks": [
    {
      "title": "Criar layout base",
      "intent": "security_fix_v2",
      "prompt": "Crie a estrutura base com React + Tailwind...",
      "stop_condition": "file_exists:src/App.tsx"
    }
  ]
}
```

Failover: Lovable AI Gateway → OpenRouter (Gemini 2.5 Flash)

---

## 5. CAMADA 4: INFRAESTRUTURA DE SUPORTE

### 5.1 Venus-Chat — Hub Central de Mensageria

**Arquivo:** `supabase/functions/venus-chat/index.ts`

É o **proxy universal** para enviar mensagens ao Lovable API. Suporta múltiplos modos:

| Modo | Intent | Uso |
|------|--------|-----|
| `task_error` | security_fix_v2 | Correção de erros de runtime |
| `task` | security_fix_v2 | Execução de tarefas genéricas |
| `chat` | security_fix_v2 | Chat geral |
| `security` | security_fix_v2 | Correções de segurança |
| `build_error` | security_fix_v2 | Correção de erros de build |
| `amplify` | — | Captura de histórico detalhado do agente (Activity view) |
| `upload` | — | Upload de arquivos via GCS presigned URLs |

**Resolução de token (prioridade):**
1. Token explícito no body (`lovable_token`)
2. Interno do orquestrador (`x-orchestrator-internal` + `_internal_user_id`)
3. JWT do usuário → `lovable_accounts`
4. Licença CLF1 → `licenses` → `lovable_accounts`

**Todos os modos usam `intent: security_fix_v2` = custo zero de créditos Lovable.**

### 5.2 Speed-Chat — Proxy Simplificado

**Arquivo:** `supabase/functions/speed-chat/index.ts`

Clone simplificado do venus-chat usado pela extensão Speed. Mesma lógica de resolução de token (JWT → CLF1 → lovable_accounts), sem modos.

### 5.3 API Key Router — Orquestrador de Chaves

**Arquivo:** `supabase/functions/api-key-router/index.ts`

Gerencia chaves de API externas com **balanceamento round-robin**:

```
Tabela: api_key_vault
Campos: provider, label, api_key_encrypted, is_active, requests_count, last_used_at

Actions:
  get      → Seleciona chave com menor requests_count (round-robin)
  list_all → Lista todas (admin only)
  add      → Adiciona nova chave (admin only)
  toggle   → Ativa/desativa (admin only)
  delete   → Remove chave (admin only)
```

**Provedores suportados:** gemini, openrouter, firecrawl, github, openai, anthropic, resend, custom

### 5.4 StarCrawl — Scraper Inteligente

**Arquivo:** `supabase/functions/starcrawl/index.ts`

Integração com Firecrawl para extração de dados web:

```
Actions:
  scrape          → Scrape de URL única (markdown + HTML + screenshot)
  crawl           → Crawl de site (até N páginas)
  search          → Busca web via Firecrawl
  generate_prompt → Scrape + gera prompt Lovable-ready para reproduzir o site
```

**Uso no Cirius:** `generate_prompt` gera um prompt pronto para criar uma réplica melhorada de qualquer site.

### 5.5 Gemini-Chat — IA Conversacional

**Arquivo:** `supabase/functions/gemini-chat/index.ts`

Chat genérico com failover:
1. Lovable AI Gateway (Gemini 3 Flash)
2. OpenRouter (Gemini 2.5 Flash)
3. api_key_vault (round-robin)

### 5.6 Support-Brain-Chat — Suporte Inteligente

**Arquivo:** `supabase/functions/support-brain-chat/index.ts`

Assistente com Knowledge Base injetada no system prompt. Failover Lovable Gateway → OpenRouter.

---

## 6. SECRETS E CONFIGURAÇÃO

### 6.1 Secrets Existentes

| Secret | Uso |
|--------|-----|
| `LOVABLE_API_KEY` | Lovable AI Gateway (Gemini/GPT) |
| `FIREBASE_API_KEY` | Renovação de tokens via Google SecureToken |
| `OPENROUTER_API_KEY` | Fallback para IA (Gemini via OpenRouter) |
| `BRAINCHAIN_ADMIN_KEY` | Administração do pool Brainchain |
| `BRAINCHAIN_EXTENSION_SECRET` | Auto-registro de contas via extensão |
| `CLF_TOKEN_SECRET` | Assinatura HMAC de tokens CLF1 |
| `CODELOVE_ADMIN_SECRET` | Autenticação interna do orquestrador |
| `RESEND_API_KEY` | Envio de e-mails |
| `MERCADO_PAGO_ACCESS_TOKEN` | Pagamentos |
| `CODELOVE_WEBHOOK_SECRET` | Webhooks |
| `EVOLUTION_API_KEY/URL` | WhatsApp via Evolution API |

### 6.2 Config.toml

Todas as edge functions estão com `verify_jwt = false` — a autenticação é feita em código (JWT do Supabase, admin keys, CLF1 tokens).

---

## 7. CIRIUS — COMO FUNCIONARIA O GERADOR DE PROJETOS

### 7.1 Conceito

O Cirius é um **meta-gerador**: ele não gera código diretamente — ele **orquestra** Brain e Brainchain para gerar código, depois faz deploy automatizado.

```
┌─────────────────────────────────────────────────────────────┐
│                    CIRIUS PIPELINE                           │
│                                                             │
│  [Input]  ──→  [PRD]  ──→  [Geração]  ──→  [Deploy]        │
│                                                             │
│  URL/Prompt   Orquestrador   Brain ou      GitHub/Vercel/   │
│  + Config     + Gemini       Brainchain    Supabase         │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Fluxo Detalhado do Cirius

```
ETAPA 1 — INPUT
├── Opção A: URL de referência → StarCrawl (scrape/generate_prompt) → prompt base
├── Opção B: Descrição textual → prompt direto
├── Opção C: Template do catálogo → prompt pré-definido
└── Config: nome do projeto, stack, domínio, features

ETAPA 2 — PRD (Product Requirements Document)
├── Gemini-Chat ou Lovable AI Gateway gera PRD estruturado
├── 3-7 tarefas sequenciais com prompts detalhados
├── Cada tarefa tem intent, stop_condition, brain_skill
└── PRD é persistido em orchestrator_projects.prd_json

ETAPA 3 — GERAÇÃO (escolha automática de motor)
│
├── MOTOR A: Brain Pessoal (projetos complexos, contexto necessário)
│   ├── Usa o Brain do usuário (user_brain_projects)
│   ├── Brain já tem bootstrap completo com skills injection
│   ├── Envia tarefas sequenciais via brain (action: send)
│   ├── Captura via brain (action: capture) ou brain-capture-cron
│   └── Ideal para: apps completos, SPAs, dashboards
│
├── MOTOR B: Brainchain Pool (tarefas rápidas, paralelizáveis)
│   ├── Seleciona conta do pool (brainchain-send)
│   ├── Não precisa de bootstrap (já tem brain_project_id)
│   ├── Envia direto via Lovable API
│   ├── Polling ou status via brainchain-status
│   └── Ideal para: landing pages, componentes, correções
│
├── MOTOR C: Orquestrador Agêntico (projetos multi-fase)
│   ├── Ghost-create do projeto Lovable
│   ├── Executa tarefas sequenciais via venus-chat
│   ├── orchestrator-tick monitora conclusão
│   ├── Inter-task delay de 40s
│   └── Ideal para: projetos completos com múltiplas features
│
└── MOTOR D: IA Direta (subtarefas de suporte)
    ├── Lovable AI Gateway para análise, planejamento
    ├── OpenRouter como fallback
    ├── Api-key-router para round-robin de chaves
    └── Ideal para: PRD, análise de código, review

ETAPA 4 — PÓS-GERAÇÃO
├── Captura source-code do projeto Lovable (API /source-code)
├── Extrai todos os arquivos (files_json)
├── Limpa boilerplate/artifacts do Brain
└── Monta estrutura de projeto final

ETAPA 5 — DEPLOY AUTOMATIZADO
│
├── GitHub
│   ├── Cria repo via GitHub API (tokens em venus_github_tokens ou api_key_vault)
│   ├── Push de todos os arquivos via Contents API ou Git Data API
│   ├── Configura branch protection, README
│   └── Edge function: venus-github (já existe)
│
├── Vercel
│   ├── Deploy via Vercel API (token no api_key_vault)
│   ├── Conecta ao repo GitHub criado
│   ├── Configura domínio customizado
│   ├── Build settings (Vite, React)
│   └── Edge function: nova (cirius-deploy-vercel)
│
├── Supabase
│   ├── Cria projeto Supabase via API
│   ├── Roda migrations extraídas do source-code
│   ├── Configura auth, storage, RLS
│   └── Edge function: supabase-migrate-start (já existe)
│
└── Lovable Direct
    ├── Projeto já existe no Lovable
    ├── URL de preview disponível imediatamente
    ├── Publish via publish-project (já existe)
    └── Download via download-project (já existe)
```

### 7.3 Features de Suporte por Camada

| Feature do Cirius | Fornecedor | Edge Function |
|-------------------|------------|---------------|
| Scraping de referência | StarCrawl + Firecrawl | `starcrawl` |
| Geração de PRD | Lovable AI / OpenRouter | `agentic-orchestrator` (inline) |
| Geração de código | Brain / Brainchain | `brain` / `brainchain-send` |
| Execução multi-task | Orquestrador | `agentic-orchestrator` + `orchestrator-tick` |
| Chat de suporte | Gemini-Chat | `gemini-chat` |
| Push para GitHub | Venus GitHub | `venus-github` |
| Upload de assets | Venus Upload | `venus-file-upload` |
| Análise de segurança | Brain (skill: security) | `brain` |
| Code review | Brain (skill: code_review) | `brain` |
| Renovação de tokens | Brainchain Token Manager | `brainchain-token-manager` |
| Gerenciamento de chaves | API Key Router | `api-key-router` |

### 7.4 Arquitetura de Dados do Cirius (Tabelas Novas)

```sql
-- Projetos gerados pelo Cirius
CREATE TABLE cirius_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT,  -- 'landing', 'app', 'dashboard', 'ecommerce', 'custom'
  source_url TEXT,     -- URL de referência (se scrapeada)
  
  -- Status
  status TEXT DEFAULT 'draft',  -- draft, generating, deploying, live, failed
  generation_engine TEXT,  -- 'brain', 'brainchain', 'orchestrator'
  
  -- Referências
  brain_id UUID,  -- se gerado via Brain
  orchestrator_project_id UUID,  -- se gerado via Orquestrador
  brainchain_queue_id UUID,  -- se gerado via Brainchain
  lovable_project_id TEXT,  -- projeto Lovable gerado
  
  -- Deploy
  github_repo TEXT,
  github_url TEXT,
  vercel_project_id TEXT,
  vercel_url TEXT,
  supabase_project_id TEXT,
  custom_domain TEXT,
  
  -- Metadata
  tech_stack JSONB DEFAULT '{"framework":"react","css":"tailwind","ui":"shadcn"}',
  features JSONB DEFAULT '[]',
  prd_json JSONB,
  source_files_json JSONB,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deployed_at TIMESTAMPTZ
);

-- Log de geração
CREATE TABLE cirius_generation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES cirius_projects(id),
  step TEXT,  -- 'scrape', 'prd', 'generate', 'capture', 'deploy_github', 'deploy_vercel'
  status TEXT,  -- 'started', 'completed', 'failed'
  input_summary TEXT,
  output_summary TEXT,
  duration_ms INTEGER,
  error_msg TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Templates pré-definidos
CREATE TABLE cirius_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,  -- 'landing', 'saas', 'portfolio', 'ecommerce', 'blog'
  preview_url TEXT,
  preview_image TEXT,
  prompt_template TEXT NOT NULL,
  tech_stack JSONB,
  features JSONB,
  is_premium BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 7.5 Edge Functions Novas Necessárias

| Função | Responsabilidade |
|--------|-----------------|
| `cirius-generate` | Orquestra todo o pipeline: input → PRD → geração → captura |
| `cirius-deploy` | Deploy para GitHub/Vercel/Supabase |
| `cirius-templates` | CRUD de templates pré-definidos |
| `cirius-status` | Status em tempo real do pipeline |

### 7.6 Seleção Automática de Motor

```typescript
function selectEngine(project: CiriusProject): 'brain' | 'brainchain' | 'orchestrator' {
  // Projetos com múltiplas features → Orquestrador
  if (project.features.length > 3) return 'orchestrator';
  
  // Landing pages simples → Brainchain (rápido, sem contexto)
  if (project.template_type === 'landing') return 'brainchain';
  
  // Apps complexos → Brain pessoal (contexto especializado)
  if (project.template_type === 'app' || project.template_type === 'dashboard') return 'brain';
  
  // Default → Brainchain
  return 'brainchain';
}
```

---

## 8. INTEGRAÇÕES EXTERNAS DISPONÍVEIS

| Serviço | Como usar no Cirius | Chave |
|---------|--------------------|----|
| **Firecrawl** | StarCrawl scraping | `api_key_vault` (provider: firecrawl) |
| **OpenRouter** | IA fallback (Gemini) | `OPENROUTER_API_KEY` ou `api_key_vault` |
| **Lovable AI Gateway** | IA principal (Gemini/GPT) | `LOVABLE_API_KEY` |
| **GitHub** | Push de código | `api_key_vault` (provider: github) + `venus_github_tokens` |
| **Vercel** | Deploy automático | `api_key_vault` (provider: vercel) — novo |
| **Resend** | Notificações por e-mail | `RESEND_API_KEY` |
| **MercadoPago** | Cobrança por geração | `MERCADO_PAGO_ACCESS_TOKEN` |

---

## 9. EXTENSÕES CHROME EXISTENTES

### 9.1 Speed Extension (`extensions/speed/`)
- Auto-captura tokens Lovable (content.js → background.js)
- Chat via speed-chat
- Auto-push para Brainchain pool via `pushAccountToStarble()`

### 9.2 Token Harvester (`extension/`)
- Captura sessões Lovable para o pool Brainchain
- Usa `x-extension-secret` para auto-registro

---

## 10. RESUMO EXECUTIVO

### O que já funciona hoje:

| Sistema | Status | Edge Functions |
|---------|--------|---------------|
| Brain (IA pessoal) | ✅ Funcional | brain, brain-capture-cron, get-brain-output |
| Brainchain (pool) | ✅ Funcional | brainchain-send, brainchain-admin, brainchain-token-manager, brainchain-status |
| Orquestrador | ✅ Funcional | agentic-orchestrator, orchestrator-tick, orchestrator-prd |
| Venus-Chat (proxy) | ✅ Funcional | venus-chat, speed-chat, lovable-proxy |
| StarCrawl (scraper) | ✅ Funcional | starcrawl |
| API Key Router | ✅ Funcional | api-key-router |
| Gemini-Chat | ✅ Funcional | gemini-chat |
| GitHub Integration | ✅ Funcional | venus-github |
| Deploy/Download | ✅ Funcional | publish-project, download-project |

### O que o Cirius precisa criar:

| Componente | Descrição |
|-----------|-----------|
| `cirius-generate` | Edge function pipeline |
| `cirius-deploy` | Deploy multi-plataforma |
| `cirius_projects` | Tabela de projetos gerados |
| `cirius_templates` | Catálogo de templates |
| Frontend `/cirius` | Interface de geração |
| Integração Vercel | API de deploy |

### Princípio fundamental:

> **O Cirius não reinventa a roda.** Ele orquestra os sistemas existentes (Brain, Brainchain, Orquestrador, StarCrawl, API Key Router) como um maestro, adicionando apenas a camada de pipeline e deploy que conecta tudo em um fluxo unificado de geração de projetos.

---

*Documento gerado em 2026-03-02 | Starble AI Platform*
