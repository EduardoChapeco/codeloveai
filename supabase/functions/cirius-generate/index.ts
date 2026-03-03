/**
 * Cirius Generate v3 — Multi-engine pipeline orchestrator
 * 
 * Actions:
 *   start         — NEW: Full pipeline (classify → scrape → PRD → create → generate)
 *   status        — Full project + orchestrator + logs status
 *   cancel        — Cancel generation
 *   init          — Create empty project (legacy)
 *   build_prompt  — Generate PRD for approval (legacy)
 *   approve_prd   — Approve PRD → trigger code gen (legacy)
 *   generate_prd  — Generate PRD only (legacy)
 *   generate_code — Generate code from existing PRD (legacy)
 *   capture       — Sync files from Brain response
 *   refine        — AI-powered holistic code review
 *   debug_log     — Comprehensive pipeline state dump
 *   pause/resume  — Pipeline control
 *   oauth_state, save_github_integration, save_vercel_integration, save_supabase_integration
 * 
 * Engine priority for PRD: Brainchain → Claude (OpenRouter) → Gemini (Vault) → AI Gateway
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildFilesFingerprint, extractFilesFromMarkdown, extractMdBody, mergeFileMaps, parseLatestMessage } from "../_shared/md-assembly.ts";
import { smartMergeFiles } from "../_shared/smart-merge.ts";
import { getCodeSystemPrompt, buildSpecializedPrdPrompt, type ProjectTemplateType } from "../_shared/cirius-templates.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXT_API = "https://api.lovable.dev";
const GIT_SHA = "3d7a3673c6f02b606137a12ddc0ab88f6b775113";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ─── Intent Classifier (inline for edge function) ─────────────────────────

type ProjectIntent = "landing_page" | "marketing_site" | "crud_system" | "dashboard" | "ecommerce" | "saas_app" | "api_only" | "component" | "custom";

interface ProjectBlueprint {
  intent: ProjectIntent;
  needsDatabase: boolean;
  needsAuth: boolean;
  needsPayments: boolean;
  needsStorage: boolean;
  suggestedEngine: "brain" | "brainchain" | "orchestrator";
  suggestedSkill: "design" | "code" | "general";
  estimatedTasks: number;
  generationStrategy: "single_shot" | "multi_task" | "iterative";
  supabaseTables: string[];
  features: string[];
}

const INTENT_KW: Record<ProjectIntent, string[]> = {
  landing_page: ["landing", "landing page", "pagina", "one page", "lp", "captura", "squeeze", "hero"],
  marketing_site: ["site", "website", "institucional", "portfolio", "blog", "contato"],
  crud_system: ["sistema", "crud", "gerenciar", "gerenciamento", "cadastro", "tabela", "listagem", "formulario", "registro", "controle", "admin", "backoffice", "gestao"],
  dashboard: ["dashboard", "painel", "metricas", "relatorio", "analytics", "grafico", "chart", "kpi", "indicador", "monitoramento"],
  ecommerce: ["loja", "ecommerce", "e-commerce", "produto", "carrinho", "cart", "checkout", "vender", "venda", "pedido", "catalogo", "shop", "store", "marketplace"],
  saas_app: ["saas", "assinatura", "plano", "billing", "subscription", "multi-tenant", "multitenant", "tenant", "recurring", "pricing", "freemium", "trial"],
  api_only: ["api", "endpoint", "backend", "edge function", "webhook", "rest", "microservice"],
  component: ["componente", "component", "widget", "botao", "modal", "card", "ui element"],
  custom: [],
};

const FEAT_KW: Record<string, string[]> = {
  auth: ["login", "autenticacao", "signup", "cadastro", "senha", "password", "oauth"],
  payments: ["pagamento", "payment", "stripe", "pix", "checkout", "cobranca", "fatura"],
  storage: ["upload", "arquivo", "file", "imagem", "image", "foto", "media", "storage"],
  notifications: ["notificacao", "notification", "email", "push", "alerta"],
  search: ["busca", "search", "filtro", "pesquisa"],
  realtime: ["realtime", "tempo real", "chat", "live", "websocket"],
};

function norm(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function classifyIntent(prompt: string): ProjectBlueprint {
  const n = norm(prompt);
  let bestIntent: ProjectIntent = "custom";
  let bestScore = 0;
  for (const [intent, kws] of Object.entries(INTENT_KW) as [ProjectIntent, string[]][]) {
    let s = 0;
    for (const kw of kws) { if (n.includes(kw)) s += kw.length; }
    if (s > bestScore) { bestScore = s; bestIntent = intent; }
  }
  const features: string[] = [];
  for (const [feat, kws] of Object.entries(FEAT_KW)) {
    if (kws.some(kw => n.includes(kw))) features.push(feat);
  }
  const needsDb = ["crud_system", "dashboard", "ecommerce", "saas_app"].includes(bestIntent) || features.includes("auth");
  const needsAuth = ["crud_system", "dashboard", "ecommerce", "saas_app"].includes(bestIntent) || features.includes("auth");
  const needsPay = ["ecommerce", "saas_app"].includes(bestIntent) || features.includes("payments");
  const needsStorage = features.includes("storage");
  let engine: ProjectBlueprint["suggestedEngine"] = "brainchain";
  if (["ecommerce", "saas_app"].includes(bestIntent)) engine = "orchestrator";
  else if (["crud_system", "dashboard", "api_only"].includes(bestIntent)) engine = "brain";
  let skill: ProjectBlueprint["suggestedSkill"] = "general";
  if (["landing_page", "marketing_site", "component"].includes(bestIntent)) skill = "design";
  else if (["crud_system", "api_only", "saas_app"].includes(bestIntent)) skill = "code";
  const taskMap: Record<string, number> = { landing_page: 2, marketing_site: 3, component: 1, api_only: 2, crud_system: 5, dashboard: 4, ecommerce: 7, saas_app: 8, custom: 3 };
  let est = taskMap[bestIntent] || 3;
  if (needsPay) est = Math.min(10, est + 1);
  if (needsStorage) est = Math.min(10, est + 1);
  let strat: ProjectBlueprint["generationStrategy"] = "single_shot";
  if (est >= 5) strat = "multi_task";
  else if (est >= 3) strat = "iterative";
  // Detect tables
  const tables: string[] = [];
  if (bestIntent === "ecommerce") tables.push("products", "orders", "order_items", "customers");
  else if (bestIntent === "saas_app") tables.push("profiles", "subscriptions", "plans", "usage_logs");
  else if (bestIntent === "dashboard") tables.push("metrics", "reports");
  else if (bestIntent === "crud_system") {
    const m = n.match(/(?:cadastro|tabela|gerenciar|crud)\s+(?:de\s+)?(\w+)/);
    tables.push(m ? m[1].replace(/s$/, "") : "items");
  }
  const fl = [...features];
  if (needsAuth && !fl.includes("auth")) fl.push("auth");
  if (needsDb) fl.push("database");
  return { intent: bestIntent, needsDatabase: needsDb, needsAuth, needsPayments: needsPay, needsStorage, suggestedEngine: engine, suggestedSkill: skill, estimatedTasks: est, generationStrategy: strat, supabaseTables: tables, features: fl };
}

// ─── PRD / Validation helpers ─────────────────────────────────────────────

function extractJSON(content: string): any {
  if (!content || content.length < 10) return null;
  let s = content.trim();
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) s = m[1].trim();
  const i = s.indexOf("{");
  if (i >= 0) s = s.slice(i);
  const j = s.lastIndexOf("}");
  if (j >= 0) s = s.slice(0, j + 1);
  try { return validatePRD(JSON.parse(s)); } catch { return null; }
}

function validatePRD(prd: any): any | null {
  if (!prd || typeof prd !== "object") return null;
  if (!Array.isArray(prd.tasks) || prd.tasks.length === 0 || prd.tasks.length > 15) return null;
  const valid = prd.tasks.filter((t: any) => {
    if (!t || typeof t !== "object") return false;
    const title = typeof t.title === "string" ? t.title.trim() : "";
    const prompt = typeof t.prompt === "string" ? t.prompt.trim() : "";
    return title.length >= 3 && prompt.length >= 20;
  });
  if (valid.length === 0) return null;
  const tasks = valid.map((t: any) => ({
    title: String(t.title).trim().slice(0, 200),
    skill: typeof t.skill === "string" ? t.skill.slice(0, 30) : "code",
    intent: typeof t.intent === "string" ? t.intent.slice(0, 30) : "security_fix_v2",
    prompt: String(t.prompt).trim().slice(0, 5000),
    stop_condition: typeof t.stop_condition === "string" ? t.stop_condition.slice(0, 200) : null,
    brain_type: typeof t.brain_type === "string" ? t.brain_type.slice(0, 30) : "code",
  }));
  let design = null;
  if (prd.design && typeof prd.design === "object") {
    design = {
      primary_color: typeof prd.design.primary_color === "string" ? prd.design.primary_color.slice(0, 20) : "#6366f1",
      font: typeof prd.design.font === "string" ? prd.design.font.slice(0, 50) : "Geist",
      style: typeof prd.design.style === "string" ? prd.design.style.slice(0, 50) : "modern_minimal",
      pages: Array.isArray(prd.design.pages) ? prd.design.pages.filter((p: any) => typeof p === "string").slice(0, 20) : [],
      tables: Array.isArray(prd.design.tables) ? prd.design.tables.filter((t: any) => typeof t === "string").slice(0, 30) : [],
    };
  }
  return { tasks, design };
}

function validateCapturedResponse(response: string): string | null {
  if (!response || typeof response !== "string") return null;
  const trimmed = response.trim();
  if (trimmed.length < 20) return null;
  if (trimmed.length < 50) {
    if (trimmed.includes('"tasks"') || trimmed.startsWith("{")) return trimmed.slice(0, 100_000);
    return null;
  }
  const reject = [/^<!DOCTYPE/i, /^<html/i, /^{"error"/i, /^404\s/i, /^500\s/i, /aguardando instrucoes/i, /brain ativado\.\s*credenciais/i];
  if (reject.some(r => r.test(trimmed))) return null;
  return trimmed.slice(0, 100_000);
}

// ─── Auth / Logging ───────────────────────────────────────────────────────

async function getUser(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const sc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await sc.auth.getUser();
  return user;
}

async function logEntry(sc: SupabaseClient, projectId: string, step: string, status: string, message: string, extra?: Record<string, unknown>) {
  const payload: Record<string, unknown> = {
    project_id: projectId, step, status, message,
    level: status === "failed" ? "error" : status === "retrying" ? "warning" : "info",
    metadata: { timestamp_ms: Date.now(), fn: "cirius-generate", ...(extra?.metadata as Record<string, unknown> || {}) },
  };
  if (extra?.duration_ms) payload.duration_ms = extra.duration_ms;
  if (extra?.output_json) payload.output_json = extra.output_json;
  if (extra?.input_json) payload.input_json = extra.input_json;
  if (extra?.error_msg) payload.error_msg = extra.error_msg;
  if (extra?.retry_count) payload.retry_count = extra.retry_count;
  await sc.from("cirius_generation_log").insert(payload);
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ─── Engine helpers ───────────────────────────────────────────────────────

async function getUserBrain(sc: SupabaseClient, userId: string) {
  const { data } = await sc.from("user_brain_projects").select("id, lovable_project_id").eq("user_id", userId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data?.lovable_project_id || data.lovable_project_id.startsWith("creating")) return null;
  return { projectId: data.lovable_project_id, brainId: data.id };
}

async function getUserToken(sc: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await sc.from("lovable_accounts").select("token_encrypted").eq("user_id", userId).eq("status", "active").maybeSingle();
  return data?.token_encrypted?.trim() || null;
}

async function sendViaBrainProject(projectId: string, token: string, message: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  const t0 = Date.now();
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/venus-chat`, {
      method: "POST", signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ task: message, project_id: projectId, mode: "task", lovable_token: token, skip_suffix: true }),
    });
    clearTimeout(timer);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data?.ok !== false, error: data?.error, durationMs: Date.now() - t0 };
  } catch (e) { clearTimeout(timer); return { ok: false, error: String(e).slice(0, 120), durationMs: Date.now() - t0 }; }
}

async function captureBrainResponse(projectId: string, token: string, maxWaitMs = 90_000, intervalMs = 4_000, initialDelayMs = 4_000): Promise<string | null> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Origin: "https://lovable.dev", Referer: "https://lovable.dev/", "X-Client-Git-SHA": GIT_SHA };
  let initialMsgId: string | null = null;
  try { const r = await fetch(`${EXT_API}/projects/${projectId}/chat/latest-message`, { headers }); if (r.ok) { const m = await r.json().catch(() => null); initialMsgId = m?.id || null; } } catch {}
  await new Promise(r => setTimeout(r, initialDelayMs));
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 10_000);
      const res = await fetch(`${EXT_API}/projects/${projectId}/chat/latest-message`, { signal: ctrl.signal, headers });
      clearTimeout(t);
      if (res.ok) {
        const msg = await res.json().catch(() => null);
        if (msg && msg.role !== "user" && !msg.is_streaming && msg.id !== initialMsgId) {
          const validated = validateCapturedResponse((msg.content || msg.text || "").trim());
          if (validated) return validated;
        }
      }
    } catch {}
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return null;
}

async function sendViaBrainchain(sc: SupabaseClient, userId: string, message: string, brainType = "code") {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const t0 = Date.now();
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/brainchain-send`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ message, brain_type: brainType, user_id: userId }),
    });
    const data = await res.json();
    const d = Date.now() - t0;
    if (data.queued) return { ok: true, queueId: data.queue_id, durationMs: d };
    if (data.ok && data.response) return { ok: true, response: data.response, durationMs: d };
    return { ok: false, error: data.error || "Brainchain unavailable", durationMs: d };
  } catch (e) { return { ok: false, error: (e as Error).message.slice(0, 120), durationMs: Date.now() - t0 }; }
}

async function sendViaOpenRouter(prompt: string, systemPrompt?: string) {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  const t0 = Date.now();
  if (!key) return { content: null, durationMs: 0, error: "OPENROUTER_API_KEY not set" };
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": "https://starble.lovable.app", "X-Title": "Cirius Generator" },
      body: JSON.stringify({ model: "anthropic/claude-sonnet-4", messages: [{ role: "system", content: systemPrompt || "Return only valid JSON, no markdown fences." }, { role: "user", content: prompt }], temperature: 0.2, max_tokens: 4000 }),
    });
    const d = Date.now() - t0;
    if (res.ok) { const r = await res.json(); return { content: r?.choices?.[0]?.message?.content || null, durationMs: d }; }
    const e = await res.text().catch(() => ""); return { content: null, durationMs: d, error: `HTTP ${res.status}: ${e.slice(0, 100)}` };
  } catch (e) { return { content: null, durationMs: Date.now() - t0, error: (e as Error).message.slice(0, 100) }; }
}

// ─── sendViaGateway e sendViaGeminiDirect REMOVIDOS (proibido usar Gemini/Lovable AI no Cirius) ───

// ─── PRD Generation (multi-engine cascade) ────────────────────────────────

async function generatePRD(sc: SupabaseClient, userId: string, project: Record<string, any>, projectId: string): Promise<any> {
  const features = Array.isArray(project.features) ? project.features : [];
  const prompt = `IMPORTANTE: Não faça perguntas. Execute diretamente. Retorne APENAS JSON válido.

Você é um arquiteto de software sênior especializado em React + Tailwind + shadcn/ui.

Projeto: "${project.name}"
Tipo: ${project.template_type || "app"}
Descrição completa: ${project.description || ""}
Features detectadas: ${features.join(", ") || "basic"}
URL de referência: ${project.source_url || "nenhuma"}
Stack: React 18 + Vite 5 + TypeScript + Tailwind CSS 3 + shadcn/ui + React Router DOM + Supabase

## REGRA CRÍTICA: TUDO NO PRIMEIRO PEDIDO

O projeto DEVE ser gerado COMPLETO e FUNCIONAL no primeiro pedido. Isso significa:
- TODAS as páginas listadas devem ser criadas
- TODOS os componentes necessários devem existir
- TODAS as rotas devem estar configuradas no App.tsx
- O CSS/Tailwind deve estar aplicado
- Os estados e interações devem funcionar
- O projeto deve renderizar sem erros

## ESTRUTURA OBRIGATÓRIA DE TAREFAS

TAREFA 1 (FUNDAÇÃO): Deve gerar TODOS estes arquivos obrigatórios:
  - index.html (com <div id="root"> e <script type="module" src="/src/main.tsx">)
  - src/main.tsx (ReactDOM.createRoot)
  - src/App.tsx (com React Router e TODAS as rotas)
  - src/index.css (Tailwind @tailwind base/components/utilities + cores customizadas)
  - vite.config.ts
  - tailwind.config.js
  - tsconfig.json
  - package.json
  E TAMBÉM todos os componentes de layout: Header/Navbar, Footer, Layout wrapper

TAREFA 2+ (PÁGINAS E FEATURES): Cada tarefa subsequente deve:
  - Gerar páginas COMPLETAS (não stubs)
  - Incluir TODOS os componentes que a página usa
  - Incluir estados, handlers, dados mockados realistas
  - Usar Tailwind CSS para estilização completa
  - Ser auto-contida (não depender de código futuro)

ÚLTIMA TAREFA (REVIEW): Revisar todos os arquivos, corrigir imports, garantir consistência visual

## FORMATO DE RESPOSTA

Retorne APENAS este JSON (sem markdown, sem explicações):
{"tasks":[{"title":"Fundação completa do projeto","brain_type":"code","skill":"code","intent":"security_fix_v2","prompt":"Prompt DETALHADO e COMPLETO com TODOS os arquivos que devem ser gerados, incluindo o conteúdo esperado de cada componente"}],"design":{"primary_color":"#6366f1","font":"Inter","style":"modern_minimal","pages":["Home","About"],"tables":[]}}

## REGRAS DO PROMPT DE CADA TAREFA
- O prompt deve ser EXTREMAMENTE detalhado (mínimo 200 palavras)
- Deve listar EXATAMENTE quais arquivos criar
- Deve descrever o visual esperado (cores, layout, espaçamento)
- Deve incluir textos/dados de exemplo realistas
- Máximo 5 tarefas (prefira 2-3 com mais conteúdo)
- brain_type: "code"
- intent: DEVE ser "security_fix_v2"`;

  const attempts: Array<{ engine: string; ok: boolean; durationMs: number; error?: string }> = [];

  // 1. BRAINCHAIN
  const bc = await sendViaBrainchain(sc, userId, prompt, "prd");
  if (bc.ok && bc.response) {
    const p = extractJSON(bc.response);
    await logEntry(sc, projectId, "prd_brainchain", p ? "completed" : "failed", p ? `Brainchain PRD: ${p.tasks?.length} tasks` : "Brainchain not parseable", { duration_ms: bc.durationMs });
    attempts.push({ engine: "brainchain", ok: !!p, durationMs: bc.durationMs || 0 });
    if (p) return p;
  } else if (bc.ok && bc.queueId) {
    const t0 = Date.now();
    let pollResult: string | null = null;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const { data: q } = await sc.from("brainchain_queue").select("status, response").eq("id", bc.queueId).maybeSingle();
      if (q?.status === "done" && q.response) { pollResult = q.response; break; }
      if (q?.status === "error") break;
    }
    if (pollResult) { const p = extractJSON(pollResult); if (p) return p; }
    attempts.push({ engine: "brainchain", ok: false, durationMs: Date.now() - t0, error: "poll timeout" });
  } else {
    attempts.push({ engine: "brainchain", ok: false, durationMs: bc.durationMs || 0, error: bc.error });
  }

  // 2. CLAUDE (OpenRouter)
  const or = await sendViaOpenRouter(prompt);
  if (or.content) { const p = extractJSON(or.content); if (p) { await logEntry(sc, projectId, "prd_openrouter", "completed", `Claude PRD: ${p.tasks?.length} tasks`, { duration_ms: or.durationMs }); return p; } }
  attempts.push({ engine: "openrouter", ok: false, durationMs: or.durationMs, error: or.error });

  // 3. GEMINI / AI GATEWAY — REMOVIDOS (proibido usar Gemini/Lovable AI no Cirius)

  await logEntry(sc, projectId, "prd_all_failed", "failed", `ALL PRD engines failed: ${attempts.map(a => `${a.engine}(${a.error || "fail"})`).join(", ")}`, { metadata: { attempts } });
  return null;
}

// ─── Refinement ───────────────────────────────────────────────────────────

async function refineSourceFiles(sc: SupabaseClient, projectId: string, files: Record<string, string>, projectName: string, description: string, prdJson?: any) {
  const fileList = Object.entries(files).filter(([, c]) => typeof c === "string" && c.length > 0).map(([p, c]) => `--- ${p} ---\n${c.slice(0, 5000)}`).join("\n\n");
  if (fileList.length < 50) return { ok: false, durationMs: 0, error: "No substantive files" };
  const truncated = fileList.slice(0, 110_000);
  let prdCtx = `\n## PROJECT: "${projectName}" — ${description}\n`;
  if (prdJson) {
    const prd = typeof prdJson === "string" ? (() => { try { return JSON.parse(prdJson); } catch { return null; } })() : prdJson;
    if (prd?.tasks) prdCtx = `\n## PRD: ${projectName}\nTasks:\n${prd.tasks.map((t: any, i: number) => `${i + 1}. ${t.title}`).join("\n")}\n`;
  }
  const prompt = `You are a senior engineer performing holistic code review.${prdCtx}\nSOURCE FILES:\n${truncated}\n\nReturn corrected files using <file path="path/to/file.tsx">corrected content</file> tags. Include ALL files, even unchanged ones.`;
  const sys = "You are a code reviewer. Return all source files wrapped in <file path=\"...\">content</file> tags. Do NOT wrap in JSON.";
  const t0 = Date.now();

  // OpenRouter/Claude only (Gateway removido)
  const or2 = await sendViaOpenRouter(prompt, sys);
  if (or2.content) {
    const p = tryParseRefinement(or2.content);
    if (p) return { ok: true, files: mergeFileMaps(files, p), durationMs: Date.now() - t0 };
  }

  // Graceful degradation: keep originals instead of hard-failing
  console.warn(`[refine] No parseable result for project=${projectId}, keeping originals`);
  return { ok: true, files, durationMs: Date.now() - t0, warning: "Refinement skipped — AI response unparseable, original files preserved" };
}

function tryParseRefinement(content: string): Record<string, string> | null {
  if (!content || content.trim().length < 10) return null;

  // Strategy 1: Extract <file path="...">content</file> blocks (most reliable)
  const fileTagRe = /<file\s+path="([^"]+)">([\s\S]*?)<\/file>/g;
  const tagFiles: Record<string, string> = {};
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = fileTagRe.exec(content)) !== null) {
    const p = tagMatch[1].trim().replace(/^\.\//, "");
    const c = tagMatch[2].replace(/^\n/, "").replace(/\s+$/, "") + "\n";
    if (p && c.trim().length > 1) tagFiles[p] = c;
  }
  if (Object.keys(tagFiles).length > 0) return tagFiles;

  // Strategy 2: Direct JSON parse with cleanup
  try {
    let s = content.trim();
    // Strip markdown code fences
    const mdMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (mdMatch) s = mdMatch[1].trim();
    // Find JSON boundaries
    const openIdx = s.indexOf("{");
    if (openIdx < 0) throw new Error("no json");
    s = s.slice(openIdx);
    const closeIdx = s.lastIndexOf("}");
    if (closeIdx < 0) throw new Error("no json close");
    s = s.slice(0, closeIdx + 1);
    // Clean common LLM artifacts
    s = s
      .replace(/,\s*}/g, "}")       // trailing commas in objects
      .replace(/,\s*]/g, "]")       // trailing commas in arrays
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ""); // control chars (keep \n \r \t)
    const parsed = JSON.parse(s);
    const refined = parsed.files || parsed;
    if (typeof refined === "object" && !Array.isArray(refined) && Object.keys(refined).length > 0) return refined;
  } catch { /* fall through */ }

  // Strategy 3: Extract code fences with path hints (```lang path\n...```)
  const fenceRe = /```(?:\w+)?\s+((?:src|public|index|vite|tailwind|tsconfig|package|supabase)[^\n]*)\n([\s\S]*?)```/g;
  const fenceFiles: Record<string, string> = {};
  let fm: RegExpExecArray | null;
  while ((fm = fenceRe.exec(content)) !== null) {
    const p = fm[1].trim().replace(/^\.\//, "");
    const c = fm[2].replace(/^\n/, "").replace(/\s+$/, "") + "\n";
    if (p.includes(".") && c.trim().length > 1) fenceFiles[p] = c;
  }
  if (Object.keys(fenceFiles).length > 0) return fenceFiles;

  return null;
}

async function autoTriggerTick(_sc: SupabaseClient) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  try { await fetch(`${supabaseUrl}/functions/v1/orchestrator-tick`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` }, body: JSON.stringify({ _auto_trigger: true }) }); } catch {}
}

async function syncFilesFromLatestMessage(sc: SupabaseClient, projectId: string, lovableProjectId: string, token: string) {
  const latestRes = await fetch(`${EXT_API}/projects/${lovableProjectId}/chat/latest-message`, {
    headers: { Authorization: `Bearer ${token}`, Origin: "https://lovable.dev", Referer: "https://lovable.dev/", "X-Client-Git-SHA": GIT_SHA },
  });
  if (!latestRes.ok) return { ok: false, error: `HTTP ${latestRes.status}`, fileCount: 0 };
  const rawLatest = await latestRes.text();
  const msg = parseLatestMessage(rawLatest);
  if (!msg || msg.role === "user") return { ok: false, error: "no assistant message", fileCount: 0 };
  const body = extractMdBody(msg.content || "");
  const parsedFiles = extractFilesFromMarkdown(body);
  if (Object.keys(parsedFiles).length === 0) return { ok: false, error: "no file blocks", fileCount: 0 };
  const { data: cur } = await sc.from("cirius_projects").select("source_files_json").eq("id", projectId).maybeSingle();
  const merged = mergeFileMaps((cur?.source_files_json || {}) as Record<string, string>, parsedFiles);
  const fp = buildFilesFingerprint(merged);
  await sc.from("cirius_projects").update({ source_files_json: merged, files_fingerprint: fp, progress_pct: 80, generation_ended_at: new Date().toISOString() }).eq("id", projectId);
  return { ok: true, fileCount: Object.keys(merged).length };
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── MAIN HANDLER ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await getUser(req);
  const authHeader = req.headers.get("Authorization") || "";
  const isServiceKey = authHeader === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
  if (!user && !isServiceKey) return json({ error: "Unauthorized" }, 401);

  const sc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = await req.json().catch(() => ({}));
  let action = (body.action as string) || "";

  // ═══════════════════════════════════════════════════════════════════════
  // ─── NEW: action = 'start' — Full 5-step pipeline ──────────────────
  // ═══════════════════════════════════════════════════════════════════════
  if (action === "start") {
    const userPrompt = typeof body.user_prompt === "string" ? body.user_prompt.trim() : "";
    const projectName = typeof body.project_name === "string" ? body.project_name.trim() : "";
    const sourceUrl = typeof body.source_url === "string" ? body.source_url.trim() : "";
    const templateId = typeof body.template_id === "string" ? body.template_id.trim() : "";
    const config = body.config || {};
    const noBrains = config.no_brains === true;

    if (!userPrompt || userPrompt.length < 3) return json({ success: false, error: "user_prompt required (min 3 chars)" }, 400);
    if (!projectName || projectName.length < 2) return json({ success: false, error: "project_name required (min 2 chars)" }, 400);

    const effectiveUserId = user?.id || (isServiceKey ? body.user_id : null);
    if (!effectiveUserId) return json({ success: false, error: "user_id required" }, 400);

    // ── STEP 1: CLASSIFY ──────────────────────────────────────────────
    const blueprint = classifyIntent(userPrompt);

    // Create project first to get an ID for logging
    const { data: project, error: createErr } = await sc.from("cirius_projects").insert({
      user_id: effectiveUserId,
      name: projectName,
      description: userPrompt,
      template_type: blueprint.intent,
      source_url: sourceUrl || null,
      tech_stack: { framework: "react", css: "tailwind", ui: "shadcn" },
      features: blueprint.features,
      deploy_config: config,
      generation_engine: blueprint.suggestedEngine,
      status: "generating_prd",
      progress_pct: 5,
    }).select("id").single();

    if (createErr || !project) return json({ success: false, error: "Failed to create project" }, 500);
    const projectId = project.id;

    await logEntry(sc, projectId, "classify", "completed", `Intent: ${blueprint.intent}, engine: ${blueprint.suggestedEngine}, tasks: ${blueprint.estimatedTasks}`, {
      output_json: blueprint as unknown as Record<string, unknown>,
    });

    // ── STEP 2: SCRAPING (optional) ───────────────────────────────────
    let combinedPrompt = userPrompt;
    if (sourceUrl) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const scrapeRes = await fetch(`${supabaseUrl}/functions/v1/starcrawl`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ action: "generate_prompt", url: sourceUrl }),
        });
        if (scrapeRes.ok) {
          const scrapeData = await scrapeRes.json();
          if (scrapeData?.prompt) {
            combinedPrompt = `${userPrompt}\n\n[REFERÊNCIA VISUAL]\n${scrapeData.prompt}`;
            await logEntry(sc, projectId, "scrape", "completed", `Scrape da URL de referência concluído`, { metadata: { source_url: sourceUrl } });
          }
        }
      } catch {
        await logEntry(sc, projectId, "scrape", "failed", `Scrape falhou para ${sourceUrl} — continuando sem referência`);
      }
    }

    // ── STEP 3: PRD GENERATION ────────────────────────────────────────
    const prd = await generatePRD(sc, effectiveUserId, {
      name: projectName,
      description: combinedPrompt,
      template_type: blueprint.intent,
      features: blueprint.features,
      source_url: sourceUrl,
    }, projectId);

    if (!prd) {
      await sc.from("cirius_projects").update({ status: "failed", error_message: "Falha ao gerar PRD" }).eq("id", projectId);
      return json({ success: false, project_id: projectId, status: "failed", message: "PRD generation failed — all engines exhausted" });
    }

    await logEntry(sc, projectId, "prd", "completed", `PRD gerado: ${prd.tasks?.length} tasks`, {
      metadata: { tasks_count: prd.tasks?.length, design: prd.design },
    });

    // ── STEP 4: UPDATE PROJECT ────────────────────────────────────────
    await sc.from("cirius_projects").update({
      prd_json: prd,
      status: "generating_code",
      progress_pct: 20,
      generation_started_at: new Date().toISOString(),
    }).eq("id", projectId);

    // ── STEP 5: CODE GENERATION ──────────────────────────────────────

    // ═══ CLAUDE DIRECT MODE: Sequential task generation via OpenRouter ═══
    await sc.from("cirius_projects").update({ generation_engine: "claude_direct" }).eq("id", projectId);
    await logEntry(sc, projectId, "code", "started", `Claude Direct mode — ${prd.tasks.length} tasks sequenciais`);

    const CODE_SYS = `You are Cirius, an expert full-stack developer specializing in React + TypeScript + Tailwind CSS + shadcn/ui.

CRITICAL RULES:
1. Return ONLY code files wrapped in <file path="...">complete content</file> tags.
2. Every file must contain COMPLETE, FUNCTIONAL code — never use "..." or "// rest of code".
3. The FIRST task MUST include these mandatory files:
   - index.html (with <div id="root"></div> and <script type="module" src="/src/main.tsx"></script>)
   - src/main.tsx (with ReactDOM.createRoot rendering <App />)
   - src/App.tsx (with React Router <Routes> containing ALL page routes)
   - src/index.css (with @tailwind base; @tailwind components; @tailwind utilities;)
   - package.json, vite.config.ts, tailwind.config.js, tsconfig.json
4. Every page component must be a COMPLETE, styled, functional React component.
5. Use Tailwind CSS utility classes for ALL styling — no inline styles, no CSS modules.
6. Include realistic placeholder content (real-looking text, not "Lorem ipsum").
7. Components must handle loading states, empty states, and basic error states.
8. Use semantic HTML and responsive design (mobile-first).
9. Import icons from lucide-react.
10. Export page components as default exports.

TECH STACK: React 18, Vite 5, TypeScript, Tailwind CSS 3, shadcn/ui, React Router DOM 6, Supabase (if needed).`;

    let currentFiles: Record<string, string> = {};
    let tasksDone = 0;

    for (let i = 0; i < prd.tasks.length; i++) {
      const task = prd.tasks[i];
      const progressPct = Math.round(20 + (60 * (i / prd.tasks.length)));
      
      await sc.from("cirius_projects").update({
        progress_pct: progressPct,
        current_step: `task_${i + 1}_of_${prd.tasks.length}`,
      }).eq("id", projectId);

      await logEntry(sc, projectId, `task_${i + 1}`, "started", `Tarefa ${i + 1}/${prd.tasks.length}: ${task.title}`);

      // Build context with ALL existing files for subsequent tasks
      const fileContext = Object.keys(currentFiles).length > 0
        ? `\n\n## EXISTING FILES (${Object.keys(currentFiles).length} files) — You MUST maintain compatibility with these:\n${Object.entries(currentFiles).filter(([p]) => !p.startsWith(".cirius/")).slice(0, 30).map(([p, c]) => `<file path="${p}">\n${c.slice(0, 4000)}\n</file>`).join("\n\n")}`
        : "";

      const isFirstTask = i === 0;
      const foundationNote = isFirstTask
        ? `\n\nCRITICAL: This is the FIRST task. You MUST generate ALL foundation files (index.html, src/main.tsx, src/App.tsx with ALL routes, src/index.css, package.json, vite.config.ts, tailwind.config.js, tsconfig.json) PLUS all layout components (Header, Footer, etc.). The project must render correctly with just these files.`
        : `\n\nIMPORTANT: Files from previous tasks already exist. You MUST ensure your new files are compatible with them. If you need to update src/App.tsx to add routes, include the COMPLETE updated version.`;

      const taskPrompt = `## Project: "${projectName}"
## Description: ${combinedPrompt}
## Stack: React 18 + Vite 5 + TypeScript + Tailwind CSS 3 + shadcn/ui + React Router DOM${blueprint.needsDatabase ? " + Supabase" : ""}

## Task ${i + 1}/${prd.tasks.length}: ${task.title}

${task.prompt}
${foundationNote}
${fileContext}

Return ALL files using <file path="path/to/file.tsx">COMPLETE file content</file> tags. Every file must be fully functional.`;

      // Try OpenRouter (Claude) → Gateway → Gemini
      let genContent: string | null = null;
      let engine = "";

      const or = await sendViaOpenRouter(taskPrompt, CODE_SYS);
      if (or.content && or.content.length > 200) {
        genContent = or.content; engine = "openrouter";
      }
      if (!genContent) {
        const gw = await sendViaGateway(taskPrompt, CODE_SYS);
        if (gw.content && gw.content.length > 200) { genContent = gw.content; engine = "gateway"; }
      }
      if (!genContent) {
        const gem = await sendViaGeminiDirect(sc, taskPrompt, CODE_SYS);
        if (gem.content && gem.content.length > 200) { genContent = gem.content; engine = "gemini"; }
      }

      if (genContent) {
        const parsed = tryParseRefinement(genContent);
        if (parsed && Object.keys(parsed).length > 0) {
          currentFiles = smartMergeFiles(currentFiles, parsed);
          tasksDone++;
          // Persist intermediate
          await sc.from("cirius_projects").update({
            source_files_json: currentFiles, updated_at: new Date().toISOString(),
          }).eq("id", projectId);
          await logEntry(sc, projectId, `task_${i + 1}`, "completed", `${Object.keys(parsed).length} arquivos via ${engine}`, { metadata: { file_count: Object.keys(parsed).length, engine } });
        } else {
          await logEntry(sc, projectId, `task_${i + 1}`, "failed", "Sem arquivos parseáveis na resposta");
        }
      } else {
        await logEntry(sc, projectId, `task_${i + 1}`, "failed", "Todos os motores falharam para esta tarefa");
      }
    }

    if (tasksDone === 0 || Object.keys(currentFiles).length === 0) {
      await sc.from("cirius_projects").update({ status: "failed", error_message: "Nenhuma tarefa completou" }).eq("id", projectId);
      return json({ success: false, project_id: projectId, status: "failed", message: "No tasks completed" });
    }

    // ── POST-GENERATION VALIDATION: Ensure critical entry files exist ──
    if (!currentFiles["index.html"]) {
      currentFiles["index.html"] = `<!DOCTYPE html>\n<html lang="pt-BR" class="dark">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>${projectName}</title>\n  <meta name="description" content="${combinedPrompt.slice(0, 150)}" />\n  <link rel="preconnect" href="https://fonts.googleapis.com" />\n  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />\n  <script src="https://cdn.tailwindcss.com"><\/script>\n</head>\n<body>\n  <div id="root"></div>\n  <script type="module" src="/src/main.tsx"><\/script>\n</body>\n</html>`;
      await logEntry(sc, projectId, "validation", "warning", "index.html ausente — injetado automaticamente");
    }
    if (!currentFiles["src/main.tsx"]) {
      currentFiles["src/main.tsx"] = `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App'\nimport './index.css'\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n)`;
      await logEntry(sc, projectId, "validation", "warning", "src/main.tsx ausente — injetado automaticamente");
    }
    if (!currentFiles["src/index.css"]) {
      currentFiles["src/index.css"] = `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n:root {\n  --background: 0 0% 100%;\n  --foreground: 0 0% 3.9%;\n  --primary: 262.1 83.3% 57.8%;\n  --primary-foreground: 210 20% 98%;\n}\n.dark {\n  --background: 0 0% 3.9%;\n  --foreground: 0 0% 98%;\n  --primary: 263.4 70% 50.4%;\n  --primary-foreground: 210 20% 98%;\n}`;
      await logEntry(sc, projectId, "validation", "warning", "src/index.css ausente — injetado automaticamente");
    }

    // Refine
    const refResult = await refineSourceFiles(sc, projectId, currentFiles, projectName, combinedPrompt, prd);
    const finalFiles = refResult.ok ? refResult.files : currentFiles;

    await sc.from("cirius_projects").update({
      source_files_json: finalFiles,
      status: "live",
      progress_pct: 100,
      generation_ended_at: new Date().toISOString(),
      generation_engine: "claude_direct",
    }).eq("id", projectId);

    await logEntry(sc, projectId, "complete", "completed", `Claude Direct: ${Object.keys(finalFiles).length} arquivos, ${tasksDone}/${prd.tasks.length} tarefas`, {
      metadata: { file_count: Object.keys(finalFiles).length, tasks_done: tasksDone, refined: refResult.ok },
    });

    // ── AUTO-DEPLOY: Trigger GitHub + Netlify if integrations exist ──
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      // Fire-and-forget deploy (don't block response)
      fetch(`${supabaseUrl}/functions/v1/cirius-deploy`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deploy_all", project_id: projectId, service_key: true }),
      }).catch(() => {});
      await logEntry(sc, projectId, "auto_deploy", "started", "Auto-deploy disparado");
    } catch { /* non-critical */ }

    return json({
      success: true,
      project_id: projectId,
      status: "live",
      message: `Generated ${Object.keys(finalFiles).length} files via Claude Direct (${tasksDone}/${prd.tasks.length} tasks)`,
      file_count: Object.keys(finalFiles).length,
      engine: "claude_direct",
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── action = 'status' — Full project status ───────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  if (action === "status") {
    const projectId = body.project_id;
    if (!projectId) return json({ success: false, error: "project_id required" }, 400);
    const statusUserId = user?.id || (isServiceKey ? body.user_id : null);
    if (!statusUserId) return json({ success: false, error: "user_id required" }, 400);

    const { data: project } = await sc.from("cirius_projects")
      .select("id, name, status, current_step, progress_pct, generation_engine, error_message, preview_url, github_url, vercel_url, netlify_url, supabase_url, created_at, updated_at, orchestrator_project_id, lovable_project_id, brain_project_id, source_files_json, prd_json")
      .eq("id", projectId).eq("user_id", statusUserId).single();
    if (!project) return json({ success: false, error: "Not found" }, 404);

    const { data: logs } = await sc.from("cirius_generation_log")
      .select("step, status, level, message, created_at, duration_ms, error_msg, metadata")
      .eq("project_id", projectId).order("created_at", { ascending: false }).limit(30);

    let orchestrator: Record<string, unknown> | null = null;
    if (project.orchestrator_project_id) {
      const [{ data: orchProj }, { data: orchTasks }] = await Promise.all([
        sc.from("orchestrator_projects").select("*").eq("id", project.orchestrator_project_id).maybeSingle(),
        sc.from("orchestrator_tasks").select("*").eq("project_id", project.orchestrator_project_id).order("task_index"),
      ]);

      // Auto-reconcile
      if (orchProj?.status === "completed" && project.status === "generating_code") {
        await sc.from("cirius_projects").update({ status: "live", current_step: "completed", progress_pct: 100, generation_ended_at: new Date().toISOString(), error_message: null }).eq("id", projectId);
        (project as any).status = "live";
        (project as any).progress_pct = 100;
      }

      const completed = orchTasks?.filter((t: any) => t.status === "completed").length || 0;
      const total = orchTasks?.length || 0;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

      orchestrator = { project: orchProj, tasks: orchTasks, progress_percent: progress };
    }

    const fileCount = project.source_files_json ? Object.keys(project.source_files_json as any).length : 0;

    return json({
      success: true,
      project_id: projectId,
      status: project.status,
      progress_percent: project.progress_pct || 0,
      current_step: project.current_step,
      message: project.error_message || `Status: ${project.status}`,
      project,
      logs: logs || [],
      orchestrator,
      file_count: fileCount,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── action = 'cancel' ─────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  if (action === "cancel") {
    const projectId = body.project_id;
    if (!projectId) return json({ success: false, error: "project_id required" }, 400);
    const cancelUserId = user?.id || (isServiceKey ? body.user_id : null);
    if (!cancelUserId) return json({ success: false, error: "user_id required" }, 400);

    const { data: project } = await sc.from("cirius_projects")
      .select("id, orchestrator_project_id")
      .eq("id", projectId).eq("user_id", cancelUserId).single();
    if (!project) return json({ success: false, error: "Not found" }, 404);

    await sc.from("cirius_projects").update({ status: "failed", error_message: "Cancelado pelo usuário" }).eq("id", projectId);
    await logEntry(sc, projectId, "cancel", "completed", "Pipeline cancelado pelo usuário");

    // Cancel orchestrator if linked
    if (project.orchestrator_project_id) {
      await sc.from("orchestrator_projects").update({ status: "failed" }).eq("id", project.orchestrator_project_id);
    }

    return json({ success: true, project_id: projectId, status: "cancelled", message: "Pipeline cancelled" });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── LEGACY ACTIONS (preserved) ────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════

  // ─── BUILD_PROMPT ───
  if (action === "build_prompt") {
    const projectId = typeof body.project_id === "string" ? body.project_id.trim() : "";
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!projectId || projectId.length < 10) return json({ error: "project_id required" }, 400);
    if (!prompt || prompt.length < 3) return json({ error: "prompt required" }, 400);
    const effectiveUserId = user?.id || (isServiceKey ? body.user_id : null);
    if (!effectiveUserId) return json({ error: "user_id required" }, 400);
    const { data: proj } = await sc.from("cirius_projects").select("*").eq("id", projectId).eq("user_id", effectiveUserId).single();
    if (!proj) return json({ error: "Project not found" }, 404);
    await sc.from("cirius_projects").update({ description: prompt, status: "generating_prd", progress_pct: 5 }).eq("id", projectId);
    let prd = proj.prd_json as any;
    if (!prd?.tasks?.length) {
      prd = await generatePRD(sc, effectiveUserId, { ...proj, description: prompt }, projectId);
      if (!prd) { await sc.from("cirius_projects").update({ status: "failed", error_message: "PRD failed" }).eq("id", projectId); return json({ error: "PRD generation failed" }, 500); }
    }
    const prdMd = `# PRD — ${proj.name}\n\n${prd.tasks.map((t: any, i: number) => `### ${i + 1}. ${t.title}\n${t.prompt}\n`).join("\n")}`;
    const ef = (proj.source_files_json || {}) as Record<string, string>;
    await sc.from("cirius_projects").update({ prd_json: prd, status: "draft", progress_pct: 15, source_files_json: { ...ef, ".cirius/prd/prd.md": prdMd } }).eq("id", projectId);
    return json({ status: "awaiting_approval", prd_json: prd, task_count: prd.tasks?.length || 0, design: prd.design || null, project_id: projectId });
  }

  // ─── APPROVE_PRD ───
  if (action === "approve_prd") {
    const projectId = typeof body.project_id === "string" ? body.project_id.trim() : "";
    if (!projectId) return json({ error: "project_id required" }, 400);
    const effectiveUserId = user?.id || (isServiceKey ? body.user_id : null);
    if (!effectiveUserId) return json({ error: "user_id required" }, 400);
    const { data: proj } = await sc.from("cirius_projects").select("*").eq("id", projectId).eq("user_id", effectiveUserId).single();
    if (!proj) return json({ error: "Not found" }, 404);
    if (!(proj.prd_json as any)?.tasks?.length) return json({ error: "No PRD" }, 400);
    await logEntry(sc, projectId, "approve_prd", "completed", "PRD aprovado");
    body.project_id = projectId;
    action = "generate_code";
  }

  // ─── OAUTH_STATE ───
  if (action === "oauth_state") {
    const provider = body.provider;
    if (!provider || !["github", "vercel", "netlify", "supabase"].includes(provider)) return json({ error: "Invalid provider" }, 400);
    const stateSecret = Deno.env.get("CLF_TOKEN_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const ts = String(Date.now());
    const sig = await hmacSign(`${user!.id}:${ts}`, stateSecret);
    const state = btoa(JSON.stringify({ user_id: user!.id, ts, sig }));
    const callbackUrl = `${Deno.env.get("SUPABASE_URL")!}/functions/v1/cirius-oauth-callback?provider=${provider}`;
    const { data: vk } = await sc.from("api_key_vault").select("api_key_encrypted").eq("provider", provider).eq("is_active", true).order("requests_count", { ascending: true }).limit(1).maybeSingle();
    const clientId = vk?.api_key_encrypted || Deno.env.get(`CIRIUS_${provider.toUpperCase()}_CLIENT_ID`) || "";
    if (!clientId) return json({ error: `${provider} OAuth not configured` }, 400);
    const urls: Record<string, string> = {
      github: `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo,read:user&state=${state}&redirect_uri=${encodeURIComponent(callbackUrl)}`,
      vercel: `https://vercel.com/oauth/authorize?client_id=${clientId}&scope=user&state=${state}&redirect_uri=${encodeURIComponent(callbackUrl)}`,
      netlify: `https://app.netlify.com/authorize?client_id=${clientId}&response_type=code&state=${state}&redirect_uri=${encodeURIComponent(callbackUrl)}`,
      supabase: `https://api.supabase.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&state=${state}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=all`,
    };
    return json({ auth_url: urls[provider] });
  }

  // ─── SAVE_GITHUB_INTEGRATION ───
  if (action === "save_github_integration") {
    const ghToken = (body.github_token as string || "").trim();
    if (!ghToken) return json({ error: "Token required" }, 400);
    let login = "", accId = "";
    try {
      const res = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${ghToken}`, "User-Agent": "Cirius" } });
      if (!res.ok) { await res.text().catch(() => {}); return json({ error: "Token inválido" }, 400); }
      const u = await res.json(); login = u.login || ""; accId = String(u.id || "");
    } catch { return json({ error: "Falha ao validar token" }, 400); }
    await sc.from("cirius_integrations").upsert({ user_id: user!.id, provider: "github", access_token_enc: ghToken, account_login: login, account_id: accId, is_active: true, updated_at: new Date().toISOString() }, { onConflict: "user_id,provider" });
    return json({ ok: true, account: login });
  }

  // ─── SAVE_VERCEL_INTEGRATION ───
  if (action === "save_vercel_integration") {
    const vToken = (body.vercel_token as string || "").trim();
    if (!vToken) return json({ error: "Token required" }, 400);
    let login = "", accId = "";
    try {
      const res = await fetch("https://api.vercel.com/v2/user", { headers: { Authorization: `Bearer ${vToken}` } });
      if (!res.ok) { await res.text().catch(() => {}); return json({ error: "Token inválido" }, 400); }
      const u = await res.json(); login = u.user?.username || u.user?.email || ""; accId = u.user?.uid || "";
    } catch { return json({ error: "Falha ao validar token" }, 400); }
    await sc.from("cirius_integrations").upsert({ user_id: user!.id, provider: "vercel", access_token_enc: vToken, account_login: login, account_id: accId, is_active: true, updated_at: new Date().toISOString() }, { onConflict: "user_id,provider" });
    return json({ ok: true, account: login });
  }

  // ─── SAVE_SUPABASE_INTEGRATION ───
  if (action === "save_supabase_integration") {
    const sbUrl = typeof body.supabase_url === "string" ? body.supabase_url.trim() : "";
    const srvKey = typeof body.service_key === "string" ? body.service_key.trim() : "";
    if (!sbUrl || !srvKey) return json({ error: "URL e Service Key obrigatórios" }, 400);
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(sbUrl)) return json({ error: "URL inválida" }, 400);
    const ref = sbUrl.match(/https:\/\/([^.]+)/)?.[1] || "";
    if (!ref || ref.length < 10) return json({ error: "URL inválida" }, 400);
    await sc.from("cirius_integrations").upsert({ user_id: user!.id, provider: "supabase", service_key_enc: srvKey, project_ref: ref, account_login: sbUrl, is_active: true, updated_at: new Date().toISOString() }, { onConflict: "user_id,provider" });
    return json({ ok: true });
  }

  // ─── INIT ───
  if (action === "init") {
    const config = body.config || {};
    const name = typeof config.name === "string" ? config.name.trim() : "";
    if (!name || name.length < 2) return json({ error: "config.name required" }, 400);
    const desc = typeof config.description === "string" ? config.description.trim().slice(0, 5000) : null;
    const tpl = typeof config.template_type === "string" ? config.template_type.slice(0, 50) : "custom";
    const srcUrl = typeof config.source_url === "string" ? config.source_url.slice(0, 500) : null;
    const feats = Array.isArray(config.features) ? config.features.filter((f: any) => typeof f === "string").slice(0, 20) : [];
    const { data: proj, error } = await sc.from("cirius_projects").insert({
      user_id: user!.id, name, description: desc, template_type: tpl, source_url: srcUrl,
      tech_stack: config.tech_stack || { framework: "react", css: "tailwind", ui: "shadcn" },
      features: feats, deploy_config: config.deploy_config || {}, status: "draft",
    }).select("id, status").single();
    if (error) return json({ error: "Failed to create project" }, 500);
    await logEntry(sc, proj!.id, "init", "completed", `Projeto criado: "${name}"`);
    return json({ project_id: proj!.id, status: "draft" });
  }

  // ─── GENERATE_PRD ───
  if (action === "generate_prd") {
    const projectId = body.project_id;
    if (!projectId) return json({ error: "project_id required" }, 400);
    const { data: proj } = await sc.from("cirius_projects").select("*").eq("id", projectId).eq("user_id", user!.id).single();
    if (!proj) return json({ error: "Not found" }, 404);
    if ((proj.prd_json as any)?.tasks?.length > 0) return json({ prd_json: proj.prd_json, cached: true, task_count: (proj.prd_json as any).tasks.length });
    await sc.from("cirius_projects").update({ status: "generating_prd" }).eq("id", projectId);
    const prd = await generatePRD(sc, user!.id, proj, projectId);
    if (!prd) { await sc.from("cirius_projects").update({ status: "failed", error_message: "PRD failed" }).eq("id", projectId); return json({ error: "PRD generation failed" }, 500); }
    await sc.from("cirius_projects").update({ prd_json: prd, generation_engine: "brainchain", status: "draft", progress_pct: 15 }).eq("id", projectId);
    return json({ prd_json: prd, task_count: prd.tasks.length, design: prd.design || null });
  }

  // ─── GENERATE_CODE (Claude Direct) ───
  if (action === "generate_code") {
    const projectId = body.project_id;
    if (!projectId) return json({ error: "project_id required" }, 400);
    const effectiveUserId = user?.id || (isServiceKey ? body.user_id : null);
    if (!effectiveUserId) return json({ error: "user_id required" }, 400);
    let pq = sc.from("cirius_projects").select("*").eq("id", projectId);
    if (user) pq = pq.eq("user_id", user.id);
    const { data: proj } = await pq.single();
    if (!proj) return json({ error: "Not found" }, 404);
    if (!proj.prd_json) return json({ error: "PRD not generated" }, 400);

    await sc.from("cirius_projects").update({ status: "generating_code", generation_started_at: new Date().toISOString(), progress_pct: 20, generation_engine: "claude_direct" }).eq("id", projectId);
    const prd = proj.prd_json as any;
    const CODE_SYS = `You are Cirius, an expert full-stack developer. Return ONLY code files wrapped in <file path="...">complete content</file> tags. Every file must be COMPLETE and FUNCTIONAL. Always include: index.html (with #root div and module script), src/main.tsx (ReactDOM.createRoot), src/App.tsx (with all routes), src/index.css (Tailwind directives), package.json, vite.config.ts, tailwind.config.js, tsconfig.json.`;

    let currentFiles: Record<string, string> = (proj.source_files_json || {}) as Record<string, string>;
    let tasksDone = 0;

    for (let i = 0; i < prd.tasks.length; i++) {
      const task = prd.tasks[i];
      const pctNow = Math.round(20 + (60 * (i / prd.tasks.length)));
      await sc.from("cirius_projects").update({ progress_pct: pctNow, current_step: `task_${i + 1}` }).eq("id", projectId);
      await logEntry(sc, projectId, `task_${i + 1}`, "started", `Tarefa ${i + 1}: ${task.title}`);

      const isFirstTask = i === 0;
      const fileCtx = Object.keys(currentFiles).length > 0
        ? `\n\nExisting files:\n${Object.entries(currentFiles).filter(([p]) => !p.startsWith(".cirius/")).slice(0, 25).map(([p, c]) => `<file path="${p}">\n${c.slice(0, 3000)}\n</file>`).join("\n\n")}`
        : "";
      const foundationNote = isFirstTask ? "\n\nCRITICAL: Generate ALL foundation files (index.html, main.tsx, App.tsx with routes, index.css, config files) plus layout components." : "\n\nMaintain compatibility with existing files. Include updated App.tsx if adding routes.";
      const taskPrompt = `Project: "${proj.name}"\n\n## Task ${i + 1}: ${task.title}\n${task.prompt}${foundationNote}${fileCtx}\n\nReturn ALL files using <file path="...">COMPLETE content</file>.`;

      let genContent: string | null = null;
      let engine = "";
      const or = await sendViaOpenRouter(taskPrompt, CODE_SYS);
      if (or.content && or.content.length > 200) { genContent = or.content; engine = "openrouter"; }
      if (!genContent) { const gw = await sendViaGateway(taskPrompt, CODE_SYS); if (gw.content && gw.content.length > 200) { genContent = gw.content; engine = "gateway"; } }

      if (genContent) {
        const parsed = tryParseRefinement(genContent);
        if (parsed && Object.keys(parsed).length > 0) {
          currentFiles = { ...currentFiles, ...parsed };
          tasksDone++;
          await sc.from("cirius_projects").update({ source_files_json: currentFiles }).eq("id", projectId);
          await logEntry(sc, projectId, `task_${i + 1}`, "completed", `${Object.keys(parsed).length} arquivos via ${engine}`);
        }
      }
    }

    if (tasksDone === 0) {
      await sc.from("cirius_projects").update({ status: "failed", error_message: "No tasks completed" }).eq("id", projectId);
      return json({ error: "No tasks completed" }, 500);
    }

    const refResult = await refineSourceFiles(sc, projectId, currentFiles, proj.name || "", proj.description || "", prd);
    const finalFiles = refResult.ok ? refResult.files : currentFiles;
    await sc.from("cirius_projects").update({ source_files_json: finalFiles, status: "live", progress_pct: 100, generation_ended_at: new Date().toISOString() }).eq("id", projectId);
    await logEntry(sc, projectId, "complete", "completed", `Claude Direct: ${Object.keys(finalFiles).length} files, ${tasksDone} tasks`);
    return json({ started: true, engine: "claude_direct", task_count: tasksDone, file_count: Object.keys(finalFiles).length });
  }

  // ─── CAPTURE ───
  if (action === "capture") {
    const projectId = body.project_id;
    if (!projectId) return json({ error: "project_id required" }, 400);
    const { data: proj } = await sc.from("cirius_projects").select("*").eq("id", projectId).eq("user_id", user!.id).single();
    if (!proj) return json({ error: "Not found" }, 404);
    const targetId = body.lovable_project_id || proj.lovable_project_id;
    if (!targetId) return json({ error: "No lovable_project_id" }, 400);
    const tok = await getUserToken(sc, user!.id);
    if (!tok) return json({ error: "No Lovable token" }, 503);
    const r = await syncFilesFromLatestMessage(sc, projectId, targetId, tok);
    if (!r.ok) return json({ error: "Capture failed", details: r.error }, 500);
    const { data: saved } = await sc.from("cirius_projects").select("source_files_json, files_fingerprint").eq("id", projectId).maybeSingle();
    return json({ files_json: saved?.source_files_json || {}, file_count: r.fileCount, capture_mode: "markdown_mining" });
  }

  // ─── REFINE ───
  if (action === "refine") {
    const projectId = body.project_id;
    if (!projectId) return json({ error: "project_id required" }, 400);
    let pq = sc.from("cirius_projects").select("id, source_files_json, prd_json, name, description, user_id").eq("id", projectId);
    if (user) pq = pq.eq("user_id", user.id);
    const { data: proj } = await pq.single();
    if (!proj) return json({ error: "Not found" }, 404);
    const files = (proj.source_files_json || {}) as Record<string, string>;
    if (Object.keys(files).length === 0) return json({ error: "No files to refine" }, 400);
    await sc.from("cirius_projects").update({ current_step: "refining", progress_pct: 85 }).eq("id", projectId);
    const result = await refineSourceFiles(sc, projectId, files, proj.name || "", proj.description || "", proj.prd_json);
    if (result.ok && result.files) {
      const fp = buildFilesFingerprint(result.files);
      await sc.from("cirius_projects").update({ source_files_json: result.files, files_fingerprint: fp, current_step: "refined", progress_pct: 95 }).eq("id", projectId);
      await sc.from("code_snapshots").insert({ project_id: projectId, files_json: result.files, file_count: Object.keys(result.files).length, fingerprint: fp, phase: 2 });
      // Auto-deploy check
      const { data: ghInt } = await sc.from("cirius_integrations").select("id").eq("user_id", proj.user_id).eq("provider", "github").eq("is_active", true).maybeSingle();
      if (ghInt) {
        await sc.from("cirius_projects").update({ status: "deploying", current_step: "deploy_github", progress_pct: 90 }).eq("id", projectId);
        const sUrl = Deno.env.get("SUPABASE_URL")!; const sKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        fetch(`${sUrl}/functions/v1/cirius-deploy`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sKey}` }, body: JSON.stringify({ action: "github", project_id: projectId }) }).catch(() => {});
      } else {
        await sc.from("cirius_projects").update({ status: "live", current_step: "done", progress_pct: 100, generation_ended_at: new Date().toISOString() }).eq("id", projectId);
      }
      return json({ ok: true, file_count: Object.keys(result.files).length, refined: true, auto_deploy: !!ghInt });
    }
    return json({ ok: false, error: result.error, refined: false });
  }

  // ─── DEBUG_LOG ───
  if (action === "debug_log") {
    const projectId = body.project_id;
    if (!projectId) return json({ error: "project_id required" }, 400);
    const { data: proj } = await sc.from("cirius_projects").select("*").eq("id", projectId).eq("user_id", user!.id).single();
    if (!proj) return json({ error: "Not found" }, 404);
    const [{ data: logs }, { data: orchProj }, { data: orchTasks }, { data: bcAcc }] = await Promise.all([
      sc.from("cirius_generation_log").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(50),
      proj.orchestrator_project_id ? sc.from("orchestrator_projects").select("*").eq("id", proj.orchestrator_project_id).maybeSingle() : Promise.resolve({ data: null }),
      proj.orchestrator_project_id ? sc.from("orchestrator_tasks").select("*").eq("project_id", proj.orchestrator_project_id).order("task_index") : Promise.resolve({ data: null }),
      sc.from("brainchain_accounts").select("id, email, brain_type, is_active, is_busy, error_count, request_count, last_used_at").order("last_used_at", { ascending: false }).limit(10),
    ]);
    return json({
      diagnostics: {
        status: proj.status, error: proj.error_message, progress: proj.progress_pct,
        has_prd: !!(proj.prd_json as any)?.tasks?.length,
        orchestrator_status: orchProj?.status || "none",
        tasks_completed: orchTasks?.filter((t: any) => t.status === "completed").length || 0,
        tasks_failed: orchTasks?.filter((t: any) => t.status === "failed").length || 0,
        brainchain_active: bcAcc?.filter((a: any) => a.is_active).length || 0,
      },
      cirius_logs: logs || [],
      orchestrator_tasks: orchTasks || [],
      brainchain_accounts: bcAcc || [],
    });
  }

  // ─── PAUSE / RESUME ───
  if (action === "pause" || action === "resume") {
    const projectId = body.project_id;
    if (!projectId) return json({ error: "project_id required" }, 400);
    const st = action === "pause" ? "paused" : "generating_code";
    await sc.from("cirius_projects").update({ status: st }).eq("id", projectId).eq("user_id", user!.id);
    await logEntry(sc, projectId, action, "completed", `Pipeline ${action === "pause" ? "pausado" : "retomado"}`);
    return json({ [action === "pause" ? "paused" : "resumed"]: true });
  }

  return json({ error: "unknown_action" }, 400);
});
