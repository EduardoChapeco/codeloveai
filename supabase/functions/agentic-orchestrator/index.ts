/**
 * Agentic Orchestrator — Engine v3 (Clean rewrite)
 *
 * Key fixes from v2:
 *  - executeTask is FIRE-AND-FORGET (no 180s polling loop that exceeds edge fn timeout)
 *  - Completion detection delegated to orchestrator-tick
 *  - PRD generation inline (not async IIFE that gets killed)
 *  - Simplified ghost-create flow
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateTypeId } from "../_shared/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXT_API = "https://api.lovable.dev";

const AQ_PREFIX = `IMPORTANTE: Não faça perguntas, não peça confirmação, não liste planos. Execute diretamente. Se houver ambiguidade, escolha a opção mais segura e execute.\n\nIMPORTANTE: Execute diretamente, sem perguntas ou planos.\n\n`;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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

async function getUserToken(sc: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await sc
    .from("lovable_accounts")
    .select("token_encrypted")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  return (data?.token_encrypted as string) || null;
}

// ─── Lovable API helper ───────────────────────────────────────
async function extFetch(url: string, opts: RequestInit, token: string) {
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "Origin": "https://lovable.dev",
      "Referer": "https://lovable.dev/",
      "X-Client-Git-SHA": "3d7a3673c6f02b606137a12ddc0ab88f6b775113",
      ...(opts.headers || {}),
    },
  });
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
          temperature: 0.2,
          max_tokens: 3000,
        }),
      });
      if (res.ok) {
        const result = await res.json() as Record<string, unknown>;
        const content = ((result?.choices as any)?.[0]?.message?.content || "") as string;
        const parsed = extractJSON(content);
        if (parsed) return parsed;
      }
    } catch (e) {
      console.error("[PRD] Gateway error:", (e as Error).message);
    }
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
    } catch (e) {
      console.error("[PRD] OpenRouter error:", (e as Error).message);
    }
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

// ─── Ghost Create (quick — no polling) ───────────────────────
async function ghostCreate(
  sc: SupabaseClient, projectId: string, token: string
): Promise<{ lovableProjectId: string } | { error: string }> {
  // Get workspace
  const wsRes = await extFetch(`${EXT_API}/user/workspaces`, { method: "GET" }, token);
  if (!wsRes.ok) return { error: `Workspace fetch failed: ${wsRes.status}` };

  let wsBody: any;
  try { wsBody = await wsRes.json(); } catch { return { error: "Workspace parse error" }; }
  const wsList = Array.isArray(wsBody) ? wsBody : (wsBody?.workspaces || wsBody?.data || []);
  const workspaceId = wsList?.[0]?.id || wsBody?.id;
  if (!workspaceId) return { error: "No workspace found" };

  // Create project
  const createRes = await extFetch(
    `${EXT_API}/workspaces/${workspaceId}/projects`,
    { method: "POST", body: JSON.stringify({ name: `starble-orch-${Date.now()}`, initial_message: "setup", visibility: "private" }) },
    token
  );
  if (!createRes.ok) return { error: `Create failed: ${createRes.status}` };

  const created = await createRes.json() as Record<string, unknown>;
  const lovableProjectId = (created.id || created.project_id) as string;
  if (!lovableProjectId) return { error: "No project ID returned" };

  // Ghost cancel (fire-and-forget)
  const initMsgId = (created.message_id || created.initial_message_id) as string | undefined;
  if (initMsgId) {
    extFetch(`${EXT_API}/projects/${lovableProjectId}/chat/${initMsgId}/cancel`, { method: "POST" }, token).catch(() => {});
  } else {
    // Try to get latest message and cancel it after a short delay
    setTimeout(async () => {
      try {
        const latestRes = await extFetch(`${EXT_API}/projects/${lovableProjectId}/latest-message`, { method: "GET" }, token);
        if (latestRes.ok) {
          const latest = await latestRes.json() as Record<string, unknown>;
          const latestId = (latest?.id || latest?.message_id) as string;
          if (latestId) await extFetch(`${EXT_API}/projects/${lovableProjectId}/chat/${latestId}/cancel`, { method: "POST" }, token);
        }
      } catch { /* ok */ }
    }, 1000);
  }

  await sc.from("orchestrator_projects").update({
    lovable_project_id: lovableProjectId, ghost_created: true,
  }).eq("id", projectId);

  await addLog(sc, projectId, `👻 Ghost created: ${lovableProjectId}`, "info");
  return { lovableProjectId };
}

// ─── Execute Task (FIRE-AND-FORGET — no polling!) ────────────
// Sends the message via venus-chat and returns immediately.
// Completion detection is handled by orchestrator-tick.
async function executeTask(
  sc: SupabaseClient,
  task: { id: string; prompt: string; intent: string; task_index: number },
  projectId: string,
  lovableProjectId: string,
  lovableToken: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  await sc.from("orchestrator_tasks").update({
    status: "running", started_at: new Date().toISOString(),
  }).eq("id", task.id);

  await addLog(sc, projectId, `▶ Task #${task.task_index} — sending via venus-chat`, "info", undefined, task.id);

  // Capture fingerprint BEFORE sending
  try {
    const fpRes = await extFetch(`${EXT_API}/projects/${lovableProjectId}/source-code`, { method: "GET" }, lovableToken);
    if (fpRes.ok) {
      const fpData = await fpRes.json() as Record<string, unknown>;
      const files = (fpData.files || []) as Array<{ path: string; size?: number }>;
      const fp = files.map(f => `${f.path}:${f.size ?? 0}`).sort().join("|");
      await sc.from("orchestrator_projects").update({ source_fingerprint: fp }).eq("id", projectId);
    }
  } catch { /* non-critical */ }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const venusRes = await fetch(`${supabaseUrl}/functions/v1/venus-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        task: AQ_PREFIX + task.prompt,
        project_id: lovableProjectId,
        mode: "task",
        lovable_token: lovableToken,
      }),
    });

    const venusData = await venusRes.json().catch(() => ({})) as Record<string, unknown>;

    if (!venusRes.ok || !venusData?.ok) {
      const errMsg = (venusData?.error as string) || `HTTP ${venusRes.status}`;
      await addLog(sc, projectId, `Task #${task.task_index} venus-chat error: ${errMsg}`, "error", venusData, task.id);
      return { success: false, error: errMsg };
    }

    const messageId = (venusData.msgId as string) || undefined;
    await sc.from("orchestrator_tasks").update({ lovable_message_id: messageId || null }).eq("id", task.id);
    await addLog(sc, projectId, `Task #${task.task_index} sent (msgId: ${messageId}). Tick will detect completion.`, "info", undefined, task.id);

    return { success: true, messageId };
  } catch (e) {
    const err = (e as Error).message;
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

      const adminToken = await getUserToken(sc, userId);
      if (!adminToken) return json({ error: "Token Lovable não encontrado. Reconecte via /lovable/connect." }, 503);

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
      }).select("id").single();

      if (projErr || !project) return json({ error: "Failed to create project" }, 500);
      const projectId = project.id as string;

      await addLog(sc, projectId, `🚀 Orchestrator started${brainName ? ` (Brain: ${brainName})` : ""}: "${clientPrompt.slice(0, 80)}…"`, "info");

      // Generate PRD INLINE (not async — avoids edge fn timeout killing the IIFE)
      await addLog(sc, projectId, "🧠 Generating PRD…", "info");
      const prd = await generatePRD(clientPrompt, brainSkills);

      if (!prd || !prd.tasks?.length) {
        const fallback = [{ title: "Implementar projeto completo", intent: "chat", prompt: clientPrompt }];
        await sc.from("orchestrator_tasks").insert(fallback.map((t, i) => ({
          project_id: projectId, task_index: i, title: t.title, intent: t.intent, prompt: t.prompt,
        })));
        await sc.from("orchestrator_projects").update({
          status: "paused", total_tasks: fallback.length,
          prd_json: { tasks: fallback, note: "PRD unavailable — fallback" },
        }).eq("id", projectId);
        await addLog(sc, projectId, "⚠️ PRD unavailable — fallback task created.", "warn");
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
        await addLog(sc, projectId, `✅ PRD ready: ${prd.tasks.length} tasks. Status: paused — click Execute or let cron handle it.`, "info");
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

      const adminTk = await getUserToken(sc, project.user_id as string);
      if (!adminTk) {
        await addLog(sc, projectId, "❌ Token indisponível — marcando como falho", "error");
        await sc.from("orchestrator_projects").update({
          status: "failed",
          last_error: "Token Lovable não encontrado. Reconecte em /lovable/connect.",
        }).eq("id", projectId);
        return json({ error: "Token Lovable não encontrado." }, 503);
      }

      // Ghost-create if needed
      if (!project.lovable_project_id) {
        const result = await ghostCreate(sc, projectId, adminTk);
        if ("error" in result) {
          await addLog(sc, projectId, `❌ Ghost create failed: ${result.error}`, "error");
          // If 401, mark as failed immediately
          if (result.error.includes("401") || result.error.includes("Unauthorized")) {
            await sc.from("orchestrator_projects").update({
              status: "failed",
              last_error: "Token Lovable expirado. Reconecte em /lovable/connect.",
            }).eq("id", projectId);
          }
          return json({ error: result.error }, 502);
        }
        project.lovable_project_id = result.lovableProjectId;
        // Wait for project to stabilize
        await new Promise(r => setTimeout(r, 3000));
      }

      // Get next pending task
      const { data: task } = await sc.from("orchestrator_tasks")
        .select("*").eq("project_id", projectId).eq("status", "pending")
        .order("task_index", { ascending: true }).limit(1).maybeSingle();

      if (!task) {
        await sc.from("orchestrator_projects").update({ status: "completed" }).eq("id", projectId);
        await addLog(sc, projectId, "🎉 All tasks completed!", "info");
        return json({ status: "completed" });
      }

      // Set to executing BEFORE sending
      await sc.from("orchestrator_projects").update({
        status: "executing", current_task_index: task.task_index as number,
        next_tick_at: new Date(Date.now() + 30_000).toISOString(), // tick checks in 30s
      }).eq("id", projectId);

      const result = await executeTask(
        sc,
        { id: task.id as string, prompt: task.prompt as string, intent: task.intent as string, task_index: task.task_index as number },
        projectId, project.lovable_project_id as string, adminTk
      );

      if (!result.success) {
        const retries = ((task.retry_count as number) || 0) + 1;
        if (retries >= 3) {
          await sc.from("orchestrator_tasks").update({ status: "failed", retry_count: retries }).eq("id", task.id);
          await sc.from("orchestrator_projects").update({ status: "failed", last_error: result.error }).eq("id", projectId);
          return json({ status: "task_failed", error: result.error }, 500);
        }
        await sc.from("orchestrator_tasks").update({ retry_count: retries }).eq("id", task.id);
        await sc.from("orchestrator_projects").update({ status: "paused" }).eq("id", projectId);
        return json({ status: "task_retry", retry_count: retries, error: result.error });
      }

      return json({
        status: "executing",
        task_index: task.task_index,
        task_title: task.title,
        message_id: result.messageId,
        message: "Task dispatched. Tick will detect completion.",
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

    // ─── ACTION: check_completion (used by tick) ──────────────
    if (action === "check_completion") {
      const projectId = (body.project_id as string) || "";
      if (!projectId) return json({ error: "project_id required" }, 400);

      const isInternal = req.headers.get("x-orchestrator-internal") === "true";
      let q = sc.from("orchestrator_projects").select("*").eq("id", projectId);
      if (!isInternal) q = q.eq("user_id", userId);
      const { data: project } = await q.maybeSingle();
      if (!project) return json({ error: "Not found" }, 404);

      const lovableProjectId = project.lovable_project_id as string;
      if (!lovableProjectId) return json({ completed: false, reason: "no_project" });

      const adminTk = await getUserToken(sc, project.user_id as string);
      if (!adminTk) return json({ completed: false, reason: "no_token" });

      // Check fingerprint change
      let fpChanged = false;
      try {
        const fpRes = await extFetch(`${EXT_API}/projects/${lovableProjectId}/source-code`, { method: "GET" }, adminTk);
        if (fpRes.ok) {
          const fpData = await fpRes.json() as Record<string, unknown>;
          const files = (fpData.files || []) as Array<{ path: string; size?: number }>;
          const fpNow = files.map(f => `${f.path}:${f.size ?? 0}`).sort().join("|");
          const fpBefore = project.source_fingerprint as string | null;
          fpChanged = !!fpBefore && fpNow !== fpBefore;
          if (fpChanged) {
            await sc.from("orchestrator_projects").update({ source_fingerprint: fpNow }).eq("id", projectId);
          }
        }
      } catch { /* non-critical */ }

      // Check latest-message streaming status
      let streamingDone = false;
      try {
        const pollRes = await extFetch(`${EXT_API}/projects/${lovableProjectId}/latest-message`, { method: "GET" }, adminTk);
        if (pollRes.ok) {
          const pollData = await pollRes.json() as Record<string, unknown>;
          streamingDone = !!(pollData && !pollData.is_streaming && pollData.content);
        }
      } catch { /* non-critical */ }

      const completed = fpChanged || streamingDone;
      return json({ completed, fp_changed: fpChanged, streaming_done: streamingDone });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("[Orchestrator] Error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
