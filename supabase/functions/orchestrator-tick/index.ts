/**
 * orchestrator-tick v4.1 — Brainchain-powered polling with comprehensive logging
 *
 * Every decision, failure, skip, timeout, and state transition is logged
 * to orchestrator_logs with structured metadata for debugging.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildFilesFingerprint, extractFilesFromMarkdown, extractMdBody, mergeFileMaps, parseLatestMessage } from "../_shared/md-assembly.ts";

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
const GIT_SHA = "3d7a3673c6f02b606137a12ddc0ab88f6b775113";

const EXECUTING_TIMEOUT_MS = 5 * 60 * 1000;
const INTER_TASK_DELAY_MS = 40 * 1000;

type SC = ReturnType<typeof createClient>;

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

async function addLog(
  sc: SC, projectId: string, message: string,
  level: "info" | "warn" | "error" | "debug" = "info",
  metadata?: unknown, taskId?: string
) {
  await sc.from("orchestrator_logs").insert({
    project_id: projectId, task_id: taskId || null,
    level, message, metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
  });
}

async function getBusyAccountForProject(sc: SC, brainProjectId: string): Promise<{
  id: string; accessToken: string; email?: string;
} | null> {
  const { data: accounts } = await sc
    .from("brainchain_accounts")
    .select("id, access_token, brain_project_id, email")
    .eq("brain_project_id", brainProjectId)
    .eq("is_busy", true)
    .limit(1);

  if (accounts?.length && accounts[0].access_token) {
    return { id: accounts[0].id, accessToken: accounts[0].access_token, email: accounts[0].email };
  }

  const { data: fallback } = await sc
    .from("brainchain_accounts")
    .select("id, access_token, email")
    .eq("brain_project_id", brainProjectId)
    .eq("is_active", true)
    .not("access_token", "is", null)
    .limit(1);

  if (fallback?.length && fallback[0].access_token) {
    return { id: fallback[0].id, accessToken: fallback[0].access_token, email: fallback[0].email };
  }
  return null;
}

async function releaseBrainchainAccount(sc: SC, accountId: string) {
  await sc.from("brainchain_accounts").update({
    is_busy: false, busy_since: null, busy_user_id: null,
    updated_at: new Date().toISOString(),
  }).eq("id", accountId);
}

/** Sync markdown-generated files from latest assistant message into cirius_projects */
async function syncLatestMarkdownFiles(
  sc: SC,
  orchProjectId: string,
  brainProjectId: string,
  token: string,
  finalize = false,
  taskId?: string,
) {
  const { data: ciriusProject } = await sc.from("cirius_projects")
    .select("id, source_files_json")
    .eq("orchestrator_project_id", orchProjectId)
    .maybeSingle();

  if (!ciriusProject) {
    await addLog(sc, orchProjectId, `📦 [capture] No cirius_project linked to orchestrator ${orchProjectId.slice(0, 8)}`, "warn", undefined, taskId);
    return { ok: false, reason: "no_cirius_project", fileCount: 0 };
  }

  const latestRes = await fetch(`${LOVABLE_API}/projects/${brainProjectId}/chat/latest-message`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...LOVABLE_HEADERS,
      "X-Client-Git-SHA": GIT_SHA,
    },
  });

  if (!latestRes.ok) {
    await addLog(sc, orchProjectId, `📦 [capture] latest-message failed: HTTP ${latestRes.status}`, "warn", undefined, taskId);
    return { ok: false, reason: `latest_message_http_${latestRes.status}`, fileCount: 0 };
  }

  const rawLatest = await latestRes.text();
  const msg = parseLatestMessage(rawLatest);
  if (!msg || msg.role === "user") {
    await addLog(sc, orchProjectId, `📦 [capture] No assistant latest message`, "warn", undefined, taskId);
    return { ok: false, reason: "no_assistant_message", fileCount: 0 };
  }

  const markdownBody = extractMdBody(msg.content || "");
  const parsedFiles = extractFilesFromMarkdown(markdownBody);
  const parsedCount = Object.keys(parsedFiles).length;

  if (parsedCount === 0) {
    await addLog(sc, orchProjectId, `📦 [capture] No code blocks with file paths found in markdown`, "warn", {
      latest_message_id: msg.id,
    }, taskId);
    return { ok: false, reason: "no_file_blocks", fileCount: 0 };
  }

  const existing = (ciriusProject.source_files_json || {}) as Record<string, string>;
  const merged = mergeFileMaps(existing, parsedFiles);
  const fingerprint = buildFilesFingerprint(merged);

  const updatePayload: Record<string, unknown> = {
    source_files_json: merged,
    files_fingerprint: fingerprint,
  };

  if (finalize) {
    updatePayload.status = "live";
    updatePayload.progress_pct = 100;
    updatePayload.generation_ended_at = new Date().toISOString();
    updatePayload.error_message = null;
  }

  await sc.from("cirius_projects").update(updatePayload).eq("id", ciriusProject.id);

  await sc.from("code_snapshots").insert({
    project_id: ciriusProject.id,
    files_json: merged,
    file_count: Object.keys(merged).length,
    fingerprint,
  }).then(() => {});

  await addLog(sc, orchProjectId,
    `📦 [capture] ✅ markdown sync: +${parsedCount} arquivo(s), total=${Object.keys(merged).length}${finalize ? " (finalize)" : ""}`,
    "info",
    { file_count: Object.keys(merged).length, parsed_count: parsedCount, latest_message_id: msg.id, cirius_project: ciriusProject.id },
    taskId,
  );

  return { ok: true, reason: "synced", fileCount: Object.keys(merged).length, latestMessageId: msg.id };
}

/** Auto-capture markdown-generated files from latest message after completion */
async function autoCapture(sc: SC, orchProjectId: string, brainProjectId: string, userId: string) {
  if (!brainProjectId) return;

  try {
    const account = await getBusyAccountForProject(sc, brainProjectId);
    if (account?.accessToken) {
      await syncLatestMarkdownFiles(sc, orchProjectId, brainProjectId, account.accessToken, true);
    } else {
      const { data: userAccount } = await sc.from("lovable_accounts")
        .select("token_encrypted")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (!userAccount?.token_encrypted) {
        await addLog(sc, orchProjectId, `📦 [capture] No token available to capture markdown files`, "warn");
        return;
      }

      await syncLatestMarkdownFiles(sc, orchProjectId, brainProjectId, userAccount.token_encrypted, true);
    }

    // ★ Trigger post-orchestration AI refinement on the linked cirius_project
    await triggerRefinement(sc, orchProjectId, userId);
  } catch (e) {
    await addLog(sc, orchProjectId, `📦 [capture] Error: ${(e as Error).message}`, "error");
  }
}

/** Trigger cirius-generate refine action after all tasks complete (fire-and-forget) */
async function triggerRefinement(sc: SC, orchProjectId: string, userId: string) {
  try {
    const { data: ciriusProject } = await sc.from("cirius_projects")
      .select("id, user_id")
      .eq("orchestrator_project_id", orchProjectId)
      .maybeSingle();

    if (!ciriusProject) {
      await addLog(sc, orchProjectId, `🔧 [refine] No cirius_project linked — skipping refinement`, "warn");
      return;
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get user token to authenticate the refine call
    const { data: userAccount } = await sc.from("lovable_accounts")
      .select("token_encrypted")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    // Create a service-level auth header for internal call
    // The refine action requires user auth, so we use the user's session
    await addLog(sc, orchProjectId, `🔧 [refine] Triggering AI refinement for cirius project ${ciriusProject.id.slice(0, 8)}`, "info");

    // Fire-and-forget refinement call via internal service key
    fetch(`${supabaseUrl}/functions/v1/cirius-generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        action: "refine",
        project_id: ciriusProject.id,
      }),
    }).catch((e) => {
      console.error("[tick] refine trigger failed:", e.message);
    });
  } catch (e) {
    await addLog(sc, orchProjectId, `🔧 [refine] Error: ${(e as Error).message}`, "error");
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sc = createClient(supabaseUrl, serviceKey);

  const tickLog: string[] = [];
  let processed = 0;
  let skipped = 0;
  const tickStartMs = Date.now();

  try {
    // ═══════════════════════════════════════════════════════
    // PHASE 1: Check "executing" projects for completion
    // ═══════════════════════════════════════════════════════
    const { data: executingProjects, error: execErr } = await sc
      .from("orchestrator_projects")
      .select("*")
      .eq("status", "executing")
      .limit(10);

    if (execErr) {
      console.error("[tick] Failed to fetch executing projects:", execErr.message);
      tickLog.push(`❌ DB error fetching executing: ${execErr.message}`);
    }

    for (const project of (executingProjects || [])) {
      const projId8 = (project.id as string).slice(0, 8);
      try {
        const lovableProjectId = project.lovable_project_id as string;
        if (!lovableProjectId) {
          // Recovery path for legacy/partial records that lost lovable_project_id.
          const [{ count: pendingCount }, { data: runningTasks }] = await Promise.all([
            sc.from("orchestrator_tasks")
              .select("id", { count: "exact", head: true })
              .eq("project_id", project.id)
              .eq("status", "pending"),
            sc.from("orchestrator_tasks")
              .select("id, task_index")
              .eq("project_id", project.id)
              .eq("status", "running"),
          ]);

          if ((pendingCount || 0) === 0 && (runningTasks?.length || 0) > 0) {
            const runningIds = (runningTasks || []).map((t) => t.id as string);
            await sc.from("orchestrator_tasks").update({
              status: "completed",
              completed_at: new Date().toISOString(),
            }).in("id", runningIds);

            await sc.from("orchestrator_projects").update({
              status: "completed",
              next_tick_at: null,
            }).eq("id", project.id);

            await addLog(sc, project.id as string,
              `🛠️ [tick] Recovery: project had no lovable_project_id with ${runningIds.length} running tasks and no pending tasks — force-completed and finalized`, "warn",
              { phase: "executing", action: "recover_missing_project_id_finalize", running_tasks: runningIds.length });
            tickLog.push(`→ [exec] ${projId8}: recovery finalize (${runningIds.length} running)`);
            processed++;
            continue;
          }

          await sc.from("orchestrator_projects").update({ status: "paused" }).eq("id", project.id);
          await addLog(sc, project.id as string,
            `🔄 [tick] No lovable_project_id set — reset to paused`, "warn",
            { phase: "executing", action: "reset_to_paused", reason: "missing_project_id" });
          tickLog.push(`→ [exec] ${projId8}: no project ID → paused`);
          processed++;
          continue;
        }

        // Get the brainchain account token
        const account = await getBusyAccountForProject(sc, lovableProjectId);
        if (!account) {
          await addLog(sc, project.id as string,
            `⚠️ [tick] No brainchain account found for brain ${lovableProjectId.slice(0, 8)} — cannot poll`, "warn",
            { phase: "executing", brain_project: lovableProjectId, action: "skip", reason: "no_account" });
          tickLog.push(`→ [exec] ${projId8}: no account for brain ${lovableProjectId.slice(0, 8)} → skip`);
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
          await addLog(sc, project.id as string,
            `🔧 [tick] Status=executing but no running task — released account ${account.id.slice(0, 8)}, reset to paused`, "warn",
            { phase: "executing", account_id: account.id, action: "reset_to_paused", reason: "no_running_task" });
          tickLog.push(`→ [exec] ${projId8}: no running task → paused`);
          processed++;
          continue;
        }

        const startedAt = runningTask.started_at ? new Date(runningTask.started_at as string).getTime() : Date.now();
        const elapsed = Date.now() - startedAt;
        const taskIdx = runningTask.task_index as number;

        // Timeout check
        if (elapsed > EXECUTING_TIMEOUT_MS) {
          await sc.from("orchestrator_tasks").update({
            status: "completed", completed_at: new Date().toISOString(),
          }).eq("id", runningTask.id);
          await releaseBrainchainAccount(sc, account.id);
          await sc.from("orchestrator_projects").update({
            status: "paused",
            next_tick_at: new Date(Date.now() + INTER_TASK_DELAY_MS).toISOString(),
          }).eq("id", project.id);
          await addLog(sc, project.id as string,
            `⏰ [tick] Task #${taskIdx} TIMEOUT after ${Math.round(elapsed / 1000)}s — force-completed, released account ${account.id.slice(0, 8)}`, "warn",
            { phase: "executing", task_id: runningTask.id, task_index: taskIdx,
              elapsed_ms: elapsed, timeout_ms: EXECUTING_TIMEOUT_MS,
              account_id: account.id, brain_project: lovableProjectId,
              action: "force_complete_timeout" }, runningTask.id as string);
          tickLog.push(`→ [exec] ${projId8}: task #${taskIdx} timeout (${Math.round(elapsed / 1000)}s)`);
          processed++;
          continue;
        }

        // Check completion — latest assistant message (markdown-first)
        let completed = false;
        let reason = "";
        let checkErrors: string[] = [];

        try {
          const pollRes = await extFetch(`${LOVABLE_API}/projects/${lovableProjectId}/chat/latest-message`, token);
          if (pollRes.ok) {
            const rawPoll = await pollRes.text();
            const pollData = parseLatestMessage(rawPoll);
            const lastSeen = project.source_fingerprint as string | null;

            if (!pollData) {
              checkErrors.push("latest-message: parse_failed");
            } else if (pollData.role !== "user" && !pollData.is_streaming && (pollData.content || "").trim().length > 20 && elapsed > 15_000) {
              if (pollData.id && pollData.id !== lastSeen) {
                completed = true;
                reason = "latest_message_new";
                await sc.from("orchestrator_projects").update({ source_fingerprint: pollData.id }).eq("id", project.id);
              } else if (!lastSeen && pollData.id) {
                await sc.from("orchestrator_projects").update({ source_fingerprint: pollData.id }).eq("id", project.id);
                checkErrors.push("latest-message: seeded_last_seen");
              }
            }
          } else {
            checkErrors.push(`latest-message: HTTP ${pollRes.status}`);
            if (pollRes.status === 401) checkErrors.push("token_expired");
          }
        } catch (e) {
          checkErrors.push(`latest-message: ${(e as Error).message.slice(0, 60)}`);
        }

        if (completed) {
          // Sync markdown files for this completed task before releasing account
          const syncResult = await syncLatestMarkdownFiles(
            sc,
            project.id as string,
            lovableProjectId,
            token,
            false,
            runningTask.id as string,
          );

          await sc.from("orchestrator_tasks").update({
            status: "completed", completed_at: new Date().toISOString(),
          }).eq("id", runningTask.id);
          await releaseBrainchainAccount(sc, account.id);

          // Count completed tasks to update progress
          const { count: completedCount } = await sc
            .from("orchestrator_tasks")
            .select("id", { count: "exact", head: true })
            .eq("project_id", project.id)
            .eq("status", "completed");

          await sc.from("orchestrator_projects").update({
            status: "paused",
            current_task_index: completedCount || (taskIdx + 1),
            next_tick_at: new Date(Date.now() + INTER_TASK_DELAY_MS).toISOString(),
          }).eq("id", project.id);
          await addLog(sc, project.id as string,
            `✅ [tick] Task #${taskIdx} completed (${reason}) after ${Math.round(elapsed / 1000)}s — released account, next in ${INTER_TASK_DELAY_MS / 1000}s`, "info",
            { phase: "executing", task_id: runningTask.id, task_index: taskIdx,
              elapsed_ms: elapsed, reason, account_id: account.id,
              brain_project: lovableProjectId, check_errors: checkErrors.length ? checkErrors : undefined,
              markdown_sync: syncResult,
              action: "task_completed" }, runningTask.id as string);
          tickLog.push(`→ [exec] ${projId8}: task #${taskIdx} ✅ (${reason}, ${Math.round(elapsed / 1000)}s)`);
          processed++;
        } else {
          // Still running — log check status for debugging
          if (checkErrors.length > 0) {
            await addLog(sc, project.id as string,
              `⏳ [tick] Task #${taskIdx} still running (${Math.round(elapsed / 1000)}s) — check errors: ${checkErrors.join("; ")}`, "debug",
              { phase: "executing", task_id: runningTask.id, task_index: taskIdx,
                elapsed_ms: elapsed, check_errors: checkErrors,
                account_id: account.id, brain_project: lovableProjectId,
                action: "still_running_with_errors" }, runningTask.id as string);
          }
          tickLog.push(`→ [exec] ${projId8}: task #${taskIdx} ⏳ (${Math.round(elapsed / 1000)}s)${checkErrors.length ? ` [${checkErrors.join(",")}]` : ""}`);
          skipped++;
        }
      } catch (e) {
        const errMsg = (e as Error).message;
        await addLog(sc, project.id as string,
          `❌ [tick] EXCEPTION in executing check: ${errMsg}`, "error",
          { phase: "executing", error: errMsg, stack: (e as Error).stack?.slice(0, 200) });
        tickLog.push(`→ [exec] ${projId8}: ❌ ${errMsg.slice(0, 60)}`);
      }
    }

    // ═══════════════════════════════════════════════════════
    // PHASE 2: Process "paused" projects — dispatch next task
    // ═══════════════════════════════════════════════════════
    const now = new Date().toISOString();
    const { data: pausedProjects, error: pauseErr } = await sc
      .from("orchestrator_projects")
      .select("*")
      .eq("status", "paused")
      .or(`next_tick_at.is.null,next_tick_at.lte.${now}`)
      .limit(5);

    if (pauseErr) {
      console.error("[tick] Failed to fetch paused projects:", pauseErr.message);
      tickLog.push(`❌ DB error fetching paused: ${pauseErr.message}`);
    }

    for (const project of (pausedProjects || [])) {
      const projId8 = (project.id as string).slice(0, 8);
      try {
        // Check pending tasks
        const { data: nextTask } = await sc
          .from("orchestrator_tasks")
          .select("id, task_index, title")
          .eq("project_id", project.id)
          .eq("status", "pending")
          .order("task_index", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!nextTask) {
          // Safety: if there is still a running task, do NOT complete the project.
          const { data: runningTask } = await sc
            .from("orchestrator_tasks")
            .select("id, task_index, started_at")
            .eq("project_id", project.id)
            .eq("status", "running")
            .order("task_index", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (runningTask) {
            await sc.from("orchestrator_projects").update({
              status: "executing",
              current_task_index: runningTask.task_index as number,
              next_tick_at: new Date(Date.now() + 5_000).toISOString(),
            }).eq("id", project.id);

            await addLog(sc, project.id as string,
              `🔄 [tick] No pending tasks but found running task #${runningTask.task_index} — switching back to executing`, "warn",
              { phase: "paused", action: "recover_running_state", task_id: runningTask.id, task_index: runningTask.task_index });

            tickLog.push(`→ [paused] ${projId8}: running task #${runningTask.task_index} found → executing`);
            skipped++;
            continue;
          }

          // If there are failed tasks, project should be failed (not completed).
          const { count: failedCount } = await sc
            .from("orchestrator_tasks")
            .select("id", { count: "exact", head: true })
            .eq("project_id", project.id)
            .eq("status", "failed");

          if ((failedCount || 0) > 0) {
            await sc.from("orchestrator_projects").update({ status: "failed" }).eq("id", project.id);
            await addLog(sc, project.id as string,
              `❌ [tick] Project marked as failed — no pending/running tasks and ${failedCount} failed tasks found`, "error",
              { phase: "paused", action: "project_failed", failed_tasks: failedCount });
            tickLog.push(`→ [paused] ${projId8}: failed tasks=${failedCount} → failed`);
            processed++;
            continue;
          }

          await sc.from("orchestrator_projects").update({
            status: "completed",
            current_task_index: project.total_tasks as number,
            quality_score: 100,
          }).eq("id", project.id);
          await addLog(sc, project.id as string,
            `🎉 [tick] All tasks completed!`, "info",
            { phase: "paused", action: "project_completed",
              total_tasks: project.total_tasks, user_id: project.user_id });
          tickLog.push(`→ [paused] ${projId8}: ✅ all done!`);
          processed++;

          // ★ Auto-capture source files back to cirius_projects
          await autoCapture(sc, project.id as string, project.lovable_project_id as string, project.user_id as string);

          continue;
        }

        // Dispatch execute_next
        const dispatchT0 = Date.now();
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
        const dispatchDuration = Date.now() - dispatchT0;

        const execData = await execRes.json().catch(() => ({})) as Record<string, unknown>;

        if (execRes.status === 503) {
          const backoffMs = 60_000;
          await sc.from("orchestrator_projects").update({
            next_tick_at: new Date(Date.now() + backoffMs).toISOString(),
          }).eq("id", project.id);
          await addLog(sc, project.id as string,
            `⚠️ [tick] No brainchain accounts available for task #${nextTask.task_index} "${nextTask.title}" — backoff ${backoffMs / 1000}s`, "warn",
            { phase: "paused", task_id: nextTask.id, task_index: nextTask.task_index,
              dispatch_duration_ms: dispatchDuration, backoff_ms: backoffMs,
              action: "backoff_no_accounts" }, nextTask.id as string);
          tickLog.push(`→ [paused] ${projId8}: no accounts → backoff 60s`);
          skipped++;
        } else if (execRes.status >= 400) {
          await addLog(sc, project.id as string,
            `❌ [tick] execute_next failed: HTTP ${execRes.status} — ${JSON.stringify(execData).slice(0, 150)}`, "error",
            { phase: "paused", task_id: nextTask.id, task_index: nextTask.task_index,
              dispatch_status: execRes.status, dispatch_response: execData,
              dispatch_duration_ms: dispatchDuration,
              action: "dispatch_failed" }, nextTask.id as string);
          tickLog.push(`→ [paused] ${projId8}: dispatch failed (${execRes.status})`);
          // Backoff on error
          await sc.from("orchestrator_projects").update({
            next_tick_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
          }).eq("id", project.id);
          skipped++;
        } else {
          await addLog(sc, project.id as string,
            `📤 [tick] Dispatched task #${nextTask.task_index} "${nextTask.title}" → status=${execData.status || "ok"} (${dispatchDuration}ms)`, "info",
            { phase: "paused", task_id: nextTask.id, task_index: nextTask.task_index,
              dispatch_status: execRes.status, dispatch_response: execData,
              dispatch_duration_ms: dispatchDuration,
              action: "task_dispatched" }, nextTask.id as string);
          tickLog.push(`→ [paused] ${projId8}: dispatched #${nextTask.task_index} (${execData.status || execRes.status})`);
          processed++;
        }
      } catch (e) {
        const errMsg = (e as Error).message;
        await addLog(sc, project.id as string,
          `❌ [tick] EXCEPTION in paused dispatch: ${errMsg}`, "error",
          { phase: "paused", error: errMsg, stack: (e as Error).stack?.slice(0, 200) });
        tickLog.push(`→ [paused] ${projId8}: ❌ ${errMsg.slice(0, 60)}`);
        await sc.from("orchestrator_projects").update({
          next_tick_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        }).eq("id", project.id);
      }
    }

    const tickDuration = Date.now() - tickStartMs;
    return json({
      success: true, processed, skipped, tick_log: tickLog,
      duration_ms: tickDuration,
      executing_count: executingProjects?.length || 0,
      paused_count: pausedProjects?.length || 0,
    });
  } catch (err) {
    console.error("[orchestrator-tick] Fatal:", err);
    return json({ error: "Internal server error", details: (err as Error).message?.slice(0, 100) }, 500);
  }
});
