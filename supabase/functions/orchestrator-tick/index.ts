/**
 * orchestrator-tick v3 — Handles BOTH "paused" and "executing" projects.
 *
 * Key fixes:
 *  - Processes "executing" projects by polling for task completion
 *  - On completion: marks task done, sets project to "paused" for next task
 *  - Timeout: 5 minutes of executing → force complete
 *  - Paused projects: dispatches next task via execute_next
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const LOVABLE_API = "https://api.lovable.dev";
const LOVABLE_HEADERS = { "Origin": "https://lovable.dev", "Referer": "https://lovable.dev/" };
const ORCHESTRATOR_FN = "/functions/v1/agentic-orchestrator";

// Max time a task can be in "executing" before force-completing (5 min)
const EXECUTING_TIMEOUT_MS = 5 * 60 * 1000;
// Delay between task completion and next dispatch (40s breathing room)
const INTER_TASK_DELAY_MS = 40 * 1000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sc = createClient(supabaseUrl, serviceKey);

  const now = new Date().toISOString();
  let processed = 0;
  let skipped = 0;
  const tickLog: string[] = [];

  try {
    // ═══════════════════════════════════════════════════════
    // PHASE 1: Check "executing" projects for completion
    // ═══════════════════════════════════════════════════════
    const { data: executingProjects } = await sc
      .from("orchestrator_projects")
      .select("*")
      .eq("status", "executing")
      .limit(10);

    for (const project of (executingProjects || [])) {
      try {
        tickLog.push(`→ [executing] Project ${project.id}`);

        // Get user token
        const { data: account } = await sc
          .from("lovable_accounts")
          .select("token_encrypted, status")
          .eq("user_id", project.user_id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();

        if (!account?.token_encrypted) {
          tickLog.push(`  ⚠️ No token, skipping`);
          skipped++;
          continue;
        }

        const token = account.token_encrypted as string;
        const lovableProjectId = project.lovable_project_id as string;
        if (!lovableProjectId) {
          tickLog.push(`  ⚠️ No lovable project, skipping`);
          continue;
        }

        // Check how long it's been executing
        const { data: runningTask } = await sc.from("orchestrator_tasks")
          .select("*")
          .eq("project_id", project.id)
          .eq("status", "running")
          .order("task_index", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!runningTask) {
          // No running task but status is executing — fix: set to paused
          await sc.from("orchestrator_projects").update({ status: "paused" }).eq("id", project.id);
          tickLog.push(`  🔧 No running task found, reset to paused`);
          processed++;
          continue;
        }

        const startedAt = runningTask.started_at ? new Date(runningTask.started_at as string).getTime() : Date.now();
        const elapsed = Date.now() - startedAt;

        // Timeout check
        if (elapsed > EXECUTING_TIMEOUT_MS) {
          tickLog.push(`  ⏰ Task #${runningTask.task_index} timed out (${Math.round(elapsed / 1000)}s)`);
          await sc.from("orchestrator_tasks").update({
            status: "completed",
            completed_at: new Date().toISOString(),
          }).eq("id", runningTask.id);
          await sc.from("orchestrator_projects").update({
            status: "paused",
            next_tick_at: new Date(Date.now() + INTER_TASK_DELAY_MS).toISOString(),
          }).eq("id", project.id);
          await sc.from("orchestrator_logs").insert({
            project_id: project.id, task_id: runningTask.id,
            level: "warn", message: `⏰ Task #${runningTask.task_index} force-completed (timeout)`,
          });
          processed++;
          continue;
        }

        // Check completion via fingerprint + streaming
        let completed = false;
        let reason = "";

        // 1. Fingerprint check
        try {
          const fpRes = await fetch(`${LOVABLE_API}/projects/${lovableProjectId}/source-code`, {
            headers: { Authorization: `Bearer ${token}`, ...LOVABLE_HEADERS },
          });
          if (fpRes.ok) {
            const fpData = await fpRes.json() as Record<string, unknown>;
            const files = (fpData.files || []) as Array<{ path: string; size?: number }>;
            const fpNow = files.map(f => `${f.path}:${f.size ?? 0}`).sort().join("|");
            const fpBefore = project.source_fingerprint as string | null;
            if (fpBefore && fpNow !== fpBefore) {
              completed = true;
              reason = "fingerprint changed";
              await sc.from("orchestrator_projects").update({ source_fingerprint: fpNow }).eq("id", project.id);
            }
          }
        } catch { /* non-critical */ }

        // 2. Streaming check (only if fingerprint didn't change yet)
        if (!completed) {
          try {
            const pollRes = await fetch(`${LOVABLE_API}/projects/${lovableProjectId}/latest-message`, {
              headers: { Authorization: `Bearer ${token}`, ...LOVABLE_HEADERS },
            });
            if (pollRes.ok) {
              const pollData = await pollRes.json() as Record<string, unknown>;
              if (pollData && !pollData.is_streaming && pollData.content && elapsed > 15_000) {
                completed = true;
                reason = "streaming complete";
              }
            }
          } catch { /* non-critical */ }
        }

        if (completed) {
          tickLog.push(`  ✅ Task #${runningTask.task_index} completed (${reason})`);
          await sc.from("orchestrator_tasks").update({
            status: "completed", completed_at: new Date().toISOString(),
          }).eq("id", runningTask.id);
          await sc.from("orchestrator_projects").update({
            status: "paused",
            next_tick_at: new Date(Date.now() + INTER_TASK_DELAY_MS).toISOString(),
          }).eq("id", project.id);
          await sc.from("orchestrator_logs").insert({
            project_id: project.id, task_id: runningTask.id,
            level: "info", message: `✅ Task #${runningTask.task_index} completed (${reason})`,
          });
          processed++;
        } else {
          tickLog.push(`  ⏳ Task #${runningTask.task_index} still running (${Math.round(elapsed / 1000)}s)`);
          skipped++;
        }
      } catch (e) {
        tickLog.push(`  ❌ Error: ${(e as Error).message}`);
      }
    }

    // ═══════════════════════════════════════════════════════
    // PHASE 2: Process "paused" projects — dispatch next task
    // ═══════════════════════════════════════════════════════
    const { data: pausedProjects } = await sc
      .from("orchestrator_projects")
      .select("*")
      .eq("status", "paused")
      .or(`next_tick_at.is.null,next_tick_at.lte.${now}`)
      .limit(5);

    for (const project of (pausedProjects || [])) {
      try {
        tickLog.push(`→ [paused] Project ${project.id}`);

        // Check if there are pending tasks
        const { data: nextTask } = await sc
          .from("orchestrator_tasks")
          .select("id")
          .eq("project_id", project.id)
          .eq("status", "pending")
          .order("task_index", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!nextTask) {
          // All done!
          await sc.from("orchestrator_projects").update({ status: "completed" }).eq("id", project.id);
          await sc.from("orchestrator_logs").insert({
            project_id: project.id, level: "info", message: "🎉 All tasks completed!",
          });
          tickLog.push(`  ✅ All tasks done!`);
          processed++;
          continue;
        }

        // Dispatch execute_next via the orchestrator function
        const execRes = await fetch(`${supabaseUrl}${ORCHESTRATOR_FN}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
            "x-orchestrator-internal": "true",
          },
          body: JSON.stringify({
            action: "execute_next",
            project_id: project.id,
            _internal_user_id: project.user_id,
          }),
        });

        const execData = await execRes.json().catch(() => ({})) as Record<string, unknown>;
        tickLog.push(`  📤 execute_next: ${execData.status || execRes.status}`);
        processed++;
      } catch (e) {
        tickLog.push(`  ❌ Error: ${(e as Error).message}`);
        await sc.from("orchestrator_projects").update({
          next_tick_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        }).eq("id", project.id);
      }
    }

    return json({ success: true, processed, skipped, tick_log: tickLog });
  } catch (err) {
    console.error("[orchestrator-tick] Fatal:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
