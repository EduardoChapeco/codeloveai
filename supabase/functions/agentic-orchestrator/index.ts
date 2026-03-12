/**
 * Agentic Orchestrator — Engine v5 (Brain Chain Pipeline)
 *
 * Key changes from v4:
 *  - 2-phase pipeline: PRD Expansion → Code Generation
 *  - Each brain receives a PRD fragment and expands it into sub-tasks
 *  - Dynamic task creation from brain PRD outputs
 *  - Phase tracking on tasks and projects
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encodeTaskAsViewDesc, EXECUTE_CMD } from "../_shared/task-encoder.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// AQ_PREFIX removed — replaced by JSON Encode Engine via task-encoder.ts

// ─── MD Output Protocol ──────────────────────────────────────
const MD_OUTPUT_PROTOCOL = `

PROTOCOLO DE SAÍDA OBRIGATÓRIO:
- TODA sua resposta com código DEVE ser escrita no arquivo src/update.md
- O arquivo src/update.md é o ÚNICO canal de saída. NÃO responda apenas no chat.
- Cada bloco de código DEVE ter o caminho do arquivo indicado. Use o formato:
  \`\`\`tsx file:src/components/MeuComponente.tsx
  // conteúdo do arquivo
  \`\`\`
  OU:
  \`\`\`tsx src/components/MeuComponente.tsx
  // conteúdo do arquivo
  \`\`\`
- O src/update.md DEVE começar com frontmatter:
  ---
  updated_at: [timestamp ISO 8601]
  status: done
  task: [resumo da tarefa]
  ---
- Inclua TODOS os arquivos completos e funcionais, prontos para uso.
- NÃO use dados mock. NÃO use placeholders. Código REAL e COMPLETO.
- NÃO responda apenas no chat inline. O chat pode ter um resumo curto, mas o código DEVE estar em src/update.md.

`;

// ─── PRD Expansion Protocol ──────────────────────────────────
const PRD_EXPANSION_PROTOCOL = `

PROTOCOLO DE EXPANSÃO DE PRD:
- Você recebeu um fragmento de PRD (Product Requirements Document).
- Sua tarefa é EXPANDIR este fragmento em um sub-PRD detalhado.
- Pense mais profundamente sobre cada requisito. Adicione detalhes técnicos.
- Crie N tasks (3-8), cada uma sendo um prompt COMPLETO pedindo código funcional.
- Cada task deve ser auto-contida e produzir código real e funcional.
- Retorne o sub-PRD no arquivo src/update.md no seguinte formato:

\`\`\`json
{
  "tasks": [
    {
      "title": "Título curto da task",
      "prompt": "Prompt completo e detalhado pedindo código funcional...",
      "brain_type": "frontend|backend|database|design|code"
    }
  ]
}
\`\`\`

- O frontmatter do src/update.md DEVE ter status: done quando concluir.
- NÃO escreva código nesta fase. Apenas o sub-PRD com tasks.

`;

// ─── Brain Specialization Context ─────────────────────────────
const BRAIN_CONTEXT: Record<string, string> = {
  frontend: "[FRONTEND SPECIALIST] You are an expert in React, TypeScript, Tailwind CSS, responsive design, and animations. Focus ONLY on UI components, pages, and user experience. ",
  backend: "[BACKEND SPECIALIST] You are an expert in Supabase Edge Functions, API design, authentication, server-side validation, and integrations. Focus ONLY on backend logic. ",
  database: "[DATABASE SPECIALIST] You are an expert in PostgreSQL, Supabase migrations, RLS policies, triggers, indexes, and data modeling. Focus ONLY on database schema and security. ",
  design: "[DESIGN SPECIALIST] You are an expert in design systems, CSS architecture, color theory, typography, and visual consistency. Focus ONLY on design tokens, themes, and visual components. ",
  review: "[HOLISTIC REVIEWER] You are a senior integration specialist. Review ALL files across the entire project for consistency: validate imports, exports, component props, database queries, naming conventions, and ensure everything compiles correctly. Fix ALL integration issues. ",
  code: "[FULL-STACK DEVELOPER] You are a senior full-stack developer. Implement features end-to-end with React, TypeScript, Supabase, and Tailwind. ",
  prd: "[ARCHITECT] You are a senior software architect. Your role is to decompose and expand requirements into detailed, actionable tasks. ",
};

const FIREBASE_KEY_ENV = "FIREBASE_API_KEY";
const C = "0123456789abcdefghjkmnpqrstvwxyz";
const rb32 = (n: number) => Array.from({ length: n }, () => C[Math.floor(Math.random() * 32)]).join("");

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Auth ─────────────────────────────────────────────────────
async function getUserId(req: Request, anonSc: SupabaseClient, body?: Record<string, unknown>): Promise<string | null> {
  if (req.headers.get("x-orchestrator-internal") === "true" && body?._internal_user_id) {
    return body._internal_user_id as string;
  }
  try {
    const { data: { user } } = await anonSc.auth.getUser();
    return user?.id || null;
  } catch { return null; }
}

// ─── Brainchain Account Pool ──────────────────────────────────
async function acquireBrainchainAccount(sc: SupabaseClient, brainType = "code"): Promise<{
  id: string; accessToken: string; brainProjectId: string;
} | null> {
  const TYPE_FALLBACK: Record<string, string[]> = {
    frontend: ["design", "code"],
    backend: ["code"],
    database: ["code"],
    review: ["code"],
    design: ["design", "code"],
    code: ["code"],
    prd: ["prd", "code"],
  };

  const typesToTry = [brainType, ...(TYPE_FALLBACK[brainType] || []), "general"]
    .filter((v, i, a) => a.indexOf(v) === i);

  // Release stuck accounts (busy > 3 min)
  const stuckThreshold = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  await sc.from("brainchain_accounts")
    .update({ is_busy: false, busy_since: null, busy_user_id: null })
    .eq("is_busy", true)
    .lt("busy_since", stuckThreshold);

  for (const type of typesToTry) {
    const { data: accounts } = await sc
      .from("brainchain_accounts")
      .select("id, access_token, access_expires_at, refresh_token, brain_project_id, brain_type")
      .eq("is_active", true)
      .eq("is_busy", false)
      .eq("brain_type", type)
      .lt("error_count", 5)
      .not("brain_project_id", "is", null)
      .order("last_used_at", { ascending: true, nullsFirst: true })
      .limit(1);

    if (!accounts?.length) continue;
    const account = accounts[0];
    if (!account.brain_project_id) continue;

    const token = await ensureValidToken(sc, account);
    if (!token) continue;

    await sc.from("brainchain_accounts").update({
      is_busy: true,
      busy_since: new Date().toISOString(),
      busy_user_id: "orchestrator",
      last_used_at: new Date().toISOString(),
    }).eq("id", account.id);

    return { id: account.id, accessToken: token, brainProjectId: account.brain_project_id };
  }
  return null;
}

async function releaseBrainchainAccount(sc: SupabaseClient, accountId: string, success: boolean) {
  await sc.from("brainchain_accounts").update({
    is_busy: false, busy_since: null, busy_user_id: null,
    updated_at: new Date().toISOString(),
  }).eq("id", accountId);
  if (success) {
    await sc.rpc("increment_requests", { acc_id: accountId });
  } else {
    await sc.rpc("increment_errors", { acc_id: accountId });
  }
}

async function ensureValidToken(sc: SupabaseClient, account: Record<string, any>): Promise<string | null> {
  const expiresAt = account.access_expires_at ? new Date(account.access_expires_at).getTime() : 0;
  const isExpired = expiresAt < Date.now() + 60000;

  if (!isExpired && account.access_token) return account.access_token;
  if (!account.refresh_token) return null;

  const firebaseKey = Deno.env.get(FIREBASE_KEY_ENV) || "";
  if (!firebaseKey) return account.access_token || null;

  try {
    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${firebaseKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(account.refresh_token)}`,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const newToken = data.id_token || data.access_token;
    if (!newToken) return null;

    let expiresAtStr = new Date(Date.now() + 3600000).toISOString();
    try {
      const payload = JSON.parse(atob(newToken.split(".")[1]));
      expiresAtStr = new Date(payload.exp * 1000).toISOString();
    } catch { /* use default */ }

    await sc.from("brainchain_accounts").update({
      access_token: newToken,
      refresh_token: data.refresh_token || account.refresh_token,
      access_expires_at: expiresAtStr,
      error_count: 0,
      updated_at: new Date().toISOString(),
    }).eq("id", account.id);

    return newToken;
  } catch { return null; }
}

// ─── Logging ─────────────────────────────────────────────────
async function addLog(
  sc: SupabaseClient, projectId: string, message: string,
  level: "info" | "warn" | "error" | "debug" = "info",
  metadata?: unknown, taskId?: string
) {
  await sc.from("orchestrator_logs").insert({
    project_id: projectId, task_id: taskId || null,
    level, message, metadata: metadata || null,
  });
}

// ─── PRD Generation (with Brain Chain support) ───────────────
async function generatePRD(
  clientPrompt: string,
  brainSkills: string[] = [],
  useBrainChain = false
): Promise<{ tasks: Array<{ title: string; intent: string; prompt: string; brain_type?: string; stop_condition?: string; depends_on?: number[]; phase?: string }> } | null> {
  const skillContext = brainSkills.length > 0
    ? `\nBrain skills available: ${brainSkills.join(", ")}. Assign brain_skill to each task.`
    : "";

  const brainChainInstructions = useBrainChain ? `

BRAIN CHAIN MODE:
- The FIRST task should be a PRD Expansion task (brain_type: "prd", phase: "prd_expansion")
- This task asks the brain to expand the requirements into detailed sub-tasks
- The remaining tasks are standard code generation tasks that depend on the PRD expansion
- Set depends_on to [0] for all code tasks so they wait for PRD expansion
` : "";

  const architectPrompt = `You are a senior software architect that decomposes projects into specialized brain tasks.

Available brain_type specializations:
- "database": Schema design, migrations, RLS policies, triggers, indexes
- "design": Design system, colors, typography, Tailwind config, CSS variables
- "frontend": React components, pages, UI/UX, responsive design, animations
- "backend": Edge functions, API routes, auth logic, server-side validation
- "code": General full-stack (use when task spans multiple areas)
- "review": Holistic code review, cross-file validation, integration check
- "prd": PRD expansion and detailed task planning

A client wants: "${clientPrompt}"${skillContext}${brainChainInstructions}

Break into 3-8 specialized tasks. Return ONLY valid JSON:
{"tasks":[{"title":"Short title","brain_type":"frontend","intent":"security_fix_v2","prompt":"Detailed prompt for the specialized brain","depends_on":[],"stop_condition":"source_contains:keyword","phase":"code_generation"}]}

Rules:
- ALWAYS start with "database" if project needs data storage
- ALWAYS include "design" early for visual system
- ALWAYS end with "review" for holistic integration check
- Each brain is SPECIALIZED — prompts must be targeted to that expertise
- depends_on: array of task indexes this task depends on
- Prompts must be self-contained, detailed, implementation-ready
- No questions, no clarifications`;

  // Strategy 1: Lovable AI Gateway
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Return only valid JSON, no markdown fences." },
            { role: "user", content: architectPrompt },
          ],
          temperature: 0.2, max_tokens: 3000,
        }),
      });
      if (res.ok) {
        const result = await res.json() as Record<string, unknown>;
        const content = ((result?.choices as any)?.[0]?.message?.content || "") as string;
        const parsed = extractJSON(content);
        if (parsed) return parsed;
      }
    } catch (e) { console.error("[PRD] Gateway error:", (e as Error).message); }
  }

  // Strategy 2: OpenRouter fallback
  const orKey = Deno.env.get("OPENROUTER_API_KEY");
  if (orKey) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${orKey}`, "Content-Type": "application/json",
          "HTTP-Referer": "https://starble.lovable.app", "X-Title": "Starble Orchestrator",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Return only valid JSON, no markdown fences." },
            { role: "user", content: architectPrompt },
          ],
          temperature: 0.2, max_tokens: 3000,
        }),
      });
      if (res.ok) {
        const result = await res.json() as Record<string, unknown>;
        const content = ((result?.choices as any)?.[0]?.message?.content || "") as string;
        const parsed = extractJSON(content);
        if (parsed) return parsed;
      }
    } catch (e) { console.error("[PRD] OpenRouter error:", (e as Error).message); }
  }

  return null;
}

function extractJSON(content: string): { tasks: Array<{ title: string; intent: string; prompt: string; stop_condition?: string; phase?: string }> } | null {
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

// ─── Execute Task via Brainchain Account ─────────────────────
async function executeTaskViaBrainchain(
  sc: SupabaseClient,
  task: { id: string; prompt: string; intent: string; task_index: number; brain_type?: string; phase?: string },
  projectId: string,
  account: { id: string; accessToken: string; brainProjectId: string },
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  await sc.from("orchestrator_tasks").update({
    status: "running", started_at: new Date().toISOString(),
  }).eq("id", task.id);

  await addLog(sc, projectId, `▶ Task #${task.task_index} (${task.phase || "code"}) — sending via account ${account.id.slice(0, 8)}`, "info", undefined, task.id);

  try {
    const msgId = "usermsg_" + rb32(26);
    const aiMsgId = "aimsg_" + rb32(26);

    // Snapshot initial latest-message ID BEFORE sending
    let initialMsgId: string | null = null;
    try {
      const snapRes = await fetch(`https://api.lovable.dev/projects/${account.brainProjectId}/chat/latest-message`, {
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
          Origin: "https://lovable.dev",
          Referer: "https://lovable.dev/",
        },
      });
      if (snapRes.ok) {
        const snapData = await snapRes.json().catch(() => null);
        initialMsgId = snapData?.id || null;
      }
    } catch (_) { /* ignore */ }

    const outputMarker = `cirius-out-${Date.now()}-${task.task_index}`;

    const brainContext = BRAIN_CONTEXT[task.brain_type || "code"] || BRAIN_CONTEXT.code;
    const protocol = isPrdExpansion ? PRD_EXPANSION_PROTOCOL : MD_OUTPUT_PROTOCOL;
    const fullPrompt = brainContext + protocol + task.prompt + `\n\n[OUTPUT_MARKER: ${outputMarker}]`;

    const encoded = encodeTaskAsViewDesc(fullPrompt, {
      name: task.phase === "prd_expansion" ? "PRD Expansion" : `Task #${task.task_index}`,
      internalId: `orch_${task.id}_${Date.now()}`,
      viewPrefix: isPrdExpansion ? "The user is running a PRD expansion phase." : "The user is running a chained sequence of tasks.",
    });

    const lvPayload = {
      id: msgId,
      message: EXECUTE_CMD,
      intent: "security_fix_v2",
      chat_only: false,
      ai_message_id: aiMsgId,
      thread_id: "main",
      view: "editor",
      view_description: encoded,
      model: null,
      session_replay: "[]",
      client_logs: [],
      network_requests: [],
      runtime_errors: [],
      files: [],
      selected_elements: [],
      optimisticImageUrls: [],
      debug_mode: false,
      integration_metadata: {
        browser: { preview_viewport_width: 1280, preview_viewport_height: 854, auth_token: account.accessToken },
        supabase: { auth_token: account.accessToken },
      },
    };

    let currentToken = account.accessToken;

    const sendChat = async (token: string) => fetch(`https://api.lovable.dev/projects/${account.brainProjectId}/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Origin: "https://lovable.dev",
        Referer: "https://lovable.dev/",
        "X-Client-Git-SHA": "3d7a3673c6f02b606137a12ddc0ab88f6b775113",
      },
      body: JSON.stringify(lvPayload),
    });

    let lvRes = await sendChat(currentToken);

    // On 401/403 — force-refresh token and retry once
    if (lvRes.status === 401 || lvRes.status === 403) {
      await lvRes.text().catch(() => {});
      await addLog(sc, projectId, `🔄 Task #${task.task_index}: HTTP ${lvRes.status} — refreshing token`, "warn", undefined, task.id);

      const { data: rawAcc } = await sc.from("brainchain_accounts")
        .select("refresh_token, access_token, access_expires_at")
        .eq("id", account.id).single();

      if (rawAcc?.refresh_token) {
        const refreshedToken = await ensureValidToken(sc, {
          ...rawAcc,
          id: account.id,
          access_expires_at: new Date(0).toISOString(),
        });
        if (refreshedToken) {
          currentToken = refreshedToken;
          lvPayload.integration_metadata.browser.auth_token = currentToken;
          lvPayload.integration_metadata.supabase.auth_token = currentToken;
          lvRes = await sendChat(currentToken);
        }
      }
    }

    if (lvRes.status === 429) {
      await lvRes.text().catch(() => {});
      await releaseBrainchainAccount(sc, account.id, false);
      return { success: false, error: "Rate limit on brainchain account" };
    }
    if (lvRes.status === 401 || lvRes.status === 403) {
      await lvRes.text().catch(() => {});
      await releaseBrainchainAccount(sc, account.id, false);
      return { success: false, error: `Auth failed (${lvRes.status}) after token refresh` };
    }
    if (lvRes.status !== 202 && !lvRes.ok) {
      await releaseBrainchainAccount(sc, account.id, false);
      const d = await lvRes.json().catch(() => ({}));
      return { success: false, error: (d as any).error || `HTTP ${lvRes.status}` };
    }

    // Store message ID + initial snapshot for tick to compare
    await sc.from("orchestrator_tasks").update({
      lovable_message_id: msgId,
      metadata: { initial_msg_id: initialMsgId, output_marker: outputMarker },
    }).eq("id", task.id);

    // Store brainchain info on project for tick to use
    await sc.from("orchestrator_projects").update({
      lovable_project_id: account.brainProjectId,
      ghost_created: true,
      source_fingerprint: initialMsgId,
    }).eq("id", projectId);

    await addLog(sc, projectId, `Task #${task.task_index} (${task.phase || "code"}) sent to brain ${account.brainProjectId.slice(0, 8)}`, "info", {
      brainchain_account_id: account.id,
      brain_project_id: account.brainProjectId,
      initial_msg_id: initialMsgId,
      output_marker: outputMarker,
      phase: task.phase,
    }, task.id);

    return { success: true, messageId: msgId };
  } catch (e) {
    const err = (e as Error).message;
    await releaseBrainchainAccount(sc, account.id, false);
    await addLog(sc, projectId, `Task #${task.task_index} exception: ${err}`, "error", undefined, task.id);
    return { success: false, error: err };
  }
}

// ══════════════════════════════════════════════════════════════
// Main Handler
// ══════════════════════════════════════════════════════════════
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const sc = createClient(supabaseUrl, serviceKey);
  const anonSc = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
  });

  try {
    const body = await req.json() as Record<string, unknown>;
    const action = (body.action as string) || "";

    const userId = await getUserId(req, anonSc, body);
    if (!userId) return json({ error: "Unauthorized" }, 401);

    // ─── ACTION: start ────────────────────────────────────────
    if (action === "start") {
      const clientPrompt = ((body.client_prompt as string) || "").trim();
      const brainId = (body.brain_id as string) || undefined;
      const useBrainChain = (body.brain_chain as boolean) || false;
      if (!clientPrompt) return json({ error: "client_prompt required" }, 400);

      // Resolve Brain skills
      let brainSkills: string[] = [];
      let brainName = "";
      if (brainId) {
        const { data: brainRow } = await sc.from("user_brain_projects")
          .select("brain_skills, name").eq("id", brainId).eq("user_id", userId).maybeSingle();
        if (brainRow) {
          brainSkills = (brainRow.brain_skills as string[]) || [];
          brainName = (brainRow.name as string) || "";
        }
      }

      // Create project record
      const { data: project, error: projErr } = await sc.from("orchestrator_projects").insert({
        user_id: userId, client_prompt: clientPrompt,
        brain_id: brainId || null, brain_skill_profile: brainSkills,
        status: "planning",
        pipeline_phase: useBrainChain ? "prd_expansion" : "standard",
      }).select("id").single();

      if (projErr || !project) {
        return json({ error: "Failed to create project", details: projErr?.message }, 500);
      }
      const projectId = project.id as string;

      await addLog(sc, projectId, `🚀 Orchestrator started (${useBrainChain ? "Brain Chain" : "Standard"})${brainName ? ` (Brain: ${brainName})` : ""}: "${clientPrompt.slice(0, 80)}…"`, "info",
        { user_id: userId, brain_id: brainId, brain_chain: useBrainChain, prompt_length: clientPrompt.length });

      // Generate PRD
      await addLog(sc, projectId, "🧠 Generating PRD…", "info");
      const prdT0 = Date.now();
      const prd = await generatePRD(clientPrompt, brainSkills, useBrainChain);
      const prdDuration = Date.now() - prdT0;

      if (!prd || !prd.tasks?.length) {
        const fallback = [{ title: "Implementar projeto completo", intent: "chat", prompt: clientPrompt, phase: "code_generation" }];
        await sc.from("orchestrator_tasks").insert(fallback.map((t, i) => ({
          project_id: projectId, task_index: i, title: t.title, intent: t.intent, prompt: t.prompt, phase: t.phase,
        })));
        await sc.from("orchestrator_projects").update({
          status: "paused", total_tasks: fallback.length,
          prd_json: { tasks: fallback, note: "PRD unavailable — fallback" },
        }).eq("id", projectId);
        await addLog(sc, projectId, `⚠️ PRD FAILED after ${prdDuration}ms — fallback`, "warn");
      } else {
        await sc.from("orchestrator_projects").update({
          prd_json: prd, total_tasks: prd.tasks.length, status: "paused",
        }).eq("id", projectId);
        await sc.from("orchestrator_tasks").insert(
          prd.tasks.map((t, i) => ({
            project_id: projectId, task_index: i,
            title: t.title, intent: t.intent || "chat",
            prompt: t.prompt, stop_condition: t.stop_condition || null,
            brain_type: t.brain_type || "code",
            phase: t.phase || "code_generation",
            depends_on: t.depends_on || [],
          }))
        );
        const brainTypes = [...new Set(prd.tasks.map(t => t.brain_type || "code"))];
        await addLog(sc, projectId, `✅ PRD: ${prd.tasks.length} tasks in ${prdDuration}ms. Brains: ${brainTypes.join(", ")}`, "info",
          { prd_duration_ms: prdDuration, task_count: prd.tasks.length, brain_types: brainTypes });
      }

      return json({ success: true, project_id: projectId, status: "paused" });
    }

    // ─── ACTION: execute_next ─────────────────────────────────
    if (action === "execute_next") {
      const projectId = (body.project_id as string) || "";
      if (!projectId) return json({ error: "project_id required" }, 400);

      const isInternal = req.headers.get("x-orchestrator-internal") === "true";
      let q = sc.from("orchestrator_projects").select("*").eq("id", projectId);
      if (!isInternal) q = q.eq("user_id", userId);
      const { data: project } = await q.maybeSingle();

      if (!project) return json({ error: "Project not found" }, 404);
      if (project.status === "completed") return json({ status: "already_completed" });
      if (project.status === "failed") return json({ status: "failed", error: project.last_error });
      if (project.status === "executing") return json({ status: "already_executing" });

      // Get next pending task (respecting target if specified)
      const targetTaskId = body._target_task_id as string | undefined;
      let taskQuery = sc.from("orchestrator_tasks")
        .select("*").eq("project_id", projectId).eq("status", "pending")
        .order("task_index", { ascending: true }).limit(1);
      
      if (targetTaskId) {
        taskQuery = sc.from("orchestrator_tasks")
          .select("*").eq("id", targetTaskId).eq("status", "pending").limit(1);
      }

      const { data: task } = await taskQuery.maybeSingle();

      if (!task) {
        await sc.from("orchestrator_projects").update({
          status: "completed",
          current_task_index: project.total_tasks as number,
          quality_score: 100,
        }).eq("id", projectId);
        await addLog(sc, projectId, "🎉 All tasks completed!", "info");
        return json({ status: "completed" });
      }

      // Acquire brainchain account
      const taskBrainType = (task as any).brain_type || "code";
      const account = await acquireBrainchainAccount(sc, taskBrainType);

      if (!account) {
        await addLog(sc, projectId, `⚠️ No brainchain accounts for brain_type="${taskBrainType}"`, "warn");
        await sc.from("orchestrator_projects").update({
          next_tick_at: new Date(Date.now() + 30_000).toISOString(),
        }).eq("id", projectId);
        return json({ error: "No brainchain accounts available", retry_after: 30 }, 503);
      }

      // Set to executing BEFORE sending
      await sc.from("orchestrator_projects").update({
        status: "executing", current_task_index: task.task_index as number,
        next_tick_at: new Date(Date.now() + 30_000).toISOString(),
      }).eq("id", projectId);

      const taskPhase = (task as any).phase || "code_generation";
      const result = await executeTaskViaBrainchain(
        sc,
        { id: task.id as string, prompt: task.prompt as string, intent: task.intent as string, task_index: task.task_index as number, brain_type: taskBrainType, phase: taskPhase },
        projectId, account,
      );

      if (!result.success) {
        const retries = ((task.retry_count as number) || 0) + 1;
        await addLog(sc, projectId,
          `❌ Task #${task.task_index} FAILED (attempt ${retries}/3): ${result.error}`, "error",
          { task_id: task.id, retry_count: retries, error: result.error },
          task.id as string);

        if (retries >= 3) {
          await sc.from("orchestrator_tasks").update({ status: "failed", retry_count: retries }).eq("id", task.id);
          await sc.from("orchestrator_projects").update({ status: "failed", last_error: result.error }).eq("id", projectId);
          return json({ status: "task_failed", error: result.error }, 500);
        }
        // ★ FIX: Reset task status back to "pending" so it can be retried by the next tick
        await sc.from("orchestrator_tasks").update({
          status: "pending", retry_count: retries, started_at: null, lovable_message_id: null,
        }).eq("id", task.id);
        await sc.from("orchestrator_projects").update({
          status: "paused",
          next_tick_at: new Date(Date.now() + 30_000).toISOString(),
        }).eq("id", projectId);
        return json({ status: "task_retry", retry_count: retries, error: result.error });
      }

      await addLog(sc, projectId,
        `📤 Task #${task.task_index} "${task.title}" (${taskPhase}) dispatched via account ${account.id.slice(0, 8)}`, "info",
        { task_id: task.id, message_id: result.messageId, phase: taskPhase },
        task.id as string);

      return json({
        status: "executing",
        task_index: task.task_index,
        task_title: task.title,
        phase: taskPhase,
        message_id: result.messageId,
        brainchain_account: account.id.slice(0, 8),
        brain_project: account.brainProjectId.slice(0, 8),
      });
    }

    // ─── ACTION: pause / resume ───────────────────────────────
    if (action === "pause" || action === "resume") {
      const projectId = (body.project_id as string) || "";
      if (!projectId) return json({ error: "project_id required" }, 400);

      const updatePayload: Record<string, unknown> = { status: "paused" };
      if (action === "resume") updatePayload.next_tick_at = null;
      await sc.from("orchestrator_projects").update(updatePayload).eq("id", projectId).eq("user_id", userId);
      await addLog(sc, projectId, `${action === "pause" ? "⏸" : "▶️"} Project ${action}d`, "info");
      return json({ success: true, status: "paused" });
    }

    // ─── ACTION: get_status ───────────────────────────────────
    if (action === "get_status") {
      const projectId = (body.project_id as string) || "";
      if (!projectId) return json({ error: "project_id required" }, 400);

      const [{ data: project }, { data: tasks }, { data: logs }] = await Promise.all([
        sc.from("orchestrator_projects").select("*").eq("id", projectId).eq("user_id", userId).maybeSingle(),
        sc.from("orchestrator_tasks").select("*").eq("project_id", projectId).order("task_index"),
        sc.from("orchestrator_logs").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(20),
      ]);
      if (!project) return json({ error: "Project not found" }, 404);
      return json({ project, tasks, logs });
    }

    // ─── ACTION: link_project ─────────────────────────────────
    if (action === "link_project") {
      const projectId = (body.project_id as string) || "";
      const lovableProjectId = (body.lovable_project_id as string) || "";
      if (!projectId || !lovableProjectId) return json({ error: "project_id and lovable_project_id required" }, 400);

      await sc.from("orchestrator_projects").update({ lovable_project_id: lovableProjectId, status: "paused" }).eq("id", projectId).eq("user_id", userId);
      await addLog(sc, projectId, `🔗 Linked: ${lovableProjectId}`, "info");
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("[Orchestrator] Error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
