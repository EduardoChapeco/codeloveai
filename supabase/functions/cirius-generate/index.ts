/**
 * Cirius Generate v2.0 — Multi-engine pipeline orchestrator
 * Actions: init, generate_prd, generate_code, capture, status, pause, resume, cancel,
 *          oauth_state, save_supabase_integration
 * 
 * Engine priority: Brainchain → OpenRouter (Claude) → AI Gateway
 * PRD generation: Brain system (send + capture/mining) → AI Gateway → OpenRouter
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

async function logEntry(sc: SupabaseClient, projectId: string, step: string, status: string, message: string, extra?: Record<string, unknown>) {
  await sc.from("cirius_generation_log").insert({
    project_id: projectId, step, status, message,
    level: status === "failed" ? "error" : status === "retrying" ? "warning" : "info",
    ...extra,
  });
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
): Promise<{ ok: boolean; error?: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/venus-chat`, {
      method: "POST", signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ task: message, project_id: projectId, mode: "task", lovable_token: token, skip_suffix: true }),
    });
    clearTimeout(timer);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) return { ok: false, error: data?.error || `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, error: String(e).slice(0, 80) };
  }
}

/** Capture response from Brain project (polls latest-message + update.md) */
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
): Promise<{ ok: boolean; queueId?: string; response?: string; error?: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/brainchain-send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ message, brain_type: brainType, user_id: userId }),
    });
    const data = await res.json();
    if (data.queued) return { ok: true, queueId: data.queue_id };
    if (data.ok && data.response) return { ok: true, response: data.response };
    return { ok: false, error: data.error || "Brainchain unavailable" };
  } catch (e) {
    return { ok: false, error: (e as Error).message.slice(0, 80) };
  }
}

/** Send via OpenRouter (Claude fallback) */
async function sendViaOpenRouter(prompt: string, systemPrompt?: string): Promise<string | null> {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) return null;
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
    if (res.ok) {
      const result = await res.json();
      return result?.choices?.[0]?.message?.content || null;
    }
  } catch (e) { console.error("[cirius] OpenRouter error:", (e as Error).message); }
  return null;
}

/** Send via AI Gateway */
async function sendViaGateway(prompt: string, systemPrompt?: string): Promise<string | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
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
    if (res.ok) {
      const result = await res.json();
      return result?.choices?.[0]?.message?.content || null;
    }
  } catch (e) { console.error("[cirius] Gateway error:", (e as Error).message); }
  return null;
}

// ─── PRD Generation ───

async function generatePRD(sc: SupabaseClient, userId: string, project: Record<string, any>): Promise<any> {
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

  // 1. Try Brain system first (preferred — uses mining/capture)
  const brain = await getUserBrain(sc, userId);
  const token = await getUserToken(sc, userId);
  if (brain && token) {
    console.log(`[cirius] PRD via Brain ${brain.brainId.slice(0, 8)}`);
    const sendResult = await sendViaBrainProject(brain.projectId, token, prompt);
    if (sendResult.ok) {
      const response = await captureBrainResponse(brain.projectId, token, 60_000, 4_000, 6_000);
      if (response) {
        const parsed = extractJSON(response);
        if (parsed) { console.log(`[cirius] PRD mined from Brain: ${parsed.tasks?.length} tasks`); return parsed; }
      }
    }
  }

  // 2. AI Gateway
  const gwContent = await sendViaGateway(prompt);
  if (gwContent) { const p = extractJSON(gwContent); if (p) return p; }

  // 3. OpenRouter (Claude) fallback
  const orContent = await sendViaOpenRouter(prompt);
  if (orContent) { const p = extractJSON(orContent); if (p) return p; }

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
  if (bcResult.ok) {
    await logEntry(sc, projectId, `code_task_${taskIndex}`, "started", `Tarefa ${taskIndex + 1} enviada via Brainchain`);
    return { engine: "brainchain", ok: true, queueId: bcResult.queueId };
  }
  console.warn(`[cirius] Brainchain failed for task ${taskIndex}: ${bcResult.error}`);

  // 2. OpenRouter (Claude) fallback
  const orContent = await sendViaOpenRouter(prefix + taskPrompt, "You are a senior developer. Implement the requested changes.");
  if (orContent && orContent.length > 50) {
    await logEntry(sc, projectId, `code_task_${taskIndex}`, "completed", `Tarefa ${taskIndex + 1} gerada via OpenRouter (Claude)`);
    return { engine: "openrouter", ok: true };
  }

  // 3. Brain pessoal
  const brain = await getUserBrain(sc, userId);
  const token = await getUserToken(sc, userId);
  if (brain && token) {
    const sendResult = await sendViaBrainProject(brain.projectId, token, prefix + taskPrompt);
    if (sendResult.ok) {
      await logEntry(sc, projectId, `code_task_${taskIndex}`, "started", `Tarefa ${taskIndex + 1} enviada via Brain pessoal`);
      return { engine: "brain", ok: true };
    }
  }

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
    let authUrl = "";
    if (provider === "github") {
      const clientId = Deno.env.get("CIRIUS_GITHUB_CLIENT_ID") || "";
      if (!clientId) return json({ error: "GitHub OAuth not configured" }, 400);
      authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo,read:user&state=${state}&redirect_uri=${encodeURIComponent(callbackUrl)}`;
    } else if (provider === "vercel") {
      const clientId = Deno.env.get("CIRIUS_VERCEL_CLIENT_ID") || "";
      if (!clientId) return json({ error: "Vercel OAuth not configured" }, 400);
      authUrl = `https://vercel.com/oauth/authorize?client_id=${clientId}&scope=user&state=${state}&redirect_uri=${encodeURIComponent(callbackUrl)}`;
    } else if (provider === "netlify") {
      const clientId = Deno.env.get("CIRIUS_NETLIFY_CLIENT_ID") || "";
      if (!clientId) return json({ error: "Netlify OAuth not configured" }, 400);
      authUrl = `https://app.netlify.com/authorize?client_id=${clientId}&response_type=code&state=${state}&redirect_uri=${encodeURIComponent(callbackUrl)}`;
    }
    return json({ auth_url: authUrl });
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
    if (error) return json({ error: "Failed to create project" }, 500);
    await logEntry(sc, project.id, "init", "completed", "Projeto criado");
    return json({ project_id: project.id, status: "draft" });
  }

  // ─── GENERATE_PRD ───
  if (action === "generate_prd") {
    const projectId = body.project_id;
    if (!projectId) return json({ error: "project_id required" }, 400);
    const { data: project } = await sc.from("cirius_projects")
      .select("*").eq("id", projectId).eq("user_id", user.id).single();
    if (!project) return json({ error: "Project not found" }, 404);

    await sc.from("cirius_projects").update({ status: "generating_prd" }).eq("id", projectId);
    await logEntry(sc, projectId, "prd", "started", "Gerando PRD...");

    const startMs = Date.now();
    const prd = await generatePRD(sc, user.id, project);
    const durationMs = Date.now() - startMs;

    if (!prd) {
      await sc.from("cirius_projects").update({ status: "failed", error_message: "Falha ao gerar PRD" }).eq("id", projectId);
      await logEntry(sc, projectId, "prd", "failed", "PRD generation failed", { duration_ms: durationMs });
      return json({ error: "PRD generation failed" }, 500);
    }

    // Always use brainchain as primary engine now
    const engine = "brainchain";

    await sc.from("cirius_projects").update({
      prd_json: prd, generation_engine: engine, status: "draft", progress_pct: 15,
    }).eq("id", projectId);

    await logEntry(sc, projectId, "prd", "completed", `PRD gerado: ${prd.tasks.length} tasks`, {
      duration_ms: durationMs, output_json: { task_count: prd.tasks.length, engine, design: prd.design || null },
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

    await sc.from("cirius_projects").update({
      status: "generating_code", generation_started_at: new Date().toISOString(), progress_pct: 20,
    }).eq("id", projectId);
    await logEntry(sc, projectId, "code", "started", "Registrando tarefas no orquestrador");

    const prd = project.prd_json as { tasks: Array<{ prompt: string; brain_type?: string; title?: string; intent?: string; stop_condition?: string }> };

    // Bridge: register in orchestrator_projects + orchestrator_tasks
    // so orchestrator-tick handles ghost-create, execution, and completion detection
    const clientPrompt = project.description || project.name || "Cirius project";
    const { data: orchProject, error: orchErr } = await sc.from("orchestrator_projects").insert({
      user_id: user.id,
      client_prompt: clientPrompt,
      status: "paused",
      total_tasks: prd.tasks.length,
      prd_json: project.prd_json,
    }).select("id").single();

    if (orchErr || !orchProject) {
      await sc.from("cirius_projects").update({ status: "failed", error_message: "Falha ao registrar no orquestrador" }).eq("id", projectId);
      await logEntry(sc, projectId, "code", "failed", "Failed to create orchestrator project");
      return json({ error: "Orchestrator registration failed" }, 500);
    }

    // Insert all tasks into orchestrator_tasks
    const taskInserts = prd.tasks.map((t, i) => ({
      project_id: orchProject.id,
      task_index: i,
      title: t.title || `Task ${i + 1}`,
      intent: t.intent || "security_fix_v2",
      prompt: t.prompt,
      stop_condition: t.stop_condition || null,
    }));
    await sc.from("orchestrator_tasks").insert(taskInserts);

    // Link cirius project to orchestrator project
    await sc.from("cirius_projects").update({
      orchestrator_project_id: orchProject.id, progress_pct: 25,
    }).eq("id", projectId);

    await logEntry(sc, projectId, "code", "started", `Orquestrador iniciado: ${prd.tasks.length} tarefas registradas (orch: ${orchProject.id.slice(0, 8)})`);

    return json({
      started: true,
      engine: "orchestrator",
      orchestrator_project_id: orchProject.id,
      task_count: prd.tasks.length,
      total_tasks: prd.tasks.length,
      note: "Tasks registered. orchestrator-tick will ghost-create a project and execute sequentially.",
    });
  }

  // ─── STATUS ───
  if (action === "status") {
    const projectId = body.project_id;
    if (!projectId) return json({ error: "project_id required" }, 400);
    const { data: project } = await sc.from("cirius_projects")
      .select("id, name, status, current_step, progress_pct, generation_engine, error_message, preview_url, github_url, vercel_url, netlify_url, supabase_url, created_at, updated_at")
      .eq("id", projectId).eq("user_id", user.id).single();
    if (!project) return json({ error: "Not found" }, 404);
    const { data: logs } = await sc.from("cirius_generation_log")
      .select("step, status, level, message, created_at, duration_ms")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(10);
    return json({ project, logs: logs || [] });
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
    await logEntry(sc, projectId, action, "completed", `Pipeline ${action === "cancel" ? "cancelado" : action === "pause" ? "pausado" : "retomado"}`);
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
    if (!targetProjectId) return json({ error: "No lovable_project_id" }, 400);
    const { data: account } = await sc.from("lovable_accounts")
      .select("token_encrypted").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
    if (!account?.token_encrypted) return json({ error: "No Lovable token" }, 503);
    const scRes = await fetch(`${EXT_API}/projects/${targetProjectId}/source-code`, {
      headers: {
        Authorization: `Bearer ${account.token_encrypted}`,
        Origin: "https://lovable.dev", Referer: "https://lovable.dev/",
        "X-Client-Git-SHA": GIT_SHA,
      },
    });
    if (!scRes.ok) return json({ error: "Source-code fetch failed" }, 500);
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
    await logEntry(sc, projectId, "capture", "completed", `${Object.keys(filesJson).length} arquivos capturados`);
    return json({ files_json: filesJson, fingerprint, file_count: Object.keys(filesJson).length });
  }

  return json({ error: "unknown_action" }, 400);
});
