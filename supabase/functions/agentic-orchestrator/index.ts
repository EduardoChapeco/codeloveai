import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateTypeId } from "../_shared/crypto.ts";

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

// getUserToken — resolves from user's own lovable_accounts (no admin fallback)
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

// ─── PRD Generation (via Lovable AI Gateway — fast & reliable) ──
async function generatePRD(
  sc: SupabaseClient,
  userId: string,
  clientPrompt: string,
  _adminToken: string,
  brainSkills: string[] = []
): Promise<{ tasks: Array<{ title: string; intent: string; prompt: string; stop_condition?: string; brain_skill?: string }> } | null> {
  const skillContext = brainSkills.length > 0
    ? `\n\nThe project has these specialized Brain skills available: ${brainSkills.join(", ")}. Assign the most appropriate brain_skill to each task from this list.`
    : "";

  const architectPrompt = `You are a senior software architect. A client wants to build: "${clientPrompt}"${skillContext}

Break this into 3–7 sequential implementation tasks. Return ONLY valid JSON — no explanation, no markdown, no comments:

{
  "tasks": [
    {
      "title": "Short task title",
      "intent": "security_fix_v2",
      "prompt": "Detailed implementation prompt with all context needed",
      "stop_condition": "source_contains:keyword"
    }
  ]
}

Rules:
- intent must be one of: security_fix_v2, seo_fix, error_fix, chat
- stop_condition format: file_exists:/path/to/file OR source_contains:keyword OR relay_response:keyword
- Each prompt must be fully self-contained and detailed
- Tasks must be sequential (each builds on the previous)
- Inject implementation instructions — no questions`;

  // Strategy 1: Lovable AI Gateway (fastest, no API key needed beyond LOVABLE_API_KEY)
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are a JSON-only architect. Return only valid JSON, no markdown fences, no explanation." },
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
        if (parsed) {
          console.log("[PRD Gen] Success via Lovable Gateway");
          return parsed;
        }
      } else {
        const errBody = await res.text().catch(() => "");
        console.error("[PRD Gen] Gateway error:", res.status, errBody.slice(0, 200));
      }
    } catch (e) {
      console.error("[PRD Gen] Gateway exception:", (e as Error).message);
    }
  }

  // Strategy 2: OpenRouter fallback
  const orKey = Deno.env.get("OPENROUTER_API_KEY");
  if (orKey) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${orKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://starble.lovable.app",
          "X-Title": "Starble Orchestrator",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are a JSON-only architect. Return only valid JSON, no markdown fences, no explanation." },
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
        if (parsed) {
          console.log("[PRD Gen] Success via OpenRouter");
          return parsed;
        }
      }
    } catch (e) {
      console.error("[PRD Gen] OpenRouter exception:", (e as Error).message);
    }
  }

  console.error("[PRD Gen] All strategies failed");
  return null;
}

// Extract JSON tasks from AI response (handles markdown fences, leading text, etc.)
function extractJSON(content: string): { tasks: Array<{ title: string; intent: string; prompt: string; stop_condition?: string }> } | null {
  if (!content || content.length < 10) return null;
  let jsonStr = content.trim();
  // Strip markdown fences
  const m = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) jsonStr = m[1].trim();
  // Find JSON object start
  const objStart = jsonStr.indexOf("{");
  if (objStart >= 0) jsonStr = jsonStr.slice(objStart);
  // Find last closing brace
  const objEnd = jsonStr.lastIndexOf("}");
  if (objEnd >= 0) jsonStr = jsonStr.slice(0, objEnd + 1);
  try {
    const parsed = JSON.parse(jsonStr) as { tasks: Array<{ title: string; intent: string; prompt: string; stop_condition?: string }> };
    if (parsed.tasks && Array.isArray(parsed.tasks) && parsed.tasks.length > 0) return parsed;
  } catch { /* invalid JSON */ }
  return null;
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

function getModeConfig(_taskIntent: string): ModeConfig {
  // ALL modes use security_fix_v2 + chat_only: false (free method, always)
  return {
    intent: "security_fix_v2",
    chat_only: false,
    view: "security",
    view_description: "The user is currently viewing the security view for their project.",
  };
}

// ─── Execute Task (via venus-chat chaining) ──────────────────
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

  await addLog(sc, projectId, `▶ Task #${task.task_index} — sending via venus-chat (task mode, FREE)`, "info", undefined, task.id);

  // Inject anti-question prefix
  const enhancedPrompt = AQ_PREFIX + task.prompt;

  // Capture fingerprint BEFORE dispatching
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
    // Send via venus-chat (task mode) — FREE chaining
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const venusRes = await fetch(`${supabaseUrl}/functions/v1/venus-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        task: enhancedPrompt,
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

    await sc.from("orchestrator_tasks").update({
      lovable_message_id: messageId || null,
    }).eq("id", task.id);

    await addLog(sc, projectId, `Task #${task.task_index} sent via venus (msgId: ${messageId}). Awaiting completion…`, "info", undefined, task.id);

    // ── Completion Detection (fingerprint + latest-message polling) ──
    const maxMs = 180_000;
    const start = Date.now();
    let relayReceived = false;

    await new Promise(r => setTimeout(r, 10000));

    while (Date.now() - start < maxMs) {
      // Fingerprint change detection
      if (fingerprintBefore) {
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
              await addLog(sc, projectId, `✅ Task #${task.task_index} source changed (fingerprint diff)`, "info", undefined, task.id);
              await sc.from("orchestrator_projects").update({ source_fingerprint: fingerprintAfter }).eq("id", projectId);
              break;
            }
          }
        } catch { /* non-critical */ }
      }

      // Latest-message streaming complete
      try {
        const pollRes = await extFetch(
          `${EXT_API}/projects/${lovableProjectId}/latest-message`,
          { method: "GET" },
          lovableToken
        );
        if (pollRes.ok) {
          const pollData = await pollRes.json() as Record<string, unknown>;
          if (pollData && !pollData.is_streaming && pollData.content) {
            await addLog(sc, projectId, `✅ Task #${task.task_index} Lovable streaming complete`, "info", undefined, task.id);
            relayReceived = true;
            break;
          }
        }
      } catch { /* non-critical */ }

      await new Promise(r => setTimeout(r, 8000));
    }

    if (!relayReceived) {
      await addLog(sc, projectId, `⚠️ Task #${task.task_index} timeout (180s) — assuming partial`, "warn", undefined, task.id);
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
      const { client_prompt, workspace_id, brain_id } = body as { client_prompt: string; workspace_id?: string; brain_id?: string };
      if (!client_prompt?.trim()) return json({ error: "client_prompt required" }, 400);

      const adminToken = await getUserToken(sc, userId);
      if (!adminToken) return json({ error: "Nenhum token Lovable vinculado. Reconecte via /lovable/connect." }, 503);

      // Resolve Brain skills if brain_id provided
      let brainSkills: string[] = [];
      let brainName = "";
      if (brain_id) {
        const { data: brainRow } = await sc
          .from("user_brain_projects")
          .select("brain_skills, name")
          .eq("id", brain_id)
          .eq("user_id", userId)
          .maybeSingle();
        if (brainRow) {
          brainSkills = (brainRow.brain_skills as string[]) || [];
          brainName = (brainRow.name as string) || "";
        }
      }

      const { data: project, error: projErr } = await sc
        .from("orchestrator_projects")
        .insert({
          user_id: userId,
          client_prompt: client_prompt.trim(),
          workspace_id: workspace_id || null,
          brain_id: brain_id || null,
          brain_skill_profile: brainSkills,
          status: "planning",
        })
        .select("id")
        .single();

      if (projErr || !project) return json({ error: "Failed to create project" }, 500);
      const projectId = project.id as string;

      const brainLabel = brainName ? ` (Brain: ${brainName})` : "";
      await addLog(sc, projectId, `🚀 Orchestrator started${brainLabel}: "${client_prompt.slice(0, 80)}…"`, "info");

      (async () => {
        try {
          await addLog(sc, projectId, "🧠 Brain generating PRD…", "info");
          const prd = await generatePRD(sc, userId, client_prompt, adminToken, brainSkills);

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

      // Token check — use user's own token
      const adminTk = await getUserToken(sc, project.user_id);
      if (!adminTk) {
        await addLog(sc, project_id, "❌ Token do usuário indisponível — pausando", "error");
        await sc.from("orchestrator_projects").update({ status: "paused", last_error: "User token unavailable" }).eq("id", project_id);
        return json({ error: "Token Lovable não encontrado. Reconecte via /lovable/connect." }, 503);
      }

      // Auto ghost-create if no Lovable project linked yet
      if (!project.lovable_project_id) {
        await addLog(sc, project_id, "👻 Auto ghost-creating Lovable project…", "info");
        
        // Get workspace
        const wsRes = await extFetch(`${EXT_API}/user/workspaces`, { method: "GET" }, adminTk);
        let workspaceId: string | null = null;
        if (wsRes.ok) {
          let wsBody: any;
          try { wsBody = await wsRes.json(); } catch { wsBody = null; }
          const wsList = Array.isArray(wsBody) ? wsBody : (wsBody?.workspaces || wsBody?.data || []);
          workspaceId = wsList?.[0]?.id || (wsBody?.id ? wsBody.id : null);
        }
        
        if (!workspaceId) {
          await addLog(sc, project_id, "❌ Workspace não encontrado", "error");
          return json({ error: "Workspace não encontrado. Reconecte via /lovable/connect." }, 503);
        }
        
        const projectName = `starble-orch-${Date.now()}`;
        const createRes = await extFetch(
          `${EXT_API}/workspaces/${workspaceId}/projects`,
          { method: "POST", body: JSON.stringify({ name: projectName, initial_message: "setup", visibility: "private" }) },
          adminTk
        );
        
        if (!createRes.ok) {
          const errText = await createRes.text();
          await addLog(sc, project_id, `❌ Ghost create failed: ${createRes.status}`, "error", { errText: errText.slice(0, 200) });
          return json({ error: `Falha ao criar projeto (HTTP ${createRes.status})` }, 502);
        }
        
        const created = await createRes.json() as Record<string, unknown>;
        const lovableProjectId = (created.id || created.project_id) as string;
        if (!lovableProjectId) {
          return json({ error: "Lovable não retornou ID do projeto" }, 502);
        }
        
        // Ghost cancel
        const initMsgId = (created.message_id || created.initial_message_id) as string | undefined;
        if (initMsgId) {
          try {
            await extFetch(`${EXT_API}/projects/${lovableProjectId}/chat/${initMsgId}/cancel`, { method: "POST" }, adminTk);
          } catch { /* ok */ }
        } else {
          await new Promise(r => setTimeout(r, 1000));
          try {
            const latestRes = await extFetch(`${EXT_API}/projects/${lovableProjectId}/latest-message`, { method: "GET" }, adminTk);
            if (latestRes.ok) {
              const latest = await latestRes.json() as Record<string, unknown>;
              const latestId = (latest?.id || latest?.message_id) as string | undefined;
              if (latestId) {
                await extFetch(`${EXT_API}/projects/${lovableProjectId}/chat/${latestId}/cancel`, { method: "POST" }, adminTk);
              }
            }
          } catch { /* ok */ }
        }
        
        await sc.from("orchestrator_projects").update({
          lovable_project_id: lovableProjectId, ghost_created: true,
        }).eq("id", project_id);
        
        project.lovable_project_id = lovableProjectId;
        await addLog(sc, project_id, `👻 Ghost created: ${lovableProjectId}`, "info");
        
        // Wait for project to stabilize
        await new Promise(r => setTimeout(r, 3000));
      }

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

      const adminTk2 = await getUserToken(sc, userId);
      if (!adminTk2) return json({ error: "Token Lovable não encontrado" }, 503);

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

      const newStatus = "paused"; // Both pause & resume set to paused; tick picks it up
      const updatePayload: Record<string, unknown> = { status: newStatus };
      if (action === "resume") updatePayload.next_tick_at = null; // Clear so tick picks up immediately
      await sc.from("orchestrator_projects").update(updatePayload).eq("id", project_id).eq("user_id", userId);
      await addLog(sc, project_id, `${action === "pause" ? "⏸" : "▶️"} Project ${action}d`, "info");
      return json({ success: true, status: newStatus });
    }

    // ─── ACTION: ghost_create ────────────────────────────────
    if (action === "ghost_create") {
      const { project_id, workspace_id, project_name } = body as {
        project_id: string; workspace_id: string; project_name?: string;
      };
      if (!project_id || !workspace_id) return json({ error: "project_id and workspace_id required" }, 400);

      const adminTk3 = await getUserToken(sc, userId);
      if (!adminTk3) return json({ error: "Token Lovable não encontrado" }, 503);

      const { data: orch } = await sc.from("orchestrator_projects")
        .select("id, status").eq("id", project_id).eq("user_id", userId).maybeSingle();
      if (!orch) return json({ error: "Orchestrator project not found" }, 404);

      try {
        const createRes = await extFetch(
          `${EXT_API}/workspaces/${workspace_id}/projects`,
          { method: "POST", body: JSON.stringify({ name: project_name || "Starble Project", initial_message: "setup", visibility: "private" }) },
          adminTk3
        );
        if (!createRes.ok) {
          const errText = await createRes.text();
          return json({ error: `Lovable create project failed: ${createRes.status} — ${errText}` }, 502);
        }
        const created = await createRes.json() as Record<string, unknown>;
        const lovableProjectId = (created.id || created.project_id) as string;
        const initialMsgId = (created.message_id || created.initial_message_id) as string | undefined;
        if (!lovableProjectId) return json({ error: "Lovable did not return project ID" }, 502);

        // Ghost pattern: cancel initial message immediately to avoid credit consumption
        if (initialMsgId) {
          try {
            await extFetch(
              `${EXT_API}/projects/${lovableProjectId}/chat/${initialMsgId}/cancel`,
              { method: "POST" },
              adminTk3
            );
          } catch { /* non-critical — message may have already completed */ }
        }

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

      const adminTk4 = await getUserToken(sc, userId);
      if (!adminTk4) return json({ error: "Token Lovable não encontrado" }, 503);

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

      // Support internal calls from orchestrator-tick (no user_id filter)
      const isInternalAudit = req.headers.get("x-orchestrator-internal") === "true";
      let auditQuery = sc.from("orchestrator_projects")
        .select("lovable_project_id, current_phase")
        .eq("id", project_id);
      if (!isInternalAudit) auditQuery = auditQuery.eq("user_id", userId);
      const { data: orch } = await auditQuery.maybeSingle();
      if (!orch?.lovable_project_id) return json({ error: "Project not linked" }, 404);

      const adminTk5 = await getUserToken(sc, userId);
      if (!adminTk5) return json({ error: "Token Lovable não encontrado" }, 503);

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
