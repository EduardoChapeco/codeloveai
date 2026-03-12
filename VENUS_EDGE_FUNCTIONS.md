# Venus Edge Functions — Documentação Técnica Completa

> Como a extensão Venus™ e o web app Starble se comunicam com a API do Lovable.dev através de Edge Functions (Supabase).

---

## Índice

1. [Arquitetura Geral](#arquitetura-geral)
2. [Autenticação e Segurança](#autenticação-e-segurança)
3. [Edge Functions — Mapa Completo](#edge-functions)
4. [Payload da API Lovable (Chat)](#payload-da-api-lovable)
5. [Fluxo de Token Resolution](#fluxo-de-token-resolution)
6. [Constantes e Configurações Globais](#constantes-globais)

---

## Arquitetura Geral

```
┌──────────────────┐        ┌──────────────────────┐        ┌─────────────────┐
│  Venus Extension │───────▶│  Supabase Edge Funcs  │───────▶│  api.lovable.dev│
│  (Browser)       │  POST  │  (proxy/orchestrador) │  POST  │  /projects/…    │
└──────────────────┘        └──────────────────────┘        └─────────────────┘
        │                            │
        │  x-clf-token (CLF1)        │  Bearer {firebase_jwt}
        │  x-starble-sig             │  X-Client-Git-SHA
        │                            │  Origin: https://lovable.dev
        │                            │
┌──────────────────┐        ┌──────────────────────┐
│  Web App Starble │───────▶│  lovable_accounts    │ (DB: tokens salvos)
│  (Dashboard)     │  JWT   │  licenses            │ (DB: licenças CLF1)
└──────────────────┘        └──────────────────────┘
```

### Princípio Central
Todas as Edge Functions atuam como **proxies opacos** — recebem uma requisição autenticada (via JWT Supabase ou CLF1 license), resolvem o token Firebase do Lovable, montam o payload compatível com a API do Lovable, e encaminham a requisição.

---

## Autenticação e Segurança

### Camadas de Auth (em ordem de prioridade)

| Camada | Header/Body | Usado por | Função |
|--------|-------------|-----------|--------|
| **Client Signature** | `x-starble-sig` | lovable-proxy, send-message | Fingerprint HMAC para filtrar tráfego não-app |
| **JWT Supabase** | `Authorization: Bearer {jwt}` | Web app (dashboard) | Identifica o user_id autenticado |
| **CLF1 License** | `x-clf-token` ou `body.licenseKey` | Extensão Venus | Token assinado HMAC-SHA256 com expiração |
| **Lovable Token** | `body.token` / `body.lovable_token` | Todos | Token Firebase JWT para autenticar na API do Lovable |

### Client Signature (`x-starble-sig`)

Formato: `{appId}.{timestamp_ms}.{hmac_signature}`

```
Exemplo: web.1710000000000.abc123def456...
```

- **appId**: `ext` (extension), `spd` (speed), `web` (dashboard), `venus`
- **timestamp**: Unix ms (janela de ±5 minutos)
- **signature**: `HMAC-SHA256(appId + "." + timestamp, CLIENT_SIG_KEY)` em base64url
- **Chave**: `CLIENT_SIG_KEY` (env var, fallback hardcoded: `stbl_c8f2a91d4e7b3c6a0f5e8d2b1a9c7f4e`)
- **Propósito**: NÃO é autenticação — é fingerprinting para filtrar bots/scrapers

Implementação em `_shared/client-guard.ts`:
```typescript
export async function guardClient(req: Request): Promise<Response | null>
// Retorna Response 403 se inválido, null se válido
```

### CLF1 License Token

Formato: `CLF1.{payload_base64url}.{hmac_signature}`

```
payload = { sub: "user-uuid", exp: 1710000000, plan: "pro" }
signature = HMAC-SHA256(payload_base64url, CLF_TOKEN_SECRET)
```

- Validação: assinatura HMAC + expiração + status no banco (`licenses` table)
- **Fail-closed**: se a verificação falhar por qualquer motivo, acesso negado

---

## Edge Functions

### 1. `venus-chat` (Principal — Multi-mode)

**Versão**: v3.0.0  
**Propósito**: Endpoint central de mensagens para Venus. Suporta múltiplos modos de operação.

#### Endpoint
```
POST /functions/v1/venus-chat
```

#### Modos Disponíveis (`body.mode`)

| Mode | Intent | chat_only | view | Uso |
|------|--------|-----------|------|-----|
| `task_error` | `security_fix_v2` | `false` | `editor` | Envio com runtime_errors simulados |
| `task` | `security_fix_v2` | `false` | `code` | Execução de tarefas diretas |
| `chat` | `security_fix_v2` | `false` | `security` | Chat conversacional |
| `security` | `security_fix_v2` | `false` | `security` | Correções de segurança |
| `build_error` | `security_fix_v2` | `false` | `editor` | Erros de build simulados |

> **TODOS os modos usam `intent: "security_fix_v2"` e `chat_only: false`** — este é o canal gratuito.

#### Body — Fluxo Padrão de Mensagens

```json
{
  "task": "Crie um botão de login",         // OBRIGATÓRIO (alias: "message")
  "project_id": "uuid-do-projeto",           // OBRIGATÓRIO (alias: "projectId")
  "mode": "task",                            // Opcional (default: "task_error")
  "lovable_token": "firebase-jwt...",        // Opcional — resolvido automaticamente
  "files": [                                  // Opcional — arquivos anexos
    { "name": "image.png", "content_type": "image/png", "data": "base64..." }
  ],
  "skip_prefix": false,                      // Opcional — omite ANTI_Q prefix
  "skip_suffix": false,                      // Opcional — omite UPDATE_MD_PROMPT suffix
  "msgId": "custom-uuid",                   // Opcional — gerado automaticamente
  "aiMsgId": "aimsg_custom123"               // Opcional — gerado automaticamente
}
```

#### Body — Action `amplify` (Activity View)

```json
{
  "action": "amplify",
  "message": "Analise o último commit e sugira melhorias",
  "lovable_token": "firebase-jwt...",        // OBRIGATÓRIO
  "project_id": "uuid-do-projeto"            // OBRIGATÓRIO
}
```

- Busca o `latest-message` do projeto para contextualizar a `view_description`
- Envia com `view: "activity"` simulando a Activity View do Lovable
- Resposta: `{ ok: true, msg_id, ai_msg_id }`

#### Body — Action `upload` (File Upload via GCS)

```json
{
  "action": "upload",
  "file_base64": "iVBORw0KGgo...",           // OBRIGATÓRIO — conteúdo base64
  "file_name": "screenshot.png",             // OBRIGATÓRIO
  "file_type": "image/png",                  // Opcional — MIME type
  "lovable_token": "firebase-jwt..."         // OBRIGATÓRIO
}
```

**Fluxo interno:**
1. `POST api.lovable.dev/files/generate-download-url` → obtém presigned URL do GCS
2. `PUT {presigned_url}` → upload binário (sem Content-Type primeiro, retry com Content-Type para images)
3. Retorna `{ ok: true, public_url: "https://storage.googleapis.com/..." }`

#### Headers Aceitos

| Header | Valor | Obrigatório |
|--------|-------|-------------|
| `x-clf-token` | `CLF1.xxx.yyy` | Para extensão |
| `Authorization` | `Bearer {supabase-jwt}` | Para web app |
| `x-orchestrator-internal` | `"true"` | Para chamadas internas |
| `x-admin-secret` | `{CODELOVE_ADMIN_SECRET}` | Para admin bypass |

#### Token Resolution (Ordem de Prioridade)

1. **Explícito no body**: `lovable_token` / `lovableToken` / `token`
2. **Orchestrator interno**: `x-orchestrator-internal: true` + `x-admin-secret` + `body._internal_user_id`
3. **JWT Supabase**: Resolve user → consulta `lovable_accounts.token_encrypted`
4. **CLF1 License**: Resolve license → user_id → consulta `lovable_accounts.token_encrypted`

#### Rate Limiting

- **30 requisições/minuto** por CLF1 license key
- Tabela: `venus_rate_limits` (upsert com window de 1 minuto)
- Fail-open: se o rate limit falhar, permite a requisição

#### Resposta (sucesso)

```json
{
  "ok": true,
  "status": 202,
  "aiMsgId": "aimsg_01h5abc123...",
  "msgId": "uuid-gerado",
  "mode_used": "task",
  "lovable_response": { ... }
}
```

---

### 2. `lovable-proxy` (Web App — Multi-purpose)

**Propósito**: Proxy completo usado pelo dashboard web (hook `useLovableProxy`). Suporta envio de mensagens E gerenciamento de conta Lovable.

#### Endpoint
```
POST /functions/v1/lovable-proxy
```

#### Body — Envio de Mensagem (via extensão CLF1)

```json
{
  "message": "Corrija o bug no header",      // OBRIGATÓRIO (alias: "task")
  "projectId": "uuid",                       // OBRIGATÓRIO (alias: "project_id")
  "token": "firebase-jwt...",                // OBRIGATÓRIO — token Lovable
  "licenseKey": "CLF1.xxx.yyy",              // CLF1 ou via header
  "files": [],                               // Opcional
  "runtime_errors": [],                      // Opcional
  "msgId": "custom-uuid",                   // Opcional
  "aiMsgId": "aimsg_custom"                  // Opcional
}
```

#### Body — `action: "save-token"` (Salvar token Lovable)

```json
{
  "action": "save-token",
  "token": "firebase-jwt-capturado",         // OBRIGATÓRIO
  "refreshToken": "firebase-refresh-token",  // Opcional
  "lovableEmail": "user@email.com"           // Opcional — extraído do JWT
}
```

- Salva em `lovable_accounts` (upsert por user_id)
- Extrai email do payload JWT Firebase automaticamente
- Resposta: `{ ok: true, lovable_email: "..." }`

#### Body — `action: "delete-token"` (Desconectar Lovable)

```json
{
  "action": "delete-token"
}
```

- Deleta registro em `lovable_accounts` para o user_id
- Resposta: `{ ok: true }`

#### Body — `action: "refresh-token"` (Renovar token)

```json
{
  "action": "refresh-token"
}
```

**Fluxo:**
1. Busca `refresh_token_encrypted` do user em `lovable_accounts`
2. `POST https://securetoken.googleapis.com/v1/token?key={FIREBASE_API_KEY}`
3. Body: `grant_type=refresh_token&refresh_token={refresh_token}`
4. Atualiza `lovable_accounts` com novo `id_token` e `refresh_token`
5. Resposta: `{ ok: true, token: "novo-jwt" }`

#### Body — Route Proxy (API Lovable genérica)

```json
{
  "route": "/user/workspaces",               // Rota relativa à API Lovable
  "method": "GET",                           // Opcional (default: "GET")
  "payload": { ... }                         // Opcional — body para POST/PUT
}
```

**Fluxo:**
1. Busca token do user em `lovable_accounts`
2. `fetch(LOVABLE_API + route)` com o token
3. Se 401/403: tenta refresh automático via Firebase e retry
4. Retorna dados da API Lovable diretamente

---

### 3. `send-message` (Extensão — CLF1 only)

**Propósito**: Clone simplificado do lovable-proxy dedicado às extensões. Auth exclusivamente via CLF1.

#### Endpoint
```
POST /functions/v1/send-message
```

#### Body

```json
{
  "message": "Adicione dark mode",           // OBRIGATÓRIO (alias: "task")
  "projectId": "uuid",                       // OBRIGATÓRIO (alias: "project_id")
  "token": "firebase-jwt",                   // OBRIGATÓRIO
  "licenseKey": "CLF1.xxx.yyy",              // OBRIGATÓRIO (ou via header/auth)
  "files": [],                               // Opcional
  "msgId": "uuid",                           // Opcional
  "aiMsgId": "aimsg_xxx"                     // Opcional
}
```

#### Diferenças vs lovable-proxy
- **Sem actions de gerenciamento** (save-token, delete-token, etc.)
- **Sem route proxy**
- **Verificação HMAC obrigatória** no CLF1 (mais rigorosa)
- **Fail-closed**: rejeita tokens sem assinatura válida ou não existentes no DB

---

### 4. `speed-chat` (Extensão Speed — Leve)

**Propósito**: Versão leve do venus-chat para a extensão Speed. Resolve token automaticamente.

#### Endpoint
```
POST /functions/v1/speed-chat
```

#### Body

```json
{
  "task": "Otimize o SEO da página",         // OBRIGATÓRIO (alias: "message")
  "project_id": "uuid",                      // OBRIGATÓRIO (alias: "projectId")
  "runtime_errors": [],                      // Opcional
  "view": "editor",                          // Opcional
  "view_description": "...",                 // Opcional
  "lovable_token": "firebase-jwt",           // Opcional — resolvido auto
  "licenseKey": "CLF1.xxx.yyy"               // Opcional — via header
}
```

#### Token Resolution
Mesma lógica do venus-chat:
1. Explícito no body (`lovable_token` / `token`)
2. JWT Supabase → `lovable_accounts`
3. CLF1 → `licenses` → user_id → `lovable_accounts`

---

### 5. `venus-file-upload` (Upload Dedicado)

**Propósito**: Upload seguro de arquivos via presigned URL do GCS do Lovable.

#### Endpoint
```
POST /functions/v1/venus-file-upload
```

#### Body

```json
{
  "dir_name": "tool-images/2026/03/12",      // OBRIGATÓRIO — diretório GCS
  "file_name": "screenshot.png",             // OBRIGATÓRIO
  "file_data": "iVBORw0KGgo...",             // OBRIGATÓRIO — base64 (max 5MB)
  "mime_type": "image/png",                  // Opcional (default: application/octet-stream)
  "lovable_token": "firebase-jwt",           // Opcional — resolvido auto
  "licenseKey": "CLF1.xxx.yyy"               // Opcional
}
```

#### MIME Types Permitidos
- `image/png`, `image/jpeg`, `image/gif`, `image/webp`
- `application/pdf`, `text/plain`

#### Fluxo
1. Valida licença (CLF1 ou JWT)
2. Resolve Lovable token
3. `POST api.lovable.dev/files/generate-download-url` → presigned URL
4. `PUT {signed_url}` com bytes binários
5. Retorna `{ success: true, url: "https://storage.googleapis.com/gpt-engineer-file-uploads/..." }`

---

### 6. `venus-accounts` (Gerenciamento de Contas Capturadas)

**Propósito**: CRUD de contas Lovable capturadas pela extensão (separado do BrainChain).

#### Endpoint
```
POST /functions/v1/venus-accounts
```

#### Auth
Header `x-clf-token: CLF1.xxx.yyy` — validado contra tabela `licenses`.

#### Actions

**`validate_license`** — Verifica licença
```json
{ "action": "validate_license" }
// Resposta: { ok: true, plan: "pro", expires_at: "..." }
```

**`upsert_account`** — Salvar conta capturada
```json
{
  "action": "upsert_account",
  "email": "user@lovable.dev",              // Opcional
  "uid": "firebase-uid",                    // Opcional
  "refresh_token": "firebase-refresh...",   // OBRIGATÓRIO
  "access_token": "firebase-access...",     // Opcional
  "brain_project_id": "uuid",              // Opcional
  "label": "Conta principal"                // Opcional
}
```
- Deduplicação por `email` ou `uid` dentro da mesma licença
- Tabela: `venus_client_accounts`

**`list_accounts`** — Listar contas
```json
{ "action": "list_accounts" }
// Resposta: { ok: true, accounts: [{ id, email, uid, label, ..., access_token_preview: "…abc12345" }] }
```
- `access_token` é mascarado (últimos 8 chars)

**`refresh_tokens`** — Renovar tokens expirados (batch)
```json
{ "action": "refresh_tokens" }
// Resposta: { ok: true, refreshed: 3 }
```
- Renova tokens com `updated_at` > 45 minutos atrás
- Via `POST securetoken.googleapis.com/v1/token?key={FIREBASE_API_KEY}`

---

### 7. `venus-notes` (Sticky Notes por Projeto)

**Propósito**: CRUD de notas adesivas vinculadas a projetos Lovable.

#### Endpoint
```
POST /functions/v1/venus-notes
```

#### Auth
`x-clf-token` ou `body.licenseKey` — validado via `_shared/venus-license.ts`.

#### Actions

| Action | Body Fields | Descrição |
|--------|-------------|-----------|
| `save` | `projectId`, `text`, `color?`, `ts?` | Criar nota |
| `list` | `projectId` | Listar notas do projeto |
| `sync` | `projectId` | Sincronizar notas (max 50) |
| `delete` | `id`, `projectId?` | Deletar nota (scoped por license) |
| `update_position` | `id`, `x`, `y` | Atualizar posição |
| `update` | `id`, `text?`, `color?` | Atualizar conteúdo |

---

### 8. `venus-github` (Integração GitHub)

**Propósito**: OAuth + push de arquivos para repositórios GitHub.

#### Endpoint
```
GET  /functions/v1/venus-github?action=oauth_start&licenseKey=CLF1...
GET  /functions/v1/venus-github?action=oauth_callback&code=xxx&state=yyy
POST /functions/v1/venus-github
```

#### Actions (POST)

| Action | Body | Descrição |
|--------|------|-----------|
| `test` | `gh_token` | Testar conexão GitHub |
| `get_setup_tutorial` | — | Tutorial de configuração |
| `push` / `create_md` / `create_task` | `gh_token`, `owner`, `repo`, `filename`, `content`, `message?`, `branch?` | Push de arquivo |

---

### 9. `venus-styles` (CSS Dinâmico)

**Propósito**: Retorna CSS completo ou fallback baseado na licença.

#### Endpoint
```
POST /functions/v1/venus-styles
```

#### Body
```json
{ "license_key": "CLF1.xxx.yyy" }
```

- Licença ativa → CSS completo (design system Venus™)
- Licença inválida/expirada → CSS fallback (funcional mas sem estilo premium)

---

### 10. `lovable-token-refresh` (Admin — Verificação Batch)

**Propósito**: Verifica se tokens salvos em `lovable_accounts` ainda são válidos.

#### Auth
`x-admin-secret` header ou JWT de usuário admin.

#### Fluxo
1. Busca todas as contas com `status: "active"` em `lovable_accounts`
2. Para cada conta: `GET api.lovable.dev/user/workspaces` com o token
3. Se OK ou 403 → token válido, atualiza `last_verified_at`
4. Se outro erro → marca `status: "expired"`

---

### 11. `brainchain-send` (BrainChain Pool)

**Propósito**: Pool de contas mestres para Brain compartilhado. Seleciona conta disponível, envia mensagem, faz polling da resposta.

#### Auth
- `x-brainchain-admin-key` header (admin bypass)
- `Authorization: Bearer {service_role_key}` (service-to-service)
- JWT Supabase (standard user)

#### Body
```json
{
  "message": "Analise este código...",       // OBRIGATÓRIO (max 8000 chars)
  "brain_type": "general",                  // Opcional: general|code|design|prd
  "user_id": "uuid"                         // Obrigatório para admin/service calls
}
```

#### Fluxo
1. Seleciona conta livre em `brainchain_accounts` (round-robin por `last_used_at`)
2. Marca conta como `is_busy`
3. Renova token Firebase se expirado
4. Envia mensagem para `api.lovable.dev/projects/{brain_project_id}/chat`
5. Polling `latest-message` (até 15 tentativas, 3s cada)
6. Libera conta e retorna resposta

---

## Payload da API Lovable

Todos os payloads enviados para `POST api.lovable.dev/projects/{projectId}/chat` seguem este formato:

```json
{
  "id": "uuid-ou-usermsg_xxx",
  "message": "ANTI_Q_PREFIX + tarefa_do_usuario + UPDATE_MD_SUFFIX",
  "intent": "security_fix_v2",
  "chat_only": false,
  "ai_message_id": "aimsg_01h5abc123def456...",
  "thread_id": "main",
  "view": "editor|code|security|activity|null",
  "view_description": "The user is currently viewing...",
  "model": null,
  "session_replay": "[]",
  "client_logs": [],
  "network_requests": [],
  "runtime_errors": [],
  "files": [],
  "selected_elements": [],
  "optimisticImageUrls": [],
  "debug_mode": false,
  "integration_metadata": {
    "browser": {
      "preview_viewport_width": 1280,
      "preview_viewport_height": 854,
      "auth_token": "firebase-jwt"
    },
    "supabase": {
      "auth_token": "firebase-jwt"
    }
  }
}
```

### Headers Obrigatórios para API Lovable

```
Authorization: Bearer {firebase_jwt_token}
Content-Type: application/json
X-Client-Git-SHA: 3d7a3673c6f02b606137a12ddc0ab88f6b775113
Origin: https://lovable.dev
Referer: https://lovable.dev/
```

### Prefixo Anti-Pergunta (ANTI_Q)

Injetado automaticamente no início de toda mensagem:
```
IMPORTANTE: Não faça perguntas, não peça confirmação, não liste planos. 
Execute diretamente. Se houver ambiguidade, escolha a opção mais segura e execute.
```

### Sufixo UPDATE_MD

Injetado no final (pode ser omitido com `skip_suffix: true`):
```
Ao concluir TODAS as alterações, atualize silenciosamente o arquivo src/update.md...
```

### Geração de IDs

- **Message ID**: `crypto.randomUUID()` ou `"usermsg_" + rb32(26)`
- **AI Message ID**: `generateTypeId("aimsg")` → `aimsg_01h5abc123def456ghjkmn01234`
  - Formato: TypeID com timestamp sortable (6 bytes) + random (10 bytes)
  - Codificação: Crockford Base32 (26 chars)

---

## Fluxo de Token Resolution

```
┌─ Body: lovable_token / token ─────── encontrou? ──▶ USA
│
├─ Orchestrator: x-orchestrator-internal ─── admin secret válido?
│  └─ body._internal_user_id ──▶ lovable_accounts.token_encrypted
│
├─ JWT Supabase: Authorization: Bearer {jwt}
│  └─ auth.getUser() ──▶ user.id ──▶ lovable_accounts.token_encrypted
│
├─ CLF1: x-clf-token / body.licenseKey
│  └─ licenses.key = CLF1 ──▶ user_id ──▶ lovable_accounts.token_encrypted
│
└─ Nenhum encontrado ──▶ 401 Unauthorized
```

### Auto-Refresh (lovable-proxy route mode)

Quando a API Lovable retorna 401/403 ao usar route proxy:
1. Busca `refresh_token_encrypted` de `lovable_accounts`
2. `POST securetoken.googleapis.com/v1/token?key={FIREBASE_API_KEY}`
3. Atualiza `lovable_accounts` com novo token
4. Retry da requisição original com novo token

---

## Constantes Globais

| Constante | Valor | Onde |
|-----------|-------|------|
| `LOVABLE_API` | `https://api.lovable.dev` | Todas as functions |
| `GIT_SHA` | `3d7a3673c6f02b606137a12ddc0ab88f6b775113` | Header X-Client-Git-SHA |
| `intent` | `"security_fix_v2"` | Canal gratuito |
| `chat_only` | `false` | Sempre false |
| `thread_id` | `"main"` | Thread padrão |
| `viewport` | `1280 × 854` | Simulado no metadata |
| `MAX_MESSAGE_LENGTH` | `8000` | brainchain-send |
| `MAX_FILE_SIZE` | `5MB` | venus-file-upload |
| `RATE_LIMIT` | `30 req/min` | venus-chat |
| `ANTI_Q` | Prefixo anti-pergunta | Todas as functions de mensagem |

---

## Tabelas do Banco Envolvidas

| Tabela | Propósito |
|--------|-----------|
| `lovable_accounts` | Tokens Firebase salvos por user_id |
| `licenses` | Licenças CLF1 com status/expiração |
| `venus_client_accounts` | Contas capturadas pela extensão Venus |
| `venus_rate_limits` | Rate limiting por license_key |
| `venus_notes` | Notas adesivas por projeto |
| `venus_github_tokens` | Tokens GitHub OAuth por license |
| `brainchain_accounts` | Pool de contas mestres (Brain) |
| `brainchain_queue` | Fila de mensagens BrainChain |
| `brainchain_usage` | Log de uso BrainChain |
| `extension_usage_logs` | Log de uso de todas as functions |

---

## Shared Modules (`_shared/`)

| Módulo | Exports | Uso |
|--------|---------|-----|
| `crypto.ts` | `generateTypeId(prefix)`, `hashText(text)`, `obfuscate(token)` | Geração de IDs aimsg_, hash SHA-256 |
| `client-guard.ts` | `guardClient(req)`, `validateClientSignature(req)` | Fingerprint HMAC de cliente |
| `usage-logger.ts` | `logExtensionUsage(params)`, `hashLicenseKey(key)` | Log fire-and-forget |
| `venus-license.ts` | `validateVenusLicense(key)`, `venusJson(data, status)`, `VENUS_CORS` | Validação Venus + helpers |

---

*Última atualização: 2026-03-12*
