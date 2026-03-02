/**
 * orchestrator-tick v4 — Brainchain-powered polling
 *
 * Key change from v3:
 *  - Uses brainchain_accounts pool tokens (not lovable_accounts)
 *  - Polls brain_project_id from the account used for the task
 *  - Releases brainchain account when task completes
 *  - No dependency on user's personal Lovable token
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const LOVABLE_API = "https://api.lovable.dev";
const LOVABLE_HEADERS = { Origin: "https://lovable.dev", Referer: "https://lovable.dev/" };
const ORCHESTRATOR_FN = "/functions/v1/agentic-orchestrator";

const EXECUTING_TIMEOUT_MS = 5 * 60 * 1000;
const INTER_TASK_DELAY_MS = 40 * 1000;

async function extFetch(url: string, token: string) {
  return fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...LOVABLE_HEADERS,
      "X-Client-Git-SHA": "3d7a3673c6f02b606137a12ddc0ab88f6b775113",
    },
  });
}

/** Find the brainchain account that's currently busy for this project (the one running the task) */
async function getBusyAccountForProject(sc: ReturnType<typeof createClient>, brainProjectId: string): Promise<{
  id: string; accessToken: string;
} | null> {
  const { data: accounts } = await sc
    .from("brainchain_accounts")
    .select("id, access_token, brain_project_id")
    .eq("brain_project_id", brainProjectId)
    .eq("is_busy", true)
    .limit(1);

  if (accounts?.length && accounts[0].access_token) {
    return { id: accounts[0].id, accessToken: accounts[0].access_token };
  }

  // Fallback: any active account with this brain_project_id
  const { data: fallback } = await sc
    .from("brainchain_accounts")
    .select("id, access_token")
    .eq("brain_project_id", brainProjectId)
    .eq("is_active", true)
    .not("access_token", "is", null)
    .limit(1);

  if (fallback?.length && fallback[0].access_token) {
    return { id: fallback[0].id, accessToken: fallback[0].access_token };
  }
  return null;
}

async function releaseBrainchainAccount(sc: ReturnType<typeof createClient>, accountId: string) {
  await sc.from("brainchain_accounts").update({
    is_busy: false, busy_since: null, busy_user_id: null,
    updated_at: new Date().toISOString(),
  }).eq("id", accountId);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sc = createClient(supabaseUrl, serviceKey);

  const tickLog: string[] = [];
  let processed = 0;
  let skipped = 0;

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
        const lovableProjectId = project.lovable_project_id as string;
        if (!lovableProjectId) {
          await sc.from("orchestrator_projects").update({ status: "paused" }).eq("id", project.id);
          tickLog.push(`→ [executing] ${project.id}: no project ID, reset to paused`);
          processed++;
          continue;
        }

        tickLog.push(`→ [executing] Project ${(project.id as string).slice(0, 8)} via brain ${lovableProjectId.slice(0, 8)}`);

        // Get the brainchain account token for this brain project
        const account = await getBusyAccountForProject(sc, lovableProjectId);
        if (!account) {
          tickLog.push(`  ⚠️ No brainchain account found for brain ${lovableProjectId.slice(0, 8)}, skipping`);
          skipped++;
          continue;
        }

        const token = account.accessToken;

        // Get running task
        const { data: runningTask } = await sc.from("orchestrator_tasks")
          .select("*")
          .eq("project_id", project.id)
          .eq("status", "running")
          .order("task_index", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!runningTask) {
          await releaseBrainchainAccount(sc, account.id);
          await sc.from("orchestrator_projects").update({ status: "paused" }).eq("id", project.id);
          tickLog.push(`  🔧 No running task, released account, reset to paused`);
          processed++;
          continue;
        }

        const startedAt = runningTask.started_at ? new Date(runningTask.started_at as string).getTime() : Date.now();
        const elapsed = Date.now() - startedAt;

        // Timeout check
        if (elapsed > EXECUTING_TIMEOUT_MS) {
          tickLog.push(`  ⏰ Task #${runningTask.task_index} timed out (${Math.round(elapsed / 1000)}s)`);
          await sc.from("orchestrator_tasks").update({
            status: "completed", completed_at: new Date().toISOString(),
          }).eq("id", runningTask.id);
          await releaseBrainchainAccount(sc, account.id);
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

        // Check completion
        let completed = false;
        let reason = "";

        // 1. Fingerprint check
        try {
          const fpRes = await extFetch(`${LOVABLE_API}/projects/${lovableProjectId}/source-code`, token);
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

        // 2. Streaming check
        if (!completed) {
          try {
            const pollRes = await extFetch(`${LOVABLE_API}/projects/${lovableProjectId}/latest-message`, token);
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
          await releaseBrainchainAccount(sc, account.id);
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
    const now = new Date().toISOString();
    const { data: pausedProjects } = await sc
      .from("orchestrator_projects")
      .select("*")
      .eq("status", "paused")
      .or(`next_tick_at.is.null,next_tick_at.lte.${now}`)
      .limit(5);

    for (const project of (pausedProjects || [])) {
      try {
        tickLog.push(`→ [paused] Project ${(project.id as string).slice(0, 8)}`);

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
          await sc.from("orchestrator_projects").update({ status: "completed" }).eq("id", project.id);
          await sc.from("orchestrator_logs").insert({
            project_id: project.id, level: "info", message: "🎉 All tasks completed!",
          });
          tickLog.push(`  ✅ All tasks done!`);
          processed++;
          continue;
        }

        // Dispatch execute_next — the orchestrator will acquire a brainchain account
        const execRes = await fetch(`${supabaseUrl}${ORCHESTRATOR_FN}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
            "x-orchestrator-internal": "true",
          },
          body: JSON.stringify({
            action: "execute_next",
            project_id: project.id,
            _internal_user_id: project.user_id,
          }),
        });

        const execData = await execRes.json().catch(() => ({})) as Record<string, unknown>;

        if (execRes.status === 503) {
          // No brainchain accounts available — backoff
          const backoffMs = 60_000;
          await sc.from("orchestrator_projects").update({
            next_tick_at: new Date(Date.now() + backoffMs).toISOString(),
          }).eq("id", project.id);
          tickLog.push(`  ⚠️ No brainchain accounts, backoff 60s`);
          skipped++;
        } else {
          tickLog.push(`  📤 execute_next: ${execData.status || execRes.status}`);
          processed++;
        }
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
