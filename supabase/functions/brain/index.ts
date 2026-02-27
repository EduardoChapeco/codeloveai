import { createClient } from "npm:@supabase/supabase-js@2";
import { generateTypeId, obfuscate } from "../_shared/crypto.ts";

type SupabaseClient = any;
type BrainSkill = "general" | "design" | "code" | "scraper" | "migration" | "data" | "devops" | "security";

const API = "https://api.lovable.dev";
const GIT_SHA = "3d7a3673c6f02b606137a12ddc0ab88f6b775113";
const VENUS_URL = Deno.env.get("SUPABASE_URL") + "/functions/v1/venus-chat";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VALID_ACTIONS = new Set(["status", "history", "reset", "setup", "send", "capture", "list", "delete"]);
const VALID_SKILLS = new Set<string>(["general", "design", "code", "scraper", "migration", "data", "devops", "security"]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function lovFetch(url: string, token: string, opts: RequestInit = {}) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Origin: "https://lovable.dev",
    Referer: "https://lovable.dev/",
    "X-Client-Git-SHA": GIT_SHA,
    ...(opts.headers as Record<string, string> || {}),
  };
  if ((opts.method === "POST" || opts.method === "PUT" || opts.method === "PATCH") && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(url, { ...opts, headers });
}

// ── Token helpers ──────────────────────────────────────────────

async function getUserToken(sc: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await sc.from("lovable_accounts")
    .select("token_encrypted")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return data?.token_encrypted?.trim() || null;
}

async function refreshToken(sc: SupabaseClient, userId: string): Promise<string | null> {
  try {
    const { data: acct } = await sc.from("lovable_accounts")
      .select("refresh_token_encrypted")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (!acct?.refresh_token_encrypted) return null;

    const firebaseKey = Deno.env.get("FIREBASE_API_KEY");
    if (!firebaseKey) return null;

    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${firebaseKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(acct.refresh_token_encrypted)}`,
    });
    if (!res.ok) return null;

    const payload = await res.json();
    const newToken = payload.id_token || payload.access_token;
    if (!newToken) return null;

    await sc.from("lovable_accounts")
      .update({
        token_encrypted: newToken,
        ...(payload.refresh_token ? { refresh_token_encrypted: payload.refresh_token } : {}),
      })
      .eq("user_id", userId)
      .eq("status", "active");

    console.log(`[Brain] Token refreshed for ${obfuscate(userId)}`);
    return newToken;
  } catch (err) {
    console.error("[Brain] refreshToken error:", err);
    return null;
  }
}

async function getValidToken(sc: SupabaseClient, userId: string): Promise<string | null> {
  let token = await getUserToken(sc, userId);
  if (!token) return null;

  const probe = await lovFetch(`${API}/user/workspaces`, token, { method: "GET" });
  if (probe.ok) return token;

  if (probe.status === 401 || probe.status === 403) {
    token = await refreshToken(sc, userId);
    return token;
  }
  return token;
}

// ── Workspace / Project helpers ────────────────────────────────

async function getWorkspaceId(token: string): Promise<string | null> {
  const res = await lovFetch(`${API}/user/workspaces`, token, { method: "GET" });
  if (!res.ok) return null;

  let body: any;
  try { body = JSON.parse(await res.text()); } catch { return null; }
  const list = Array.isArray(body) ? body : (body?.workspaces || body?.data || []);
  if (list.length === 0 && body?.id) return body.id;
  return list?.[0]?.id || null;
}

async function getBrainRaw(sc: SupabaseClient, userId: string, brainId?: string) {
  if (brainId) {
    const { data } = await sc.from("user_brain_projects")
      .select("id, lovable_project_id, lovable_workspace_id, status, created_at, brain_skill, brain_skills, name")
      .eq("id", brainId)
      .eq("user_id", userId)
      .maybeSingle();
    return data;
  }
  const { data } = await sc.from("user_brain_projects")
    .select("id, lovable_project_id, lovable_workspace_id, status, created_at, brain_skill, brain_skills, name")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function getBrain(sc: SupabaseClient, userId: string, brainId?: string) {
  const data = await getBrainRaw(sc, userId, brainId);
  if (!data || data.status !== "active") return null;
  return data;
}

async function listBrains(sc: SupabaseClient, userId: string) {
  const { data } = await sc.from("user_brain_projects")
    .select("id, lovable_project_id, lovable_workspace_id, status, created_at, brain_skill, brain_skills, name, last_message_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data || [];
}

type ProjectVerificationState = "accessible" | "not_found" | "unknown";

async function verifyProjectState(
  projectId: string,
  token: string,
): Promise<{ state: ProjectVerificationState; status: number | null }> {
  try {
    const res = await lovFetch(`${API}/projects/${projectId}`, token, { method: "GET" });
    if (res.ok) return { state: "accessible", status: res.status };
    if (res.status === 405) return { state: "accessible", status: res.status };
    if (res.status === 403 || res.status === 404) return { state: "not_found", status: res.status };
    return { state: "unknown", status: res.status };
  } catch {
    return { state: "unknown", status: null };
  }
}

async function acquireBrainLock(sc: SupabaseClient, userId: string, skills: string[], name: string): Promise<string | null> {
  const { data: stale } = await sc.from("user_brain_projects")
    .select("id, created_at")
    .eq("user_id", userId)
    .eq("status", "creating");
  if (stale) {
    for (const s of stale) {
      const ageMs = s.created_at ? Date.now() - new Date(s.created_at).getTime() : 0;
      if (ageMs > 120_000) {
        await sc.from("user_brain_projects").delete().eq("id", s.id);
      } else {
        return null;
      }
    }
  }

  const primarySkill = skills[0] || "general";
  const { data: row, error } = await sc.from("user_brain_projects").insert({
    user_id: userId,
    lovable_project_id: "creating",
    lovable_workspace_id: "pending",
    status: "creating",
    brain_owner: "user",
    brain_skill: primarySkill,
    brain_skills: skills,
    name,
  }).select("id").single();

  return error ? null : row?.id || null;
}

// ── Expert skill profiles (v4 — enhanced expert personas) ─────

const SKILL_PROFILES: Record<BrainSkill, { title: string; credentials: string; focus: string }> = {
  general: {
    title: "Star AI — Assistente Geral Sênior",
    credentials: "PhD em Ciência da Computação (MIT), MBA (Harvard), 50 anos de experiência em arquitetura de sistemas, liderança técnica e consultoria empresarial.",
    focus: "análise geral, planejamento, arquitetura de software, resolução de problemas complexos",
  },
  design: {
    title: "Star AI — Arquiteto de Design & UX",
    credentials: "PhD em HCI (MIT Media Lab), Mestre em Design Visual (RISD), 40 anos de experiência em design systems, acessibilidade e branding corporativo.",
    focus: "design systems, UX research, acessibilidade WCAG, Tailwind CSS, shadcn/ui, Figma-to-code",
  },
  code: {
    title: "Star AI — Engenheiro de Software Principal",
    credentials: "PhD em Engenharia de Software (Stanford), 50 anos como Staff Engineer em empresas Fortune 500.",
    focus: "TypeScript, React, Node.js, Deno, PostgreSQL, Edge Functions, arquitetura de microsserviços",
  },
  scraper: {
    title: "Star AI — Especialista em Extração de Dados",
    credentials: "PhD em Data Engineering (CMU), 30 anos em web scraping, NLP e pipelines de dados em larga escala.",
    focus: "crawlers, parsing, Firecrawl, APIs de dados, ETL, processamento de linguagem natural",
  },
  migration: {
    title: "Star AI — Arquiteto de Dados & Migrações",
    credentials: "PhD em Database Systems (UC Berkeley), 40 anos em PostgreSQL, modelagem relacional e otimização de queries.",
    focus: "migrações SQL, modelagem relacional, performance tuning, índices, RLS policies",
  },
  data: {
    title: "Star AI — Cientista de Dados Sênior",
    credentials: "PhD em Machine Learning (Stanford), PhD em Estatística (MIT), 35 anos de experiência em analytics e modelagem preditiva.",
    focus: "análise de dados, visualização, modelagem preditiva, ETL, dashboards",
  },
  devops: {
    title: "Star AI — Engenheiro DevOps/SRE Principal",
    credentials: "PhD em Sistemas Distribuídos (MIT), 40 anos em infraestrutura cloud, CI/CD e monitoramento.",
    focus: "CI/CD, Edge Functions, Supabase, monitoramento, cron jobs, Kubernetes",
  },
  security: {
    title: "Star AI — Engenheiro de Segurança Principal",
    credentials: "PhD em Cybersecurity (MIT), CISSP, OSCP, 45 anos em AppSec, pentesting e hardening.",
    focus: "RLS policies, OAuth, criptografia, hardening de infraestrutura, auditoria de segurança",
  },
};

// ── Bootstrap prompt (v4 — enhanced expert persona with PRD format)
// Creates project structure + expert persona + response protocol

function buildBootstrapPrompt(skill: BrainSkill, ctx?: { supabaseUrl?: string; anonKey?: string; userId?: string }): string {
  const p = SKILL_PROFILES[skill];
  const callbackSection = ctx?.supabaseUrl ? `
4. Crie o arquivo \`src/config.json\` com:
\`\`\`json
{
  "brain_title": "${p.title}",
  "skill": "${skill}",
  "response_file": "src/brain-output.md",
  "callback_url": "${ctx.supabaseUrl}/functions/v1/brain-capture-cron",
  "user_id": "${ctx.userId || ""}",
  "status": "ready",
  "version": "4.0"
}
\`\`\`` : "";

  return `Criar Projeto (Brain Specialist — ${p.title}):

Este projeto é um sistema headless de IA especializada onde todas as perguntas serão respondidas de forma coerente e profissional como um especialista ${p.credentials}.

## PRD — Product Requirements Document

### Objetivo
Sistema de resposta especializada com persona PhD/Sênior. O corpo da resposta deve ser anexado sempre em .md (nos arquivos em JSON também, nos arquivos .md e no corpo do site em HTML).

### Requisitos Funcionais
1. Todas as respostas devem ser escritas em \`src/brain-output.md\` com frontmatter \`status: done\`
2. Respostas devem ser criadas em formato .md, .json e HTML5 quando solicitado
3. O sistema deve suportar webhooks/APIs para integração externa
4. NÃO criar componentes React, páginas ou rotas visuais — este é um backend de IA headless

### Estrutura Inicial

1. Crie o arquivo \`.lovable/plan.md\` com:
\`\`\`markdown
---
title: ${p.title}
skill: ${skill}
status: ready
credentials: ${p.credentials}
---
# ${p.title}
Sistema especializado em ${p.focus}.
Protocolo: todas as respostas em \`src/brain-output.md\` com status: done.
\`\`\`

2. Crie o arquivo \`src/brain-output.md\` com:
\`\`\`markdown
---
status: ready
skill: ${skill}
timestamp: ${Date.now()}
---
# ${p.title}
Brain ativado. Credenciais: ${p.credentials}
Foco: ${p.focus}
Aguardando instruções.
\`\`\`

3. Crie o arquivo \`src/INSTRUCTIONS.md\` com:
\`\`\`markdown
# ${p.title} — Protocolo de Resposta

## Identidade
${p.credentials}

## Regras
1. SEMPRE escreva respostas em \`src/brain-output.md\` com frontmatter \`status: done\`
2. Responda em Português (Brasil)
3. Seja técnico, detalhado e acionável
4. NÃO crie componentes React ou páginas visuais
5. Pode criar Edge Functions, SQL, scripts backend
6. Use formato Markdown com código quando necessário
\`\`\`
${callbackSection}

NÃO crie componentes React, páginas ou rotas. Este projeto serve APENAS como backend de IA especializada.`;
}

// ── Post-bootstrap audit prompts (5 sequential at 1min intervals)
// These prompts audit and complete the brain setup

function buildAuditPrompts(skill: BrainSkill): string[] {
  const p = SKILL_PROFILES[skill];
  return [
    // Audit 1: Verify structure was created
    `Verifique se todos os arquivos do sistema foram criados corretamente:
- .lovable/plan.md (deve existir com skill: ${skill})
- src/brain-output.md (deve existir com status: ready)
- src/INSTRUCTIONS.md (deve existir com protocolo de resposta)
Se algum arquivo estiver faltando, crie-o agora. Atualize src/brain-output.md com status: done e uma confirmação de que a estrutura está completa.`,

    // Audit 2: Create response templates
    `Crie o arquivo src/response-templates.md com templates de resposta para diferentes tipos de consulta:

\`\`\`markdown
---
status: done
timestamp: ${Date.now()}
---

# Templates de Resposta — ${p.title}

## Template: Análise Técnica
- Diagnóstico
- Causa raiz
- Solução recomendada
- Código (se aplicável)

## Template: Arquitetura
- Visão geral
- Componentes
- Fluxo de dados
- Considerações de segurança

## Template: Code Review
- Problemas encontrados
- Severidade
- Correções sugeridas
- Boas práticas
\`\`\`

Atualize src/brain-output.md com status: done confirmando a criação dos templates.`,

    // Audit 3: Create capability manifest
    `Crie o arquivo src/capabilities.json com o manifesto de capacidades deste Brain:

\`\`\`json
{
  "brain": "${p.title}",
  "skill": "${skill}",
  "capabilities": [
    "análise técnica avançada",
    "geração de código",
    "revisão de arquitetura",
    "criação de documentação",
    "resolução de problemas complexos"
  ],
  "response_formats": ["markdown", "json", "html"],
  "output_file": "src/brain-output.md",
  "version": "4.0",
  "status": "operational"
}
\`\`\`

Atualize src/brain-output.md com status: done.`,

    // Audit 4: Self-test
    `Realize um auto-teste do sistema. Escreva em src/brain-output.md uma resposta de teste demonstrando suas capacidades como ${p.title}:

1. Apresente-se com suas credenciais
2. Liste suas áreas de especialização
3. Demonstre conhecimento técnico em ${p.focus}
4. Confirme que o protocolo de resposta está funcionando

Use o formato correto com frontmatter status: done.`,

    // Audit 5: Final readiness check
    `Verificação final de prontidão. Atualize src/brain-output.md com:

\`\`\`markdown
---
status: done
skill: ${skill}
timestamp: ${Date.now()}
readiness: complete
---

# ${p.title} — Sistema Operacional ✅

## Status: Totalmente operacional
- Estrutura de arquivos: ✅
- Templates de resposta: ✅
- Manifesto de capacidades: ✅
- Auto-teste: ✅
- Protocolo de resposta: ✅

Aguardando instruções do usuário.
\`\`\``,
  ];
}

// ── Brain prompt (v3 — .md response format) ────────────────────

function buildBrainPrompt(skill: BrainSkill, message: string): string {
  const p = SKILL_PROFILES[skill];

  return `Analise e corrija os seguintes problemas de segurança encontrados:

=== ${p.title} ===
Foco: ${p.focus}

O usuário solicitou: "${message}"

REGRAS ABSOLUTAS:
- Não faça perguntas, não peça confirmação. Execute diretamente.
- RESPONDA EM PORTUGUÊS (Brasil)
- NÃO crie componentes React, páginas ou rotas de UI
- Você PODE e DEVE criar Edge Functions, arquivos SQL, scripts e código backend
- Seja técnico, detalhado e acionável

OBRIGATÓRIO — Ao finalizar, crie/atualize o arquivo src/brain-output.md com:

\`\`\`markdown
---
status: done
skill: ${skill}
timestamp: ${Date.now()}
request: "${message.slice(0, 100)}"
---

# Resposta do ${p.title}

[SUA RESPOSTA COMPLETA AQUI — detalhada, em Markdown, com código se necessário]
\`\`\`

Se criar tabelas SQL, crie em supabase/migrations/.
Se criar funções, crie em supabase/functions/<nome>/index.ts.
SEMPRE finalize atualizando src/brain-output.md com status: done.`;
}

// ── Send message via venus-chat (task mode) ────────────────────
// Uses the internal venus-chat edge function for free messaging

async function sendViaVenus(
  projectId: string,
  prompt: string,
  token: string,
): Promise<{ ok: boolean; msgId?: string; error?: string }> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/venus-chat`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        task: prompt,
        project_id: projectId,
        mode: "task",
        lovable_token: token,
      }),
    });
    clearTimeout(timer);

    const text = await res.text().catch(() => "{}");
    let data: any = {};
    try { data = JSON.parse(text); } catch { data = {}; }
    if (!res.ok || !data?.ok) {
      return { ok: false, error: data?.error || `HTTP ${res.status}` };
    }
    return { ok: true, msgId: data.msgId };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, error: `venus-chat timeout/error: ${String(e).slice(0, 80)}` };
  }
}

// ── Response mining (scraper) ──────────────────────────────────
// Mines the Brain project's source-code for the response in src/brain-output.md

async function mineResponse(
  projectId: string,
  token: string,
  maxWaitMs = 90_000,
  intervalMs = 5_000,
  initialDelayMs = 8_000,
): Promise<{ response: string | null; status: "completed" | "processing" | "timeout" }> {
  await new Promise((r) => setTimeout(r, initialDelayMs));
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    // Strategy 1: Mine src/brain-output.md from source-code
    try {
      const srcRes = await lovFetch(`${API}/projects/${projectId}/source-code`, token, { method: "GET" });
      if (srcRes.ok) {
        const raw = await srcRes.text();
        let parsed: any = {};
        try { parsed = JSON.parse(raw); } catch { parsed = {}; }

        const files = parsed?.files || parsed?.data?.files || parsed?.source?.files || parsed;
        const getContent = (path: string): string | null => {
          if (!files) return null;
          if (Array.isArray(files)) {
            const found = files.find((f: any) => f.path === path || f.name === path);
            return typeof found === "string" ? found : (found?.contents || found?.content || found?.source || null);
          }
          if (typeof files === "object") {
            const val = files[path];
            if (typeof val === "string") return val;
            if (val && typeof val === "object") return val.contents || val.content || val.source || null;
          }
          return null;
        };

        // Log file keys for debugging (first poll only)
        if (Date.now() < deadline - maxWaitMs + initialDelayMs + intervalMs + 2000) {
          const fileKeys = typeof files === "object" && !Array.isArray(files)
            ? Object.keys(files).filter(k => k.includes("brain") || k.includes("output") || k.includes("tasks")).slice(0, 10)
            : Array.isArray(files)
              ? files.filter((f: any) => {
                  const p = f?.path || f?.name || "";
                  return p.includes("brain") || p.includes("output") || p.includes("tasks");
                }).map((f: any) => f?.path || f?.name).slice(0, 10)
              : [];
          console.log(`[Mine] project=${projectId.slice(0,8)} files-type=${Array.isArray(files) ? "array" : typeof files} brain-files=${JSON.stringify(fileKeys)}`);
        }

        // Primary: src/brain-output.md
        const mdContent = getContent("src/brain-output.md");
        if (mdContent) {
          console.log(`[Mine] brain-output.md found, len=${mdContent.length}, hasDone=${/status:\s*done/i.test(mdContent)}`);
          
          // Accept if status: done OR if content is substantial (>100 chars, meaning AI wrote something)
          const hasDone = /status:\s*done/i.test(mdContent);
          const hasReady = /status:\s*ready/i.test(mdContent);
          
          if (hasDone || (mdContent.length > 200 && !hasReady)) {
            const parts = mdContent.split("---");
            if (parts.length >= 3) {
              let body = parts.slice(2).join("---").trim();
              // Strip markdown code fences if wrapping the content
              body = body.replace(/^```(?:markdown|md)?\s*/i, "").replace(/```\s*$/, "").trim();
              if (body.length > 10) return { response: body, status: "completed" };
            }
            // Fallback: entire content after frontmatter
            const afterFm = mdContent.replace(/^---[\s\S]*?---\s*/m, "").trim();
            if (afterFm.length > 10) return { response: afterFm, status: "completed" };
          }
        }

        // Fallback: ANY .md file with "status: done" in .lovable/tasks/
        const allKeys = typeof files === "object" && !Array.isArray(files) ? Object.keys(files) : [];
        for (const key of allKeys) {
          if (!key.includes(".lovable/tasks/") && !key.includes("brain-response")) continue;
          const taskContent = getContent(key);
          if (taskContent && /status:\s*done/i.test(taskContent)) {
            const parts = taskContent.split("---");
            if (parts.length >= 3) {
              const body = parts.slice(2).join("---").trim();
              if (body.length > 20) {
                console.log(`[Mine] Found done task: ${key} len=${body.length}`);
                return { response: body, status: "completed" };
              }
            }
          }
        }

        // Fallback: src/brain-output.json (legacy)
        const jsonContent = getContent("src/brain-output.json");
        if (jsonContent) {
          let clean = typeof jsonContent === "string" ? jsonContent.trim() : "";
          if (clean.startsWith("```")) {
            clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
          }
          try {
            const out = JSON.parse(clean);
            if (out?.status === "done" && typeof out?.response === "string" && out.response.length > 0) {
              return { response: out.response, status: "completed" };
            }
          } catch { /* ignore */ }
        }
      } else {
        console.log(`[Mine] source-code HTTP ${srcRes.status} for project=${projectId.slice(0,8)}`);
      }
    } catch (e) { console.log(`[Mine] source-code error: ${String(e).slice(0,100)}`); }

    // Strategy 2: latest-message as last resort (with timeout protection)
    try {
      const ctrl = new AbortController();
      const lmTimer = setTimeout(() => ctrl.abort(), 8_000);
      const latestRes = await fetch(`${API}/projects/${projectId}/latest-message`, {
        signal: ctrl.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          Origin: "https://lovable.dev",
          Referer: "https://lovable.dev/",
          "X-Client-Git-SHA": GIT_SHA,
        },
      });
      clearTimeout(lmTimer);
      if (latestRes.ok) {
        const rawText = await latestRes.text().catch(() => "");
        let msg: any = {};
        try { msg = JSON.parse(rawText); } catch { msg = {}; }
        if (msg && !msg.is_streaming && msg.role !== "user") {
          const content = msg.content || msg.message || msg.text || "";
          if (typeof content === "string" && content.trim().length > 30) {
            return { response: content.trim(), status: "completed" };
          }
        }
      }
    } catch { /* continue — timeout or network error */ }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return { response: null, status: "timeout" };
}

// ── Ghost cancel helper ────────────────────────────────────────

function extractMessageId(payload: any): string | null {
  const raw = payload?.message_id || payload?.initial_message_id || payload?.message?.id || payload?.data?.message_id || null;
  return typeof raw === "string" && raw.trim().length > 0 ? raw : null;
}

async function getLatestMessageId(projectId: string, token: string): Promise<string | null> {
  try {
    const res = await lovFetch(`${API}/projects/${projectId}/latest-message`, token, { method: "GET" });
    if (!res.ok) return null;
    const payload = await res.json().catch(() => null);
    return payload?.id || payload?.message_id || null;
  } catch {
    return null;
  }
}

async function cancelInitialCreation(
  projectId: string,
  token: string,
  createPayload: any,
): Promise<{ cancelled: boolean; messageId: string | null }> {
  let messageId = extractMessageId(createPayload);

  if (!messageId) {
    await new Promise((r) => setTimeout(r, 1_000));
    messageId = await getLatestMessageId(projectId, token);
  }

  if (!messageId) {
    console.warn(`[Brain] Ghost cancel skipped (no message_id) project=${projectId}`);
    return { cancelled: false, messageId: null };
  }

  try {
    const cancelRes = await lovFetch(`${API}/projects/${projectId}/chat/${messageId}/cancel`, token, {
      method: "POST",
    });

    if (!cancelRes.ok) {
      console.warn(`[Brain] Ghost cancel failed project=${projectId} status=${cancelRes.status}`);
      return { cancelled: false, messageId };
    }

    console.log(`[Brain] Ghost cancel OK project=${projectId}`);
    return { cancelled: true, messageId };
  } catch (err) {
    console.warn(`[Brain] Ghost cancel exception project=${projectId}`, err);
    return { cancelled: false, messageId };
  }
}

// ── Project creation pipeline ──────────────────────────────────
// 1. Create project → 2. Ghost cancel → 3. Bootstrap prompt (via venus task mode)

async function createFreshBrain(
  sc: SupabaseClient,
  userId: string,
  token: string,
  skills: BrainSkill[],
  name: string,
): Promise<{ projectId: string; workspaceId: string; brainId: string } | { error: string }> {
  const lockId = await acquireBrainLock(sc, userId, skills, name);
  if (!lockId) {
    return { error: "Brain está sendo criado. Tente novamente em alguns segundos." };
  }

  const primarySkill = skills[0] || "general";

  try {
    const workspaceId = await getWorkspaceId(token);
    if (!workspaceId) {
      await sc.from("user_brain_projects").delete().eq("id", lockId);
      return { error: "Nenhum workspace encontrado. Reconecte em /lovable/connect." };
    }

    const skillLabel = SKILL_PROFILES[primarySkill].title.replace(/Star AI — /, "").toLowerCase().replace(/\s+/g, "-");
    const projectName = `star-${skillLabel}-${Date.now()}`;

    console.log(`[Brain] Creating project=${projectName} skills=${skills.join(",")}`);
    const createRes = await lovFetch(`${API}/workspaces/${workspaceId}/projects`, token, {
      method: "POST",
      body: JSON.stringify({
        name: projectName,
        initial_message: { message: "setup" },
        visibility: "private",
      }),
    });

    const createBody = await createRes.text().catch(() => "");
    if (!createRes.ok) {
      await sc.from("user_brain_projects").delete().eq("id", lockId);
      return { error: `Falha ao criar projeto Brain (HTTP ${createRes.status})` };
    }

    let created: any;
    try { created = JSON.parse(createBody); } catch {
      await sc.from("user_brain_projects").delete().eq("id", lockId);
      return { error: "Resposta inválida da API ao criar projeto" };
    }

    const projectId = created?.id;
    if (!projectId) {
      await sc.from("user_brain_projects").delete().eq("id", lockId);
      return { error: "ID do projeto não retornado pela API" };
    }

    await sc.from("user_brain_projects")
      .update({
        lovable_project_id: projectId,
        lovable_workspace_id: workspaceId,
        status: "active",
        brain_skill: primarySkill,
        brain_skills: skills,
        name,
        skill_phase: 1, // Queue audit prompts for cron processing
      })
      .eq("id", lockId);

    // Step 2: Ghost cancel — prevent credit usage from initial_message
    const cancelResult = await cancelInitialCreation(projectId, token, created);
    console.log(`[Brain] Ghost cancel result=${cancelResult.cancelled} project=${projectId}`);

    // Step 3: Wait for project to stabilize (8s minimum after cancel)
    await new Promise((r) => setTimeout(r, 8_000));

    // Step 3b: Verify project is accessible before bootstrap
    let projectReady = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const check = await lovFetch(`${API}/projects/${projectId}`, token, { method: "GET" });
      if (check.ok) {
        projectReady = true;
        break;
      }
      console.warn(`[Brain] Project not ready yet (attempt ${attempt + 1}/3, status=${check.status})`);
      await new Promise((r) => setTimeout(r, 5_000));
    }

    if (!projectReady) {
      console.warn(`[Brain] Project ${projectId} never became ready, skipping bootstrap`);
    }

    // Step 4: Bootstrap — send enhanced PRD prompt via venus-chat
    if (projectReady) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
      const bootstrapPrompt = buildBootstrapPrompt(primarySkill, { supabaseUrl, anonKey, userId });
      let bootstrapResult = await sendViaVenus(projectId, bootstrapPrompt, token);
      
      // Retry once if 404
      if (!bootstrapResult.ok && bootstrapResult.error?.includes("404")) {
        console.warn(`[Brain] Bootstrap got 404, retrying after 5s...`);
        await new Promise((r) => setTimeout(r, 5_000));
        bootstrapResult = await sendViaVenus(projectId, bootstrapPrompt, token);
      }
      
      console.log(`[Brain] Bootstrap via venus ok=${bootstrapResult.ok} project=${projectId}`);

      // NOTE: Background audit prompts removed — edge functions get killed after response.
      // Audits should be triggered separately via cron or explicit user action.
    }

    console.log(`[Brain] Setup complete project=${projectId} skills=${skills.join(",")}`);
    return { projectId, workspaceId, brainId: lockId };
  } catch (err) {
    console.error("[Brain] createFreshBrain error:", err);
    await sc.from("user_brain_projects").delete().eq("id", lockId);
    return { error: "Erro inesperado ao criar Brain" };
  }
}

// ── Main handler ───────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRole) {
      return json({ error: "Configuração do servidor incompleta" }, 500);
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: "Token inválido" }, 401);

    const sc = createClient(supabaseUrl, serviceRole);
    const userId = user.id;

    let body: any;
    try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

    const action = typeof body?.action === "string" ? body.action : "";
    if (!VALID_ACTIONS.has(action)) return json({ error: "Ação desconhecida" }, 400);

    // ── STATUS ──
    if (action === "status") {
      const token = await getUserToken(sc, userId);
      if (!token) return json({ active: false, connected: false, reason: "no_token" });

      const brains = await listBrains(sc, userId);
      const activeBrains = brains.filter(b => b.status === "active" && b.lovable_project_id !== "creating");
      const currentWorkspaceId = await getWorkspaceId(token);

      return json({
        active: activeBrains.length > 0,
        connected: true,
        brains: activeBrains.map(b => ({
          id: b.id,
          name: b.name,
          project_id: b.lovable_project_id,
          project_url: `https://lovable.dev/projects/${b.lovable_project_id}`,
          skill: b.brain_skill,
          skills: b.brain_skills || [b.brain_skill],
          workspace_id: b.lovable_workspace_id,
          last_message_at: b.last_message_at,
        })),
        creating: brains.some(b => b.status === "creating"),
        current_workspace_id: currentWorkspaceId || null,
      });
    }

    // ── LIST ──
    if (action === "list") {
      const brains = await listBrains(sc, userId);
      return json({
        brains: brains.map(b => ({
          id: b.id,
          name: b.name,
          project_id: b.lovable_project_id,
          project_url: b.lovable_project_id !== "creating" ? `https://lovable.dev/projects/${b.lovable_project_id}` : null,
          status: b.status,
          skill: b.brain_skill,
          skills: b.brain_skills || [b.brain_skill],
          workspace_id: b.lovable_workspace_id,
          last_message_at: b.last_message_at,
          created_at: b.created_at,
        })),
      });
    }

    // ── HISTORY ──
    if (action === "history") {
      const limit = Math.max(1, Math.min(typeof body?.limit === "number" ? body.limit : 50, 100));
      const brainId = typeof body?.brain_id === "string" ? body.brain_id : null;

      let query = supabase
        .from("loveai_conversations")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (brainId) {
        const brain = await getBrain(sc, userId, brainId);
        if (brain) query = query.eq("target_project_id", brain.lovable_project_id);
      }

      const { data } = await query;
      return json({ conversations: data || [] });
    }

    // ── RESET ──
    if (action === "reset") {
      const brainId = typeof body?.brain_id === "string" ? body.brain_id : null;
      if (brainId) {
        await sc.from("user_brain_projects").delete().eq("id", brainId).eq("user_id", userId);
      } else {
        await sc.from("user_brain_projects").delete().eq("user_id", userId);
        await sc.from("loveai_conversations").delete().eq("user_id", userId);
      }
      return json({ success: true, message: brainId ? "Brain removido." : "Todos os Brains resetados." });
    }

    // ── DELETE ──
    if (action === "delete") {
      const brainId = typeof body?.brain_id === "string" ? body.brain_id : "";
      if (!brainId) return json({ error: "brain_id obrigatório" }, 400);

      const brain = await getBrainRaw(sc, userId, brainId);
      if (!brain) return json({ success: true, message: "Brain já foi removido anteriormente." });

      await sc.from("user_brain_projects").delete().eq("id", brainId).eq("user_id", userId);
      return json({ success: true, message: "Brain removido com sucesso." });
    }

    const lovableToken = await getValidToken(sc, userId);
    if (!lovableToken) {
      return json({ error: "Token Lovable inválido. Reconecte via /lovable/connect.", code: "no_token" }, 503);
    }

    // ── SETUP ──
    if (action === "setup") {
      const rawSkills = Array.isArray(body?.skills) ? body.skills.filter((s: string) => VALID_SKILLS.has(s)) : [];
      const rawSkill = typeof body?.skill === "string" && VALID_SKILLS.has(body.skill) ? body.skill : null;
      const skills: BrainSkill[] = rawSkills.length > 0
        ? rawSkills as BrainSkill[]
        : [((rawSkill || "general") as BrainSkill)];
      const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim().slice(0, 60) : `Star AI — ${skills.join(", ")}`;

      const result = await createFreshBrain(sc, userId, lovableToken, skills, name);
      if ("error" in result) return json({ error: result.error }, 502);
      return json({
        success: true,
        brain_id: result.brainId,
        project_id: result.projectId,
        project_url: `https://lovable.dev/projects/${result.projectId}`,
        skills,
        name,
        stored_workspace_id: result.workspaceId,
      });
    }

    // ── SEND (via venus-chat task mode) ──
    if (action === "send") {
      const message = typeof body?.message === "string" ? body.message.trim() : "";
      const rawSkill = typeof body?.brain_type === "string" ? body.brain_type : "";
      const brainId = typeof body?.brain_id === "string" ? body.brain_id : undefined;

      if (!message || message.length < 1 || message.length > 10_000) {
        return json({ error: "Mensagem inválida (1-10000 chars)" }, 400);
      }

      let brain = await getBrain(sc, userId, brainId);
      if (!brain) brain = await getBrain(sc, userId);
      if (!brain) {
        return json({ error: "Star AI não está ativo. Crie um Brain primeiro.", code: "brain_inactive" }, 400);
      }

      const brainProjectId = brain.lovable_project_id;

      // Safeguard: brain project must NOT be "creating" placeholder
      if (!brainProjectId || brainProjectId === "creating") {
        return json({ error: "Brain ainda está sendo criado. Aguarde.", code: "brain_creating" }, 503);
      }

      // Log which project we're targeting
      console.log(`[Brain:send] user=${userId.slice(0,8)} brain=${brain.id.slice(0,8)} project=${brainProjectId.slice(0,8)} skill=${brain.brain_skill}`);

      const access = await verifyProjectState(brainProjectId, lovableToken);
      if (access.state === "not_found") {
        const currentWorkspaceId = await getWorkspaceId(lovableToken);
        return json({
          error: "Projeto Brain não encontrado no workspace atual.",
          code: "project_not_found_in_workspace",
          stored_workspace_id: brain.lovable_workspace_id || null,
          current_workspace_id: currentWorkspaceId || null,
        }, 409);
      }

      const skill: BrainSkill = (VALID_SKILLS.has(rawSkill) ? rawSkill : (brain.brain_skill || "general")) as BrainSkill;
      const prompt = buildBrainPrompt(skill, message);

      // Log conversation — uses brain's lovable_project_id (NOT the main app)
      const { data: convoRow } = await sc.from("loveai_conversations")
        .insert({
          user_id: userId,
          user_message: message,
          brain_type: skill,
          status: "processing",
          target_project_id: brainProjectId,
        })
        .select("id")
        .single();

      const convoId = convoRow?.id;
      console.log(`[Brain:send] convo=${convoId?.slice(0,8)} target_project=${brainProjectId.slice(0,8)}`);

      // Send via venus-chat (task mode) — FREE
      let venusResult = await sendViaVenus(brainProjectId, prompt, lovableToken);
      let activeProjectId = brainProjectId;

      if (!venusResult.ok) {
        // If 404 — brain project was deleted, auto-recreate
        const is404 = venusResult.error?.includes("404");
        if (is404) {
          console.warn(`[Brain] Project ${brainProjectId} returned 404, recreating...`);
          await sc.from("user_brain_projects").delete().eq("id", brain.id);
          const newBrain = await createFreshBrain(sc, userId, lovableToken, [skill], brain.name || `Star AI — ${skill}`);
          if ("error" in newBrain) {
            if (convoId) await sc.from("loveai_conversations").update({ status: "failed" }).eq("id", convoId);
            return json({ error: `Brain recriado com falha: ${newBrain.error}` }, 502);
          }
          activeProjectId = newBrain.projectId;
          if (convoId) await sc.from("loveai_conversations").update({ target_project_id: activeProjectId }).eq("id", convoId);
          // Wait for new brain to stabilize
          await new Promise(r => setTimeout(r, 5000));
          venusResult = await sendViaVenus(activeProjectId, prompt, lovableToken);
        }

        // Token might be expired — try refresh
        if (!venusResult.ok) {
          const refreshed = await refreshToken(sc, userId);
          if (refreshed) {
            const retry = await sendViaVenus(activeProjectId, prompt, refreshed);
            if (!retry.ok) {
              if (convoId) await sc.from("loveai_conversations").update({ status: "failed" }).eq("id", convoId);
              return json({ error: `Erro ao enviar: ${retry.error}` }, 502);
            }
          } else {
            if (convoId) await sc.from("loveai_conversations").update({ status: "failed" }).eq("id", convoId);
            return json({ error: `Erro ao enviar: ${venusResult.error}` }, 502);
          }
        }
      }

      // Quick mine (10s) for fast responses
      let quickResponse: string | null = null;
      try {
        const quickResult = await mineResponse(activeProjectId, lovableToken, 8_000, 3_000, 5_000);
        if (quickResult.status === "completed") {
          quickResponse = quickResult.response;
        }
      } catch { /* cron will handle it */ }

      if (quickResponse && convoId) {
        await sc.from("loveai_conversations").update({
          ai_response: quickResponse,
          status: "completed",
        }).eq("id", convoId);

        // Persist to brain_outputs table for API access
        await sc.from("brain_outputs").insert({
          user_id: userId,
          conversation_id: convoId,
          skill,
          request: message,
          response: quickResponse,
          status: "done",
          brain_project_id: activeProjectId,
        }).then(({ error }) => {
          if (error) console.warn(`[Brain] brain_outputs insert err: ${error.message}`);
        });
      }

      await sc.from("user_brain_projects")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", brain.id);

      return json({
        conversation_id: convoId,
        response: quickResponse,
        status: quickResponse ? "completed" : "processing",
        skill,
        brain_id: brain.id,
        message: quickResponse ? undefined : "Resposta sendo minerada. Use action=capture para obter.",
      });
    }

    // ── CAPTURE (mine response) ──
    if (action === "capture") {
      const conversationId = typeof body?.conversation_id === "string" ? body.conversation_id : "";
      if (!conversationId) return json({ error: "conversation_id obrigatório" }, 400);

      const { data: convo } = await sc.from("loveai_conversations")
        .select("id, user_id, ai_response, status, target_project_id")
        .eq("id", conversationId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!convo) return json({ error: "Conversa não encontrada" }, 404);

      if (convo.ai_response && convo.ai_response.length > 0) {
        return json({ response: convo.ai_response, status: convo.status });
      }

      const projectId = convo.target_project_id;
      if (!projectId) return json({ response: null, status: convo.status || "processing" });

      const capture = await mineResponse(projectId, lovableToken, 45_000, 4_000, 0);
      if (capture.response) {
        await sc.from("loveai_conversations").update({
          ai_response: capture.response,
          status: capture.status === "completed" ? "completed" : convo.status,
        }).eq("id", conversationId);

        // Persist to brain_outputs
        await sc.from("brain_outputs").insert({
          user_id: userId,
          conversation_id: conversationId,
          skill: "general",
          request: "",
          response: capture.response,
          status: "done",
          brain_project_id: projectId,
        }).catch(() => {});
      }

      return json({ response: capture.response, status: capture.status });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (err) {
    console.error("[Brain] Unhandled error:", err);
    return json({ error: "Erro interno no Brain" }, 500);
  }
});
