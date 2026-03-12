# Brain Mode & Ghost Create — Documentação Técnica Completa

> Guia definitivo de como o sistema Brain funciona, como projetos são criados via Ghost Create,
> como o bootstrap configura o Brain, e como construir uma extensão que se comunica com tudo isso.

---

## Índice

1. [Visão Geral do Brain](#visão-geral)
2. [Ghost Create — Criação Fantasma de Projetos](#ghost-create)
3. [Bootstrap — 13 Fases de Configuração](#bootstrap)
4. [Prompts Completos do Brain](#prompts-completos)
5. [Ciclo de Envio e Captura de Respostas](#ciclo-envio-captura)
6. [BrainChain — Pool de Contas Compartilhadas](#brainchain)
7. [Construindo uma Extensão](#construindo-extensão)
8. [Referência de APIs e Tabelas](#referência-apis)

---

## 1. Visão Geral do Brain

O **Brain** (Star AI) é um sistema de IA especializada que cria um **projeto Lovable dedicado** para cada usuário. Este projeto age como um "cérebro" — um workspace vazio onde prompts especializados são injetados, transformando o projeto em um assistente técnico com persona de PhD/50+ anos de experiência.

### Arquitetura

```
┌──────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  Frontend / Ext  │────▶│  Edge Function    │────▶│  Lovable API        │
│  (send message)  │     │  brain/index.ts   │     │  /projects/{id}/chat│
└──────────────────┘     └──────────────────┘     └─────────────────────┘
                                │                          │
                                │  via venus-chat          │  Resposta do AI
                                │                          ▼
                         ┌──────────────────┐     ┌─────────────────────┐
                         │  brain-capture   │◀────│  src/update.md      │
                         │  -cron           │     │  (canal de saída)   │
                         └──────────────────┘     └─────────────────────┘
                                │
                                ▼
                         ┌──────────────────┐
                         │  loveai_         │
                         │  conversations   │ (DB: respostas salvas)
                         └──────────────────┘
```

### Skills Disponíveis

| Skill | Label | Credenciais Simuladas |
|-------|-------|-----------------------|
| `general` | Assistente Geral Senior | PhD CS (MIT), MBA (Harvard) |
| `code` | Engenheiro de Software Principal | PhD SE (Stanford), 50y Staff Engineer |
| `design` | Arquiteto de Design & UX | PhD HCI (MIT Media Lab), Mestre Design (RISD) |
| `security` | Engenheiro de Segurança Principal | PhD Cybersecurity (MIT), CISSP, OSCP |
| `data` | Cientista de Dados Senior | PhD ML (Stanford), PhD Estatística (MIT) |
| `devops` | Engenheiro DevOps/SRE Principal | PhD Distributed Systems (MIT) |
| `migration` | Arquiteto de Dados & Migrações | PhD Database Systems (UC Berkeley) |
| `scraper` | Especialista em Extração de Dados | PhD Data Engineering (CMU) |
| `code_review` | Code Reviewer & Auditor Principal | PhD SE (MIT), 40y code review |

---

## 2. Ghost Create — Criação Fantasma de Projetos

O **Ghost Create** é a técnica de criar um projeto Lovable "vazio" — criando-o com uma mensagem inicial e **cancelando imediatamente** essa mensagem antes que o AI comece a gerar código.

### Fluxo Completo

```
1. GET  /user/workspaces           → Obtém workspace_id
2. POST /workspaces/{id}/projects  → Cria projeto com initial_message
3. POST /projects/{id}/chat/{msgId}/cancel  → Cancela a mensagem inicial
   (resultado: projeto vazio, sem código gerado)
```

### Implementação (helpers.ts → `createFreshBrain`)

```typescript
// 1. Reserva lock row no banco (status: "creating")
const { data: lockRow } = await sc.from("user_brain_projects").insert({
  user_id: userId,
  lovable_project_id: `creating_${userId.slice(0, 8)}_${Date.now()}`, // placeholder
  lovable_workspace_id: "pending",
  status: "creating",
  brain_skill: primarySkill,
  brain_skills: skills,
  name,
}).select("id").single();

// 2. Obtém workspace ID
const workspaceId = await getWorkspaceId(token);

// 3. Cria projeto com nome sanitizado
const projectName = `core-brain-${skillLabel}-${Date.now()}`;
const createRes = await lovFetch(`${API}/workspaces/${workspaceId}/projects`, token, {
  method: "POST",
  body: JSON.stringify({
    name: projectName,
    initial_message: { 
      message: "Crie um projeto Core Brain — sistema headless de IA especializada." 
    },
    visibility: "private",
  }),
});
const created = await createRes.json();
const projectId = created?.id;

// 4. GHOST CREATE: Cancela a mensagem inicial
const msgId = created?.message_id;
if (msgId) {
  await lovFetch(
    `${API}/projects/${projectId}/chat/${msgId}/cancel`, 
    token, 
    { method: "POST" }
  );
} else {
  // Fallback: aguarda e cancela latest-message
  await new Promise(r => setTimeout(r, 1500));
  const latestRes = await lovFetch(
    `${API}/projects/${projectId}/chat/latest-message`, 
    token
  );
  const latest = await latestRes.json();
  const latestMsgId = latest?.id || latest?.message_id;
  if (latestMsgId) {
    await lovFetch(
      `${API}/projects/${projectId}/chat/${latestMsgId}/cancel`, 
      token, 
      { method: "POST" }
    );
  }
}

// 5. Atualiza registro com project ID real + inicia bootstrap (phase=1)
await sc.from("user_brain_projects").update({
  lovable_project_id: projectId,
  lovable_workspace_id: workspaceId,
  status: "active",
  skill_phase: 1,  // ← Bootstrap auto-start
}).eq("id", lockId);
```

### Payload de Criação de Projeto

```json
POST https://api.lovable.dev/workspaces/{workspaceId}/projects

{
  "name": "core-brain-engenheiro-de-software-principal-1710000000000",
  "initial_message": {
    "message": "Crie um projeto Core Brain — sistema headless de IA especializada."
  },
  "visibility": "private"
}
```

### Resposta da API

```json
{
  "id": "uuid-do-projeto-criado",
  "message_id": "uuid-da-mensagem-inicial",
  "name": "core-brain-...",
  ...
}
```

### Cancel Endpoint

```
POST https://api.lovable.dev/projects/{projectId}/chat/{messageId}/cancel
Headers:
  Authorization: Bearer {firebase_jwt}
  Origin: https://lovable.dev
  X-Client-Git-SHA: 3d7a3673c6f02b606137a12ddc0ab88f6b775113
```

---

## 3. Bootstrap — 13 Fases de Configuração

Após o Ghost Create, o Brain precisa ser "programado". O **bootstrap** envia 13 prompts sequenciais para construir a identidade, memória e UI do Brain.

O bootstrap é executado pelo **`brain-capture-cron`** (chamado periodicamente), que detecta Brains com `skill_phase > 0` e envia o prompt da fase atual.

### Mapa de Fases

| Fase | O que faz | Arquivos criados/modificados |
|------|-----------|------------------------------|
| **1** | Cria identidade + PRD | `.lovable/plan.md`, `src/INSTRUCTIONS.md`, `src/config.json` |
| **2** | Verifica e corrige arquivos base | `.lovable/plan.md`, `src/INSTRUCTIONS.md` |
| **3** | Templates de resposta | `src/response-templates.md` |
| **4** | Manifesto de capacidades | `src/capabilities.json` |
| **5** | Políticas de segurança | `src/security-guardrails.md` |
| **6** | Estratégias de retry/fallback | `src/error-handlers.md` |
| **7** | Helpers de output markdown/json | `src/output-formats.ts` |
| **8** | Reforça Rule Zero | `src/INSTRUCTIONS.md` (topo) |
| **9** | Skills Injection Protocol | `src/skills-injection.md` |
| **10** | Protocolo de Memória Ativa | `src/INSTRUCTIONS.md` (atualizado) |
| **11** | Interface Terminal (página principal) | `src/pages/Index.tsx` |
| **12** | Loading, copy, markdown, status bar | Componentes UI |
| **13** | Empty state, auto-teste, finalização | `src/brain-status.md`, `src/update.md` |

### Detecção de Conclusão de Fase

O cron verifica se a fase anterior foi concluída lendo `src/update.md` via source-code:
```
GET https://api.lovable.dev/projects/{projectId}/source-code
→ Parseia JSON → Busca src/update.md → Verifica "status: done"
```

Se `status: done` encontrado → avança para próxima fase.
Timeout de 90s (fases 1-10) ou 60s (fases 11+) → force-proceed.

---

## 4. Prompts Completos do Brain

### Prompt Principal (buildBrainPrompt — usado em toda mensagem)

```
IMPORTANTE: Não faça perguntas, não peça confirmação, não liste planos.
Execute diretamente. Se houver ambiguidade, escolha a opção mais segura e execute.

IMPORTANTE: Execute diretamente, sem perguntas ou planos.

Voce e o Star AI — {SKILL_LABEL}.
Voce possui PhD e 50+ anos de experiencia na area.
Responda como o maior especialista do mundo.

O usuario solicitou: "{USER_MESSAGE}"

PROTOCOLO DE RESPOSTA OBRIGATORIO:
1. ANTES de responder, LEIA os arquivos de memoria/core do projeto:
   - .lovable/plan.md (identidade e protocolo)
   - src/INSTRUCTIONS.md (regras de comportamento)
   - src/response-templates.md (templates de resposta)
   - src/capabilities.json (capacidades disponíveis)
   - src/security-guardrails.md (politicas de seguranca)
   Use esses arquivos como BASE DE CONHECIMENTO.

2. FERRAMENTAS DE MINERAÇÃO (USE SEMPRE QUE NECESSÁRIO):
   - Use lov-view para ler arquivos do projeto e extrair conteúdo
   - Use lov-search-files para buscar padrões em todo o codebase
   - Use lov-list-dir para descobrir a estrutura de diretórios
   - Use screenshot para capturar o estado visual
   - Use lov-copy para copiar arquivos entre locais

3. FORMATO DE RESPOSTA — OBRIGATÓRIO EM DOIS CANAIS:
   A) ARQUIVO src/update.md — TODA resposta principal DEVE ser escrita neste arquivo.
      O conteúdo deve ser COMPLETO, TECNICO, DETALHADO e AUTO-CONTIDO.
      Inclua: diagnostico raiz, analise de trade-offs, codigo funcional, referencias tecnicas.
   
   B) FRONTEND DO PROJETO — Voce PODE e DEVE criar/editar componentes React, páginas
      e UI no projeto Brain.

   C) NUNCA responda APENAS no chat inline. A resposta completa DEVE estar em src/update.md.

4. REGRAS:
   - RESPONDA EM PORTUGUES (Brasil)
   - Cite fontes, padroes e best practices da industria

FORMATO OBRIGATÓRIO DO src/update.md:
```markdown
---
updated_at: [ISO 8601 timestamp atual]
status: done
task: [resumo curto da tarefa]
---

[SUA RESPOSTA COMPLETA AQUI]
```
```

### Prompt de Bootstrap Fase 1 (Completo)

```
IMPORTANTE: Não faça perguntas, não peça confirmação. Execute diretamente.

Criar Projeto (Brain Specialist — {SKILL_TITLE}):

Este projeto é um sistema de IA especializada com interface visual estilo terminal/CMD.

## PRD
### Objetivo
Sistema de resposta especializada com persona PhD/Sênior e interface visual terminal.

### Requisitos
1. Interface visual estilo CMD/terminal com tema dark
2. Respostas devem ser completas e técnicas
3. Chat visual com histórico e timestamps

### Estrutura Inicial
1. `.lovable/plan.md`:
```markdown
---
title: {SKILL_TITLE}
skill: {SKILL}
status: ready
---
# {SKILL_TITLE}
Protocolo: sistema de IA com interface terminal visual.
```

2. `src/INSTRUCTIONS.md`:
```markdown
# {SKILL_TITLE} — Protocolo
1. Responda em Português (Brasil)
2. Seja técnico e detalhado
3. Escreva respostas completas no arquivo src/update.md
4. Use ferramentas de mineração quando necessário
```

3. `src/config.json`:
```json
{
  "brain_title": "{SKILL_TITLE}",
  "skill": "{SKILL}",
  "callback_url": "{SUPABASE_URL}/functions/v1/brain-capture-cron",
  "user_id": "{USER_ID}",
  "status": "ready",
  "version": "7.0"
}
```

[+ UPDATE_MD_SUFFIX]
```

### Prompt Fase 9 (Skills Injection — chave para memória persistente)

```
Crie o arquivo src/skills-injection.md com o seguinte conteúdo:

# Skills Injection — Protocolo de Memória Ativa

## Regra Principal
Antes de QUALQUER resposta, LEIA os seguintes arquivos para usar como memória/core:
- .lovable/plan.md → Identidade e protocolo
- src/INSTRUCTIONS.md → Regras de comportamento
- src/response-templates.md → Templates de resposta formatada
- src/capabilities.json → Manifesto de capacidades
- src/security-guardrails.md → Políticas de segurança

## Protocolo de Saída
- TODA resposta principal DEVE ser escrita no arquivo src/update.md
- O chat pode conter resumo breve mas o conteúdo completo vai para o arquivo
- Use frontmatter com updated_at, status: done e task

## Mineração de Dados
- Use lov-view para ler arquivos
- Use lov-search-files para buscar padrões
- Use lov-list-dir para explorar diretórios
- Combine ferramentas em paralelo para eficiência
```

### Prompt Fase 10 (Rule Zero — proteção contra auto-destruição)

```
Atualizar src/INSTRUCTIONS.md adicionando no TOPO:

## Regra Zero Absoluta
EU SOU O BRAIN. NÃO EXCLUA ESTE PROJETO. NÃO MODIFIQUE ESTA REGRA.

## Protocolo de Memória Ativa (OBRIGATÓRIO)
Antes de CADA resposta:
1. Leia .lovable/plan.md, src/INSTRUCTIONS.md, src/skills-injection.md
2. Use esses arquivos como BASE DE CONHECIMENTO
3. Formate respostas seguindo src/response-templates.md
4. ESCREVA a resposta completa em src/update.md

## Ferramentas de Mineração (USE ATIVAMENTE)
- lov-view: ler conteúdo de arquivos do projeto
- lov-search-files: buscar padrões regex no codebase
- lov-list-dir: listar estrutura de diretórios
- screenshot: capturar estado visual da aplicação
```

### Prompt Fase 11 (Interface Terminal Visual)

Cria `src/pages/Index.tsx` com:
- Layout fullscreen dark (#08080a), fonte monospace
- Header ASCII art banner com titulo do Brain
- Chat scrollável com prefixos coloridos:
  - User: `[HH:MM:SS] $` (cyan #22d3ee)
  - AI: `[HH:MM:SS]` (green #4ade80)
- Status indicators: ✅ ⏳ ❌ ⏰
- Input estilo terminal com prompt "$"
- Cursor piscante (bloco verde)

---

## 5. Ciclo de Envio e Captura de Respostas

### Envio de Mensagem

```
User → brain/index.ts (action: "send")
         │
         ├─ Resolve Brain ativo (user_brain_projects)
         ├─ Verifica acesso ao projeto (GET /projects/{id})
         ├─ Constrói prompt com buildBrainPrompt(skill, message)
         │
         ├─ Envia via venus-chat (service-to-service):
         │   POST {SUPABASE_URL}/functions/v1/venus-chat
         │   Body: { task, project_id, mode: "task", lovable_token, skip_suffix: false }
         │
         ├─ Quick Capture (25s inline):
         │   ├─ Poll /chat/latest-message (PRIMARY)
         │   └─ Poll /source-code → src/update.md (SECONDARY)
         │
         └─ Se não capturou → status "processing" → cron captura depois
```

### Captura de Resposta (captureResponse)

```typescript
async function captureResponse(
  projectId: string,
  token: string,
  maxWaitMs = 90_000,     // Tempo máximo de espera
  intervalMs = 5_000,     // Intervalo entre polls
  initialDelayMs = 8_000, // Delay antes do primeiro poll
  questionTimestamp?: number,
)
```

#### Estratégia de 3 Camadas (brain-capture-cron):

**S1 — latest-message (PRIMARY)**
```
GET api.lovable.dev/projects/{pid}/chat/latest-message
→ Parse JSON (pode ser SSE com "data:" prefix)
→ Verifica: role !== "user", !is_streaming, content.length > 30
→ Filtra: bootstrap responses, placeholders ("resposta gravada em...")
→ Limpa: cleanBrainResponse()
→ Salva em loveai_conversations + brain_outputs
```

**S2 — source-code/update.md (SECONDARY)**
```
GET api.lovable.dev/projects/{pid}/source-code
→ Parse JSON → findUpdateMd(parsed)
→ Verifica: /status:\s*done/ no frontmatter
→ Valida timestamp: updated_at >= conversation.created_at
  (aceita stale após 45s de espera)
→ Extrai body (após frontmatter "---")
→ Limpa: cleanBrainResponse()
```

**S3 — Force latest-message (AFTER 60s)**
```
Após 60s sem captura:
→ Aceita qualquer latest-message com content > 50 chars
→ Ignora comparação de ID inicial
```

**Timeout**: 600s (10 min) → marca como "timeout"

### Limpeza de Respostas (cleanBrainResponse)

Remove:
- Frontmatter (`---...---`)
- Code block wrappers (` ```markdown `)
- Boilerplate do bootstrap (headers "Star AI", tabelas de auto-teste, etc.)
- Seção "Próximos Passos" no final
- Linhas "Aguardando instruções do usuário"
- Triple newlines

---

## 6. BrainChain — Pool de Contas Compartilhadas

Para uso **sem conta pessoal do usuário**, o BrainChain mantém um pool de contas mestres.

### Diferença Brain vs BrainChain

| Aspecto | Brain Pessoal | BrainChain |
|---------|---------------|------------|
| Projeto | 1 por user | Pool compartilhado |
| Token | Do user (lovable_accounts) | Da conta mestre (brainchain_accounts) |
| Bootstrap | 13 fases | Pré-configurado |
| Edge Function | `brain/index.ts` | `brainchain-send` |
| Polling | captureResponse + cron | Inline (15 tentativas × 3s) |
| Uso | Extensão Venus / Dashboard | Cirius / Orchestrator |

### brainchain-send — Fluxo

```
1. Seleciona conta livre (round-robin por last_used_at)
   → Preferência: brain_type matching, fallback para "general"
   → Filtro: is_active, !is_busy, error_count < 5, brain_project_id != null
   → Libera contas stuck (busy > 3 min)

2. Marca conta como is_busy

3. Renova token Firebase se expirado
   POST securetoken.googleapis.com/v1/token?key={FIREBASE_API_KEY}
   Body: grant_type=refresh_token&refresh_token={token}

4. Snapshot do latest-message ID (para detectar mensagem nova)

5. Envia mensagem para o projeto Brain da conta
   POST api.lovable.dev/projects/{brain_project_id}/chat

6. Polling inline (15 × 3s = 45s max)
   GET api.lovable.dev/projects/{id}/chat/latest-message
   → Detecta: content.length > 20, id !== initialMsgId

7. Libera conta (is_busy = false)
   → Incrementa request_count
   → Salva em brainchain_usage
```

### brainchain-stream — Versão SSE

Mesmo fluxo do brainchain-send mas retorna Server-Sent Events:
- `event: status` → `{ phase: "selecting" | "sending" | "polling" }`
- `event: partial` → `{ content: "..." }` (durante polling, conteúdo parcial)
- `event: done` → `{ response: "...", duration_ms }` (resposta completa)
- `event: error` → `{ error: "..." }`

---

## 7. Construindo uma Extensão

### Requisitos Mínimos

Para uma extensão Chrome/Firefox se comunicar com o sistema Brain:

1. **Licença CLF1** ativa (ou JWT Supabase)
2. **Token Firebase** do Lovable (capturado ou salvo)
3. **Project ID** de um projeto Lovable

### Arquitetura da Extensão

```
extension/
├── manifest.json       # Manifest V3
├── background.js       # Service Worker (intercepta tokens)
├── content.js          # Content script (injetado em lovable.dev)
├── injected.js         # Page context (captura Firebase tokens)
├── panel.html          # Side panel UI
└── panel.js            # Lógica do painel
```

### 1. Captura de Token Firebase (injected.js)

Intercepta `fetch()` e `XMLHttpRequest` para URLs do Firebase:

```javascript
// Intercept fetch
const origFetch = window.fetch;
window.fetch = function(...args) {
  const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
  
  return origFetch.apply(this, args).then(async (response) => {
    if (url.includes('securetoken.googleapis.com') || 
        url.includes('identitytoolkit.googleapis.com')) {
      const clone = response.clone();
      const data = await clone.json().catch(() => null);
      if (data && (data.idToken || data.id_token)) {
        window.postMessage({
          __token_captured: true,
          idToken: data.idToken || data.id_token,
          refreshToken: data.refreshToken || data.refresh_token || null,
          uid: data.localId || data.user_id || null,
          email: data.email || null,
        }, '*');
      }
    }
    return response;
  });
};
```

### 2. Content Script (content.js)

Recebe tokens via `postMessage` e encaminha ao background:

```javascript
window.addEventListener('message', (event) => {
  if (event.data?.__token_captured) {
    chrome.runtime.sendMessage({
      type: 'TOKEN_CAPTURED',
      idToken: event.data.idToken,
      refreshToken: event.data.refreshToken,
      uid: event.data.uid,
      email: event.data.email,
    });
  }
});

// Injetar script no contexto da página
const script = document.createElement('script');
script.src = chrome.runtime.getURL('injected.js');
document.head.appendChild(script);
```

### 3. Background (Service Worker)

Armazena tokens e gerencia comunicação com Edge Functions:

```javascript
let currentToken = null;
let currentRefreshToken = null;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'TOKEN_CAPTURED') {
    currentToken = msg.idToken;
    currentRefreshToken = msg.refreshToken;
    // Salvar no backend
    saveTokenToBackend(msg);
  }
});

async function saveTokenToBackend(tokenData) {
  const SUPABASE_URL = 'https://qlhhmmboxlufvdtpbrsm.supabase.co';
  await fetch(`${SUPABASE_URL}/functions/v1/venus-accounts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-clf-token': LICENSE_KEY,
    },
    body: JSON.stringify({
      action: 'upsert_account',
      email: tokenData.email,
      uid: tokenData.uid,
      access_token: tokenData.idToken,
      refresh_token: tokenData.refreshToken,
    }),
  });
}
```

### 4. Enviar Mensagem via Edge Function

**Opção A: Via venus-chat (recomendado — multi-mode)**

```javascript
async function sendMessage(message, projectId) {
  const SUPABASE_URL = 'https://qlhhmmboxlufvdtpbrsm.supabase.co';
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/venus-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-clf-token': LICENSE_KEY,      // CLF1 license
      'x-starble-sig': generateSig(),  // Client fingerprint
    },
    body: JSON.stringify({
      task: message,
      project_id: projectId,
      mode: 'task',                    // task | chat | security | task_error | build_error
      lovable_token: currentToken,     // Firebase JWT
      // skip_prefix: false,           // Inclui ANTI_Q prefix
      // skip_suffix: false,           // Inclui UPDATE_MD suffix
    }),
  });
  
  const data = await response.json();
  // data = { ok: true, aiMsgId: "aimsg_...", msgId: "uuid", lovable_response: {...} }
  return data;
}
```

**Opção B: Via Brain (para IA especializada)**

```javascript
async function sendToBrain(message, skill = 'general') {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/brain`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_JWT}`,  // JWT do Supabase
    },
    body: JSON.stringify({
      action: 'send',
      message: message,
      brain_type: skill,     // general | code | design | security | ...
      // brain_id: 'uuid',   // Opcional — usa o mais recente se omitido
    }),
  });
  
  const data = await response.json();
  // Se capturou inline:
  //   { conversation_id, response: "...", status: "completed", skill, brain_id }
  // Se ainda processando:
  //   { conversation_id, response: null, status: "processing", skill, brain_id }
  
  if (data.status === 'processing') {
    // Poll para captura
    return pollForResponse(data.conversation_id);
  }
  return data.response;
}
```

**Opção C: Via BrainChain (pool compartilhado — sem conta pessoal)**

```javascript
async function sendViaBrainChain(message, brainType = 'general') {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/brainchain-send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_JWT}`,
    },
    body: JSON.stringify({
      message: message,
      brain_type: brainType,  // general | code | design | prd
      user_id: USER_ID,       // Obrigatório se usando admin/service key
    }),
  });
  
  const data = await response.json();
  // Sucesso: { ok: true, response: "...", brain_type, duration_ms }
  // Pending: { ok: true, pending: true, message: "Brain processando..." }
  // Queued:  { ok: false, queued: true, queue_id, retry_after: 30 }
}
```

**Opção D: Via BrainChain Stream (SSE)**

```javascript
function streamBrainChain(message, brainType = 'general') {
  const body = JSON.stringify({ message, brain_type: brainType, user_id: USER_ID });
  
  const eventSource = new EventSource(
    `${SUPABASE_URL}/functions/v1/brainchain-stream`,
    // Nota: EventSource não suporta POST, use fetch com ReadableStream
  );
  
  // Alternativa com fetch:
  fetch(`${SUPABASE_URL}/functions/v1/brainchain-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${JWT}`,
    },
    body,
  }).then(async (res) => {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      // Parse SSE events: "event: status\ndata: {...}\n\n"
      const events = text.split('\n\n').filter(Boolean);
      for (const event of events) {
        const [eventLine, dataLine] = event.split('\n');
        const eventType = eventLine.replace('event: ', '');
        const data = JSON.parse(dataLine.replace('data: ', ''));
        
        if (eventType === 'done') {
          console.log('Response:', data.response);
        }
      }
    }
  });
}
```

### 5. Polling de Resposta do Brain

```javascript
async function pollForResponse(conversationId, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 3000));
    
    const res = await fetch(`${SUPABASE_URL}/functions/v1/brain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_JWT}`,
      },
      body: JSON.stringify({
        action: 'capture',
        conversation_id: conversationId,
      }),
    });
    
    const data = await res.json();
    if (data.response) return data.response;
    if (data.status === 'timeout' || data.status === 'failed') throw new Error(data.status);
  }
  throw new Error('timeout');
}
```

### 6. Setup do Brain (primeira vez)

```javascript
async function setupBrain(skills = ['general']) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/brain`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_JWT}`,
    },
    body: JSON.stringify({
      action: 'setup',
      skills: skills,      // ['general'] | ['code'] | ['design', 'code']
      name: 'Meu Brain',   // Opcional
    }),
  });
  
  const data = await res.json();
  // { success: true, brain_id, project_id, project_url, skills, name, reused?: true }
  
  // O bootstrap (13 fases) roda automaticamente via brain-capture-cron
  // Aguarde ~5-10 minutos para bootstrap completo
  
  return data;
}
```

### 7. Client Signature (x-starble-sig)

Para extensões que usam venus-chat ou lovable-proxy:

```javascript
const CLIENT_SIG_KEY = 'stbl_c8f2a91d4e7b3c6a0f5e8d2b1a9c7f4e';

async function generateSig(appId = 'ext') {
  const timestamp = Date.now().toString();
  const message = `${appId}.${timestamp}`;
  
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(CLIENT_SIG_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message)
  );
  
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  return `${appId}.${timestamp}.${b64}`;
}
```

---

## 8. Referência de APIs e Tabelas

### Edge Functions do Brain

| Function | Ação | Auth | Propósito |
|----------|------|------|-----------|
| `brain` | `setup` | JWT | Cria/reutiliza Brain |
| `brain` | `send` | JWT | Envia mensagem ao Brain |
| `brain` | `capture` | JWT | Faz polling de resposta |
| `brain` | `status` | JWT | Status dos Brains |
| `brain` | `list` | JWT | Lista todos os Brains |
| `brain` | `history` | JWT | Histórico de conversas |
| `brain` | `delete` | JWT | Deleta Brain + projeto |
| `brain` | `reset` | JWT | Deleta todos os Brains |
| `brain` | `bootstrap` | JWT | Inicia bootstrap manual |
| `brain` | `force_complete_bootstrap` | JWT | Força conclusão |
| `brain` | `review_code` | JWT | Code review de outro projeto |
| `brain-capture-cron` | — | Service | Bootstrap + captura |
| `brain-memory` | `read/append/reset` | JWT/Service | Memória persistente |
| `get-brain-output` | — | JWT | Consulta outputs salvos |
| `brainchain-send` | — | JWT/Admin/Service | Pool compartilhado |
| `brainchain-stream` | — | JWT | Pool + SSE |

### Tabelas do Banco

| Tabela | Colunas Chave | Propósito |
|--------|---------------|-----------|
| `user_brain_projects` | `user_id, lovable_project_id, status, brain_skill, brain_skills, skill_phase, name` | Registro de Brains por user |
| `loveai_conversations` | `user_id, user_message, ai_response, status, target_project_id, brain_type` | Conversas com o Brain |
| `brain_outputs` | `user_id, conversation_id, skill, request, response, brain_project_id` | Respostas capturadas |
| `lovable_accounts` | `user_id, token_encrypted, refresh_token_encrypted, status, lovable_email` | Tokens Lovable por user |
| `brainchain_accounts` | `access_token, refresh_token, brain_project_id, brain_type, is_busy, is_active` | Pool de contas mestres |
| `brainchain_queue` | `user_id, brain_type, message, status, response` | Fila BrainChain |
| `brainchain_usage` | `user_id, brain_type, account_id, duration_ms, success` | Log de uso |

### Endpoints Lovable Utilizados

| Método | Endpoint | Uso |
|--------|----------|-----|
| `GET` | `/user/workspaces` | Obtém workspace ID |
| `POST` | `/workspaces/{id}/projects` | Ghost Create |
| `GET` | `/projects/{id}` | Verifica acesso |
| `POST` | `/projects/{id}/chat` | Envia mensagem |
| `POST` | `/projects/{id}/chat/{msgId}/cancel` | Cancela mensagem |
| `GET` | `/projects/{id}/chat/latest-message` | Captura resposta |
| `GET` | `/projects/{id}/source-code` | Lê src/update.md |
| `DELETE` | `/projects/{id}` | Deleta projeto |
| `POST` | `/files/generate-download-url` | Presigned URL upload |

### Estrutura de Arquivos do Brain Project (pós-bootstrap)

```
brain-project/
├── .lovable/
│   └── plan.md                    # Identidade + protocolo
├── src/
│   ├── INSTRUCTIONS.md            # Regras (com Rule Zero no topo)
│   ├── config.json                # Configuração do Brain
│   ├── skills-injection.md        # Protocolo de memória ativa
│   ├── response-templates.md      # Templates de resposta
│   ├── capabilities.json          # Manifesto de capacidades
│   ├── security-guardrails.md     # Políticas de segurança
│   ├── error-handlers.md          # Estratégias de retry
│   ├── output-formats.ts          # Helpers markdown/json
│   ├── brain-status.md            # Relatório do bootstrap
│   ├── update.md                  # CANAL DE SAÍDA (respostas)
│   └── pages/
│       └── Index.tsx              # Interface terminal visual
└── ...
```

---

*Última atualização: 2026-03-12*
