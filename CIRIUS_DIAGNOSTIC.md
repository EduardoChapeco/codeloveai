# 🔍 Cirius — Diagnóstico Completo & Roadmap Funcional

**Data:** 2026-03-02  
**Versão:** v2.1  
**Autor:** Sistema de análise automática

---

## 📋 Sumário Executivo

O Cirius é um **AI-powered vibecoding platform** que gera projetos completos (React + Tailwind + Supabase) a partir de prompts em linguagem natural. O sistema utiliza um pipeline multi-engine com PRD generation, execução paralela via Brainchain pool e deploy automático para GitHub/Vercel/Netlify.

### Status Geral

| Componente | Status | Nota |
|---|---|---|
| Criação de projeto (init) | ✅ Funcional | Projetos são criados corretamente |
| Geração de PRD | ✅ Funcional | OpenRouter (Claude) + Gateway (Gemini) |
| Brainchain pool | ✅ Funcional | 10+ contas ativas, error_count baixo |
| Orquestrador de tarefas | ✅ Funcional | Tarefas completadas com sucesso |
| Deploy GitHub | ✅ Funcional | Repos criados + arquivos pushados |
| Deploy Vercel | ⚠️ Falha | Erro de permissão: "You don't have permission to create the project" |
| Deploy Netlify | 🟡 Não testado | Integração OAuth recém-adicionada |
| Preview estático (srcDoc) | ⚠️ Limitado | Babel Standalone renderiza TSX mas sem imports reais |
| Preview live (URL externa) | ❌ Não funcional | Depende de deploy Vercel/Netlify bem-sucedido |
| Chat AI (streaming) | ✅ Funcional | SSE via Gateway (Gemini 3 Flash) |
| Chat AI (file extraction) | ✅ Funcional | Parser `<file path="">` extrai e salva arquivos |
| StatusCard / UI | ⚠️ Corrigido | Loops infinitos resolvidos (último fix) |

---

## 🏗️ Arquitetura Completa

### Fluxo: Novo Projeto (`/cirius/new`)

```
[CiriusNew.tsx]
  └─ Prompt do usuário
      └─ supabase.functions.invoke("cirius-generate", { action: "init" })
          └─ Cria registro em cirius_projects (status: draft)
          └─ Retorna project_id
      └─ supabase.functions.invoke("cirius-generate", { action: "generate_prd" })
          └─ Engine Priority:
              1. Brain System (send via venus-chat → capture via latest-message)
              2. AI Gateway (Gemini 2.5 Flash)
              3. OpenRouter (Claude Sonnet 4)
          └─ PRD JSON validado → salvo em cirius_projects.prd_json
      └─ supabase.functions.invoke("cirius-generate", { action: "generate_code" })
          └─ Registra tarefas no orchestrator_projects + orchestrator_tasks
          └─ Dispara orchestrator-tick (fire-and-forget)
      └─ Redirect → /cirius/editor/:id
```

### Fluxo: Editor (`/cirius/editor/:id`)

```
[CiriusEditor.tsx]
  ├─ loadProject() → cirius-status (GET project + logs + files)
  ├─ Realtime Subscription:
  │   ├─ cirius_generation_log → INSERT → upsertBubbleFromLog
  │   └─ cirius_projects → UPDATE → refresh project + preview
  │
  ├─ Chat Modes:
  │   ├─ "build" → cirius-generate (action: build_prompt) → PRD → Orchestrator
  │   └─ "ai-chat" → cirius-ai-chat (SSE streaming) → file extraction → save
  │
  ├─ Preview:
  │   ├─ Prioridade 1: livePreviewUrl (Vercel/Netlify/Custom Domain)
  │   ├─ Prioridade 2: srcDoc montado via buildPreviewFromFiles()
  │   └─ Fallback: Empty state com placeholder
  │
  └─ Deploy (manual via DrawerDeploy):
      ├─ GitHub → cirius-deploy (action: github)
      ├─ Vercel → cirius-deploy (action: vercel) [chain automática após GitHub]
      ├─ Netlify → cirius-deploy (action: netlify)
      └─ Supabase → cirius-deploy (action: supabase)
```

### Edge Functions do Cirius

| Função | Responsabilidade |
|---|---|
| `cirius-generate` | Pipeline principal: init, PRD, code generation, approve, capture |
| `cirius-ai-chat` | Chat interativo com streaming SSE, file extraction, build commands |
| `cirius-deploy` | Deploy para GitHub, Vercel, Netlify, Supabase |
| `cirius-status` | Polling de status do projeto e logs |
| `cirius-oauth-callback` | OAuth callback para GitHub, Vercel, Supabase, Netlify |
| `cirius-github-import` | Import de projetos GitHub existentes |
| `orchestrator-tick` | Cron que despacha e monitora tarefas paralelas |
| `agentic-orchestrator` | Execução individual de tarefas via Brainchain |

---

## 📊 Dados Reais do Sistema (Última Execução)

### Projeto: "Pagina em Branco" (1a8424bb)

| Etapa | Status | Duração | Detalhes |
|---|---|---|---|
| init | ✅ completed | - | Projeto criado |
| prd_engine_check | ℹ️ info | - | Brain: found (a54348fa), Token: present |
| prd_brain_send | ❌ failed | 30144ms | AbortError: The signal has been aborted (timeout 30s) |
| prd_gateway | ✅ completed | 5751ms | Gateway PRD: 5 tasks |
| prd | ✅ completed | 37407ms | PRD gerado: 5 tasks |
| code | ✅ started | - | Pipeline: 5 tarefas → Brain df24d609 (orch: 84e29658) |
| refine | ✅ completed | 10748ms | 10 arquivos refinados |
| auto_deploy | ✅ started | - | Refinamento concluído, auto-deploy GitHub triggered |
| deploy_github | ✅ completed | - | 10 arquivos pushados |
| deploy_vercel | ❌ failed | - | **"You don't have permission to create the project"** |

### Orchestrator Tasks (84e29658)

| Task | Status | Duração | Brain Type |
|---|---|---|---|
| Configurar Projeto React e Tailwind | ✅ completed | ~5min | code |
| Instalar e Configurar shadcn/ui | ✅ completed | ~8min | code |
| Criar Componente de Landing Page | ✅ completed | ~10min | code |
| Integrar LandingPage no App.tsx | ✅ completed | ~6min | code |
| Configurar Supabase (Placeholder) | ✅ completed | ~6min | code |

### Brainchain Pool

| Contas Ativas | Error Count | Brain Types |
|---|---|---|
| 10+ contas | 0-1 errors | code, prd, design |
| Todos `is_busy: false` | Pool saudável | Múltiplos brain_project_ids |

---

## 🔴 Problemas Identificados

### 1. **CRÍTICO: Deploy Vercel Falhando**

**Erro:** `"You don't have permission to create the project"`

**Causa provável:**
- O token Vercel salvo em `cirius_integrations` (user: eduardochapeco) não tem permissões de criação de projeto
- Token pode ser de escopo limitado (apenas leitura)
- Token pode ter expirado ou ser de uma conta sem billing ativa

**Como corrigir:**
1. Gerar um novo Vercel API Token com escopo `Full Access` em https://vercel.com/account/tokens
2. Reconectar via `/cirius/integrations` → Vercel
3. Se usar Team, garantir que o `teamId` está correto na integração

### 2. **CRÍTICO: Preview Não Funcional Para Projetos Reais**

O `buildPreviewFromFiles()` tenta renderizar React via **Babel Standalone + CDN**, mas isso tem limitações severas:

- **Imports não resolvidos**: `import { Button } from "@/components/ui/button"` falha
- **shadcn/ui não disponível**: Não existe no CDN
- **Supabase client**: Não pode ser importado inline
- **React Router**: Não funciona em srcDoc
- **Módulos ES**: Babel Standalone não resolve `import` entre arquivos

**Resultado:** O preview mostra uma página em branco ou com erros para qualquer projeto que use imports entre arquivos (99% dos casos).

**Soluções possíveis:**
1. **Deploy Vercel/Netlify funcional** = preview live real (solução ideal)
2. **Sandpack** (CodeSandbox SDK) = editor + preview in-browser com resolução de módulos
3. **WebContainers** (StackBlitz) = Node.js no browser, build real
4. **iframe com Vite dev server** em backend dedicado

### 3. **MODERADO: Brain System Timeout no PRD**

O Brain system deu timeout (30s AbortError) na geração de PRD. O fallback para Gateway funcionou, mas indica:

- O `venus-chat` levou >30s para processar
- O polling de `captureBrainResponse` pode ter conflitos com múltiplos projetos usando o mesmo Brain
- O sistema depende da API da Lovable (`api.lovable.dev/projects/{id}/chat/latest-message`) que pode ter latência

**Impacto:** PRD generation funciona via fallback (Gateway/OpenRouter), mas é mais lento e perde a capacidade de especialização do Brain.

### 4. **MODERADO: Logs de Edge Functions Vazios**

Todas as Edge Functions do Cirius (`cirius-generate`, `cirius-ai-chat`, `cirius-deploy`, `agentic-orchestrator`, `cirius-oauth-callback`) retornaram **"No logs found"**.

**Causa:** As funções estão sendo chamadas com sucesso (dados existem no DB), mas os logs estão expirando ou não sendo capturados pelo sistema de logging do Supabase.

**Impacto:** Dificulta debugging em produção.

### 5. **MENOR: Botões Sem Ação no Editor**

| Botão/Feature | Status |
|---|---|
| Anexar (attach) | 🔴 `addToast("Anexar: em breve")` |
| Voz (voice) | 🔴 `addToast("Voz: em breve")` |
| Desenho (draw) | 🔴 `addToast("Desenho: em breve")` |
| Histórico de versões | 🔴 `addToast("Histórico de versões")` |
| Review mode | 🟡 Apenas muda `activeMode` para "debug" |
| Queue clear | 🟡 Apenas zera `queueCount` local |

---

## 🟢 O Que Está Funcionando

### Pipeline de Geração (✅ End-to-End)
1. **Prompt → PRD**: OpenRouter (Claude Sonnet 4) gera PRDs com 5-7 tasks em ~6s
2. **PRD → Orchestrator**: Tarefas registradas e dispatched corretamente
3. **Orchestrator → Brainchain**: Pool com 10+ contas, execução paralela (3 slots)
4. **Brainchain → Código**: Tarefas completadas com sucesso (5-10min cada)
5. **Código → Refine**: IA refina arquivos automaticamente (10-11s)
6. **Refine → GitHub**: Deploy automático (10 arquivos pushados)

### Chat AI (✅ Streaming)
- SSE streaming via Gateway (Gemini 3 Flash Preview)
- File extraction com parser `<file path="">`
- Merge de arquivos com `sourceFilesRef`
- Terminal com feedback em tempo real
- Persistência de mensagens no DB

### Integrações Ativas
| Provider | Login | Status |
|---|---|---|
| GitHub | EduardoChapeco | ✅ Ativo (PAT) |
| Vercel | eduardochapeco | ⚠️ Token sem permissão de criação |
| Supabase | fupzxorkquuecjdiaysu | ✅ Ativo |
| Netlify | - | 🆕 OAuth configurado (não testado) |

### Realtime (✅ Funcional)
- Subscription em `cirius_generation_log` (INSERT)
- Subscription em `cirius_projects` (UPDATE)
- Task Bubbles atualizadas em tempo real
- Build progress card sincronizado

---

## 🛠️ Melhorias de UX/UI Propostas

### 1. Preview Funcional (Prioridade Máxima)

**Problema:** O preview estático (srcDoc + Babel) não funciona para projetos React reais.

**Solução recomendada — Sandpack:**
```tsx
import { SandpackProvider, SandpackPreview } from "@codesandbox/sandpack-react";

<SandpackProvider
  files={sourceFiles}
  template="react-ts"
  customSetup={{
    dependencies: {
      "react-router-dom": "latest",
      "lucide-react": "latest",
      // shadcn deps...
    }
  }}
>
  <SandpackPreview />
</SandpackProvider>
```

**Benefícios:**
- Resolução real de imports/módulos
- Hot reload instantâneo
- Suporte a TypeScript/TSX
- Sem necessidade de deploy para preview
- Fallback para quando Vercel/Netlify não está configurado

### 2. Chat UX Melhorado

- **Code diff view**: Mostrar diff antes/depois dos arquivos alterados
- **File tree sidebar**: Visualizar estrutura do projeto durante o chat
- **Syntax highlighting**: No streaming text (usar Prism/Shiki)
- **Undo/Redo**: Reverter última alteração de arquivo
- **Context awareness**: Mostrar quais arquivos estão sendo referenciados

### 3. Deploy UX

- **One-click deploy**: Botão unificado que faz GitHub + Vercel em sequência
- **Deploy status bar**: Progress bar com stages (upload → build → ready)
- **Auto-retry**: Se Vercel falhar, tentar Netlify automaticamente
- **Preview URL prominente**: Mostrar URL de preview como elemento principal

### 4. Build Progress

- **Timeline visual**: Mostrar timeline de tarefas do orchestrator
- **Estimated time**: Baseado em duração média de tarefas anteriores
- **Live code preview**: Mostrar preview parcial conforme cada task completa
- **Error recovery**: Botão "Retry" para tarefas que falharam

---

## 📐 Estrutura de Arquivos do Cirius

### Frontend
```
src/pages/
├── CiriusNew.tsx           ← Tela de criação (prompt inicial)
├── CiriusEditor.tsx        ← Editor principal (738 linhas — GRANDE)
├── CiriusDashboard.tsx     ← Lista de projetos
├── CiriusProject.tsx       ← Detalhes do projeto
├── CiriusIntegrations.tsx  ← Configuração de integrações

src/components/cirius-editor/
├── BottomIsland.tsx        ← Barra inferior (modos, input, ações)
├── BuildProgressCard.tsx   ← Card de progresso do build
├── ChatTaskCard.tsx        ← Card de chat + tarefas
├── CmdPanel.tsx            ← Painel ⌘K (code, chat, terminal)
├── CodeViewer.tsx          ← Visualizador de código
├── DomainIsland.tsx        ← Configuração de domínio
├── DrawerBuild.tsx         ← Drawer de build status
├── DrawerChain.tsx         ← Drawer de Brainchain
├── DrawerDeploy.tsx        ← Drawer de deploy
├── DrawerFiles.tsx         ← Drawer de arquivos
├── DrawerSEO.tsx           ← Drawer de SEO
├── FileExplorer.tsx        ← Explorer de arquivos
├── IslandLeft.tsx          ← Barra superior esquerda
├── IslandCenter.tsx        ← Barra superior central (viewport)
├── IslandRight.tsx         ← Barra superior direita (ações)
├── PreviewArea.tsx         ← Área de preview (iframe)
├── SplitChatPanel.tsx      ← Painel de chat (modo split)
├── SplitModeEditor.tsx     ← Layout split (chat + preview)
├── SplitPreviewPanel.tsx   ← Preview no modo split
├── SplitResizer.tsx        ← Resizer entre painéis
├── SplitTopBar.tsx         ← Barra superior do split mode
├── TaskBubbles.tsx         ← Bolhas de progresso flutuantes
├── TerminalPanel.tsx       ← Terminal de log
├── types.ts                ← Tipos compartilhados
└── PRDCard.tsx             ← Card de aprovação do PRD
```

### Backend (Edge Functions)
```
supabase/functions/
├── cirius-generate/        ← Pipeline principal (1424 linhas)
├── cirius-ai-chat/         ← Chat streaming (783 linhas)
├── cirius-deploy/          ← Deploy multi-plataforma (459 linhas)
├── cirius-status/          ← Polling de status
├── cirius-oauth-callback/  ← OAuth para integrações
├── cirius-github-import/   ← Import de GitHub
├── orchestrator-tick/      ← Cron de execução de tarefas
├── agentic-orchestrator/   ← Executor individual de tarefas
├── brainchain-send/        ← Envio para pool Brainchain
├── brainchain-stream/      ← Streaming SSE do Brainchain
└── _shared/
    └── md-assembly.ts      ← Parser de markdown para extração de arquivos
```

### Database Tables
```
cirius_projects        ← Projetos (source_files_json, prd_json, status, deploy URLs)
cirius_chat_messages   ← Histórico de chat por projeto
cirius_generation_log  ← Logs de geração (step, status, duration_ms, error_msg)
cirius_integrations    ← Tokens OAuth (GitHub, Vercel, Netlify, Supabase)
cirius_templates       ← Templates pré-configurados
orchestrator_projects  ← Projetos do orquestrador
orchestrator_tasks     ← Tarefas individuais do orquestrador
brainchain_accounts    ← Pool de contas para execução
brainchain_queue       ← Fila de mensagens para Brains
code_snapshots         ← Snapshots de código por fase
```

---

## 🔧 Correções Urgentes

### 1. Corrigir Deploy Vercel
```
Ação: Reconectar Vercel com token Full Access
Local: /cirius/integrations → Vercel
Impacto: Desbloqueia preview live para todos os projetos
```

### 2. Implementar Preview Sandpack (ou similar)
```
Ação: Substituir buildPreviewFromFiles() por Sandpack
Local: src/components/cirius-editor/PreviewArea.tsx
Impacto: Preview funcional sem depender de deploy externo
Dependência: npm install @codesandbox/sandpack-react
```

### 3. Aumentar Timeout do Brain PRD
```
Ação: Aumentar AbortController timeout de 30s → 60s
Local: supabase/functions/cirius-generate/index.ts (linha ~188)
Impacto: Menos fallbacks para Gateway, PRD mais especializado
```

### 4. Implementar Features "Em Breve"
```
Prioridade Alta:
- Anexar imagens/arquivos ao chat
- Histórico de versões (snapshots já existem na tabela code_snapshots)

Prioridade Média:
- Voice input (Web Speech API)
- Review mode (análise automática de código)

Prioridade Baixa:
- Desenho (canvas → screenshot → prompt de IA)
```

---

## 📈 Métricas de Performance

| Métrica | Valor | Observação |
|---|---|---|
| PRD Generation (Gateway) | ~6s | Gemini 2.5 Flash |
| PRD Generation (Brain) | Timeout 30s | Precisa aumentar timeout |
| Task Execution (Brainchain) | 5-10min cada | Paralelo (3 slots) |
| Code Refinement | ~11s | 10 arquivos via IA |
| GitHub Deploy | ~8s | 10 arquivos via Contents API |
| Vercel Deploy | ❌ Falhando | Permissão de token |
| Total Pipeline (prompt → GitHub) | ~20min | Para projeto com 5 tarefas |

---

## 🔐 Segurança

| Item | Status |
|---|---|
| Tokens em cirius_integrations | ⚠️ `access_token_enc` armazenado em texto (nome sugere criptografia mas não há evidência de encriptação real) |
| HMAC signature (X-Starble-Sig) | ✅ Implementado para client guard |
| Service Key para deploys internos | ✅ Usado para chamadas internas |
| RLS em cirius_projects | ✅ user_id = auth.uid() |
| RLS em cirius_integrations | ✅ user_id = auth.uid() |
| OAuth callbacks | ⚠️ Sem proteção CSRF (state não validado) |

---

## 📝 Conclusão

O pipeline do Cirius está **funcionalmente completo** para geração de código (prompt → PRD → tarefas → código → GitHub). Os principais bloqueios para uma experiência funcional são:

1. **Preview real** — O preview estático não funciona para React. Precisa de Sandpack ou deploy Vercel/Netlify.
2. **Deploy Vercel** — Token sem permissão. Fix imediato = reconectar com token correto.
3. **UX polish** — Botões sem ação, falta de code diff, syntax highlighting no streaming.

**Recomendação de prioridade:**
1. 🔴 Fix Vercel token → preview live funcional
2. 🔴 Implementar Sandpack → preview local funcional
3. 🟡 Aumentar timeout do Brain → PRD mais confiável
4. 🟡 Implementar histórico de versões → code_snapshots já existe
5. 🟢 UX polish → code diff, syntax highlighting, anexos
