/**
 * Cirius Generate v2.1 — Multi-engine pipeline orchestrator
 * Actions: init, generate_prd, generate_code, capture, status, pause, resume, cancel,
 *          oauth_state, save_supabase_integration, debug_log
 * 
 * Engine priority: Brainchain → OpenRouter (Claude) → AI Gateway
 * PRD generation: Brain system (send + capture/mining) → AI Gateway → OpenRouter
 * 
 * v2.1: Comprehensive internal logging for debugging all errors/failures/pauses
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXT_API = "https://api.lovable.dev";
const GIT_SHA = "3d7a3673c6f02b606137a12ddc0ab88f6b775113";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function extractJSON(content: string): any {
  if (!content || content.length < 10) return null;
  let s = content.trim();
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) s = m[1].trim();
  const i = s.indexOf("{");
  if (i >= 0) s = s.slice(i);
  const j = s.lastIndexOf("}");
  if (j >= 0) s = s.slice(0, j + 1);
  try {
    const parsed = JSON.parse(s);
    if (parsed.tasks && Array.isArray(parsed.tasks) && parsed.tasks.length > 0) return parsed;
  } catch { /* invalid */ }
  return null;
}

async function getUser(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const sc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } }
  );
  const { data: { user } } = await sc.auth.getUser();
  return user;
}

// ─── Enhanced Logging ─────────────────────────────────────────
async function logEntry(
  sc: SupabaseClient, projectId: string, step: string, status: string,
  message: string, extra?: Record<string, unknown>
) {
  const payload: Record<string, unknown> = {
    project_id: projectId, step, status, message,
    level: status === "failed" ? "error" : status === "retrying" ? "warning" : "info",
    metadata: {
      timestamp_ms: Date.now(),
      fn: "cirius-generate",
      ...(extra?.metadata as Record<string, unknown> || {}),
    },
  };
  if (extra?.duration_ms) payload.duration_ms = extra.duration_ms;
  if (extra?.output_json) payload.output_json = extra.output_json;
  if (extra?.input_json) payload.input_json = extra.input_json;
  if (extra?.error_msg) payload.error_msg = extra.error_msg;
  if (extra?.retry_count) payload.retry_count = extra.retry_count;
  await sc.from("cirius_generation_log").insert(payload);
}

/** HMAC-SHA256 sign */
async function hmacSign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ─── Engine helpers ───

/** Get user's active Brain project */
async function getUserBrain(sc: SupabaseClient, userId: string): Promise<{ projectId: string; brainId: string } | null> {
  const { data } = await sc.from("user_brain_projects")
    .select("id, lovable_project_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.lovable_project_id || data.lovable_project_id.startsWith("creating")) return null;
  return { projectId: data.lovable_project_id, brainId: data.id };
}

/** Get user's Lovable token */
async function getUserToken(sc: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await sc.from("lovable_accounts")
    .select("token_encrypted")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return data?.token_encrypted?.trim() || null;
}

/** Send prompt via venus-chat */
async function sendViaBrainProject(
  projectId: string, token: string, message: string,
): Promise<{ ok: boolean; error?: string; durationMs?: number }> {
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
    const durationMs = Date.now() - t0;
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) return { ok: false, error: data?.error || `HTTP ${res.status}`, durationMs };
    return { ok: true, durationMs };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, error: String(e).slice(0, 120), durationMs: Date.now() - t0 };
  }
}

/** Capture response from Brain project */
async function captureBrainResponse(
  projectId: string, token: string,
  maxWaitMs = 60_000, intervalMs = 5_000, initialDelayMs = 8_000,
): Promise<string | null> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`, Origin: "https://lovable.dev",
    Referer: "https://lovable.dev/", "X-Client-Git-SHA": GIT_SHA,
  };

  let initialMsgId: string | null = null;
  try {
    const initRes = await fetch(`${EXT_API}/projects/${projectId}/chat/latest-message`, { headers });
    if (initRes.ok) {
      const msg = await initRes.json().catch(() => null);
      initialMsgId = msg?.id || null;
    }
  } catch { /* ignore */ }

  await new Promise(r => setTimeout(r, initialDelayMs));
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10_000);
      const res = await fetch(`${EXT_API}/projects/${projectId}/chat/latest-message`, { signal: ctrl.signal, headers });
      clearTimeout(t);
      if (res.ok) {
        const msg = await res.json().catch(() => null);
        if (msg && msg.role !== "user" && !msg.is_streaming && msg.id !== initialMsgId) {
          const content = (msg.content || msg.text || "").trim();
          if (content.length > 30) return content;
        }
      }
    } catch { /* continue */ }

    try {
      const srcRes = await fetch(`${EXT_API}/projects/${projectId}/source-code`, { headers });
      if (srcRes.ok) {
        const srcData = await srcRes.json().catch(() => ({}));
        const files = srcData?.files || (Array.isArray(srcData) ? srcData : []);
        for (const f of files) {
          if ((f.path || f.name || "") === "src/update.md") {
            const c = f.contents || f.content || "";
            if (/status:\s*done/i.test(c)) {
              const parts = c.split("---");
              if (parts.length >= 3) {
                const body = parts.slice(2).join("---").trim();
                if (body.length > 20) return body;
              }
            }
          }
        }
      }
    } catch { /* continue */ }

    await new Promise(r => setTimeout(r, intervalMs));
  }
  return null;
}

/** Send via Brainchain pool */
async function sendViaBrainchain(
  sc: SupabaseClient, userId: string, message: string, brainType = "code"
): Promise<{ ok: boolean; queueId?: string; response?: string; error?: string; durationMs?: number }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const t0 = Date.now();
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/brainchain-send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ message, brain_type: brainType, user_id: userId }),
    });
    const data = await res.json();
    const durationMs = Date.now() - t0;
    if (data.queued) return { ok: true, queueId: data.queue_id, durationMs };
    if (data.ok && data.response) return { ok: true, response: data.response, durationMs };
    return { ok: false, error: data.error || "Brainchain unavailable", durationMs };
  } catch (e) {
    return { ok: false, error: (e as Error).message.slice(0, 120), durationMs: Date.now() - t0 };
  }
}

/** Send via OpenRouter (Claude fallback) */
async function sendViaOpenRouter(prompt: string, systemPrompt?: string): Promise<{ content: string | null; durationMs: number; error?: string }> {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  const t0 = Date.now();
  if (!key) return { content: null, durationMs: 0, error: "OPENROUTER_API_KEY not set" };
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`, "Content-Type": "application/json",
        "HTTP-Referer": "https://starble.lovable.app", "X-Title": "Cirius Generator",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4",
        messages: [
          { role: "system", content: systemPrompt || "Return only valid JSON, no markdown fences." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2, max_tokens: 4000,
      }),
    });
    const durationMs = Date.now() - t0;
    if (res.ok) {
      const result = await res.json();
      return { content: result?.choices?.[0]?.message?.content || null, durationMs };
    }
    const errBody = await res.text().catch(() => "");
    return { content: null, durationMs, error: `HTTP ${res.status}: ${errBody.slice(0, 100)}` };
  } catch (e) {
    return { content: null, durationMs: Date.now() - t0, error: (e as Error).message.slice(0, 100) };
  }
}

/** Send via AI Gateway */
async function sendViaGateway(prompt: string, systemPrompt?: string): Promise<{ content: string | null; durationMs: number; error?: string }> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  const t0 = Date.now();
  if (!key) return { content: null, durationMs: 0, error: "LOVABLE_API_KEY not set" };
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt || "Return only valid JSON, no markdown fences." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2, max_tokens: 3000,
      }),
    });
    const durationMs = Date.now() - t0;
    if (res.ok) {
      const result = await res.json();
      return { content: result?.choices?.[0]?.message?.content || null, durationMs };
    }
    const errBody = await res.text().catch(() => "");
    return { content: null, durationMs, error: `HTTP ${res.status}: ${errBody.slice(0, 100)}` };
  } catch (e) {
    return { content: null, durationMs: Date.now() - t0, error: (e as Error).message.slice(0, 100) };
  }
}

// ─── PRD Generation with full logging ───

async function generatePRD(sc: SupabaseClient, userId: string, project: Record<string, any>, projectId: string): Promise<any> {
  const features = Array.isArray(project.features) ? project.features : [];
  const prompt = `IMPORTANTE: Não faça perguntas, não peça confirmação. Execute diretamente.

Você é um arquiteto de software sênior. Um cliente quer construir:
Nome: ${project.name}
Tipo: ${project.template_type || "app"}
Descrição: ${project.description || ""}
Features: ${features.join(", ") || "basic"}
URL de referência: ${project.source_url || "none"}
Stack: React + Tailwind + shadcn/ui + Supabase

Quebre em 3-7 tarefas sequenciais de implementação. Retorne APENAS JSON válido, sem markdown fences:
{"tasks":[{"title":"Título curto","skill":"code","intent":"security_fix_v2","prompt":"Prompt detalhado de implementação","stop_condition":"file_exists:src/App.tsx","brain_type":"code"}],"design":{"primary_color":"#6366f1","font":"Geist","style":"modern_minimal","pages":["Home","Dashboard","Login"],"tables":["users","projects"]}}

Regras:
- intent DEVE ser security_fix_v2
- Prompts devem ser auto-contidos, detalhados, prontos para implementação
- Sem perguntas, sem clarificações
- Máximo 7 tarefas
- Inclua o objeto "design" com cores, fonte, estilo, páginas e tabelas
- Retorne SOMENTE o JSON, nada mais`;

  const engineAttempts: Array<{ engine: string; ok: boolean; durationMs: number; error?: string; taskCount?: number }> = [];

  // 1. Try Brain system first (preferred — uses mining/capture)
  const brain = await getUserBrain(sc, userId);
  const token = await getUserToken(sc, userId);

  await logEntry(sc, projectId, "prd_engine_check", "info", `Brain: ${brain ? `found (${brain.brainId.slice(0, 8)})` : "NOT FOUND"}, Token: ${token ? "present" : "MISSING"}`, {
    metadata: { brain_id: brain?.brainId, brain_project: brain?.projectId, has_token: !!token },
  });

  if (brain && token) {
    const sendResult = await sendViaBrainProject(brain.projectId, token, prompt);
    await logEntry(sc, projectId, "prd_brain_send", sendResult.ok ? "completed" : "failed",
      `Brain send: ${sendResult.ok ? "OK" : sendResult.error}`, {
      duration_ms: sendResult.durationMs, error_msg: sendResult.error,
      metadata: { brain_project: brain.projectId },
    });

    if (sendResult.ok) {
      const t0 = Date.now();
      const response = await captureBrainResponse(brain.projectId, token, 60_000, 4_000, 6_000);
      const captureDuration = Date.now() - t0;

      if (response) {
        const parsed = extractJSON(response);
        await logEntry(sc, projectId, "prd_brain_capture", parsed ? "completed" : "failed",
          parsed ? `Brain PRD mined: ${parsed.tasks?.length} tasks` : `Brain response not parseable (len=${response.length})`, {
          duration_ms: captureDuration,
          metadata: { response_length: response.length, parsed_ok: !!parsed, task_count: parsed?.tasks?.length },
        });
        engineAttempts.push({ engine: "brain", ok: !!parsed, durationMs: captureDuration, taskCount: parsed?.tasks?.length });
        if (parsed) return parsed;
      } else {
        await logEntry(sc, projectId, "prd_brain_capture", "failed", `Brain capture timeout (${captureDuration}ms) — no response mined`, {
          duration_ms: captureDuration,
        });
        engineAttempts.push({ engine: "brain", ok: false, durationMs: captureDuration, error: "capture timeout" });
      }
    } else {
      engineAttempts.push({ engine: "brain", ok: false, durationMs: sendResult.durationMs || 0, error: sendResult.error });
    }
  } else {
    engineAttempts.push({ engine: "brain", ok: false, durationMs: 0, error: !brain ? "no brain project" : "no lovable token" });
  }

  // 2. AI Gateway
  const gwResult = await sendViaGateway(prompt);
  if (gwResult.content) {
    const p = extractJSON(gwResult.content);
    await logEntry(sc, projectId, "prd_gateway", p ? "completed" : "failed",
      p ? `Gateway PRD: ${p.tasks?.length} tasks` : `Gateway response not parseable (len=${gwResult.content.length})`, {
      duration_ms: gwResult.durationMs,
      metadata: { response_length: gwResult.content.length, parsed_ok: !!p, task_count: p?.tasks?.length },
    });
    engineAttempts.push({ engine: "gateway", ok: !!p, durationMs: gwResult.durationMs, taskCount: p?.tasks?.length });
    if (p) return p;
  } else {
    await logEntry(sc, projectId, "prd_gateway", "failed", `Gateway failed: ${gwResult.error || "empty response"}`, {
      duration_ms: gwResult.durationMs, error_msg: gwResult.error,
    });
    engineAttempts.push({ engine: "gateway", ok: false, durationMs: gwResult.durationMs, error: gwResult.error });
  }

  // 3. OpenRouter (Claude) fallback
  const orResult = await sendViaOpenRouter(prompt);
  if (orResult.content) {
    const p = extractJSON(orResult.content);
    await logEntry(sc, projectId, "prd_openrouter", p ? "completed" : "failed",
      p ? `OpenRouter PRD: ${p.tasks?.length} tasks` : `OpenRouter response not parseable (len=${orResult.content.length})`, {
      duration_ms: orResult.durationMs,
      metadata: { response_length: orResult.content.length, parsed_ok: !!p, task_count: p?.tasks?.length },
    });
    engineAttempts.push({ engine: "openrouter", ok: !!p, durationMs: orResult.durationMs, taskCount: p?.tasks?.length });
    if (p) return p;
  } else {
    await logEntry(sc, projectId, "prd_openrouter", "failed", `OpenRouter failed: ${orResult.error || "empty response"}`, {
      duration_ms: orResult.durationMs, error_msg: orResult.error,
    });
    engineAttempts.push({ engine: "openrouter", ok: false, durationMs: orResult.durationMs, error: orResult.error });
  }

  // ALL engines failed — log comprehensive summary
  await logEntry(sc, projectId, "prd_all_failed", "failed",
    `ALL PRD engines failed. Attempts: ${engineAttempts.map(a => `${a.engine}(${a.ok ? "ok" : a.error})`).join(", ")}`, {
    metadata: { engine_attempts: engineAttempts },
  });

  return null;
}

// ─── Code Generation via Brainchain + Fallback ───

async function executeCodeTask(
  sc: SupabaseClient, userId: string, projectId: string,
  taskPrompt: string, taskIndex: number, brainType = "code"
): Promise<{ engine: string; ok: boolean; error?: string; queueId?: string }> {
  const prefix = `IMPORTANTE: Execute diretamente, sem perguntas.\n\n`;

  // 1. Brainchain (pool)
  const bcResult = await sendViaBrainchain(sc, userId, prefix + taskPrompt, brainType);
  await logEntry(sc, projectId, `code_task_${taskIndex}_brainchain`, bcResult.ok ? "started" : "failed",
    bcResult.ok ? `Task ${taskIndex + 1} sent via Brainchain${bcResult.queueId ? ` (queue: ${bcResult.queueId.slice(0, 8)})` : ""}` : `Brainchain failed: ${bcResult.error}`, {
    duration_ms: bcResult.durationMs, error_msg: bcResult.error,
    metadata: { queue_id: bcResult.queueId, engine: "brainchain" },
  });
  if (bcResult.ok) return { engine: "brainchain", ok: true, queueId: bcResult.queueId };

  // 2. OpenRouter (Claude) fallback
  const orResult = await sendViaOpenRouter(prefix + taskPrompt, "You are a senior developer. Implement the requested changes.");
  await logEntry(sc, projectId, `code_task_${taskIndex}_openrouter`, orResult.content && orResult.content.length > 50 ? "completed" : "failed",
    orResult.content && orResult.content.length > 50 ? `Task ${taskIndex + 1} via OpenRouter (${orResult.content.length} chars)` : `OpenRouter failed: ${orResult.error || "short response"}`, {
    duration_ms: orResult.durationMs, error_msg: orResult.error,
    metadata: { response_length: orResult.content?.length, engine: "openrouter" },
  });
  if (orResult.content && orResult.content.length > 50) return { engine: "openrouter", ok: true };

  // 3. Brain pessoal
  const brain = await getUserBrain(sc, userId);
  const token = await getUserToken(sc, userId);
  if (brain && token) {
    const sendResult = await sendViaBrainProject(brain.projectId, token, prefix + taskPrompt);
    await logEntry(sc, projectId, `code_task_${taskIndex}_brain`, sendResult.ok ? "started" : "failed",
      sendResult.ok ? `Task ${taskIndex + 1} sent via personal Brain` : `Brain failed: ${sendResult.error}`, {
      duration_ms: sendResult.durationMs, error_msg: sendResult.error,
      metadata: { brain_project: brain.projectId, engine: "brain" },
    });
    if (sendResult.ok) return { engine: "brain", ok: true };
  } else {
    await logEntry(sc, projectId, `code_task_${taskIndex}_brain`, "failed",
      `Personal Brain unavailable: ${!brain ? "no brain project" : "no token"}`, {
      metadata: { has_brain: !!brain, has_token: !!token, engine: "brain" },
    });
  }

  await logEntry(sc, projectId, `code_task_${taskIndex}_all_failed`, "failed",
    `ALL engines failed for task ${taskIndex + 1}`, {
    metadata: { tried: ["brainchain", "openrouter", "brain"] },
  });
  return { engine: "none", ok: false, error: "All engines failed" };
}

// ─── Main Handler ───

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await getUser(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const sc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = await req.json().catch(() => ({}));
  const action = (body.action as string) || "";

  // ─── OAUTH_STATE ───
  if (action === "oauth_state") {
    const provider = body.provider;
    if (!provider || !["github", "vercel", "netlify"].includes(provider)) {
      return json({ error: "Invalid provider" }, 400);
    }
    const stateSecret = Deno.env.get("CLF_TOKEN_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const ts = String(Date.now());
    const payload = `${user.id}:${ts}`;
    const sig = await hmacSign(payload, stateSecret);
    const state = btoa(JSON.stringify({ user_id: user.id, ts, sig }));
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const callbackUrl = `${supabaseUrl}/functions/v1/cirius-oauth-callback?provider=${provider}`;

    // Fetch OAuth credentials from api_key_vault (Admin > Integrações)
    const { data: vaultKey } = await sc.from("api_key_vault")
      .select("api_key_encrypted")
      .eq("provider", provider)
      .eq("is_active", true)
      .order("requests_count", { ascending: true })
      .limit(1)
      .maybeSingle();

    const clientId = vaultKey?.api_key_encrypted || Deno.env.get(`CIRIUS_${provider.toUpperCase()}_CLIENT_ID`) || "";
    if (!clientId) return json({ error: `${provider} OAuth not configured. Configure em Admin > Integrações.` }, 400);

    let authUrl = "";
    if (provider === "github") {
      authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo,read:user&state=${state}&redirect_uri=${encodeURIComponent(callbackUrl)}`;
    } else if (provider === "vercel") {
      authUrl = `https://vercel.com/oauth/authorize?client_id=${clientId}&scope=user&state=${state}&redirect_uri=${encodeURIComponent(callbackUrl)}`;
    } else if (provider === "netlify") {
      authUrl = `https://app.netlify.com/authorize?client_id=${clientId}&response_type=code&state=${state}&redirect_uri=${encodeURIComponent(callbackUrl)}`;
    }
    return json({ auth_url: authUrl });
  }

  // ─── SAVE_GITHUB_INTEGRATION (PAT) ───
  if (action === "save_github_integration") {
    const ghToken = (body.github_token as string || "").trim();
    if (!ghToken) return json({ error: "Personal Access Token é obrigatório" }, 400);
    let accountLogin = "";
    let accountId = "";
    try {
      const res = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${ghToken}`, "User-Agent": "Cirius-Starble" },
      });
      if (!res.ok) {
        await res.text().catch(() => {});
        return json({ error: "Token inválido — verifique em github.com/settings/tokens" }, 400);
      }
      const ghUser = await res.json();
      accountLogin = ghUser.login || "";
      accountId = String(ghUser.id || "");
    } catch {
      return json({ error: "Falha ao validar token GitHub" }, 400);
    }
    const { error } = await sc.from("cirius_integrations").upsert({
      user_id: user.id, provider: "github", access_token_enc: ghToken,
      account_login: accountLogin, account_id: accountId,
      is_active: true, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,provider" });
    if (error) return json({ error: "Failed to save integration" }, 500);
    return json({ ok: true, account: accountLogin });
  }

  // ─── SAVE_VERCEL_INTEGRATION ───
  if (action === "save_vercel_integration") {
    const vToken = (body.vercel_token as string || "").trim();
    if (!vToken) return json({ error: "API Token é obrigatório" }, 400);
    // Validate token by fetching user info
    let accountLogin = "";
    let accountId = "";
    try {
      const res = await fetch("https://api.vercel.com/v2/user", {
        headers: { Authorization: `Bearer ${vToken}` },
      });
      if (!res.ok) {
        await res.text().catch(() => {});
        return json({ error: "Token inválido — verifique em vercel.com/account/tokens" }, 400);
      }
      const userData = await res.json();
      accountLogin = userData.user?.username || userData.user?.email || "";
      accountId = userData.user?.uid || "";
    } catch {
      return json({ error: "Falha ao validar token Vercel" }, 400);
    }
    const { error } = await sc.from("cirius_integrations").upsert({
      user_id: user.id, provider: "vercel", access_token_enc: vToken,
      account_login: accountLogin, account_id: accountId,
      is_active: true, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,provider" });
    if (error) return json({ error: "Failed to save integration" }, 500);
    return json({ ok: true, account: accountLogin });
  }

  // ─── SAVE_SUPABASE_INTEGRATION ───
  if (action === "save_supabase_integration") {
    const sbUrl = (body.supabase_url as string || "").trim();
    const serviceKey = (body.service_key as string || "").trim();
    if (!sbUrl || !serviceKey) return json({ error: "URL e Service Key são obrigatórios" }, 400);
    const ref = sbUrl.match(/https:\/\/([^.]+)/)?.[1] || "";
    if (!ref) return json({ error: "URL inválida" }, 400);
    try {
      const testClient = createClient(sbUrl, serviceKey);
      const { error: testErr } = await testClient.from("_test_nonexistent_table_").select("id").limit(1);
      if (testErr && testErr.message?.includes("Invalid API key")) return json({ error: "Service key inválida" }, 400);
    } catch { /* ok */ }
    const { error } = await sc.from("cirius_integrations").upsert({
      user_id: user.id, provider: "supabase", service_key_enc: serviceKey,
      project_ref: ref, account_login: sbUrl, is_active: true, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,provider" });
    if (error) return json({ error: "Failed to save integration" }, 500);
    return json({ ok: true });
  }


  // ─── INIT ───
  if (action === "init") {
    const config = body.config || {};
    if (!config.name) return json({ error: "config.name required" }, 400);
    const { data: project, error } = await sc.from("cirius_projects").insert({
      user_id: user.id, name: config.name,
      description: config.description || null,
      template_type: config.template_type || "custom",
      source_url: config.source_url || null,
      tech_stack: config.tech_stack || { framework: "react", css: "tailwind", ui: "shadcn" },
      features: config.features || [],
      deploy_config: config.deploy_config || {},
      status: "draft",
    }).select("id, status").single();
    if (error) {
      console.error("[cirius] init error:", error);
      return json({ error: "Failed to create project" }, 500);
    }
    await logEntry(sc, project.id, "init", "completed", `Projeto criado: "${config.name}"`, {
      metadata: { template: config.template_type, features: config.features, source_url: config.source_url },
    });
    return json({ project_id: project.id, status: "draft" });
  }

  // ─── GENERATE_PRD ───
  if (action === "generate_prd") {
    const projectId = body.project_id;
    if (!projectId) return json({ error: "project_id required" }, 400);
    const { data: project } = await sc.from("cirius_projects")
      .select("*").eq("id", projectId).eq("user_id", user.id).single();
    if (!project) return json({ error: "Project not found" }, 404);

    // ★ Skip if PRD already exists
    if (project.prd_json && (project.prd_json as any).tasks?.length > 0) {
      await logEntry(sc, projectId, "prd_cache_hit", "completed",
        `PRD already exists (${(project.prd_json as any).tasks.length} tasks), skipping generation`, {
        metadata: { cached: true, task_count: (project.prd_json as any).tasks.length },
      });
      const existingPrd = project.prd_json as any;
      return json({
        prd_json: existingPrd,
        engine_selected: project.generation_engine || "cached",
        task_count: existingPrd.tasks?.length || 0,
        design: existingPrd.design || null,
        cached: true,
      });
    }

    await sc.from("cirius_projects").update({ status: "generating_prd" }).eq("id", projectId);
    await logEntry(sc, projectId, "prd", "started", `Gerando PRD para "${project.name}"...`, {
      input_json: { name: project.name, template: project.template_type, features: project.features },
    });

    const startMs = Date.now();
    const prd = await generatePRD(sc, user.id, project, projectId);
    const durationMs = Date.now() - startMs;

    if (!prd) {
      await sc.from("cirius_projects").update({ status: "failed", error_message: "Falha ao gerar PRD — todos os engines falharam" }).eq("id", projectId);
      await logEntry(sc, projectId, "prd", "failed", `PRD generation FAILED after ${durationMs}ms — all engines exhausted`, {
        duration_ms: durationMs, error_msg: "All PRD engines failed",
      });
      return json({ error: "PRD generation failed" }, 500);
    }

    const engine = "brainchain";
    await sc.from("cirius_projects").update({
      prd_json: prd, generation_engine: engine, status: "draft", progress_pct: 15,
    }).eq("id", projectId);

    await logEntry(sc, projectId, "prd", "completed", `PRD gerado: ${prd.tasks.length} tasks em ${durationMs}ms`, {
      duration_ms: durationMs,
      output_json: { task_count: prd.tasks.length, engine, design: prd.design || null, task_titles: prd.tasks.map((t: any) => t.title) },
    });

    return json({ prd_json: prd, engine_selected: engine, task_count: prd.tasks.length, design: prd.design || null });
  }

  // ─── GENERATE_CODE ───
  if (action === "generate_code") {
    const projectId = body.project_id;
    if (!projectId) return json({ error: "project_id required" }, 400);
    const { data: project } = await sc.from("cirius_projects")
      .select("*").eq("id", projectId).eq("user_id", user.id).single();
    if (!project) return json({ error: "Project not found" }, 404);
    if (!project.prd_json) return json({ error: "PRD not generated yet" }, 400);

    // ★ Skip if already linked to orchestrator
    if (project.orchestrator_project_id) {
      await logEntry(sc, projectId, "code_orchestrator_reuse", "info",
        `Already linked to orchestrator ${(project.orchestrator_project_id as string).slice(0, 8)}, resetting for retry`, {
        metadata: { orchestrator_id: project.orchestrator_project_id, action: "reset_to_paused" },
      });
      await sc.from("orchestrator_projects").update({ status: "paused", quality_score: 0 }).eq("id", project.orchestrator_project_id);
      await sc.from("cirius_projects").update({ status: "generating_code", error_message: null, progress_pct: 25 }).eq("id", projectId);
      return json({
        started: true, engine: "orchestrator",
        orchestrator_project_id: project.orchestrator_project_id,
        note: "Orchestrator project already exists. Reset to paused for retry.",
        resumed: true,
      });
    }

    await sc.from("cirius_projects").update({
      status: "generating_code", generation_started_at: new Date().toISOString(), progress_pct: 20,
    }).eq("id", projectId);
    await logEntry(sc, projectId, "code", "started", "Registrando tarefas no orquestrador...", {
      metadata: { prd_task_count: (project.prd_json as any).tasks?.length },
    });

    const prd = project.prd_json as { tasks: Array<{ prompt: string; brain_type?: string; title?: string; intent?: string; stop_condition?: string }> };

    const clientPrompt = project.description || project.name || "Cirius project";
    const { data: orchProject, error: orchErr } = await sc.from("orchestrator_projects").insert({
      user_id: user.id, client_prompt: clientPrompt,
      status: "paused", total_tasks: prd.tasks.length, prd_json: project.prd_json,
    }).select("id").single();

    if (orchErr || !orchProject) {
      await sc.from("cirius_projects").update({ status: "failed", error_message: "Falha ao registrar no orquestrador" }).eq("id", projectId);
      await logEntry(sc, projectId, "code", "failed", `Orchestrator project creation failed: ${orchErr?.message || "unknown"}`, {
        error_msg: orchErr?.message,
      });
      return json({ error: "Orchestrator registration failed" }, 500);
    }

    const taskInserts = prd.tasks.map((t, i) => ({
      project_id: orchProject.id, task_index: i,
      title: t.title || `Task ${i + 1}`,
      intent: t.intent || "security_fix_v2",
      prompt: t.prompt, stop_condition: t.stop_condition || null,
    }));
    const { error: taskErr } = await sc.from("orchestrator_tasks").insert(taskInserts);

    if (taskErr) {
      await logEntry(sc, projectId, "code", "failed", `Task insertion failed: ${taskErr.message}`, {
        error_msg: taskErr.message,
      });
    }

    await sc.from("cirius_projects").update({
      orchestrator_project_id: orchProject.id, progress_pct: 25,
    }).eq("id", projectId);

    await logEntry(sc, projectId, "code", "started",
      `Orquestrador iniciado: ${prd.tasks.length} tarefas registradas (orch: ${orchProject.id.slice(0, 8)})`, {
      metadata: {
        orchestrator_id: orchProject.id,
        task_count: prd.tasks.length,
        task_titles: prd.tasks.map(t => t.title || "untitled"),
      },
    });

    return json({
      started: true, engine: "orchestrator",
      orchestrator_project_id: orchProject.id,
      task_count: prd.tasks.length, total_tasks: prd.tasks.length,
      note: "Tasks registered. orchestrator-tick will execute sequentially via Brainchain.",
    });
  }

  // ─── STATUS ───
  if (action === "status") {
    const projectId = body.project_id;
    if (!projectId) return json({ error: "project_id required" }, 400);
    const { data: project } = await sc.from("cirius_projects")
      .select("id, name, status, current_step, progress_pct, generation_engine, error_message, preview_url, github_url, vercel_url, netlify_url, supabase_url, created_at, updated_at, orchestrator_project_id")
      .eq("id", projectId).eq("user_id", user.id).single();
    if (!project) return json({ error: "Not found" }, 404);

    // Get cirius logs
    const { data: logs } = await sc.from("cirius_generation_log")
      .select("step, status, level, message, created_at, duration_ms, error_msg, metadata")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(30);

    // Get orchestrator status if linked
    let orchestrator: Record<string, unknown> | null = null;
    if (project.orchestrator_project_id) {
      const [{ data: orchProj }, { data: orchTasks }, { data: orchLogs }] = await Promise.all([
        sc.from("orchestrator_projects").select("*").eq("id", project.orchestrator_project_id).maybeSingle(),
        sc.from("orchestrator_tasks").select("*").eq("project_id", project.orchestrator_project_id).order("task_index"),
        sc.from("orchestrator_logs").select("*").eq("project_id", project.orchestrator_project_id).order("created_at", { ascending: false }).limit(30),
      ]);

      // Auto-reconcile: if orchestrator is completed, finalize Cirius generation state.
      if (orchProj?.status === "completed" && project.status === "generating_code") {
        await sc.from("cirius_projects").update({
          status: "live",
          current_step: "completed",
          progress_pct: 100,
          generation_ended_at: new Date().toISOString(),
          error_message: null,
        }).eq("id", projectId).eq("user_id", user.id);

        await logEntry(sc, projectId, "code", "completed",
          "Orquestrador concluído — projeto finalizado automaticamente.", {
            metadata: { orchestrator_id: project.orchestrator_project_id },
          });

        // Keep returned project data aligned with the reconciled state
        (project as Record<string, unknown>).status = "live";
        (project as Record<string, unknown>).current_step = "completed";
        (project as Record<string, unknown>).progress_pct = 100;
      }

      orchestrator = { project: orchProj, tasks: orchTasks, logs: orchLogs };
    }

    return json({ project, logs: logs || [], orchestrator });
  }

  // ─── DEBUG_LOG — Comprehensive pipeline state dump ───
  if (action === "debug_log") {
    const projectId = body.project_id;
    if (!projectId) return json({ error: "project_id required" }, 400);

    const { data: project } = await sc.from("cirius_projects")
      .select("*").eq("id", projectId).eq("user_id", user.id).single();
    if (!project) return json({ error: "Not found" }, 404);

    const [
      { data: ciriusLogs },
      { data: orchProject },
      { data: orchTasks },
      { data: orchLogs },
      { data: bcAccounts },
      { data: bcQueue },
    ] = await Promise.all([
      sc.from("cirius_generation_log")
        .select("*").eq("project_id", projectId)
        .order("created_at", { ascending: false }).limit(50),
      project.orchestrator_project_id
        ? sc.from("orchestrator_projects").select("*").eq("id", project.orchestrator_project_id).maybeSingle()
        : Promise.resolve({ data: null }),
      project.orchestrator_project_id
        ? sc.from("orchestrator_tasks").select("*").eq("project_id", project.orchestrator_project_id).order("task_index")
        : Promise.resolve({ data: null }),
      project.orchestrator_project_id
        ? sc.from("orchestrator_logs").select("*").eq("project_id", project.orchestrator_project_id).order("created_at", { ascending: false }).limit(50)
        : Promise.resolve({ data: null }),
      sc.from("brainchain_accounts").select("id, email, brain_type, brain_project_id, is_active, is_busy, busy_since, error_count, request_count, last_used_at, access_expires_at").order("last_used_at", { ascending: false }).limit(10),
      sc.from("brainchain_queue").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
    ]);

    // Compute pipeline health diagnostics
    const diagnostics: Record<string, unknown> = {
      cirius_status: project.status,
      cirius_error: project.error_message,
      cirius_progress: project.progress_pct,
      has_prd: !!(project.prd_json as any)?.tasks?.length,
      prd_task_count: (project.prd_json as any)?.tasks?.length || 0,
      has_orchestrator: !!project.orchestrator_project_id,
      orchestrator_status: orchProject?.status || "none",
      orchestrator_last_error: orchProject?.last_error || null,
      tasks_pending: orchTasks?.filter((t: any) => t.status === "pending").length || 0,
      tasks_running: orchTasks?.filter((t: any) => t.status === "running").length || 0,
      tasks_completed: orchTasks?.filter((t: any) => t.status === "completed").length || 0,
      tasks_failed: orchTasks?.filter((t: any) => t.status === "failed").length || 0,
      brainchain_active: bcAccounts?.filter((a: any) => a.is_active).length || 0,
      brainchain_busy: bcAccounts?.filter((a: any) => a.is_busy).length || 0,
      brainchain_errored: bcAccounts?.filter((a: any) => (a.error_count || 0) >= 5).length || 0,
      errors_in_logs: ciriusLogs?.filter((l: any) => l.level === "error").length || 0,
      warnings_in_logs: ciriusLogs?.filter((l: any) => l.level === "warning").length || 0,
    };

    return json({
      diagnostics,
      cirius_project: project,
      cirius_logs: ciriusLogs || [],
      orchestrator: orchProject || null,
      orchestrator_tasks: orchTasks || [],
      orchestrator_logs: orchLogs || [],
      brainchain_accounts: bcAccounts || [],
      brainchain_queue: bcQueue || [],
    });
  }

  // ─── PAUSE / RESUME / CANCEL ───
  if (action === "pause" || action === "resume" || action === "cancel") {
    const projectId = body.project_id;
    if (!projectId) return json({ error: "project_id required" }, 400);
    const statusMap: Record<string, string> = { pause: "paused", resume: "generating_code", cancel: "failed" };
    const { error } = await sc.from("cirius_projects")
      .update({
        status: statusMap[action],
        ...(action === "cancel" ? { error_message: "Cancelado pelo usuário" } : {}),
      })
      .eq("id", projectId).eq("user_id", user.id);
    if (error) return json({ error: "Operation failed" }, 500);
    await logEntry(sc, projectId, action, "completed",
      `Pipeline ${action === "cancel" ? "cancelado" : action === "pause" ? "pausado" : "retomado"} pelo usuário`, {
      metadata: { user_action: action, user_id: user.id },
    });
    return json({ [action === "cancel" ? "cancelled" : action === "pause" ? "paused" : "resumed"]: true });
  }

  // ─── CAPTURE ───
  if (action === "capture") {
    const projectId = body.project_id;
    const lovableProjectId = body.lovable_project_id;
    if (!projectId) return json({ error: "project_id required" }, 400);
    const { data: project } = await sc.from("cirius_projects")
      .select("*").eq("id", projectId).eq("user_id", user.id).single();
    if (!project) return json({ error: "Not found" }, 404);
    const targetProjectId = lovableProjectId || project.lovable_project_id;
    if (!targetProjectId) {
      await logEntry(sc, projectId, "capture", "failed", "No lovable_project_id available for capture");
      return json({ error: "No lovable_project_id" }, 400);
    }
    const { data: account } = await sc.from("lovable_accounts")
      .select("token_encrypted").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
    if (!account?.token_encrypted) {
      await logEntry(sc, projectId, "capture", "failed", "No Lovable token available for capture");
      return json({ error: "No Lovable token" }, 503);
    }
    const t0 = Date.now();
    const scRes = await fetch(`${EXT_API}/projects/${targetProjectId}/source-code`, {
      headers: {
        Authorization: `Bearer ${account.token_encrypted}`,
        Origin: "https://lovable.dev", Referer: "https://lovable.dev/",
        "X-Client-Git-SHA": GIT_SHA,
      },
    });
    const captureDuration = Date.now() - t0;
    if (!scRes.ok) {
      await logEntry(sc, projectId, "capture", "failed", `Source-code fetch failed: HTTP ${scRes.status}`, {
        duration_ms: captureDuration, error_msg: `HTTP ${scRes.status}`,
      });
      return json({ error: "Source-code fetch failed" }, 500);
    }
    const scData = await scRes.json();
    const files = scData.files || [];
    const filesJson: Record<string, string> = {};
    for (const f of files) {
      if (f.path && !f.path.startsWith(".lovable/")) filesJson[f.path] = f.content || "";
    }
    const fingerprint = files.map((f: any) => `${f.path}:${f.size ?? 0}`).sort().join("|");
    await sc.from("cirius_projects").update({
      source_files_json: filesJson, files_fingerprint: fingerprint,
      lovable_project_id: targetProjectId, progress_pct: 80,
      generation_ended_at: new Date().toISOString(),
    }).eq("id", projectId);
    await logEntry(sc, projectId, "capture", "completed", `${Object.keys(filesJson).length} arquivos capturados em ${captureDuration}ms`, {
      duration_ms: captureDuration,
      metadata: { file_count: Object.keys(filesJson).length, target_project: targetProjectId },
    });
    return json({ files_json: filesJson, fingerprint, file_count: Object.keys(filesJson).length });
  }

  return json({ error: "unknown_action" }, 400);
});
