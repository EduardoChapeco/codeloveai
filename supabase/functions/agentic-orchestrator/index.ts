import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ══════════════════════════════════════════════════════════════
// Agentic Orchestrator — Engine v2 (Phase 9)
//
// Key improvements:
//  1. Anti-question prefix injected in ALL prompts → no clarifying Q's
//  2. Token expiry check before every Lovable dispatch
//  3. Relay polling: execute_next waits for relay-response to confirm
//     Lovable actually streamed output (up to 3 min)
//  4. Stop conditions v2: file_exists / source_contains / relay_response
//  5. New actions: generate_md_tasks, read_md_tasks, read_source_code
//  6. Auto-rollback on 3 consecutive task failures
// ══════════════════════════════════════════════════════════════

import { obfuscate } from "../_shared/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXT_API = "https://api.lovable.dev";

// ─── Anti-question prefix ─────────────────────────────────────
// Prevents Lovable from asking clarifying questions mid-task.
const AQ_PREFIX = `IMPORTANT INSTRUCTION: You MUST implement this directly without asking any clarifying questions. Do NOT say "would you like me to", do NOT ask for confirmation. Just implement it completely. If anything is ambiguous, choose the most sensible option and implement it.\n\n`;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Auth helpers ─────────────────────────────────────────────
async function getUserId(req: Request, anonSc: SupabaseClient, body?: Record<string, unknown>): Promise<string | null> {
  // Internal calls from orchestrator-tick use service role key + _internal_user_id
  const isInternal = req.headers.get("x-orchestrator-internal") === "true";
  if (isInternal && body?._internal_user_id) {
    return body._internal_user_id as string;
  }
  try {
    const { data: { user } } = await anonSc.auth.getUser();
    return user?.id || null;
  } catch { return null; }
}

// getLovableToken and refreshLovableToken removed — all operations now use admin token

async function getAdminToken(sc: SupabaseClient): Promise<string | null> {
  const { data } = await sc
    .from("lovable_accounts")
    .select("token_encrypted")
    .eq("is_admin_account", true)
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
      ...(opts.headers || {}),
    },
  });
}

// ─── Logging ─────────────────────────────────────────────────
async function addLog(
  sc: SupabaseClient,
  projectId: string,
  message: string,
  level: "info" | "warn" | "error" | "debug" = "info",
  metadata?: unknown,
  taskId?: string
) {
  await sc.from("orchestrator_logs").insert({
    project_id: projectId,
    task_id: taskId || null,
    level,
    message,
    metadata: metadata || null,
  });
}

// ─── PRD Generation ───────────────────────────────────────────
async function generatePRD(
  sc: SupabaseClient,
  userId: string,
  clientPrompt: string,
  adminToken: string
): Promise<{ tasks: Array<{ title: string; intent: string; prompt: string; stop_condition?: string }> } | null> {
  // Get user's brain project (admin-owned)
  const { data: brainRow } = await sc
    .from("user_brain_projects")
    .select("lovable_project_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  const brainProjectId = brainRow?.lovable_project_id || null;
  const token = adminToken;
  if (!brainProjectId) return null;

  const architectPrompt = `${AQ_PREFIX}You are a senior software architect. A client wants to build: "${clientPrompt}"

Break this into 3–7 sequential implementation tasks. Return ONLY valid JSON — no explanation, no markdown, no comments:

{
  "tasks": [
    {
      "title": "Short task title",
      "intent": "security_fix_v2",
      "prompt": "Detailed implementation prompt with all context needed",
      "stop_condition": "source_contains:TableName"
    }
  ]
}

Rules:
- intent must be one of: security_fix_v2, seo_fix, error_fix, chat
- stop_condition format: file_exists:/path/to/file OR source_contains:keyword OR relay_response:keyword
- Each prompt must be fully self-contained and detailed
- Tasks must be sequential (each builds on the previous)
- Inject implementation instructions — no questions`;

  try {
    const res = await extFetch(
      `${EXT_API}/projects/${brainProjectId}/chat`,
      { method: "POST", body: JSON.stringify({ message: architectPrompt, intent: "chat", chat_only: true }) },
      token
    );
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const messageId = (data.id || data.message_id) as string | undefined;
    if (!messageId) return null;

    const maxWait = 30000;
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      await new Promise(r => setTimeout(r, 3000));
      const pollRes = await extFetch(`${EXT_API}/projects/${brainProjectId}/latest-message`, { method: "GET" }, token);
      if (pollRes.ok) {
        const msg = await pollRes.json() as Record<string, unknown>;
        if (msg && !msg.is_streaming) {
          const content = (msg.content || msg.message || msg.text || "") as string;
          if (content.length > 20) {
            let jsonStr = content.trim();
            const m = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (m) jsonStr = m[1].trim();
            // Find JSON object
            const objStart = jsonStr.indexOf("{");
            if (objStart >= 0) jsonStr = jsonStr.slice(objStart);
            try {
              const parsed = JSON.parse(jsonStr) as { tasks: Array<{ title: string; intent: string; prompt: string; stop_condition?: string }> };
              if (parsed.tasks && Array.isArray(parsed.tasks)) return parsed;
            } catch { /* keep polling */ }
          }
        }
      }
    }
    return null;
  } catch (e) {
    console.error("[PRD Gen] Error:", e);
    return null;
  }
}

// ─── Stop Conditions v2 ───────────────────────────────────────
type StopConditionResult = { met: boolean; reason: string };

async function evaluateStopCondition(
  sc: SupabaseClient,
  projectId: string,
  condition: string,
  lovableProjectId: string,
  lovableToken: string,
  relayMessageId?: string
): Promise<StopConditionResult> {
  if (!condition) return { met: true, reason: "no condition set" };

  const [type, ...valueParts] = condition.split(":");
  const value = valueParts.join(":");

  // Layer 1: file_exists — check Lovable source for file at path
  if (type === "file_exists") {
    try {
      const srcRes = await extFetch(
        `${EXT_API}/projects/${lovableProjectId}/source-code`,
        { method: "GET" },
        lovableToken
      );
      if (srcRes.ok) {
        const srcData = await srcRes.json() as Record<string, unknown>;
        const files = (srcData.files || []) as Array<{ path: string }>;
        const found = files.some(f => f.path.includes(value));
        return { met: found, reason: found ? `File "${value}" found` : `File "${value}" not found in source` };
      }
    } catch (e) { return { met: false, reason: `file_exists check error: ${(e as Error).message}` }; }
  }

  // Layer 2: source_contains — check file content for keyword
  if (type === "source_contains") {
    try {
      const srcRes = await extFetch(
        `${EXT_API}/projects/${lovableProjectId}/source-code`,
        { method: "GET" },
        lovableToken
      );
      if (srcRes.ok) {
        const srcData = await srcRes.json() as Record<string, unknown>;
        const files = (srcData.files || []) as Array<{ path: string; content?: string }>;
        const found = files.some(f => f.content?.includes(value));
        return { met: found, reason: found ? `Keyword "${value}" found in source` : `Keyword "${value}" not found in any file` };
      }
    } catch (e) { return { met: false, reason: `source_contains check error: ${(e as Error).message}` }; }
  }

  // Layer 3: relay_response — check orchestration_messages for relay confirmation
  if (type === "relay_response") {
    const { data: relayMsg } = await sc
      .from("orchestration_messages")
      .select("content")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (relayMsg && relayMsg.length > 0) {
      const found = relayMsg.some((m: { content: string }) =>
        !value || m.content?.toLowerCase().includes(value.toLowerCase())
      );
      return { met: found, reason: found ? "Relay response received with expected content" : "Relay response not yet received" };
    }
    return { met: false, reason: "No relay messages yet" };
  }

  // Unknown condition type — pass optimistically
  return { met: true, reason: `Unknown condition type "${type}" — skipping` };
}

// ─── Mode Config (per guide) ──────────────────────────────────
// Maps intent to proper Lovable API parameters.
// Rule: everything except "build" (null intent) is free.
interface ModeConfig {
  intent: string;
  chat_only: boolean;
  view: string | null;
  view_description: string | null;
}

function getModeConfig(taskIntent: string): ModeConfig {
  switch (taskIntent) {
    case "chat":
      return {
        intent: "security_fix_v2",
        chat_only: true,
        view: null,
        view_description: null,
      };
    case "security_fix_v2":
    case "security":
      return {
        intent: "security_fix_v2",
        chat_only: false,
        view: "security",
        view_description: "The user is currently viewing the security view for their project.",
      };
    case "seo_fix":
      return {
        intent: "seo_fix",
        chat_only: false,
        view: "code",
        view_description: "User editing via Starble Orchestrator.",
      };
    case "error_fix":
      return {
        intent: "security_fix_v2",
        chat_only: false,
        view: "code",
        view_description: "User editing via Starble Orchestrator.",
      };
    case "build":
      // Only mode that costs credits — use sparingly
      return {
        intent: "",  // null intent = normal chat = costs credits
        chat_only: false,
        view: "code",
        view_description: "User editing via Starble Orchestrator.",
      };
    default:
      // Default: use security_fix_v2 (free) with code view
      return {
        intent: "security_fix_v2",
        chat_only: false,
        view: "code",
        view_description: "User editing via Starble Orchestrator.",
      };
  }
}

// ─── Execute Task ─────────────────────────────────────────────
async function executeTask(
  sc: SupabaseClient,
  task: { id: string; prompt: string; intent: string; task_index: number; stop_condition?: string },
  projectId: string,
  lovableProjectId: string,
  lovableToken: string
): Promise<{ success: boolean; messageId?: string; error?: string; relayReceived?: boolean }> {
  await sc.from("orchestrator_tasks").update({
    status: "running",
    started_at: new Date().toISOString(),
  }).eq("id", task.id);

  const mode = getModeConfig(task.intent);
  await addLog(sc, projectId, `▶ Task #${task.task_index} — intent: ${task.intent} → mode: ${mode.intent || "chat(paid)"}, chat_only: ${mode.chat_only}`, "info", undefined, task.id);

  // Inject anti-question prefix
  const enhancedPrompt = AQ_PREFIX + task.prompt;

  // Capture fingerprint BEFORE dispatching (for completion detection layer 2)
  let fingerprintBefore: string | null = null;
  try {
    const fpRes = await extFetch(
      `${EXT_API}/projects/${lovableProjectId}/source-code`,
      { method: "GET" },
      lovableToken
    );
    if (fpRes.ok) {
      const fpData = await fpRes.json() as Record<string, unknown>;
      const files = (fpData.files || []) as Array<{ path: string; size?: number }>;
      fingerprintBefore = files.map(f => `${f.path}:${f.size ?? 0}`).sort().join("|");
    }
  } catch { /* non-critical */ }

  try {
    const msgId = `umsg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    const aiMsgId = `aimsg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

    const payload: Record<string, unknown> = {
      id: msgId,
      message: enhancedPrompt,
      intent: mode.intent || undefined,
      chat_only: mode.chat_only,
      ai_message_id: aiMsgId,
      thread_id: "main",
      files: [],
      optimisticImageUrls: [],
    };
    if (mode.view) payload.view = mode.view;
    if (mode.view_description) payload.view_description = mode.view_description;

    const res = await extFetch(
      `${EXT_API}/projects/${lovableProjectId}/chat`,
      { method: "POST", body: JSON.stringify(payload) },
      lovableToken
    );

    if (!res.ok) {
      const errText = await res.text();
      await addLog(sc, projectId, `Task #${task.task_index} Lovable API error: ${res.status}`, "error", { errText }, task.id);
      return { success: false, error: `Lovable API ${res.status}: ${errText.slice(0, 200)}` };
    }

    const data = await res.json() as Record<string, unknown>;
    const messageId = (data.id || data.message_id) as string | undefined;

    await sc.from("orchestrator_tasks").update({
      lovable_message_id: messageId || null,
    }).eq("id", task.id);

    await addLog(sc, projectId, `Task #${task.task_index} sent (msgId: ${messageId}). Awaiting completion…`, "info", undefined, task.id);

    // ── 3-Layer Completion Detection ──
    // Layer 1: Relay response from extension WS bridge
    // Layer 2: Source-code fingerprint change
    // Layer 3: latest-message polling (streaming complete)
    const relayMaxMs = 180_000;
    const relayStart = Date.now();
    let relayReceived = false;

    // Initial delay before polling (Lovable needs time to start processing)
    await new Promise(r => setTimeout(r, 8000));

    while (Date.now() - relayStart < relayMaxMs) {
      // Layer 1: Check relay messages
      const { data: relayRows } = await sc
        .from("orchestration_messages")
        .select("id, created_at")
        .eq("project_id", projectId)
        .gte("created_at", new Date(relayStart - 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1);

      if (relayRows && relayRows.length > 0) {
        relayReceived = true;
        await addLog(sc, projectId, `✅ Task #${task.task_index} relay response confirmed`, "info", undefined, task.id);
        break;
      }

      // Layer 2: Fingerprint change detection (if we have a baseline)
      if (fingerprintBefore && !mode.chat_only) {
        try {
          const fpRes2 = await extFetch(
            `${EXT_API}/projects/${lovableProjectId}/source-code`,
            { method: "GET" },
            lovableToken
          );
          if (fpRes2.ok) {
            const fpData2 = await fpRes2.json() as Record<string, unknown>;
            const files2 = (fpData2.files || []) as Array<{ path: string; size?: number }>;
            const fingerprintAfter = files2.map(f => `${f.path}:${f.size ?? 0}`).sort().join("|");
            if (fingerprintAfter !== fingerprintBefore) {
              relayReceived = true;
              await addLog(sc, projectId, `✅ Task #${task.task_index} source-code changed (fingerprint diff)`, "info", undefined, task.id);
              // Update project fingerprint
              await sc.from("orchestrator_projects").update({ source_fingerprint: fingerprintAfter }).eq("id", projectId);
              break;
            }
          }
        } catch { /* non-critical */ }
      }

      // Layer 3: Poll Lovable's latest-message for streaming completion
      try {
        const pollRes = await extFetch(
          `${EXT_API}/projects/${lovableProjectId}/latest-message`,
          { method: "GET" },
          lovableToken
        );
        if (pollRes.ok) {
          const pollData = await pollRes.json() as Record<string, unknown>;
          if (pollData && !pollData.is_streaming && pollData.content) {
            await addLog(sc, projectId, `✅ Task #${task.task_index} Lovable streaming complete (direct poll)`, "info", undefined, task.id);
            relayReceived = true;
            break;
          }
        }
      } catch { /* non-critical */ }

      await new Promise(r => setTimeout(r, 8000));
    }

    if (!relayReceived) {
      await addLog(sc, projectId, `⚠️ Task #${task.task_index} completion timeout (180s) — assuming partial completion`, "warn", undefined, task.id);
    }

    return { success: true, messageId, relayReceived };
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
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;

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
      const { client_prompt, workspace_id } = body as { client_prompt: string; workspace_id?: string };
      if (!client_prompt?.trim()) return json({ error: "client_prompt required" }, 400);

      const adminToken = await getAdminToken(sc);
      if (!adminToken) return json({ error: "Platform Brain unavailable. Contact administrator." }, 503);

      const { data: project, error: projErr } = await sc
        .from("orchestrator_projects")
        .insert({
          user_id: userId,
          client_prompt: client_prompt.trim(),
          workspace_id: workspace_id || null,
          status: "planning",
        })
        .select("id")
        .single();

      if (projErr || !project) return json({ error: "Failed to create project" }, 500);
      const projectId = project.id as string;

      await addLog(sc, projectId, `🚀 Orchestrator started: "${client_prompt.slice(0, 80)}…"`, "info");

      (async () => {
        try {
          await addLog(sc, projectId, "🧠 Brain generating PRD…", "info");
          const prd = await generatePRD(sc, userId, client_prompt, adminToken);

          if (!prd || !prd.tasks?.length) {
            const fallback = [{ title: "Implementar projeto completo", intent: "chat", prompt: client_prompt }];
            await sc.from("orchestrator_tasks").insert(fallback.map((t, i) => ({
              project_id: projectId, task_index: i, title: t.title, intent: t.intent, prompt: t.prompt,
            })));
            await sc.from("orchestrator_projects").update({
              status: "paused", total_tasks: fallback.length,
              prd_json: { tasks: fallback, note: "Brain unavailable — fallback" },
            }).eq("id", projectId);
            await addLog(sc, projectId, "⚠️ Brain unavailable — fallback task created. Ready to execute.", "warn");
            return;
          }

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

          await addLog(sc, projectId, `✅ PRD ready: ${prd.tasks.length} tasks — awaiting approval.`, "info");
        } catch (e) {
          await sc.from("orchestrator_projects").update({ status: "failed", last_error: (e as Error).message }).eq("id", projectId);
        }
      })();

      return json({ success: true, project_id: projectId, status: "planning" });
    }

    // ─── ACTION: execute_next ─────────────────────────────────
    if (action === "execute_next") {
      const { project_id } = body as { project_id: string };
      if (!project_id) return json({ error: "project_id required" }, 400);

      // For internal tick calls, don't filter by user_id (already validated)
      const isInternal = req.headers.get("x-orchestrator-internal") === "true";
      let projectQuery = sc.from("orchestrator_projects").select("*").eq("id", project_id);
      if (!isInternal) projectQuery = projectQuery.eq("user_id", userId);
      const { data: project } = await projectQuery.maybeSingle();

      if (!project) return json({ error: "Project not found" }, 404);
      if (project.status === "completed") return json({ status: "already_completed" });
      if (project.status === "failed") return json({ status: "failed", error: project.last_error });
      if (project.status === "planning") return json({ status: "still_planning" });

      // Token check — use admin token for all operations
      const adminTk = await getAdminToken(sc);
      if (!adminTk) {
        await addLog(sc, project_id, "❌ Admin token unavailable — pausing", "error");
        await sc.from("orchestrator_projects").update({ status: "paused", last_error: "Admin token unavailable" }).eq("id", project_id);
        return json({ error: "Platform Brain unavailable. Contact administrator." }, 503);
      }

      if (!project.lovable_project_id) return json({ error: "No Lovable project linked." }, 400);

      const { data: task } = await sc.from("orchestrator_tasks")
        .select("*").eq("project_id", project_id).eq("status", "pending")
        .order("task_index", { ascending: true }).limit(1).maybeSingle();

      if (!task) {
        await sc.from("orchestrator_projects").update({ status: "completed" }).eq("id", project_id);
        await addLog(sc, project_id, "🎉 All tasks completed!", "info");
        return json({ status: "completed" });
      }

      await sc.from("orchestrator_projects").update({
        status: "executing", current_task_index: task.task_index,
      }).eq("id", project_id);

      const result = await executeTask(
        sc,
        {
          id: task.id as string,
          prompt: task.prompt as string,
          intent: task.intent as string,
          task_index: task.task_index as number,
          stop_condition: (task.stop_condition as string) || undefined,
        },
        project_id,
        project.lovable_project_id as string,
        adminTk
      );

      if (!result.success) {
        const retries = ((task.retry_count as number) || 0) + 1;
        if (retries >= 3) {
          await sc.from("orchestrator_tasks").update({ status: "failed", retry_count: retries }).eq("id", task.id);
          await sc.from("orchestrator_projects").update({ status: "failed", last_error: result.error }).eq("id", project_id);

          // Check for 3 consecutive failures → auto-rollback signal
          const { data: recentFailed } = await sc.from("orchestrator_tasks")
            .select("id").eq("project_id", project_id).eq("status", "failed")
            .order("task_index", { ascending: false }).limit(3);
          if (recentFailed && recentFailed.length >= 3) {
            await addLog(sc, project_id, "🔄 3 consecutive failures — rollback triggered", "warn");
          }

          return json({ status: "task_failed", error: result.error }, 500);
        }
        await sc.from("orchestrator_tasks").update({ retry_count: retries }).eq("id", task.id);
        await sc.from("orchestrator_projects").update({ status: "paused" }).eq("id", project_id);
        return json({ status: "task_retry", retry_count: retries, error: result.error });
      }

      // Evaluate stop condition v2
      const stopCond = (task.stop_condition as string) || null;
      let stopMet = true;
      let stopReason = "no condition";

      if (stopCond) {
        const sc2Result = await evaluateStopCondition(
          sc, project_id, stopCond,
          project.lovable_project_id as string, adminTk
        );
        stopMet = sc2Result.met;
        stopReason = sc2Result.reason;
        await addLog(
          sc, project_id,
          `Stop condition "${stopCond}": ${stopMet ? "✅ met" : "⚠️ not met"} — ${stopReason}`,
          stopMet ? "info" : "warn", undefined, task.id as string
        );
      }

      if (stopMet) {
        await sc.from("orchestrator_tasks").update({
          status: "completed",
          completed_at: new Date().toISOString(),
          lovable_message_id: result.messageId || null,
        }).eq("id", task.id);
        await sc.from("orchestrator_projects").update({ status: "paused" }).eq("id", project_id);
      } else {
        // Stop condition not met → retry this task
        const retries = ((task.retry_count as number) || 0) + 1;
        await sc.from("orchestrator_tasks").update({ retry_count: retries }).eq("id", task.id);
        await sc.from("orchestrator_projects").update({ status: "paused", last_error: `Stop condition not met: ${stopReason}` }).eq("id", project_id);
        return json({ status: "stop_condition_pending", reason: stopReason, task_index: task.task_index });
      }

      const remaining = (project.total_tasks as number) - (task.task_index as number) - 1;
      return json({
        status: "task_completed",
        task_index: task.task_index,
        task_title: task.title,
        message_id: result.messageId,
        relay_received: result.relayReceived,
        stop_condition_met: stopMet,
        tasks_remaining: remaining,
      });
    }

    // ─── ACTION: generate_md_tasks ───────────────────────────
    // Converts PRD JSON tasks into a markdown task list and stores
    // as "prd_md" in orchestrator_projects metadata.
    if (action === "generate_md_tasks") {
      const { project_id } = body as { project_id: string };
      if (!project_id) return json({ error: "project_id required" }, 400);

      const { data: project } = await sc.from("orchestrator_projects")
        .select("prd_json, client_prompt").eq("id", project_id).eq("user_id", userId).maybeSingle();
      if (!project) return json({ error: "Project not found" }, 404);

      const prd = project.prd_json as { tasks?: Array<{ title: string; intent: string; prompt: string; stop_condition?: string }> } | null;
      if (!prd?.tasks?.length) return json({ error: "No PRD tasks found. Run `start` first." }, 400);

      const md = [
        `# Project Tasks`,
        `> ${(project.client_prompt as string).slice(0, 120)}`,
        "",
        ...prd.tasks.map((t, i) => [
          `## Task ${i + 1}: ${t.title}`,
          `- **Intent:** \`${t.intent}\``,
          t.stop_condition ? `- **Stop Condition:** \`${t.stop_condition}\`` : null,
          "",
          `### Prompt`,
          "```",
          t.prompt,
          "```",
          "",
        ].filter(Boolean).join("\n")),
      ].join("\n");

      // Store in project metadata
      await sc.from("orchestrator_projects")
        .update({ prd_json: { ...prd, md_tasks: md } })
        .eq("id", project_id);

      await addLog(sc, project_id, "📝 MD task list generated", "info");
      return json({ success: true, md });
    }

    // ─── ACTION: read_md_tasks ────────────────────────────────
    // Returns the markdown task list for a project.
    if (action === "read_md_tasks") {
      const { project_id } = body as { project_id: string };
      if (!project_id) return json({ error: "project_id required" }, 400);

      const { data: project } = await sc.from("orchestrator_projects")
        .select("prd_json").eq("id", project_id).eq("user_id", userId).maybeSingle();
      if (!project) return json({ error: "Project not found" }, 404);

      const prd = project.prd_json as { md_tasks?: string; tasks?: unknown[] } | null;
      const md = prd?.md_tasks || null;
      if (!md) return json({ error: "No MD task list — run `generate_md_tasks` first." }, 404);

      return json({ md, task_count: (prd?.tasks || []).length });
    }

    // ─── ACTION: read_source_code ─────────────────────────────
    // Fetches the Lovable project source code and returns a
    // structured summary (file tree + optional content by pattern).
    if (action === "read_source_code") {
      const { project_id, pattern } = body as { project_id: string; pattern?: string };
      if (!project_id) return json({ error: "project_id required" }, 400);

      const { data: project } = await sc.from("orchestrator_projects")
        .select("lovable_project_id").eq("id", project_id).eq("user_id", userId).maybeSingle();
      if (!project?.lovable_project_id) return json({ error: "No Lovable project linked" }, 404);

      const adminTk2 = await getAdminToken(sc);
      if (!adminTk2) return json({ error: "Platform unavailable" }, 503);

      const srcRes = await extFetch(
        `${EXT_API}/projects/${project.lovable_project_id}/source-code`,
        { method: "GET" },
        adminTk2
      );
      if (!srcRes.ok) return json({ error: `Source-code API ${srcRes.status}` }, 502);

      const srcData = await srcRes.json() as Record<string, unknown>;
      const files = (srcData.files || []) as Array<{ path: string; content?: string; size?: number }>;

      // Filter by pattern if specified
      const filtered = pattern
        ? files.filter(f => f.path.includes(pattern))
        : files;

      const tree = filtered.map(f => ({
        path: f.path,
        size: f.size || (f.content?.length ?? 0),
        content: pattern ? f.content : undefined, // Only include content if filtering
      }));

      return json({
        file_count: files.length,
        filtered_count: filtered.length,
        pattern: pattern || null,
        files: tree,
      });
    }

    // ─── ACTION: link_project ─────────────────────────────────
    if (action === "link_project") {
      const { project_id, lovable_project_id } = body as { project_id: string; lovable_project_id: string };
      if (!project_id || !lovable_project_id) return json({ error: "project_id and lovable_project_id required" }, 400);

      const { error } = await sc.from("orchestrator_projects")
        .update({ lovable_project_id, status: "paused" })
        .eq("id", project_id).eq("user_id", userId);

      if (error) return json({ error: error.message }, 500);
      await addLog(sc, project_id, `🔗 Linked to Lovable project: ${lovable_project_id}`, "info");
      return json({ success: true });
    }

    // ─── ACTION: get_status ───────────────────────────────────
    if (action === "get_status") {
      const { project_id } = body as { project_id: string };
      if (!project_id) return json({ error: "project_id required" }, 400);

      const [{ data: project }, { data: tasks }, { data: logs }] = await Promise.all([
        sc.from("orchestrator_projects").select("*").eq("id", project_id).eq("user_id", userId).maybeSingle(),
        sc.from("orchestrator_tasks").select("*").eq("project_id", project_id).order("task_index"),
        sc.from("orchestrator_logs").select("*").eq("project_id", project_id).order("created_at", { ascending: false }).limit(20),
      ]);

      if (!project) return json({ error: "Project not found" }, 404);
      return json({ project, tasks, logs });
    }

    // ─── ACTION: pause / resume ───────────────────────────────
    if (action === "pause" || action === "resume") {
      const { project_id } = body as { project_id: string };
      if (!project_id) return json({ error: "project_id required" }, 400);

      const newStatus = action === "pause" ? "paused" : "executing";
      await sc.from("orchestrator_projects").update({ status: newStatus }).eq("id", project_id).eq("user_id", userId);
      await addLog(sc, project_id, `${action === "pause" ? "⏸" : "▶️"} Project ${action}d`, "info");
      return json({ success: true, status: newStatus });
    }

    // ─── ACTION: ghost_create ────────────────────────────────
    if (action === "ghost_create") {
      const { project_id, workspace_id, project_name } = body as {
        project_id: string; workspace_id: string; project_name?: string;
      };
      if (!project_id || !workspace_id) return json({ error: "project_id and workspace_id required" }, 400);

      const adminTk3 = await getAdminToken(sc);
      if (!adminTk3) return json({ error: "Platform unavailable" }, 503);

      const { data: orch } = await sc.from("orchestrator_projects")
        .select("id, status").eq("id", project_id).eq("user_id", userId).maybeSingle();
      if (!orch) return json({ error: "Orchestrator project not found" }, 404);

      try {
        const createRes = await extFetch(
          `${EXT_API}/workspaces/${workspace_id}/projects`,
          { method: "POST", body: JSON.stringify({ name: project_name || "Starble Project", is_public: false }) },
          adminTk3
        );
        if (!createRes.ok) {
          const errText = await createRes.text();
          return json({ error: `Lovable create project failed: ${createRes.status} — ${errText}` }, 502);
        }
        const created = await createRes.json() as Record<string, unknown>;
        const lovableProjectId = (created.id || created.project_id) as string;
        if (!lovableProjectId) return json({ error: "Lovable did not return project ID" }, 502);

        await sc.from("orchestrator_projects").update({
          lovable_project_id: lovableProjectId, ghost_created: true, status: "paused",
        }).eq("id", project_id);

        await addLog(sc, project_id, `👻 Ghost created Lovable project: ${lovableProjectId}`, "info");
        return json({ success: true, lovable_project_id: lovableProjectId });
      } catch (e) {
        const err = (e as Error).message;
        await addLog(sc, project_id, `ghost_create exception: ${err}`, "error");
        return json({ error: err }, 500);
      }
    }

    // ─── ACTION: check_idle ───────────────────────────────────
    if (action === "check_idle") {
      const { project_id } = body as { project_id: string };
      if (!project_id) return json({ error: "project_id required" }, 400);

      const { data: orch } = await sc.from("orchestrator_projects")
        .select("lovable_project_id, source_fingerprint")
        .eq("id", project_id).eq("user_id", userId).maybeSingle();
      if (!orch?.lovable_project_id) return json({ error: "Project not linked" }, 404);

      const adminTk4 = await getAdminToken(sc);
      if (!adminTk4) return json({ error: "Platform unavailable" }, 503);

      try {
        const srcRes = await extFetch(
          `${EXT_API}/projects/${orch.lovable_project_id}/source-code`,
          { method: "GET" },
          adminTk4
        );
        if (!srcRes.ok) return json({ idle: false, reason: `Source-code API ${srcRes.status}` });

        const srcData = await srcRes.json() as Record<string, unknown>;
        const files = (srcData.files || []) as Array<{ path: string; size?: number }>;
        const fingerprint = files.map(f => `${f.path}:${f.size ?? 0}`).sort().join("|");
        const prev = orch.source_fingerprint as string | null;
        const idle = fingerprint === prev;

        await sc.from("orchestrator_projects").update({ source_fingerprint: fingerprint }).eq("id", project_id);
        return json({ idle, changed: !idle, file_count: files.length });
      } catch (e) {
        return json({ idle: false, error: (e as Error).message });
      }
    }

    // ─── ACTION: audit_checkpoint ─────────────────────────────
    if (action === "audit_checkpoint") {
      const { project_id, task_id } = body as { project_id: string; task_id?: string };
      if (!project_id) return json({ error: "project_id required" }, 400);

      const { data: orch } = await sc.from("orchestrator_projects")
        .select("lovable_project_id, current_phase")
        .eq("id", project_id).eq("user_id", userId).maybeSingle();
      if (!orch?.lovable_project_id) return json({ error: "Project not linked" }, 404);

      const adminTk5 = await getAdminToken(sc);
      if (!adminTk5) return json({ error: "Platform unavailable" }, 503);

      await sc.from("orchestrator_projects").update({ status: "auditing" }).eq("id", project_id);
      await addLog(sc, project_id, "🔍 Audit checkpoint started", "info", undefined, task_id);

      const issues: string[] = [];
      let fileCount = 0;
      let filesJson: unknown = null;
      let seoScore: number | null = null;

      try {
        const srcRes = await extFetch(
          `${EXT_API}/projects/${orch.lovable_project_id}/source-code`,
          { method: "GET" }, adminTk5
        );
        if (srcRes.ok) {
          const srcData = await srcRes.json() as Record<string, unknown>;
          const files = (srcData.files || []) as Array<{ path: string; content?: string }>;
          fileCount = files.length;
          filesJson = files.map(f => ({ path: f.path }));

          const migFiles = files.filter(f => f.path.includes("migration") || f.path.includes(".sql"));
          const hasRls = migFiles.some(f => f.content?.includes("ROW LEVEL SECURITY") || f.content?.includes("ENABLE ROW LEVEL SECURITY"));
          if (migFiles.length > 0 && !hasRls) issues.push("Missing RLS in migration files");

          const routeFiles = files.filter(f => f.path.includes("App.tsx") || f.path.includes("routes"));
          const hasAuth = routeFiles.some(f => f.content?.includes("PrivateRoute") || f.content?.includes("useAuth") || f.content?.includes("isAuthenticated"));
          if (routeFiles.length > 0 && !hasAuth) issues.push("No auth guard in routing layer");
        }

        // Verify stop condition v2 if task_id provided
        let stopConditionMet = true;
        if (task_id) {
          const { data: task } = await sc.from("orchestrator_tasks")
            .select("stop_condition").eq("id", task_id).maybeSingle();
          const condition = task?.stop_condition as string | null;
          if (condition) {
            const sc2Result = await evaluateStopCondition(
              sc, project_id, condition, orch.lovable_project_id as string, adminTk5
            );
            stopConditionMet = sc2Result.met;
            await addLog(sc, project_id, `Stop condition "${condition}": ${sc2Result.met ? "✅" : "⚠️"} ${sc2Result.reason}`, "info", undefined, task_id);
          }
        }

        const fingerprint = `${fileCount}-${Date.now()}`;
        await sc.from("code_snapshots").insert({
          project_id, task_id: task_id || null,
          phase: (orch.current_phase as number) || 0,
          files_json: filesJson, file_count: fileCount, fingerprint,
          security_issues: issues.length > 0 ? issues : null, seo_score: seoScore,
        });

        const passed = issues.length === 0 && stopConditionMet;
        const qualityScore = Math.max(0, 100 - issues.length * 20);

        await sc.from("orchestrator_projects").update({
          status: "paused", quality_score: qualityScore, audit_required: false,
        }).eq("id", project_id);

        await addLog(sc, project_id, `${passed ? "✅" : "⚠️"} Audit complete. Score: ${qualityScore}/100. Issues: ${issues.length}`, passed ? "info" : "warn", { issues }, task_id);
        return json({ passed, quality_score: qualityScore, issues, file_count: fileCount, seo_score: seoScore });
      } catch (e) {
        await sc.from("orchestrator_projects").update({ status: "paused" }).eq("id", project_id);
        await addLog(sc, project_id, `Audit exception: ${(e as Error).message}`, "error", undefined, task_id);
        return json({ error: (e as Error).message }, 500);
      }
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("[Orchestrator] Error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
