import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ═══════════════════════════════════════════════════════════
// orchestrator-tick — Phase 9 aware
// Called by pg_cron every 30s to advance all paused projects.
// Note: execute_next now does its OWN 3-min relay poll internally.
// So tick skips projects with status=executing and gives 4min breathing room.
// ═══════════════════════════════════════════════════════════

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
const LOVABLE_HEADERS = {
  "Origin": "https://lovable.dev",
  "Referer": "https://lovable.dev/",
};
const ORCHESTRATOR_FN = "/functions/v1/agentic-orchestrator";

interface OrchestratorProject {
  id: string;
  user_id: string;
  lovable_project_id: string | null;
  status: string;
  current_task_index: number;
  total_tasks: number;
  audit_required: boolean;
  source_fingerprint: string | null;
  next_tick_at: string | null;
  quality_score: number | null;
}

interface OrchestratorTask {
  id: string;
  project_id: string;
  task_index: number;
  status: string;
  required_audit_before: boolean;
  retry_count: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sc = createClient(supabaseUrl, serviceKey);

  const now = new Date().toISOString();
  let processed = 0;
  let skipped = 0;
  const tickLog: string[] = [];

  try {
    // 1. Find projects that are PAUSED (not executing — Phase 9: execute_next handles its own relay)
    const { data: projects, error: projErr } = await sc
      .from("orchestrator_projects")
      .select("*")
      .eq("status", "paused")
      .or(`next_tick_at.is.null,next_tick_at.lte.${now}`)
      .limit(10);

    if (projErr) {
      console.error("[orchestrator-tick] Failed to fetch projects:", projErr.message);
      return json({ error: projErr.message }, 500);
    }

    if (!projects?.length) {
      return json({ success: true, processed: 0, message: "No projects pending tick" });
    }

    for (const project of projects as OrchestratorProject[]) {
      try {
        tickLog.push(`→ Project ${project.id} (user: ${project.user_id})`);

        // 2. Get user's lovable token — Phase 9: read access_token directly
        // Use admin token instead of per-user tokens
        const { data: account } = await sc
          .from("lovable_accounts")
          .select("token_encrypted, token_expires_at, status")
          .eq("is_admin_account", true)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();

        if (!account?.token_encrypted || account.status !== "active") {
          tickLog.push(`  ⚠️ No active Lovable token for user ${project.user_id}, skipping`);
          skipped++;
          await sc.from("orchestrator_projects").update({
            next_tick_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          }).eq("id", project.id);
          continue;
        }

        // Token expiry pre-check
        if (account.token_expires_at) {
          const expiresAt = new Date(account.token_expires_at as string).getTime();
          if (Date.now() + 2 * 60 * 1000 >= expiresAt) {
            tickLog.push(`  ⏰ Token expiring soon for user ${project.user_id} — skipping, orchestrator will refresh`);
            skipped++;
            continue;
          }
        }

        const lovableToken = account.token_encrypted as string;

        // 3. Check if Lovable is idle (has the source code changed since last tick?)
        let isIdle = true;
        if (project.lovable_project_id) {
          const srcRes = await fetch(
            `${LOVABLE_API}/projects/${project.lovable_project_id}/source-code`,
            {
              headers: {
                Authorization: `Bearer ${lovableToken}`,
                ...LOVABLE_HEADERS,
              },
            }
          );

          if (srcRes.ok) {
            const srcData = await srcRes.json() as Record<string, unknown>;
            const files = (srcData.files || []) as Array<{ path: string; size?: number }>;
            const fingerprint = files.map(f => `${f.path}:${f.size ?? 0}`).sort().join("|");
            isIdle = fingerprint === project.source_fingerprint;

            // Update fingerprint
            await sc.from("orchestrator_projects")
              .update({ source_fingerprint: fingerprint }).eq("id", project.id);
          }
        }

        if (!isIdle) {
          tickLog.push(`  ⏳ Still processing, back-off 15s`);
          await sc.from("orchestrator_projects").update({
            next_tick_at: new Date(Date.now() + 15 * 1000).toISOString(),
          }).eq("id", project.id);
          skipped++;
          continue;
        }

        // 4. Get next pending task
        const { data: nextTask } = await sc
          .from("orchestrator_tasks")
          .select("*")
          .eq("project_id", project.id)
          .eq("status", "pending")
          .order("task_index", { ascending: true })
          .limit(1)
          .maybeSingle() as { data: OrchestratorTask | null };

        if (!nextTask) {
          // All done!
          await sc.from("orchestrator_projects")
            .update({ status: "completed" }).eq("id", project.id);
          await sc.from("orchestrator_logs").insert({
            project_id: project.id,
            level: "info",
            message: "🎉 All tasks completed via cron tick!",
          });
          tickLog.push(`  ✅ Completed!`);
          processed++;
          continue;
        }

        // 5. If the next task requires audit first, trigger audit
        if (nextTask.required_audit_before && !project.audit_required) {
          // Mark as needing audit, and let the next tick handle it
          await sc.from("orchestrator_projects").update({
            status: "auditing",
            audit_required: true,
            next_tick_at: new Date(Date.now() + 5 * 1000).toISOString(),
          }).eq("id", project.id);

          // Trigger audit_checkpoint via the main orchestrator function
          const auditRes = await fetch(`${supabaseUrl}${ORCHESTRATOR_FN}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceKey}`,
              "x-orchestrator-internal": "true",
            },
            body: JSON.stringify({
              action: "audit_checkpoint",
              project_id: project.id,
              task_id: nextTask.id,
              _internal_user_id: project.user_id,
            }),
          });

          tickLog.push(`  🔍 Audit triggered for task ${nextTask.id}: ${auditRes.status}`);
          processed++;
          continue;
        }

        // 6. Execute the next task
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

        const execData = await execRes.json() as Record<string, unknown>;
        tickLog.push(`  📤 execute_next: ${execData.status || execRes.status}`);

        // Phase 9: execute_next does its own 3-min relay poll internally.
        // Give it 4 minutes before we tick again to avoid double-dispatch.
        await sc.from("orchestrator_projects").update({
          next_tick_at: new Date(Date.now() + 4 * 60 * 1000).toISOString(),
        }).eq("id", project.id);

        processed++;
      } catch (e) {
        console.error(`[orchestrator-tick] Error processing project ${project.id}:`, e);
        tickLog.push(`  ❌ Error: ${(e as Error).message}`);
        // Back-off 2 minutes on error
        await sc.from("orchestrator_projects").update({
          next_tick_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        }).eq("id", project.id);
      }
    }

    return json({
      success: true,
      processed,
      skipped,
      total: (projects as OrchestratorProject[]).length,
      tick_log: tickLog,
    });
  } catch (err) {
    console.error("[orchestrator-tick] Fatal error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
