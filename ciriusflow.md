# Cirius Flow — Blueprint Completo para Vibecoding Real

> PRD/Blueprint técnico para transformar o Cirius de um "gerador de texto que parece código" em um **sistema real de criação de projetos** com build, preview e deploy funcionais — usando a infraestrutura que já existe.

---

## 📍 Diagnóstico: O Que Temos vs O Que Falta

### ✅ O que já existe e funciona

| Componente | Status | Localização |
|-----------|--------|-------------|
| Editor Full Mode (Islands flutuantes) | ✅ Completo | `CiriusEditor.tsx` |
| Editor Split Mode (Chat + Preview) | ✅ Completo | `SplitModeEditor.tsx` |
| Preview Live (iframe lovable.app) | ✅ Funciona | `PreviewArea.tsx` |
| Preview Estático (srcDoc) | ✅ Funciona | `PreviewArea.tsx` |
| Pipeline PRD (IA gera tarefas) | ✅ Funciona | `cirius-generate` action `generate_prd` |
| Orquestrador de tarefas | ✅ Funciona | `orchestrator-tick` + `agentic-orchestrator` |
| Deploy GitHub (cria repo + push) | ✅ Real | `cirius-deploy` action `github` |
| Deploy Vercel (vincula repo) | ✅ Real | `cirius-deploy` action `vercel` |
| Deploy Netlify (cria site) | ✅ Real | `cirius-deploy` action `netlify` |
| Deploy Supabase (migrations SQL) | ✅ Real | `cirius-deploy` action `supabase` |
| OAuth GitHub/Vercel/Netlify | ✅ Real | `cirius-oauth-callback` |
| Brainchain Pool (contas Lovable) | ✅ Ativo | `brainchain_accounts` + `brainchain-send` |
| Markdown Assembly (extrai código) | ✅ Existe | `_shared/md-assembly.ts` |
| AI Refinement (pós-geração) | ✅ Existe | `cirius-generate` action `refine` |
| Task Bubbles (progresso visual) | ✅ Funciona | `TaskBubbles.tsx` |
| Realtime Logs | ✅ Funciona | `cirius_generation_log` via Supabase Realtime |
| Diagnóstico (debug_log) | ✅ Existe | `cirius-generate` action `debug_log` |
| DrawerFiles (visualizar arquivos) | ✅ Existe | `DrawerFiles.tsx` |
| DrawerBuild (logs de build) | ✅ Existe | `DrawerBuild.tsx` |
| DrawerChain (cadeia de tarefas) | ✅ Existe | `DrawerChain.tsx` |
| DrawerDeploy (painel de deploy) | ✅ Existe | `DrawerDeploy.tsx` |
| DrawerSEO (análise SEO) | ✅ Existe | `DrawerSEO.tsx` |

### ❌ O que está quebrado ou desconectado

| Problema | Impacto | Causa Raiz |
|----------|---------|------------|
| `CiriusNew` → cria projeto → vai para `CiriusProject` (timeline genérica) em vez do Editor | Usuário nunca vê o editor real | Navegação hardcoded para `/cirius/project/:id` |
| `lovable_project_id` não propaga do Ghost Create | Preview live nunca funciona | `generate_code` cria orchestrator mas não vincula lovable_project_id de volta |
| `md-assembly` minera código mas `source_files_json` fica vazio | Preview estático não funciona | `orchestrator-tick` faz captura mas não chama `mergeFileMaps` no projeto Cirius |
| Refinamento de código não é disparado automaticamente | Código gerado tem imports quebrados | Falta trigger no `orchestrator-tick` quando todas tasks completam |
| Deploy não é disparado automaticamente | Usuário precisa clicar manualmente em cada provider | Falta auto-deploy após refinamento |
| `CiriusProject` é uma timeline passiva | Não permite interação, apenas visualização | Falta integração com o Editor |
| Chat do Editor (`sendMsg`) funciona mas não persiste | Histórico se perde ao recarregar | `chatMessages` é estado local, não salvo no banco |

---

## 🏗️ Arquitetura Alvo: Fluxo Real de Vibecoding

### Visão: O Que o Usuário Deve Experimentar

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. Usuário abre /cirius/new                                        │
│     → Preenche wizard (nome, tipo, features)                        │
│     → Clica "Criar Projeto"                                         │
│                                                                     │
│  2. Sistema cria projeto + abre EDITOR imediatamente                │
│     → /cirius/editor/:id (Split Mode por padrão)                    │
│     → Chat à esquerda, Preview à direita                            │
│     → Preview mostra placeholder enquanto gera                      │
│                                                                     │
│  3. Pipeline roda em background (visível via Task Bubbles)          │
│     → PRD gerado (3-10 tarefas)                                     │
│     → Cada task enviada ao Brainchain → código gerado               │
│     → md-assembly extrai arquivos → source_files_json atualiza      │
│     → Preview atualiza em tempo real (srcDoc ou live URL)            │
│                                                                     │
│  4. Usuário interage no chat ENQUANTO gera                          │
│     → "Muda a cor primária para azul"                               │
│     → "Adiciona dark mode"                                          │
│     → Cada mensagem vira task no orquestrador                       │
│                                                                     │
│  5. Quando todas tasks completam:                                   │
│     → Refinamento automático (IA corrige imports/tipos)             │
│     → Deploy automático (GitHub → Vercel)                           │
│     → Badge "LIVE" aparece no preview                               │
│     → Toast: "Projeto publicado em projeto.vercel.app"              │
│                                                                     │
│  6. Usuário continua iterando                                       │
│     → Cada mensagem no chat = nova iteração do projeto              │
│     → Preview atualiza em tempo real                                │
│     → Deploy atualiza automaticamente                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Mudanças Necessárias (por prioridade)

### P0 — Crítico: Consertar o Fluxo Principal

#### 1. Navegação: `CiriusNew` → Editor (não Timeline)

**Arquivo:** `src/pages/CiriusNew.tsx`

**Mudança:** Após criar o projeto, navegar para `/cirius/editor/:id` em vez de `/cirius/project/:id`.

```tsx
// ANTES (provavelmente):
navigate(`/cirius/project/${data.project_id}`);

// DEPOIS:
navigate(`/cirius/editor/${data.project_id}`);
```

**Impacto:** Usuário cai direto no editor com chat + preview. A timeline (`CiriusProject`) vira uma tela secundária acessível via botão.

#### 2. Propagação do `lovable_project_id` no Pipeline

**Arquivo:** `supabase/functions/cirius-generate/index.ts`

**Problema:** Quando `generate_code` cria o orchestrator project e o Ghost Create retorna um `lovable_project_id`, esse ID não é salvo de volta em `cirius_projects`.

**Mudança:** Na action `generate_code`, após criar o orchestrator project:

```typescript
// Após Ghost Create retornar project_id
if (orchestratorData?.lovable_project_id) {
  await sc.from("cirius_projects")
    .update({ lovable_project_id: orchestratorData.lovable_project_id })
    .eq("id", projectId);
}
```

**Verificação:** `SELECT lovable_project_id FROM cirius_projects WHERE id = ?` não deve ser null após geração.

#### 3. md-assembly: Conectar Mineração ao Cirius

**Arquivo:** `supabase/functions/orchestrator-tick/index.ts`

**Problema:** `orchestrator-tick` processa tarefas e captura respostas em markdown, mas não atualiza `cirius_projects.source_files_json`.

**Mudança:** Após cada task completar com sucesso, verificar se tem `cirius_projects` vinculado e atualizar:

```typescript
async function syncSourceFilesToCirius(sc: SC, orchestratorProjectId: string, newFiles: Record<string, string>) {
  // Buscar cirius_project vinculado
  const { data: cirius } = await sc
    .from("cirius_projects")
    .select("id, source_files_json")
    .eq("orchestrator_project_id", orchestratorProjectId)
    .maybeSingle();
  
  if (!cirius) return;
  
  // Merge incremental
  const existing = (cirius.source_files_json as Record<string, string>) || {};
  const merged = { ...existing, ...newFiles };
  
  await sc.from("cirius_projects").update({
    source_files_json: merged,
    files_fingerprint: buildFilesFingerprint(merged),
  }).eq("id", cirius.id);
}
```

**Impacto:** Preview estático atualiza em tempo real conforme cada task completa.

#### 4. Auto-Trigger: Refinamento + Deploy após Conclusão

**Arquivo:** `supabase/functions/orchestrator-tick/index.ts`

**Problema:** Quando todas tasks completam, nada acontece automaticamente.

**Mudança:** No handler de "todas tasks completadas":

```typescript
async function onAllTasksCompleted(sc: SC, orchestratorProjectId: string) {
  // 1. Buscar cirius project
  const { data: cirius } = await sc
    .from("cirius_projects")
    .select("id, source_files_json")
    .eq("orchestrator_project_id", orchestratorProjectId)
    .maybeSingle();
  
  if (!cirius?.id) return;
  
  // 2. Trigger refinement
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  await fetch(`${supabaseUrl}/functions/v1/cirius-generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "refine", project_id: cirius.id }),
  });
  
  // 3. Log
  await sc.from("cirius_generation_log").insert({
    project_id: cirius.id,
    step: "auto_refine_trigger",
    status: "started",
    level: "info",
    message: "Refinamento automático iniciado após conclusão de todas as tarefas",
  });
}
```

**Para auto-deploy após refinamento:** No final da action `refine` em `cirius-generate`:

```typescript
// Após refinamento bem-sucedido, trigger deploy se GitHub está conectado
const { data: ghIntegration } = await sc
  .from("cirius_integrations")
  .select("id")
  .eq("user_id", project.user_id)
  .eq("provider", "github")
  .eq("is_active", true)
  .maybeSingle();

if (ghIntegration) {
  // Auto-deploy para GitHub
  await fetch(`${supabaseUrl}/functions/v1/cirius-deploy`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "github", project_id: projectId }),
  });
}
```

---

### P1 — Importante: Melhorar Experiência do Editor

#### 5. Persistir Chat no Banco

**Tabela nova:** `cirius_chat_messages`

```sql
CREATE TABLE public.cirius_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES cirius_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'user', -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cirius_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own project chats"
  ON public.cirius_chat_messages FOR ALL
  USING (user_id = auth.uid());
CREATE INDEX idx_cirius_chat_project ON cirius_chat_messages(project_id, created_at);
```

**Frontend:** `CiriusEditor.tsx` carrega mensagens do banco ao abrir, e salva cada nova mensagem.

#### 6. Preview com Hot Reload Real

**Problema:** O preview estático (srcDoc) não suporta SPA routing, CSS modules, etc.

**Solução em 3 camadas:**

1. **Camada 1 — Live URL (já funciona):** Se `lovable_project_id` existe, iframe aponta para `https://id-preview--{id}.lovable.app`. Hot reload nativo do Lovable.

2. **Camada 2 — Build local via Stackblitz/WebContainers:** Para projetos sem lovable_project_id, usar WebContainers API para rodar Vite no browser:
   ```typescript
   // Converter source_files_json → WebContainer filesystem
   const files = Object.entries(sourceFiles).reduce((acc, [path, content]) => {
     acc[path] = { file: { contents: content } };
     return acc;
   }, {});
   await webcontainer.mount(files);
   await webcontainer.spawn('npm', ['install']);
   await webcontainer.spawn('npm', ['run', 'dev']);
   // iframe.src = webcontainer.url (localhost temporário)
   ```
   **Complexidade:** Alta. Requer pacote `@webcontainer/api` (~3MB). Ideal para V2.

3. **Camada 3 — srcDoc melhorado (quick win):** Gerar um index.html auto-contido com todos os CSS/JS inline. Já funciona para landing pages simples.

**Recomendação:** Manter Camada 1 + 3 para V1. Adicionar Camada 2 em V2.

#### 7. Drawer de Arquivos com Edição

**Arquivo:** `src/components/cirius-editor/DrawerFiles.tsx`

**Mudança:** Adicionar editor inline (textarea ou CodeMirror) para cada arquivo:

```tsx
// Ao clicar em um arquivo no drawer:
<textarea
  value={fileContent}
  onChange={(e) => updateFile(filePath, e.target.value)}
  className="font-mono text-xs w-full h-full"
/>
```

**Salvar alterações:** Atualizar `source_files_json` via `cirius-generate` action `update_file`:

```typescript
// Nova action em cirius-generate
if (action === "update_file") {
  const { file_path, content } = body;
  const existing = project.source_files_json || {};
  existing[file_path] = content;
  await sc.from("cirius_projects").update({
    source_files_json: existing,
    files_fingerprint: buildFilesFingerprint(existing),
  }).eq("id", projectId);
  return json({ ok: true });
}
```

---

### P2 — Nice to Have: Funcionalidades Avançadas

#### 8. File System Virtual com Árvore de Diretórios

Converter `source_files_json` (flat map) em árvore navegável:

```typescript
function buildFileTree(files: Record<string, string>): TreeNode[] {
  const root: TreeNode = { name: "/", children: [] };
  for (const [path, content] of Object.entries(files)) {
    const parts = path.split("/");
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      if (i === parts.length - 1) {
        current.children.push({ name, content, type: "file" });
      } else {
        let dir = current.children.find(c => c.name === name && c.type === "dir");
        if (!dir) {
          dir = { name, children: [], type: "dir" };
          current.children.push(dir);
        }
        current = dir;
      }
    }
  }
  return root.children;
}
```

#### 9. Terminal Emulado

Adicionar um drawer/panel de terminal que executa comandos predefinidos:
- `npm install` → Atualiza `package.json` no `source_files_json`
- `npm run build` → Trigger `cirius-generate` action `refine`
- `npm run deploy` → Trigger `cirius-deploy`
- `git push` → Trigger `cirius-deploy` action `github`

Não é um terminal real, é um **command palette** com comandos mapeados para actions do backend.

#### 10. Versionamento (Git-like)

Usar `code_snapshots` (tabela que já existe!) para salvar versões:

```typescript
// Ao completar cada task ou refinamento:
await sc.from("code_snapshots").insert({
  project_id: ciriusProjectId,
  files_json: sourceFilesJson,
  file_count: Object.keys(sourceFilesJson).length,
  fingerprint: buildFilesFingerprint(sourceFilesJson),
  phase: taskIndex,
  task_id: taskId,
});
```

**Drawer de Histórico:** Lista snapshots com diff visual e botão "Restaurar".

#### 11. Integração com Supabase Schema

Para projetos que usam Supabase, extrair tabelas/RLS do PRD e gerar migrations automaticamente:

```typescript
// No PRD, design.tables = ["users", "posts", "comments"]
// Na task de setup, gerar SQL:
const migrationSql = tables.map(t => `
  CREATE TABLE public.${t} (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;
`).join("\n");

// Salvar em source_files_json["supabase/migrations/001_init.sql"]
```

---

## 🔄 Comparação: Lovable vs Cirius

| Aspecto | Lovable (referência) | Cirius (atual) | Cirius (alvo) |
|---------|---------------------|----------------|---------------|
| Input | Chat livre | Chat + Wizard + Modes | Chat + Wizard + Modes ✅ |
| PRD/Planning | Interno (não visível) | PRD visível com tasks | PRD visível ✅ |
| Code Generation | Interno (não visível) | Brainchain + OpenRouter + Gateway | Igual + Brain pessoal ✅ |
| Preview | iframe live (hot reload nativo) | ❌ Preview live desconectado | iframe live + srcDoc fallback |
| File Browser | Árvore lateral com editor | DrawerFiles (flat, read-only) | DrawerFiles com árvore + edição |
| Deploy | 1-click publish | GitHub/Vercel/Netlify manual | Auto-deploy após build |
| Versioning | Git integrado | code_snapshots (não usado) | code_snapshots ativo |
| Terminal | Não tem (abstrai tudo) | Não tem | Command palette mapeado |
| Banco de Dados | Supabase integrado nativo | Supabase externo via deploy | Schema do PRD → migrations auto |
| Colaboração | Não tem (solo) | Não tem | Não priorizado (V3) |

---

## 📋 Plano de Execução (Sprints)

### Sprint 1 — Fluxo Funcional (P0) — ~4 tarefas

1. **Redirect CiriusNew → Editor** — Mudar navegação pós-criação para `/cirius/editor/:id`
2. **Propagar lovable_project_id** — Garantir que Ghost Create salva ID no cirius_projects
3. **Conectar md-assembly ao Cirius** — orchestrator-tick atualiza source_files_json do cirius
4. **Auto-trigger refinamento + deploy** — Disparar automaticamente ao completar todas tasks

### Sprint 2 — Experiência do Editor (P1) — ~3 tarefas

5. **Persistir chat no banco** — Criar tabela + carregar/salvar mensagens
6. **Melhorar DrawerFiles** — Árvore de diretórios + edição inline
7. **Versionamento com code_snapshots** — Salvar snapshots automáticos + drawer de histórico

### Sprint 3 — Funcionalidades Avançadas (P2) — ~3 tarefas

8. **Command palette (terminal)** — Comandos mapeados para actions do backend
9. **Schema auto-generation** — PRD tables → SQL migrations automáticas
10. **WebContainers (preview local)** — Vite no browser para preview sem Lovable

---

## 🗺️ Diagrama de Fluxo Completo (Alvo)

```
┌──────────┐    ┌──────────────┐    ┌─────────────────┐
│ CiriusNew│───▶│cirius-generate│───▶│ Editor (Split)  │
│ (Wizard) │    │ action: init  │    │ Chat + Preview  │
└──────────┘    └──────┬───────┘    └────────┬────────┘
                       │                      │
                       ▼                      │ sendMsg (cada msg)
                ┌──────────────┐              │
                │cirius-generate│◀─────────────┘
                │action:build_  │
                │prompt         │
                └──────┬───────┘
                       │
            ┌──────────┼──────────┐
            ▼          ▼          ▼
     ┌──────────┐ ┌─────────┐ ┌─────────────┐
     │  PRD IA  │ │Orchestr.│ │ Brain/Chain  │
     │(Gateway/ │ │ (tasks) │ │ (execução)   │
     │OpenRouter│ └────┬────┘ └──────┬───────┘
     └──────────┘      │             │
                       ▼             ▼
              ┌─────────────────────────┐
              │   orchestrator-tick      │
              │   (CRON cada 30s)       │
              │                         │
              │ 1. Pega task pendente    │
              │ 2. Envia para Brainchain│
              │ 3. Captura resposta     │
              │ 4. md-assembly extrai   │
              │ 5. Atualiza source_files│
              │ 6. Sync → cirius_project│
              │ 7. Próxima task...      │
              └────────┬────────────────┘
                       │
                       ▼ (todas tasks done)
              ┌─────────────────────────┐
              │   Auto-Refinement       │
              │   (cirius-generate      │
              │    action: refine)      │
              │                         │
              │ • Fix imports quebrados │
              │ • Padronizar estrutura  │
              │ • Validar schemas       │
              └────────┬────────────────┘
                       │
                       ▼
              ┌─────────────────────────┐
              │   Auto-Deploy           │
              │   (cirius-deploy)       │
              │                         │
              │ • GitHub: push files    │
              │ • Vercel: connect repo  │
              │ • Netlify: ZIP deploy   │
              │ • Supabase: migrations  │
              └────────┬────────────────┘
                       │
                       ▼
              ┌─────────────────────────┐
              │   Projeto LIVE          │
              │   • Preview funcional   │
              │   • URLs de deploy      │
              │   • Iteração contínua   │
              └─────────────────────────┘
```

---

## 📊 Realtime: O Que o Usuário Vê em Tempo Real

```
Supabase Realtime ──┐
                    │
                    ├──▶ cirius_generation_log (INSERT)
                    │     → Task Bubbles atualizam
                    │     → DrawerBuild mostra logs
                    │     → Toast notifications
                    │
                    ├──▶ cirius_projects (UPDATE)
                    │     → Status badge muda
                    │     → Progress bar atualiza
                    │     → source_files_json → Preview recarrega
                    │     → lovable_project_id → Preview live ativa
                    │
                    └──▶ cirius_chat_messages (INSERT) [futuro]
                          → Chat mostra novas mensagens
                          → Respostas do sistema em tempo real
```

---

## 🔐 Segurança no Fluxo

1. **Todos os tokens OAuth** ficam server-side em `cirius_integrations` (RLS por user_id)
2. **Brainchain access_tokens** são gerenciados pela pool, nunca expostos ao frontend
3. **source_files_json** não contém segredos (são arquivos de código, não .env)
4. **Auto-deploy** só dispara se o usuário tem integração ativa e configurada
5. **Service keys do Supabase** são armazenados criptografados server-side
6. **HMAC-SHA256** protege OAuth state contra CSRF
7. **RLS** em todas as tabelas do Cirius (cirius_projects, cirius_integrations, cirius_generation_log)

---

## 📁 Mapa de Arquivos Afetados

### Frontend
| Arquivo | Mudança |
|---------|---------|
| `src/pages/CiriusNew.tsx` | Redirect para editor |
| `src/pages/CiriusEditor.tsx` | Carregar/salvar chat, auto-start pipeline |
| `src/components/cirius-editor/DrawerFiles.tsx` | Árvore + edição |
| `src/components/cirius-editor/SplitModeEditor.tsx` | Nenhuma (já funciona) |
| `src/components/cirius-editor/PreviewArea.tsx` | Nenhuma (já funciona) |

### Backend (Edge Functions)
| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/cirius-generate/index.ts` | Propagar lovable_project_id, action update_file |
| `supabase/functions/orchestrator-tick/index.ts` | Sync source_files → cirius, auto-refine trigger |
| `supabase/functions/cirius-deploy/index.ts` | Nenhuma (já funciona) |

### Banco de Dados
| Tabela | Mudança |
|--------|---------|
| `cirius_chat_messages` | Nova tabela |
| `cirius_projects` | Nenhuma (schema ok) |
| `code_snapshots` | Nenhuma (já existe, só precisa ser usado) |

---

## ✅ Critérios de Sucesso

### V1 (Sprint 1) — "Funciona de ponta a ponta"
- [ ] Usuário cria projeto → cai no Editor (não na timeline)
- [ ] Preview live aparece quando lovable_project_id existe
- [ ] source_files_json se popula automaticamente durante geração
- [ ] Refinamento dispara automaticamente ao concluir
- [ ] Deploy automático para GitHub se integração ativa

### V2 (Sprint 2+3) — "Experiência completa"
- [ ] Chat persiste entre sessões
- [ ] Usuário pode editar arquivos inline
- [ ] Versionamento com restauração
- [ ] Terminal/command palette funcional
- [ ] Schema SQL gerado automaticamente do PRD

---

> **Resumo em uma frase:** O Cirius já tem 80% da infraestrutura pronta — o que falta é **conectar as pontas** (lovable_project_id, md-assembly → cirius, auto-trigger) e **mudar a navegação** para que o usuário caia no Editor real, não na timeline passiva.
