/**
 * Agentic Orchestrator — Engine v4 (Brainchain-powered)
 *
 * Key change from v3:
 *  - Uses brainchain_accounts pool instead of single lovable_accounts token
 *  - Each brainchain account has its own brain_project_id (no ghost-create needed)
 *  - Auto-refresh tokens via Firebase SecureToken API
 *  - Round-robin account selection with busy/error tracking
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AQ_PREFIX = `IMPORTANTE: Não faça perguntas, não peça confirmação, não liste planos. Execute diretamente. Se houver ambiguidade, escolha a opção mais segura e execute.\n\n`;

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
async function acquireBrainchainAccount(sc: SupabaseClient, brainType = "general"): Promise<{
  id: string; accessToken: string; brainProjectId: string;
} | null> {
  // Release stuck accounts (busy > 3 min)
  const stuckThreshold = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  await sc.from("brainchain_accounts")
    .update({ is_busy: false, busy_since: null, busy_user_id: null })
    .eq("is_busy", true)
    .lt("busy_since", stuckThreshold);

  // Try specific type, then general
  for (const type of [brainType, "general"]) {
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

    // Ensure valid token
    const token = await ensureValidToken(sc, account);
    if (!token) continue;

    // Mark busy
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
  if (!firebaseKey) return account.access_token || null; // best effort

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

// ─── PRD Generation ──────────────────────────────────────────
async function generatePRD(
  clientPrompt: string,
  brainSkills: string[] = []
): Promise<{ tasks: Array<{ title: string; intent: string; prompt: string; stop_condition?: string }> } | null> {
  const skillContext = brainSkills.length > 0
    ? `\nBrain skills available: ${brainSkills.join(", ")}. Assign brain_skill to each task.`
    : "";

  const architectPrompt = `You are a senior software architect. A client wants: "${clientPrompt}"${skillContext}

Break into 3-7 sequential tasks. Return ONLY valid JSON:
{"tasks":[{"title":"Short title","intent":"security_fix_v2","prompt":"Detailed prompt","stop_condition":"source_contains:keyword"}]}

Rules:
- intent: security_fix_v2 | seo_fix | error_fix | chat
- stop_condition: file_exists:/path OR source_contains:keyword
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

function extractJSON(content: string): { tasks: Array<{ title: string; intent: string; prompt: string; stop_condition?: string }> } | null {
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
// Uses a brainchain account's brain_project_id to send the task.
// Fire-and-forget: completion detection by orchestrator-tick.
async function executeTaskViaBrainchain(
  sc: SupabaseClient,
  task: { id: string; prompt: string; intent: string; task_index: number },
  projectId: string,
  account: { id: string; accessToken: string; brainProjectId: string },
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  await sc.from("orchestrator_tasks").update({
    status: "running", started_at: new Date().toISOString(),
  }).eq("id", task.id);

  await addLog(sc, projectId, `▶ Task #${task.task_index} — sending via Brainchain account ${account.id.slice(0, 8)}`, "info", undefined, task.id);

  try {
    const msgId = "usermsg_" + rb32(26);
    const aiMsgId = "aimsg_" + rb32(26);

    const lvPayload = {
      id: msgId,
      message: AQ_PREFIX + task.prompt,
      chat_only: false,
      ai_message_id: aiMsgId,
      thread_id: "main",
      view: "editor",
      view_description: "Orchestrator task execution.",
      model: null,
      session_replay: "[]",
      client_logs: [],
      network_requests: [],
      runtime_errors: [],
      files: [],
      integration_metadata: {
        browser: { preview_viewport_width: 1280, preview_viewport_height: 854, auth_token: account.accessToken },
        supabase: { auth_token: account.accessToken },
      },
    };

    const lvRes = await fetch(`https://api.lovable.dev/projects/${account.brainProjectId}/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        "Content-Type": "application/json",
        Origin: "https://lovable.dev",
        Referer: "https://lovable.dev/",
        "X-Client-Git-SHA": "3d7a3673c6f02b606137a12ddc0ab88f6b775113",
      },
      body: JSON.stringify(lvPayload),
    });

    if (lvRes.status === 429) {
      await releaseBrainchainAccount(sc, account.id, false);
      return { success: false, error: "Rate limit on brainchain account" };
    }
    if (lvRes.status === 401) {
      await releaseBrainchainAccount(sc, account.id, false);
      return { success: false, error: "Token expired on brainchain account" };
    }
    if (lvRes.status !== 202 && !lvRes.ok) {
      await releaseBrainchainAccount(sc, account.id, false);
      const d = await lvRes.json().catch(() => ({}));
      return { success: false, error: (d as any).error || `HTTP ${lvRes.status}` };
    }

    // Store which account is running this task (for tick to poll)
    await sc.from("orchestrator_tasks").update({
      lovable_message_id: msgId,
    }).eq("id", task.id);

    // Store brainchain info on project for tick to use
    await sc.from("orchestrator_projects").update({
      lovable_project_id: account.brainProjectId,
      ghost_created: true,
    }).eq("id", projectId);

    await addLog(sc, projectId, `Task #${task.task_index} sent to brain ${account.brainProjectId.slice(0, 8)}. Tick will detect completion.`, "info", {
      brainchain_account_id: account.id,
      brain_project_id: account.brainProjectId,
    }, task.id);

    // NOTE: We do NOT release the account here — tick will release it when task completes
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
        await addLog(sc, "", `🔍 Brain lookup: ${brainId.slice(0, 8)} → ${brainRow ? `found (${brainSkills.length} skills)` : "NOT FOUND"}`, "debug",
          { brain_id: brainId, skills: brainSkills, brain_name: brainName });
      }

      // Create project record
      const { data: project, error: projErr } = await sc.from("orchestrator_projects").insert({
        user_id: userId, client_prompt: clientPrompt,
        brain_id: brainId || null, brain_skill_profile: brainSkills,
        status: "planning",
      }).select("id").single();

      if (projErr || !project) {
        console.error("[orch] start: project creation failed:", projErr?.message);
        return json({ error: "Failed to create project", details: projErr?.message }, 500);
      }
      const projectId = project.id as string;

      await addLog(sc, projectId, `🚀 Orchestrator started${brainName ? ` (Brain: ${brainName})` : ""}: "${clientPrompt.slice(0, 80)}…"`, "info",
        { user_id: userId, brain_id: brainId, prompt_length: clientPrompt.length });

      // Generate PRD INLINE
      await addLog(sc, projectId, "🧠 Generating PRD…", "info");
      const prdT0 = Date.now();
      const prd = await generatePRD(clientPrompt, brainSkills);
      const prdDuration = Date.now() - prdT0;

      if (!prd || !prd.tasks?.length) {
        const fallback = [{ title: "Implementar projeto completo", intent: "chat", prompt: clientPrompt }];
        await sc.from("orchestrator_tasks").insert(fallback.map((t, i) => ({
          project_id: projectId, task_index: i, title: t.title, intent: t.intent, prompt: t.prompt,
        })));
        await sc.from("orchestrator_projects").update({
          status: "paused", total_tasks: fallback.length,
          prd_json: { tasks: fallback, note: "PRD unavailable — fallback" },
        }).eq("id", projectId);
        await addLog(sc, projectId, `⚠️ PRD FAILED after ${prdDuration}ms — fallback single task created`, "warn",
          { prd_duration_ms: prdDuration, fallback: true, reason: prd === null ? "all_engines_failed" : "empty_tasks" });
      } else {
        await sc.from("orchestrator_projects").update({
          prd_json: prd, total_tasks: prd.tasks.length, status: "paused",
        }).eq("id", projectId);
        await sc.from("orchestrator_tasks").insert(
          prd.tasks.map((t, i) => ({
            project_id: projectId, task_index: i,
            title: t.title, intent: t.intent || "chat",
            prompt: t.prompt, stop_condition: t.stop_condition || null,
          }))
        );
        await addLog(sc, projectId, `✅ PRD ready: ${prd.tasks.length} tasks in ${prdDuration}ms. Brainchain pool will execute.`, "info",
          { prd_duration_ms: prdDuration, task_count: prd.tasks.length,
            task_titles: prd.tasks.map(t => t.title) });
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
      if (project.status === "completed") {
        await addLog(sc, projectId, `⏭ execute_next called but project already completed`, "debug");
        return json({ status: "already_completed" });
      }
      if (project.status === "failed") {
        await addLog(sc, projectId, `⏭ execute_next called but project is failed: ${project.last_error}`, "debug");
        return json({ status: "failed", error: project.last_error });
      }
      if (project.status === "executing") {
        await addLog(sc, projectId, `⏭ execute_next called but project already executing`, "debug");
        return json({ status: "already_executing" });
      }

      // Acquire a brainchain account from the pool
      const acqT0 = Date.now();
      const account = await acquireBrainchainAccount(sc);
      const acqDuration = Date.now() - acqT0;

      if (!account) {
        await addLog(sc, projectId, `⚠️ No brainchain accounts available — will retry on next tick (acq took ${acqDuration}ms)`, "warn",
          { acquire_duration_ms: acqDuration, action: "no_accounts_backoff" });
        await sc.from("orchestrator_projects").update({
          next_tick_at: new Date(Date.now() + 30_000).toISOString(),
        }).eq("id", projectId);
        return json({ error: "No brainchain accounts available", retry_after: 30 }, 503);
      }

      await addLog(sc, projectId, `🔑 Acquired brainchain account ${account.id.slice(0, 8)} (brain: ${account.brainProjectId.slice(0, 8)}) in ${acqDuration}ms`, "debug",
        { account_id: account.id, brain_project: account.brainProjectId, acquire_duration_ms: acqDuration });

      // Get next pending task
      const { data: task } = await sc.from("orchestrator_tasks")
        .select("*").eq("project_id", projectId).eq("status", "pending")
        .order("task_index", { ascending: true }).limit(1).maybeSingle();

      if (!task) {
        await releaseBrainchainAccount(sc, account.id, true);
        await sc.from("orchestrator_projects").update({
          status: "completed",
          current_task_index: project.total_tasks as number,
          quality_score: 100,
        }).eq("id", projectId);
        await addLog(sc, projectId, "🎉 All tasks completed! Released account.", "info",
          { account_id: account.id });
        return json({ status: "completed" });
      }

      // Set to executing BEFORE sending
      await sc.from("orchestrator_projects").update({
        status: "executing", current_task_index: task.task_index as number,
        next_tick_at: new Date(Date.now() + 30_000).toISOString(),
      }).eq("id", projectId);

      const execT0 = Date.now();
      const result = await executeTaskViaBrainchain(
        sc,
        { id: task.id as string, prompt: task.prompt as string, intent: task.intent as string, task_index: task.task_index as number },
        projectId, account,
      );
      const execDuration = Date.now() - execT0;

      if (!result.success) {
        const retries = ((task.retry_count as number) || 0) + 1;
        await addLog(sc, projectId,
          `❌ Task #${task.task_index} "${task.title}" FAILED (attempt ${retries}/3): ${result.error}`, "error",
          { task_id: task.id, task_index: task.task_index, retry_count: retries,
            error: result.error, exec_duration_ms: execDuration,
            account_id: account.id, brain_project: account.brainProjectId },
          task.id as string);

        if (retries >= 3) {
          await sc.from("orchestrator_tasks").update({ status: "failed", retry_count: retries }).eq("id", task.id);
          await sc.from("orchestrator_projects").update({ status: "failed", last_error: result.error }).eq("id", projectId);
          return json({ status: "task_failed", error: result.error }, 500);
        }
        await sc.from("orchestrator_tasks").update({ retry_count: retries }).eq("id", task.id);
        await sc.from("orchestrator_projects").update({ status: "paused" }).eq("id", projectId);
        return json({ status: "task_retry", retry_count: retries, error: result.error });
      }

      await addLog(sc, projectId,
        `📤 Task #${task.task_index} "${task.title}" dispatched successfully via account ${account.id.slice(0, 8)} in ${execDuration}ms`, "info",
        { task_id: task.id, task_index: task.task_index, message_id: result.messageId,
          exec_duration_ms: execDuration, account_id: account.id,
          brain_project: account.brainProjectId },
        task.id as string);

      return json({
        status: "executing",
        task_index: task.task_index,
        task_title: task.title,
        message_id: result.messageId,
        brainchain_account: account.id.slice(0, 8),
        brain_project: account.brainProjectId.slice(0, 8),
        message: "Task dispatched via Brainchain. Tick will detect completion.",
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
