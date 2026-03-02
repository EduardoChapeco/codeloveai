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

async function sendViaGateway(prompt: string, systemPrompt?: string) {
  const key = Deno.env.get("LOVABLE_API_KEY");
  const t0 = Date.now();
  if (!key) return { content: null, durationMs: 0, error: "LOVABLE_API_KEY not set" };
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "system", content: systemPrompt || "Return only valid JSON, no markdown fences." }, { role: "user", content: prompt }], temperature: 0.2, max_tokens: 3000 }),
    });
    const d = Date.now() - t0;
    if (res.ok) { const r = await res.json(); return { content: r?.choices?.[0]?.message?.content || null, durationMs: d }; }
    const e = await res.text().catch(() => ""); return { content: null, durationMs: d, error: `HTTP ${res.status}: ${e.slice(0, 100)}` };
  } catch (e) { return { content: null, durationMs: Date.now() - t0, error: (e as Error).message.slice(0, 100) }; }
}

async function sendViaGeminiDirect(sc: SupabaseClient, prompt: string, systemPrompt?: string) {
  const t0 = Date.now();
  const { data: vk } = await sc.from("api_key_vault").select("id, api_key_encrypted, requests_count").eq("provider", "gemini").eq("is_active", true).order("requests_count", { ascending: true }).limit(1).maybeSingle();
  if (!vk?.api_key_encrypted) return { content: null, durationMs: 0, error: "No Gemini key in vault" };
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${vk.api_key_encrypted}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: `${systemPrompt || "Return only valid JSON."}\n\n${prompt}` }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 4000 } }),
    });
    const d = Date.now() - t0;
    await sc.from("api_key_vault").update({ requests_count: (vk.requests_count || 0) + 1, last_used_at: new Date().toISOString() }).eq("id", vk.id);
    if (res.ok) { const r = await res.json(); return { content: r?.candidates?.[0]?.content?.parts?.[0]?.text || null, durationMs: d }; }
    const e = await res.text().catch(() => ""); return { content: null, durationMs: d, error: `HTTP ${res.status}: ${e.slice(0, 100)}` };
  } catch (e) { return { content: null, durationMs: Date.now() - t0, error: (e as Error).message.slice(0, 100) }; }
}

// ─── PRD Generation (multi-engine cascade) ────────────────────────────────

async function generatePRD(sc: SupabaseClient, userId: string, project: Record<string, any>, projectId: string): Promise<any> {
  const features = Array.isArray(project.features) ? project.features : [];
  const prompt = `IMPORTANTE: Não faça perguntas. Execute diretamente.

Você é um arquiteto de software sênior. Decomponha o projeto em tarefas para brains ESPECIALIZADOS.

Brains disponíveis: "database", "design", "frontend", "backend", "code", "review"

Projeto:
Nome: ${project.name}
Tipo: ${project.template_type || "app"}
Descrição: ${project.description || ""}
Features: ${features.join(", ") || "basic"}
URL de referência: ${project.source_url || "none"}
Stack: React + Tailwind + shadcn/ui + Supabase

Retorne APENAS JSON válido:
{"tasks":[{"title":"Título","brain_type":"frontend","skill":"code","intent":"security_fix_v2","prompt":"Prompt detalhado","depends_on":[],"stop_condition":"file_exists:src/App.tsx"}],"design":{"primary_color":"#6366f1","font":"Geist","style":"modern_minimal","pages":["Home"],"tables":["users"]}}

Regras:
- intent DEVE ser security_fix_v2
- SEMPRE comece com "database" se o projeto precisa de dados
- SEMPRE inclua "design" cedo para o sistema visual
- SEMPRE termine com "review" para checagem holística
- depends_on: array de índices
- Máximo 8 tarefas`;

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

  // 3. GEMINI (Vault)
  const gm = await sendViaGeminiDirect(sc, prompt);
  if (gm.content) { const p = extractJSON(gm.content); if (p) { await logEntry(sc, projectId, "prd_gemini", "completed", `Gemini PRD: ${p.tasks?.length} tasks`, { duration_ms: gm.durationMs }); return p; } }
  attempts.push({ engine: "gemini", ok: false, durationMs: gm.durationMs, error: gm.error });

  // 4. AI GATEWAY (último recurso)
  const gw = await sendViaGateway(prompt);
  if (gw.content) { const p = extractJSON(gw.content); if (p) { await logEntry(sc, projectId, "prd_gateway", "completed", `Gateway PRD: ${p.tasks?.length} tasks`, { duration_ms: gw.durationMs }); return p; } }
  attempts.push({ engine: "gateway", ok: false, durationMs: gw.durationMs, error: gw.error });

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

  // Try Gateway first
  const gw = await sendViaGateway(prompt, sys);
  if (gw.content) {
    const p = tryParseRefinement(gw.content);
    if (p) return { ok: true, files: mergeFileMaps(files, p), durationMs: Date.now() - t0 };
  }

  // Fallback to OpenRouter
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

    if (noBrains) {
      // ═══ NO BRAINS MODE: Direct Claude/OpenRouter generation ═══
      await sc.from("cirius_projects").update({ generation_engine: "claude_direct" }).eq("id", projectId);
      await logEntry(sc, projectId, "code", "started", "No Brains mode — generating directly via Claude (OpenRouter)");

      // Build a comprehensive prompt with all PRD tasks
      const taskPrompts = prd.tasks.map((t: any, i: number) => `### Task ${i + 1}: ${t.title}\n${t.prompt}`).join("\n\n");
      const codePrompt = `You are a senior full-stack engineer. Generate a COMPLETE, production-ready project.

## Project: "${projectName}"
## Description: ${combinedPrompt}
## Stack: React 18 + Vite 5 + TypeScript + Tailwind CSS 3 + shadcn/ui + React Router DOM
${blueprint.needsDatabase ? "## Database: Supabase (PostgreSQL + Auth + Storage)" : ""}

## PRD Tasks:
${taskPrompts}

## RULES:
- Return ALL files using <file path="path/to/file.tsx">content</file> tags
- Include: App.tsx, main.tsx, index.css, all pages, components, hooks, lib utilities
- Use modern, responsive design with dark mode support
- Include loading states, empty states, error handling
- Use shadcn/ui components (Button, Card, Input, etc.)
- Use React Router DOM for navigation
- DO NOT use mock data — connect to Supabase if database is needed
- Each file must be COMPLETE and functional`;

      const sysPrompt = "You are an expert React/TypeScript developer. Return only code files wrapped in <file path=\"...\">content</file> tags. No explanations outside file tags.";

      // Try OpenRouter (Claude) first, then Gateway, then Gemini Direct
      let generatedContent: string | null = null;
      let engine = "";

      const or = await sendViaOpenRouter(codePrompt, sysPrompt);
      if (or.content && or.content.length > 200) {
        generatedContent = or.content;
        engine = "openrouter_claude";
        await logEntry(sc, projectId, "code_claude", "completed", `Claude generated ${or.content.length} chars in ${or.durationMs}ms`);
      }

      if (!generatedContent) {
        const gw = await sendViaGateway(codePrompt, sysPrompt);
        if (gw.content && gw.content.length > 200) {
          generatedContent = gw.content;
          engine = "lovable_gateway";
          await logEntry(sc, projectId, "code_gateway", "completed", `Gateway generated ${gw.content.length} chars in ${gw.durationMs}ms`);
        }
      }

      if (!generatedContent) {
        const gem = await sendViaGeminiDirect(sc, codePrompt, sysPrompt);
        if (gem.content && gem.content.length > 200) {
          generatedContent = gem.content;
          engine = "gemini_direct";
          await logEntry(sc, projectId, "code_gemini", "completed", `Gemini generated ${gem.content.length} chars in ${gem.durationMs}ms`);
        }
      }

      if (!generatedContent) {
        await sc.from("cirius_projects").update({ status: "failed", error_message: "All AI engines failed to generate code" }).eq("id", projectId);
        await logEntry(sc, projectId, "code", "failed", "No Brains: all engines exhausted");
        return json({ success: false, project_id: projectId, status: "failed", message: "Code generation failed — all engines exhausted" });
      }

      // Parse files from response
      const parsedFiles = tryParseRefinement(generatedContent);
      if (!parsedFiles || Object.keys(parsedFiles).length === 0) {
        await sc.from("cirius_projects").update({ status: "failed", error_message: "AI response contained no parseable files" }).eq("id", projectId);
        await logEntry(sc, projectId, "code", "failed", "No parseable files in AI response");
        return json({ success: false, project_id: projectId, status: "failed", message: "No parseable files in AI response" });
      }

      // Refine
      const refResult = await refineSourceFiles(sc, projectId, parsedFiles, projectName, combinedPrompt, prd);

      const finalFiles = refResult.ok ? refResult.files : parsedFiles;

      await sc.from("cirius_projects").update({
        source_files_json: finalFiles,
        status: "live",
        progress_pct: 100,
        generation_ended_at: new Date().toISOString(),
        generation_engine: engine,
      }).eq("id", projectId);

      await logEntry(sc, projectId, "complete", "completed", `No Brains complete: ${Object.keys(finalFiles).length} files via ${engine}`, {
        metadata: { file_count: Object.keys(finalFiles).length, engine, refined: refResult.ok },
      });

      return json({
        success: true,
        project_id: projectId,
        status: "live",
        message: `Generated ${Object.keys(finalFiles).length} files directly via ${engine}`,
        file_count: Object.keys(finalFiles).length,
        engine,
      });
    }

    // ═══ STANDARD MODE: Brain + Orchestrator pipeline ═══
    // Acquire brain for orchestrator
    const { data: bcAccounts } = await sc.from("brainchain_accounts")
      .select("id, brain_project_id, brain_type")
      .eq("is_active", true).eq("is_busy", false).lt("error_count", 5)
      .not("brain_project_id", "is", null)
      .order("last_used_at", { ascending: true, nullsFirst: true })
      .limit(1);

    let brainProjectId = bcAccounts?.[0]?.brain_project_id || null;
    if (!brainProjectId) {
      const brain = await getUserBrain(sc, effectiveUserId);
      brainProjectId = brain?.projectId || null;
    }

    if (!brainProjectId) {
      await sc.from("cirius_projects").update({ status: "failed", error_message: "Nenhum Brain disponível" }).eq("id", projectId);
      await logEntry(sc, projectId, "code", "failed", "No brain project available");
      return json({ success: false, project_id: projectId, status: "failed", message: "No brain project available" });
    }

    await sc.from("cirius_projects").update({ brain_project_id: brainProjectId }).eq("id", projectId);

    // Create orchestrator project + tasks
    const prdCtx = `[CONTEXTO]\nNome: ${projectName}\nDescrição: ${combinedPrompt}\nStack: React + Tailwind + shadcn/ui + Supabase\n\n[PRD]\n${prd.tasks.map((t: any, i: number) => `${i + 1}. ${t.title}: ${t.prompt?.slice(0, 200)}`).join("\n")}\n\n`;

    const { data: orchProject, error: orchErr } = await sc.from("orchestrator_projects").insert({
      user_id: effectiveUserId, client_prompt: combinedPrompt,
      status: "paused", total_tasks: prd.tasks.length, prd_json: prd,
      lovable_project_id: brainProjectId,
    }).select("id").single();

    if (orchErr || !orchProject) {
      await sc.from("cirius_projects").update({ status: "failed", error_message: "Orchestrator registration failed" }).eq("id", projectId);
      return json({ success: false, project_id: projectId, status: "failed", message: "Orchestrator registration failed" });
    }

    const taskInserts = prd.tasks.map((t: any, i: number) => ({
      project_id: orchProject.id, task_index: i,
      title: t.title || `Task ${i + 1}`,
      intent: t.intent || "security_fix_v2",
      prompt: prdCtx + `[ESPECIALIDADE: ${t.title}]\n\n${t.prompt}`,
      stop_condition: t.stop_condition || null,
      brain_type: t.brain_type || "code",
    }));

    const { error: taskErr } = await sc.from("orchestrator_tasks").insert(taskInserts);
    if (taskErr) {
      await sc.from("orchestrator_projects").delete().eq("id", orchProject.id);
      await sc.from("cirius_projects").update({ status: "failed", error_message: `Task insertion failed: ${taskErr.message}` }).eq("id", projectId);
      return json({ success: false, project_id: projectId, status: "failed", message: taskErr.message });
    }

    await sc.from("cirius_projects").update({
      orchestrator_project_id: orchProject.id, progress_pct: 25,
    }).eq("id", projectId);

    await logEntry(sc, projectId, "code", "started",
      `Pipeline iniciado: ${prd.tasks.length} tarefas → Brain ${brainProjectId.slice(0, 8)} (orch: ${orchProject.id.slice(0, 8)})`, {
      metadata: { orchestrator_id: orchProject.id, brain_project: brainProjectId, task_count: prd.tasks.length },
    });

    // Fire orchestrator tick
    autoTriggerTick(sc).catch(() => {});

    // Return immediately — generation is async
    return json({
      success: true,
      project_id: projectId,
      status: "generating_code",
      message: `Pipeline started: ${prd.tasks.length} tasks via ${blueprint.suggestedEngine}`,
      blueprint,
      prd_task_count: prd.tasks.length,
      orchestrator_project_id: orchProject.id,
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

  // ─── GENERATE_CODE ───
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

    const { data: bcAcc } = await sc.from("brainchain_accounts")
      .select("id, brain_project_id").eq("is_active", true).eq("is_busy", false).lt("error_count", 5)
      .not("brain_project_id", "is", null).order("last_used_at", { ascending: true, nullsFirst: true }).limit(1);
    let bpId = bcAcc?.[0]?.brain_project_id || null;
    if (!bpId) { const b = await getUserBrain(sc, effectiveUserId); bpId = b?.projectId || null; }
    if (!bpId) { await sc.from("cirius_projects").update({ status: "failed", error_message: "No Brain available" }).eq("id", projectId); return json({ error: "No brain project available" }, 503); }

    await sc.from("cirius_projects").update({ brain_project_id: bpId }).eq("id", projectId);

    if (proj.orchestrator_project_id) {
      await sc.from("orchestrator_projects").update({ status: "paused", quality_score: 0, lovable_project_id: bpId }).eq("id", proj.orchestrator_project_id);
      await sc.from("cirius_projects").update({ status: "generating_code", error_message: null, progress_pct: 25 }).eq("id", projectId);
      autoTriggerTick(sc).catch(() => {});
      return json({ started: true, engine: "orchestrator", orchestrator_project_id: proj.orchestrator_project_id, resumed: true });
    }

    await sc.from("cirius_projects").update({ status: "generating_code", generation_started_at: new Date().toISOString(), progress_pct: 20 }).eq("id", projectId);
    const prd = proj.prd_json as any;
    const prdCtx = `[CONTEXTO]\nNome: ${proj.name}\nStack: React + Tailwind + shadcn/ui + Supabase\n\n[PRD]\n${prd.tasks.map((t: any, i: number) => `${i + 1}. ${t.title}: ${t.prompt?.slice(0, 200)}`).join("\n")}\n\n`;
    const { data: orchProj, error: orchErr } = await sc.from("orchestrator_projects").insert({
      user_id: effectiveUserId, client_prompt: proj.description || proj.name,
      status: "paused", total_tasks: prd.tasks.length, prd_json: prd, lovable_project_id: bpId,
    }).select("id").single();
    if (orchErr || !orchProj) { await sc.from("cirius_projects").update({ status: "failed" }).eq("id", projectId); return json({ error: "Orchestrator failed" }, 500); }
    const inserts = prd.tasks.map((t: any, i: number) => ({
      project_id: orchProj.id, task_index: i, title: t.title || `Task ${i + 1}`,
      intent: t.intent || "security_fix_v2", prompt: prdCtx + `[${t.title}]\n\n${t.prompt}`,
      stop_condition: t.stop_condition || null, brain_type: t.brain_type || "code",
    }));
    const { error: tErr } = await sc.from("orchestrator_tasks").insert(inserts);
    if (tErr) { await sc.from("orchestrator_projects").delete().eq("id", orchProj.id); await sc.from("cirius_projects").update({ status: "failed" }).eq("id", projectId); return json({ error: tErr.message }, 500); }
    await sc.from("cirius_projects").update({ orchestrator_project_id: orchProj.id, progress_pct: 25 }).eq("id", projectId);
    await logEntry(sc, projectId, "code", "started", `Pipeline: ${prd.tasks.length} tasks → Brain ${bpId.slice(0, 8)}`, { metadata: { orchestrator_id: orchProj.id } });
    autoTriggerTick(sc).catch(() => {});
    return json({ started: true, engine: "orchestrator", orchestrator_project_id: orchProj.id, task_count: prd.tasks.length });
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
