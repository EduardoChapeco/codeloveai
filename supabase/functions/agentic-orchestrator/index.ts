import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API = "https://api.lovable.dev";

// ─── Helpers ───────────────────────────────────────────────

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getUserId(req: Request, sc: SupabaseClient): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await sc.auth.getClaims(token);
  if (error || !data?.claims) return null;
  return (data.claims.sub as string) || null;
}

async function getLovableToken(serviceClient: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await serviceClient
    .from("lovable_accounts")
    .select("token_encrypted, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || data.status !== "active") return null;
  return data.token_encrypted as string;
}

async function getAdminToken(serviceClient: SupabaseClient): Promise<string | null> {
  const { data } = await serviceClient
    .from("admin_secrets")
    .select("lovable_token")
    .eq("id", 1)
    .maybeSingle();
  return (data?.lovable_token as string) || null;
}

async function lovableFetch(
  url: string,
  options: RequestInit,
  token: string
): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      ...((options.headers as Record<string, string>) || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Origin": "https://lovable.dev",
      "Referer": "https://lovable.dev/",
    },
  });
}

async function addLog(
  sc: SupabaseClient,
  projectId: string,
  message: string,
  level: "info" | "warn" | "error" | "debug" = "info",
  metadata?: Record<string, unknown>,
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

// ─── PRD Generation via Brain ───────────────────────────────
// Uses the admin Lovable Brain project to generate a structured
// list of tasks from a client's raw prompt.
async function generatePRD(
  sc: SupabaseClient,
  userId: string,
  clientPrompt: string,
  lovableToken: string,
  adminToken: string | null
): Promise<{ tasks: Array<{ title: string; intent: string; prompt: string }> } | null> {
  // Get brain project
  const { data: brain } = await sc
    .from("user_brain_projects")
    .select("lovable_project_id, brain_owner")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!brain) return null;

  const token = brain.brain_owner === "admin" && adminToken ? adminToken : lovableToken;
  const brainProjectId = brain.lovable_project_id;

  const architectPrompt = `You are a senior software architect. A client sent this request:

"""
${clientPrompt}
"""

Generate a structured JSON execution plan with sequential tasks to build this project using Lovable AI.
Each task should be a focused, actionable prompt. Use at most 6 tasks.

Respond ONLY with valid JSON in this exact format:
{
  "projectName": "Short project name",
  "summary": "One line description",
  "tasks": [
    {
      "title": "Setup Database Schema",
      "intent": "security_fix_v2",
      "prompt": "Create the following Supabase tables with RLS policies: ..."
    }
  ]
}

Rules:
- intent must be one of: security_fix_v2, seo_fix, error_fix, chat
- Use security_fix_v2 for DB/backend/RLS tasks
- Use seo_fix for UI/performance/SEO tasks
- Use error_fix for bug fix tasks
- Use chat for general feature implementation
- Each prompt must be self-contained and detailed
- Tasks must be sequential (each builds on the previous)`;

  try {
    const res = await lovableFetch(
      `${LOVABLE_API}/projects/${brainProjectId}/chat`,
      {
        method: "POST",
        body: JSON.stringify({
          message: architectPrompt,
          intent: "chat",
          chat_only: true,
        }),
      },
      token
    );

    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const messageId = (data.id || data.message_id) as string | undefined;
    if (!messageId) return null;

    // Poll for completion (up to 25s)
    const maxWait = 25000;
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      await new Promise(r => setTimeout(r, 3000));
      const pollRes = await lovableFetch(
        `${LOVABLE_API}/projects/${brainProjectId}/latest-message`,
        { method: "GET" },
        token
      );
      if (pollRes.ok) {
        const msg = await pollRes.json() as Record<string, unknown>;
        if (msg && !msg.is_streaming) {
          const content = (msg.content || msg.message || msg.text || "") as string;
          if (content.length > 20) {
            // Extract JSON from response
            let jsonStr = content.trim();
            const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) jsonStr = jsonMatch[1].trim();
            const parsed = JSON.parse(jsonStr) as { tasks: Array<{ title: string; intent: string; prompt: string }> };
            if (parsed.tasks && Array.isArray(parsed.tasks)) {
              return parsed;
            }
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

// ─── Execute a single task ──────────────────────────────────
async function executeTask(
  sc: SupabaseClient,
  task: { id: string; prompt: string; intent: string; task_index: number },
  projectId: string,
  lovableProjectId: string,
  lovableToken: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  await sc.from("orchestrator_tasks").update({
    status: "running",
    started_at: new Date().toISOString(),
  }).eq("id", task.id);

  await addLog(sc, projectId, `▶ Executing task #${task.task_index}: sending to Lovable`, "info", undefined, task.id);

  try {
    const res = await lovableFetch(
      `${LOVABLE_API}/projects/${lovableProjectId}/chat`,
      {
        method: "POST",
        body: JSON.stringify({
          message: task.prompt,
          intent: task.intent,
          chat_only: false,
        }),
      },
      lovableToken
    );

    if (!res.ok) {
      const errText = await res.text();
      await addLog(sc, projectId, `Task #${task.task_index} Lovable API error: ${res.status}`, "error", { errText }, task.id);
      return { success: false, error: `Lovable API ${res.status}: ${errText}` };
    }

    const data = await res.json() as Record<string, unknown>;
    const messageId = (data.id || data.message_id) as string | undefined;

    await sc.from("orchestrator_tasks").update({
      lovable_message_id: messageId || null,
    }).eq("id", task.id);

    await addLog(sc, projectId, `Task #${task.task_index} sent, messageId: ${messageId}`, "info", undefined, task.id);
    return { success: true, messageId };
  } catch (e) {
    const err = (e as Error).message;
    await addLog(sc, projectId, `Task #${task.task_index} exception: ${err}`, "error", undefined, task.id);
    return { success: false, error: err };
  }
}

// ═══════════════════════════════════════════════════════════
// Main Handler
// ═══════════════════════════════════════════════════════════
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
    const userId = await getUserId(req, anonSc);
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const body = await req.json() as Record<string, unknown>;
    const action = (body.action as string) || "";

    // ─── ACTION: start ──────────────────────────────────────
    // Creates a new orchestrator project from a client prompt.
    // Immediately generates a PRD via the Brain, then saves tasks.
    if (action === "start") {
      const { client_prompt, workspace_id } = body as { client_prompt: string; workspace_id?: string };
      if (!client_prompt?.trim()) return json({ error: "client_prompt required" }, 400);

      const [lovableToken, adminToken] = await Promise.all([
        getLovableToken(sc, userId),
        getAdminToken(sc),
      ]);
      if (!lovableToken) return json({ error: "Lovable account not connected" }, 403);

      // Create the orchestrator project record
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

      await addLog(sc, projectId, `🚀 Orchestrator started for prompt: "${client_prompt.substring(0, 80)}..."`, "info");

      // Generate PRD in the background (async)
      // We return the project ID immediately so the client can poll
      (async () => {
        try {
          await addLog(sc, projectId, "🧠 Brain generating PRD...", "info");
          const prd = await generatePRD(sc, userId, client_prompt, lovableToken, adminToken);

          if (!prd || !prd.tasks?.length) {
            // Fallback: create a single generic task if Brain isn't configured
            const fallbackTasks = [
              { title: "Implementar projeto completo", intent: "chat", prompt: client_prompt },
            ];
            await sc.from("orchestrator_tasks").insert(
              fallbackTasks.map((t, i) => ({
                project_id: projectId,
                task_index: i,
                title: t.title,
                intent: t.intent,
                prompt: t.prompt,
              }))
            );
            await sc.from("orchestrator_projects").update({
              status: "paused",
              total_tasks: fallbackTasks.length,
              prd_json: { tasks: fallbackTasks, note: "Brain not available, using fallback" },
            }).eq("id", projectId);
            await addLog(sc, projectId, "⚠️ Brain unavailable — fallback task created. Ready to execute.", "warn");
            return;
          }

          // Save PRD and tasks
          await sc.from("orchestrator_projects").update({
            prd_json: prd,
            total_tasks: prd.tasks.length,
            status: "paused", // Paused for user review before execution
          }).eq("id", projectId);

          await sc.from("orchestrator_tasks").insert(
            prd.tasks.map((t, i) => ({
              project_id: projectId,
              task_index: i,
              title: t.title,
              intent: t.intent || "chat",
              prompt: t.prompt,
            }))
          );

          await addLog(sc, projectId, `✅ PRD generated: ${prd.tasks.length} tasks created. Awaiting user approval.`, "info");
        } catch (e) {
          console.error("[Orchestrator start] PRD generation error:", e);
          await sc.from("orchestrator_projects").update({ status: "failed", last_error: (e as Error).message }).eq("id", projectId);
        }
      })();

      return json({ success: true, project_id: projectId, status: "planning" });
    }

    // ─── ACTION: execute_next ───────────────────────────────
    // Executes the next pending task for a project.
    // Call this repeatedly (via cron or polling) to advance the pipeline.
    if (action === "execute_next") {
      const { project_id } = body as { project_id: string };
      if (!project_id) return json({ error: "project_id required" }, 400);

      // Verify ownership
      const { data: project } = await sc
        .from("orchestrator_projects")
        .select("*")
        .eq("id", project_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (!project) return json({ error: "Project not found" }, 404);
      if (project.status === "completed") return json({ status: "already_completed" });
      if (project.status === "failed") return json({ status: "failed", error: project.last_error });
      if (project.status === "planning") return json({ status: "still_planning" });

      const lovableToken = await getLovableToken(sc, userId);
      if (!lovableToken) return json({ error: "Lovable token not connected" }, 403);

      if (!project.lovable_project_id) {
        return json({ error: "No Lovable project linked. Create or link a project first." }, 400);
      }

      // Get the next pending task
      const { data: task } = await sc
        .from("orchestrator_tasks")
        .select("*")
        .eq("project_id", project_id)
        .eq("status", "pending")
        .order("task_index", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!task) {
        // All tasks done!
        await sc.from("orchestrator_projects").update({ status: "completed" }).eq("id", project_id);
        await addLog(sc, project_id, "🎉 All tasks completed! Project orchestration finished.", "info");
        return json({ status: "completed" });
      }

      // Mark project as executing
      await sc.from("orchestrator_projects").update({
        status: "executing",
        current_task_index: task.task_index,
      }).eq("id", project_id);

      const result = await executeTask(
        sc,
        { id: task.id as string, prompt: task.prompt as string, intent: task.intent as string, task_index: task.task_index as number },
        project_id,
        project.lovable_project_id as string,
        lovableToken
      );

      if (result.success) {
        await sc.from("orchestrator_tasks").update({
          status: "completed",
          completed_at: new Date().toISOString(),
          lovable_message_id: result.messageId || null,
        }).eq("id", task.id);

        await sc.from("orchestrator_projects").update({ status: "paused" }).eq("id", project_id);

        const remaining = (project.total_tasks as number) - (task.task_index as number) - 1;
        return json({
          status: "task_completed",
          task_index: task.task_index,
          task_title: task.title,
          message_id: result.messageId,
          tasks_remaining: remaining,
        });
      } else {
        // Retry up to 2 times before marking failed
        const retries = (task.retry_count as number) + 1;
        if (retries >= 3) {
          await sc.from("orchestrator_tasks").update({ status: "failed", retry_count: retries }).eq("id", task.id);
          await sc.from("orchestrator_projects").update({ status: "failed", last_error: result.error }).eq("id", project_id);
          return json({ status: "task_failed", error: result.error }, 500);
        }
        await sc.from("orchestrator_tasks").update({ retry_count: retries }).eq("id", task.id);
        await sc.from("orchestrator_projects").update({ status: "paused" }).eq("id", project_id);
        return json({ status: "task_retry", retry_count: retries, error: result.error });
      }
    }

    // ─── ACTION: link_project ───────────────────────────────
    // Links an existing Lovable project to an orchestrator project.
    if (action === "link_project") {
      const { project_id, lovable_project_id } = body as { project_id: string; lovable_project_id: string };
      if (!project_id || !lovable_project_id) return json({ error: "project_id and lovable_project_id required" }, 400);

      const { error } = await sc
        .from("orchestrator_projects")
        .update({ lovable_project_id, status: "paused" })
        .eq("id", project_id)
        .eq("user_id", userId);

      if (error) return json({ error: error.message }, 500);
      await addLog(sc, project_id, `🔗 Linked to Lovable project: ${lovable_project_id}`, "info");
      return json({ success: true });
    }

    // ─── ACTION: get_status ─────────────────────────────────
    // Returns full status of a project including tasks and recent logs.
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

    // ─── ACTION: pause / resume ─────────────────────────────
    if (action === "pause" || action === "resume") {
      const { project_id } = body as { project_id: string };
      if (!project_id) return json({ error: "project_id required" }, 400);

      const newStatus = action === "pause" ? "paused" : "paused"; // resume just means ready, execution triggered by execute_next
      await sc.from("orchestrator_projects").update({ status: newStatus }).eq("id", project_id).eq("user_id", userId);
      await addLog(sc, project_id, `${action === "pause" ? "⏸" : "▶️"} Project ${action}d`, "info");
      return json({ success: true, status: newStatus });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("[Orchestrator] Error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
