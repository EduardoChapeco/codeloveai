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

/** Try to read timestamped cirius-out .md files from Brain project source-code as fallback */
async function trySourceCodeFallback(brainProjectId: string, token: string, outputMarker?: string): Promise<Record<string, string>> {
  // If we have a specific output marker, try that file first
  const pathsToTry = outputMarker
    ? [`src/${outputMarker}.md`, "src/update.md"]
    : ["src/update.md"];

  for (const filePath of pathsToTry) {
    try {
      const res = await fetch(`${LOVABLE_API}/projects/${brainProjectId}/source-code?path=${encodeURIComponent(filePath)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...LOVABLE_HEADERS,
          "X-Client-Git-SHA": GIT_SHA,
        },
      });
      if (!res.ok) continue;
      const data = await res.json().catch(() => null);
      const content = data?.content || data?.source || "";
      if (!content || content.length < 50) continue;
      const body = extractMdBody(content);
      const files = extractFilesFromMarkdown(body);
      if (Object.keys(files).length > 0) return files;
    } catch {
      continue;
    }
  }
  return {};
}

/** Sync markdown-generated files from latest assistant message into cirius_projects */
async function syncLatestMarkdownFiles(
  sc: SC,
  orchProjectId: string,
  brainProjectId: string,
  token: string,
  finalize = false,
  taskId?: string,
  outputMarker?: string,
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
    // Fallback: try reading timestamped cirius-out .md from the Brain project's source code
    const fallbackFiles = await trySourceCodeFallback(brainProjectId, token, outputMarker);
    if (Object.keys(fallbackFiles).length > 0) {
      const existing = (ciriusProject.source_files_json || {}) as Record<string, string>;
      const merged = mergeFileMaps(existing, fallbackFiles);
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
      await addLog(sc, orchProjectId,
        `📦 [capture] ✅ source-code fallback: +${Object.keys(fallbackFiles).length} arquivo(s)${finalize ? " (finalize)" : ""}`,
        "info", { fallback: true, file_count: Object.keys(fallbackFiles).length }, taskId);
      return { ok: true, reason: "source_code_fallback", fileCount: Object.keys(merged).length };
    }

    await addLog(sc, orchProjectId, `📦 [capture] No code blocks with file paths found in markdown or source-code`, "warn", {
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

/** Trigger cirius-generate refine action after all tasks complete */
async function triggerRefinement(sc: SC, orchProjectId: string, userId: string) {
  try {
    const { data: ciriusProject } = await sc.from("cirius_projects")
      .select("id, user_id, status, source_files_json")
      .eq("orchestrator_project_id", orchProjectId)
      .maybeSingle();

    if (!ciriusProject) {
      await addLog(sc, orchProjectId, `🔧 [refine] No cirius_project linked — skipping refinement`, "warn");
      return;
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    await addLog(sc, orchProjectId, `🔧 [refine] Triggering AI refinement for cirius project ${ciriusProject.id.slice(0, 8)}`, "info");

    const refineRes = await fetch(`${supabaseUrl}/functions/v1/cirius-generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        action: "refine",
        project_id: ciriusProject.id,
      }),
    });

    const refineBody = await refineRes.text().catch(() => "");

    if (!refineRes.ok) {
      const fileCount = Object.keys((ciriusProject.source_files_json || {}) as Record<string, string>).length;

      // Fallback: avoid infinite "generating_code" when internal refine auth/invoke fails
      if (fileCount > 0) {
        await sc.from("cirius_projects").update({
          status: "live",
          current_step: "done",
          progress_pct: 100,
          generation_ended_at: new Date().toISOString(),
          error_message: null,
        }).eq("id", ciriusProject.id);

        await addLog(
          sc,
          orchProjectId,
          `🔧 [refine] HTTP ${refineRes.status} on refine — fallback applied (marked live with existing files)`,
          "warn",
          { refine_status: refineRes.status, refine_body: refineBody.slice(0, 180), file_count: fileCount }
        );
      } else {
        await addLog(
          sc,
          orchProjectId,
          `🔧 [refine] HTTP ${refineRes.status} on refine and no files available`,
          "error",
          { refine_status: refineRes.status, refine_body: refineBody.slice(0, 180), file_count: 0 }
        );
      }
    }
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

        // Get ALL running tasks (parallel support)
        const { data: runningTasks } = await sc.from("orchestrator_tasks")
          .select("*")
          .eq("project_id", project.id)
          .eq("status", "running")
          .order("task_index", { ascending: true });

        if (!runningTasks || runningTasks.length === 0) {
          await releaseBrainchainAccount(sc, account.id);
          await sc.from("orchestrator_projects").update({ status: "paused" }).eq("id", project.id);
          await addLog(sc, project.id as string,
            `🔧 [tick] Status=executing but no running task — released account ${account.id.slice(0, 8)}, reset to paused`, "warn",
            { phase: "executing", account_id: account.id, action: "reset_to_paused", reason: "no_running_task" });
          tickLog.push(`→ [exec] ${projId8}: no running task → paused`);
          processed++;
          continue;
        }

        let anyCompleted = false;
        let allDone = true;

        for (const runningTask of runningTasks) {
          const startedAt = runningTask.started_at ? new Date(runningTask.started_at as string).getTime() : Date.now();
          const elapsed = Date.now() - startedAt;
          const taskIdx = runningTask.task_index as number;

          // Timeout check
          if (elapsed > EXECUTING_TIMEOUT_MS) {
            await sc.from("orchestrator_tasks").update({
              status: "completed", completed_at: new Date().toISOString(),
            }).eq("id", runningTask.id);
            await addLog(sc, project.id as string,
              `⏰ [tick] Task #${taskIdx} TIMEOUT after ${Math.round(elapsed / 1000)}s — force-completed`, "warn",
              { phase: "executing", task_id: runningTask.id, task_index: taskIdx,
                elapsed_ms: elapsed, timeout_ms: EXECUTING_TIMEOUT_MS,
                brain_project: lovableProjectId,
                action: "force_complete_timeout" }, runningTask.id as string);
            tickLog.push(`→ [exec] ${projId8}: task #${taskIdx} timeout (${Math.round(elapsed / 1000)}s)`);
            anyCompleted = true;
            continue;
          }

          // Check completion — latest assistant message (compare against initial snapshot)
          let completed = false;
          let reason = "";
          let checkErrors: string[] = [];

          // Get the initial message ID stored when task was dispatched
          const taskInitialMsgId = (runningTask as any).metadata?.initial_msg_id as string | null;
          const lastSeen = taskInitialMsgId || (project.source_fingerprint as string | null);

          // Each parallel task may use a different brain — try to get account for that brain
          const taskAccount = await getBusyAccountForProject(sc, lovableProjectId);
          const taskToken = taskAccount?.accessToken || token;

          try {
            const pollRes = await extFetch(`${LOVABLE_API}/projects/${lovableProjectId}/chat/latest-message`, taskToken);
            if (pollRes.ok) {
              const rawPoll = await pollRes.text();
              const pollData = parseLatestMessage(rawPoll);

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
            const taskOutputMarker = (runningTask as any).metadata?.output_marker as string | undefined;
            const syncResult = await syncLatestMarkdownFiles(
              sc,
              project.id as string,
              lovableProjectId,
              taskToken,
              false,
              runningTask.id as string,
              taskOutputMarker,
            );

            await sc.from("orchestrator_tasks").update({
              status: "completed", completed_at: new Date().toISOString(),
            }).eq("id", runningTask.id);

            await addLog(sc, project.id as string,
              `✅ [tick] Task #${taskIdx} completed (${reason}) after ${Math.round(elapsed / 1000)}s`, "info",
              { phase: "executing", task_id: runningTask.id, task_index: taskIdx,
                elapsed_ms: elapsed, reason,
                brain_project: lovableProjectId, check_errors: checkErrors.length ? checkErrors : undefined,
                markdown_sync: syncResult,
                action: "task_completed" }, runningTask.id as string);
            tickLog.push(`→ [exec] ${projId8}: task #${taskIdx} ✅ (${reason}, ${Math.round(elapsed / 1000)}s)`);
            anyCompleted = true;
          } else {
            allDone = false;
            if (checkErrors.length > 0) {
              await addLog(sc, project.id as string,
                `⏳ [tick] Task #${taskIdx} still running (${Math.round(elapsed / 1000)}s) — check errors: ${checkErrors.join("; ")}`, "debug",
                { phase: "executing", task_id: runningTask.id, task_index: taskIdx,
                  elapsed_ms: elapsed, check_errors: checkErrors,
                  brain_project: lovableProjectId,
                  action: "still_running_with_errors" }, runningTask.id as string);
            }
            tickLog.push(`→ [exec] ${projId8}: task #${taskIdx} ⏳ (${Math.round(elapsed / 1000)}s)${checkErrors.length ? ` [${checkErrors.join(",")}]` : ""}`);
          }
        }

        // After processing all running tasks
        if (anyCompleted) {
          await releaseBrainchainAccount(sc, account.id);
          
          const { count: completedCount } = await sc
            .from("orchestrator_tasks")
            .select("id", { count: "exact", head: true })
            .eq("project_id", project.id)
            .eq("status", "completed");

          await sc.from("orchestrator_projects").update({
            status: "paused",
            current_task_index: completedCount || 0,
            next_tick_at: new Date(Date.now() + (allDone ? 5_000 : INTER_TASK_DELAY_MS)).toISOString(),
          }).eq("id", project.id);
          processed++;
        } else {
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
    // PHASE 2: Process "paused" projects — dispatch next task(s) in PARALLEL
    // ═══════════════════════════════════════════════════════
    const MAX_PARALLEL = 3; // Max concurrent brain tasks per project
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
        // Count currently running tasks for this project
        const { count: runningCount } = await sc
          .from("orchestrator_tasks")
          .select("id", { count: "exact", head: true })
          .eq("project_id", project.id)
          .eq("status", "running");

        const currentRunning = runningCount || 0;
        const slotsAvailable = MAX_PARALLEL - currentRunning;

        // Get pending tasks (up to available slots)
        // Check dependency satisfaction: only dispatch tasks whose depends_on are all completed
        const { data: allTasks } = await sc
          .from("orchestrator_tasks")
          .select("id, task_index, title, status, brain_type, depends_on, prompt")
          .eq("project_id", project.id)
          .order("task_index", { ascending: true });

        const completedIndexes = new Set(
          (allTasks || []).filter(t => t.status === "completed").map(t => t.task_index as number)
        );
        const runningIndexes = new Set(
          (allTasks || []).filter(t => t.status === "running").map(t => t.task_index as number)
        );

        const pendingTasks = (allTasks || [])
          .filter(t => t.status === "pending")
          .filter(t => {
            const deps = (t.depends_on as number[]) || [];
            return deps.every(d => completedIndexes.has(d));
          })
          .slice(0, Math.max(slotsAvailable, 1));

        if (!pendingTasks || pendingTasks.length === 0) {
          // No pending tasks — check if there are still running ones
          if (currentRunning > 0) {
            // Tasks still running — switch to executing
            await sc.from("orchestrator_projects").update({
              status: "executing",
              next_tick_at: new Date(Date.now() + 5_000).toISOString(),
            }).eq("id", project.id);

            await addLog(sc, project.id as string,
              `🔄 [tick] No pending tasks but ${currentRunning} running — switching to executing`, "warn",
              { phase: "paused", action: "recover_running_state", running_count: currentRunning });

            tickLog.push(`→ [paused] ${projId8}: ${currentRunning} running → executing`);
            skipped++;
            continue;
          }

          // No pending and no running — check for failures
          const { count: failedCount } = await sc
            .from("orchestrator_tasks")
            .select("id", { count: "exact", head: true })
            .eq("project_id", project.id)
            .eq("status", "failed");

          if ((failedCount || 0) > 0) {
            await sc.from("orchestrator_projects").update({ status: "failed" }).eq("id", project.id);
            await addLog(sc, project.id as string,
              `❌ [tick] Project marked as failed — ${failedCount} failed tasks`, "error",
              { phase: "paused", action: "project_failed", failed_tasks: failedCount });
            tickLog.push(`→ [paused] ${projId8}: failed tasks=${failedCount} → failed`);
            processed++;
            continue;
          }

          // All done!
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

        // Dispatch multiple tasks in parallel (up to available slots)
        const tasksToDispatch = slotsAvailable > 0 ? pendingTasks.slice(0, slotsAvailable) : [pendingTasks[0]];
        let anySuccess = false;
        let anyBackoff = false;

        for (const nextTask of tasksToDispatch) {
          // ★ For "review" brain tasks, enrich the prompt with current file inventory
          if ((nextTask as any).brain_type === "review") {
            const { data: ciriusPrj } = await sc.from("cirius_projects")
              .select("source_files_json")
              .eq("orchestrator_project_id", project.id)
              .maybeSingle();
            const filesMap = (ciriusPrj?.source_files_json || {}) as Record<string, string>;
            const fileList = Object.keys(filesMap);
            if (fileList.length > 0) {
              const fileSummary = fileList.map(f => `- ${f} (${filesMap[f].length} chars)`).join("\n");
              const enrichedPrompt = (nextTask as any).prompt + `\n\n--- CURRENT PROJECT FILES (${fileList.length} files) ---\n${fileSummary}\n\nReview ALL these files holistically. Ensure imports, exports, types, and component composition are consistent across the entire codebase.`;
              await sc.from("orchestrator_tasks").update({ prompt: enrichedPrompt }).eq("id", nextTask.id);
              await addLog(sc, project.id as string,
                `🔍 [tick] Enriched review task #${nextTask.task_index} with ${fileList.length} file inventory`, "info",
                { phase: "paused", file_count: fileList.length, brain_type: "review" }, nextTask.id as string);
            }
          }

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
              _target_task_id: nextTask.id,
            }),
          });
          const dispatchDuration = Date.now() - dispatchT0;
          const execData = await execRes.json().catch(() => ({})) as Record<string, unknown>;

          if (execRes.status === 503) {
            anyBackoff = true;
            await addLog(sc, project.id as string,
              `⚠️ [tick] No brainchain accounts for task #${nextTask.task_index} "${nextTask.title}" — backoff`, "warn",
              { phase: "paused", task_id: nextTask.id, task_index: nextTask.task_index,
                dispatch_duration_ms: dispatchDuration, action: "backoff_no_accounts" }, nextTask.id as string);
            tickLog.push(`→ [paused] ${projId8}: no accounts for #${nextTask.task_index} → backoff`);
            break; // No more accounts available
          } else if (execRes.status >= 400) {
            await addLog(sc, project.id as string,
              `❌ [tick] execute_next failed for #${nextTask.task_index}: HTTP ${execRes.status}`, "error",
              { phase: "paused", task_id: nextTask.id, task_index: nextTask.task_index,
                dispatch_status: execRes.status, dispatch_response: execData,
                dispatch_duration_ms: dispatchDuration, action: "dispatch_failed" }, nextTask.id as string);
            tickLog.push(`→ [paused] ${projId8}: dispatch #${nextTask.task_index} failed (${execRes.status})`);
          } else {
            anySuccess = true;
            await addLog(sc, project.id as string,
              `📤 [tick] Dispatched task #${nextTask.task_index} "${nextTask.title}" → parallel (${dispatchDuration}ms)`, "info",
              { phase: "paused", task_id: nextTask.id, task_index: nextTask.task_index,
                dispatch_status: execRes.status, dispatch_response: execData,
                dispatch_duration_ms: dispatchDuration, parallel_slot: tasksToDispatch.indexOf(nextTask) + 1,
                total_parallel: tasksToDispatch.length, action: "task_dispatched_parallel" }, nextTask.id as string);
            tickLog.push(`→ [paused] ${projId8}: dispatched #${nextTask.task_index} ∥${tasksToDispatch.indexOf(nextTask) + 1}`);
            processed++;
          }
        }

        if (anyBackoff) {
          await sc.from("orchestrator_projects").update({
            next_tick_at: new Date(Date.now() + 60_000).toISOString(),
          }).eq("id", project.id);
          skipped++;
        } else if (!anySuccess) {
          await sc.from("orchestrator_projects").update({
            next_tick_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
          }).eq("id", project.id);
          skipped++;
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
