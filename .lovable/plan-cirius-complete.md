# Plano Completo — Cirius: AI App & Site Builder

## Status Atual (Implementado ✅)

### Edge Functions
- `cirius-generate` — init, generate_prd, generate_code, capture, status, pause/resume/cancel, oauth_state, save_supabase_integration
- `cirius-deploy` — github, vercel, netlify, supabase
- `cirius-status` — get, list
- `cirius-oauth-callback` — github, vercel, netlify (HMAC-signed state)

### Tabelas
- `cirius_projects` — projetos do usuário com RLS owner-scoped
- `cirius_generation_log` — logs de geração com realtime
- `cirius_integrations` — OAuth tokens (server-side only)
- `cirius_templates` — templates (tabela existe, vazia, sem UI)

### Frontend
- `/cirius` — Dashboard com listagem de projetos
- `/cirius/new` — Wizard 3 steps (tipo → detalhes → features)
- `/cirius/project/:id` — Status, logs, ações, deploy panel
- `/cirius/integrations` — OAuth + Supabase manual

### Segurança
- JWT auth em todas as edge functions
- HMAC-signed OAuth state com expiração 10min
- Service key armazenada server-side
- RLS owner-scoped em todas as tabelas
- Error masking (sem info leak)

---

## Fases Pendentes

### FASE 1 — Pipeline de Execução Multi-Task
**Prioridade: CRÍTICA**

O PRD gera 3-7 tasks, mas apenas a primeira é enviada. Falta o loop de execução.

**O que implementar:**
1. **`cirius-tick` (nova edge function)** — Cron job (a cada 60s) que:
   - Busca projetos com `status = 'generating_code'`
   - Verifica se o BrainChain queue item completou (polling `brainchain_queue`)
   - Se completou → armazena resposta → avança para próxima task
   - Se todas as tasks completaram → `status = 'deploying'` ou `'live'`
   - Atualiza `progress_pct` proporcionalmente (20% + (60% × task_index / total_tasks))

2. **Coluna `current_task_index` em `cirius_projects`** — Rastrear qual task está executando

3. **Coluna `task_responses` em `cirius_projects`** — JSONB com respostas por task

**Dependências:** brainchain-send, brainchain-status (já existem)

---

### FASE 2 — Integração StarCrawl
**Prioridade: ALTA**

O campo `source_url` é capturado no wizard mas nunca usado. O StarCrawl já existe (`starcrawl` edge function).

**O que implementar:**
1. **No `cirius-generate` action `generate_prd`:**
   - Se `source_url` presente → chamar `starcrawl` para extrair conteúdo/estrutura
   - Incluir resultado do crawl no prompt do PRD para gerar tasks mais precisas
   - Armazenar crawl result em `cirius_projects.crawl_data` (nova coluna JSONB)

2. **UI indicator no wizard** — Mostrar que o StarCrawl está analisando a URL

---

### FASE 3 — Sistema de Templates
**Prioridade: MÉDIA**

A tabela `cirius_templates` existe mas está vazia e sem UI.

**O que implementar:**
1. **Seed de templates** (migration SQL):
   - Landing Page SaaS
   - Portfolio Pessoal
   - Dashboard Admin
   - E-commerce Simples
   - Blog com CMS
   - App de Chat
   - Documentação

2. **UI no wizard `/cirius/new`:**
   - Step 0.5: "Começar do zero ou usar template?"
   - Grid de templates com thumbnail, nome, descrição
   - Ao selecionar template → preencher `template_type`, `features`, `description` automaticamente
   - Template `prompt_template` é injetado no PRD

3. **Admin CRUD de templates** (página `/admin/cirius-templates`)

---

### FASE 4 — Preview & Download
**Prioridade: ALTA**

Não há como visualizar ou baixar o código gerado.

**O que implementar:**
1. **Preview iframe no `/cirius/project/:id`:**
   - Compilar `source_files_json` em HTML estático (para landing pages)
   - Ou gerar preview URL via Vercel/Netlify preview deploy
   - Alternativamente: usar StackBlitz WebContainer SDK para preview ao vivo

2. **Download ZIP:**
   - Nova action `download` em `cirius-generate` ou rota dedicada
   - Gerar ZIP a partir de `source_files_json`
   - Retornar URL temporária para download

3. **File Explorer:**
   - Componente tree view mostrando `source_files_json`
   - Visualizar conteúdo de cada arquivo com syntax highlighting

---

### FASE 5 — Iteração & Chat
**Prioridade: MÉDIA**

Após gerar, não há como iterar/refinar o código.

**O que implementar:**
1. **Chat de iteração no `/cirius/project/:id`:**
   - Input de prompt adicional
   - Envia contexto (source_files_json + prompt) ao BrainChain/Brain
   - Aplica diff nas files existentes
   - Log de cada iteração

2. **Nova action `iterate` em `cirius-generate`:**
   - Recebe `project_id` + `prompt`
   - Inclui source_files como contexto
   - Atualiza `source_files_json` com resposta

3. **Histórico de versões:**
   - Usar `code_snapshots` (tabela já existe) para salvar snapshots antes de cada iteração
   - Botão "Reverter" para voltar a snapshot anterior

---

### FASE 6 — Limites & Billing
**Prioridade: MÉDIA**

Sem integração com sistema de licenças/planos.

**O que implementar:**
1. **Verificar licença antes de gerar:**
   - No `cirius-generate` action `init`: verificar se user tem plano ativo
   - Planos free: máx 1 projeto, apenas landing page
   - Planos pagos: projetos ilimitados, todos os tipos

2. **Consumo de tokens:**
   - Cada geração de PRD = 1 token
   - Cada task de código = 1 token
   - Deploy = 0 tokens
   - Integrar com `daily_usage` / `increment_daily_usage`

3. **Feature flag `cirius`:**
   - Adicionar na tabela `feature_flags`
   - Controlar acesso global vs por plano

---

### FASE 7 — Módulos Complementares
**Prioridade: BAIXA**

Funcionalidades extras para diferenciação.

1. **Auto-deploy on completion:**
   - Quando todas as tasks completam → auto-push GitHub → auto-deploy Vercel
   - Configurável por projeto via `deploy_config`

2. **Webhook notifications:**
   - Notificar via webhook quando projeto muda de status
   - Integrar com WhatsApp (Evolution API) para notificar via mensagem

3. **Compartilhamento:**
   - Gerar link público de preview
   - Compartilhar projeto com outros usuários (read-only)

4. **Import de projeto existente:**
   - Importar de GitHub repo existente
   - Importar de URL (via StarCrawl + reconstituição)

5. **CI/CD integrado:**
   - Ao atualizar código via iteração → auto-commit + deploy

---

## Ordem de Execução Recomendada

| Fase | Prioridade | Esforço | Dependências |
|------|-----------|---------|-------------|
| 1 — Multi-Task Pipeline | CRÍTICA | Alto | brainchain-send, brainchain-status |
| 2 — StarCrawl | ALTA | Médio | starcrawl edge function |
| 4 — Preview & Download | ALTA | Alto | source_files_json |
| 3 — Templates | MÉDIA | Médio | cirius_templates table |
| 5 — Iteração & Chat | MÉDIA | Alto | source_files_json, brainchain |
| 6 — Limites & Billing | MÉDIA | Médio | licenses, plans, feature_flags |
| 7 — Módulos Extras | BAIXA | Variável | Todas as fases anteriores |

---

## Resumo de Novos Artefatos Necessários

### Edge Functions (novas)
- `cirius-tick` — Cron de avanço de pipeline

### Edge Functions (modificações)
- `cirius-generate` — Adicionar: StarCrawl, iterate, download, billing checks
- `cirius-status` — Adicionar: file explorer data, snapshot data

### Tabelas (alterações)
- `cirius_projects` — Novas colunas: `current_task_index`, `task_responses`, `crawl_data`
- `cirius_templates` — Seed data

### Frontend (novas páginas/componentes)
- Componente FileExplorer para `/cirius/project/:id`
- Componente ChatIteration para `/cirius/project/:id`
- Seção Templates no wizard `/cirius/new`
- Admin `/admin/cirius-templates`

### Feature Flags
- `cirius` — Controle de acesso ao módulo

### Config
- `supabase/config.toml` — Adicionar cron para `cirius-tick`
