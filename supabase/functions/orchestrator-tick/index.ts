/**
 * orchestrator-tick v5.0 — Brain Chain Pipeline with source-code-first mining
 *
 * Key changes from v4.1:
 *  - PRIMARY mining via source-code endpoint (not chat/latest-message which 404s)
 *  - 2-phase support: prd_expansion tasks create dynamic sub-tasks
 *  - Integrated brain_output registration for unified tracking
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
      "X-Client-Git-SHA": GIT_SHA,
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

// ═══════════════════════════════════════════════════════════════
// ★ PRIMARY MINING: source-code endpoint (replaces chat/latest-message)
// ═══════════════════════════════════════════════════════════════

/** Read source-code from brain project and find update.md content */
async function readSourceCode(brainProjectId: string, token: string): Promise<string | null> {
  // Try full source-code endpoint first (returns all files)
  try {
    const res = await fetch(`${LOVABLE_API}/projects/${brainProjectId}/source-code`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...LOVABLE_HEADERS,
        "X-Client-Git-SHA": GIT_SHA,
      },
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data) {
        const md = findUpdateMd(data);
        if (md && md.length > 30) return md;
      }
    }
  } catch { /* continue */ }

  // Try specific file path
  for (const filePath of ["src/update.md"]) {
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
      if (content && content.length > 30) return content;
    } catch { continue; }
  }
  return null;
}

/** Find update.md in nested source-code response */
function findUpdateMd(obj: any): string | null {
  const target = "src/update.md";
  if (!obj || typeof obj !== "object") return null;

  if (obj[target]) {
    const v = obj[target];
    if (typeof v === "string") return v;
    if (typeof v === "object") return v.contents || v.content || v.source || null;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (!item || typeof item !== "object") continue;
      const p = item.path || item.name || item.file_path || "";
      if (p === target || p.endsWith("update.md")) {
        const c = item.contents || item.content || item.source || item.code;
        if (typeof c === "string") return c;
      }
    }
    return null;
  }

  for (const key of ["files", "data", "source", "source_code", "project", "code"]) {
    if (obj[key]) {
      const result = findUpdateMd(obj[key]);
      if (result) return result;
    }
  }

  for (const key of Object.keys(obj)) {
    if (key.endsWith("update.md")) {
      const v = obj[key];
      if (typeof v === "string") return v;
      if (typeof v === "object") return v?.contents || v?.content || v?.source || null;
    }
  }

  return null;
}

/** Try to read timestamped cirius-out .md files from Brain project source-code as fallback */
async function trySourceCodeFallback(brainProjectId: string, token: string, outputMarker?: string): Promise<Record<string, string>> {
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
    } catch { continue; }
  }
  return {};
}

// ═══════════════════════════════════════════════════════════════
// ★ SMART MINING: source-code FIRST, chat/latest-message as fallback
// ═══════════════════════════════════════════════════════════════

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

  // ★ STRATEGY 1: source-code endpoint (PRIMARY — no more 404s)
  const sourceContent = await readSourceCode(brainProjectId, token);
  if (sourceContent && sourceContent.length > 50) {
    const body = extractMdBody(sourceContent);
    const parsedFiles = extractFilesFromMarkdown(body);
    
    if (Object.keys(parsedFiles).length > 0) {
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
        `📦 [capture] ✅ source-code sync: +${Object.keys(parsedFiles).length} arquivo(s), total=${Object.keys(merged).length}${finalize ? " (finalize)" : ""}`,
        "info", { strategy: "source_code", file_count: Object.keys(merged).length, parsed_count: Object.keys(parsedFiles).length, cirius_project: ciriusProject.id }, taskId);
      return { ok: true, reason: "source_code_sync", fileCount: Object.keys(merged).length };
    }
  }

  // ★ STRATEGY 2: Try specific output marker files
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
      "info", { strategy: "source_code_fallback", file_count: Object.keys(merged).length }, taskId);
    return { ok: true, reason: "source_code_fallback", fileCount: Object.keys(merged).length };
  }

  // ★ STRATEGY 3: chat/latest-message (LAST RESORT)
  try {
    const latestRes = await fetch(`${LOVABLE_API}/projects/${brainProjectId}/chat/latest-message`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...LOVABLE_HEADERS,
        "X-Client-Git-SHA": GIT_SHA,
      },
    });

    if (latestRes.ok) {
      const rawLatest = await latestRes.text();
      const msg = parseLatestMessage(rawLatest);
      if (msg && msg.role !== "user") {
        const markdownBody = extractMdBody(msg.content || "");
        const parsedFiles = extractFilesFromMarkdown(markdownBody);
        if (Object.keys(parsedFiles).length > 0) {
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
          await addLog(sc, orchProjectId,
            `📦 [capture] ✅ chat fallback: +${Object.keys(parsedFiles).length} arquivo(s)`,
            "info", { strategy: "chat_latest_message", file_count: Object.keys(merged).length }, taskId);
          return { ok: true, reason: "chat_fallback", fileCount: Object.keys(merged).length };
        }
      }
    }
  } catch { /* chat endpoint failed, already tried source-code */ }

  await addLog(sc, orchProjectId, `📦 [capture] No files found via any strategy`, "warn", undefined, taskId);
  return { ok: false, reason: "no_files_any_strategy", fileCount: 0 };
}

// ═══════════════════════════════════════════════════════════════
// ★ COMPLETION DETECTION: source-code timestamp-based (no chat polling)
// ═══════════════════════════════════════════════════════════════

async function checkTaskCompletion(
  brainProjectId: string, token: string, taskStartedAt: number
): Promise<{ completed: boolean; reason: string }> {
  // Check if update.md has been updated AFTER task was sent
  const sourceContent = await readSourceCode(brainProjectId, token);
  if (!sourceContent) return { completed: false, reason: "no_source_content" };

  // Check for status: done in frontmatter
  const hasDone = /status:\s*done/i.test(sourceContent);
  
  // Extract timestamp from update.md
  const tsMatch = sourceContent.match(/updated_at:\s*(\S+)/);
  if (tsMatch) {
    const mdTs = new Date(tsMatch[1]).getTime();
    if (!isNaN(mdTs) && mdTs > taskStartedAt) {
      if (hasDone) return { completed: true, reason: "source_code_done" };
      // Has new timestamp but no done status — check content size
      const body = extractMdBody(sourceContent);
      if (body && body.length > 100) return { completed: true, reason: "source_code_new_content" };
    }
  }

  // Fallback: check timestamp marker
  const timestampMatch = sourceContent.match(/timestamp:\s*(\d{10,15})/);
  if (timestampMatch) {
    let ts = parseInt(timestampMatch[1], 10);
    if (ts < 1e12) ts *= 1000;
    if (ts > taskStartedAt && hasDone) return { completed: true, reason: "source_code_timestamp_done" };
  }

  // After 30s, accept content even without done marker
  const elapsed = Date.now() - taskStartedAt;
  if (elapsed > 30_000 && hasDone) return { completed: true, reason: "source_code_delayed_done" };

  return { completed: false, reason: "not_ready" };
}

// ═══════════════════════════════════════════════════════════════
// ★ PRD EXPANSION: Extract sub-tasks from brain's expanded PRD
// ═══════════════════════════════════════════════════════════════

async function extractPrdSubTasks(
  sc: SC, orchProjectId: string, brainProjectId: string, token: string, taskId: string
): Promise<number> {
  const sourceContent = await readSourceCode(brainProjectId, token);
  if (!sourceContent) return 0;

  const body = extractMdBody(sourceContent);
  if (!body) return 0;

  // Try to extract JSON sub-PRD from the response
  let subTasks: Array<{ title: string; prompt: string; brain_type?: string }> = [];

  // Strategy 1: Look for JSON block
  const jsonMatch = body.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1].trim());
      if (parsed.tasks && Array.isArray(parsed.tasks)) {
        subTasks = parsed.tasks;
      }
    } catch { /* not JSON */ }
  }

  // Strategy 2: Look for numbered tasks in markdown
  if (subTasks.length === 0) {
    const taskMatches = body.matchAll(/(?:^|\n)\s*(?:\d+[\.\)]\s*|[-*]\s*\*\*Task\s*\d+\*\*[:\s]*)(.*?)(?=\n\s*(?:\d+[\.\)]|[-*]\s*\*\*Task|$))/gs);
    for (const match of taskMatches) {
      const content = match[1]?.trim();
      if (content && content.length > 20) {
        subTasks.push({ title: content.slice(0, 80), prompt: content, brain_type: "code" });
      }
    }
  }

  if (subTasks.length === 0) return 0;

  // Get current max task_index
  const { data: existingTasks } = await sc.from("orchestrator_tasks")
    .select("task_index")
    .eq("project_id", orchProjectId)
    .order("task_index", { ascending: false })
    .limit(1);

  const maxIndex = existingTasks?.[0]?.task_index as number || 0;

  // Insert dynamic sub-tasks
  const newTasks = subTasks.slice(0, 10).map((t, i) => ({
    project_id: orchProjectId,
    task_index: maxIndex + 1 + i,
    title: t.title.slice(0, 200),
    intent: "security_fix_v2",
    prompt: t.prompt,
    brain_type: t.brain_type || "code",
    phase: "code_generation",
    status: "pending",
  }));

  await sc.from("orchestrator_tasks").insert(newTasks);

  // Update project total_tasks
  const { count: totalTasks } = await sc.from("orchestrator_tasks")
    .select("id", { count: "exact", head: true })
    .eq("project_id", orchProjectId);

  await sc.from("orchestrator_projects").update({
    total_tasks: totalTasks || 0,
    pipeline_phase: "code_generation",
  }).eq("id", orchProjectId);

  // Store sub-tasks on the PRD expansion task
  await sc.from("orchestrator_tasks").update({
    sub_tasks: newTasks.map(t => ({ title: t.title, brain_type: t.brain_type })),
  }).eq("id", taskId);

  await addLog(sc, orchProjectId,
    `🧠 [prd_expansion] Created ${newTasks.length} dynamic sub-tasks from brain PRD expansion`,
    "info", { sub_task_count: newTasks.length, task_titles: newTasks.map(t => t.title) }, taskId);

  return newTasks.length;
}

/** Register brain output for unified tracking */
async function registerBrainOutput(
  sc: SC, userId: string, brainProjectId: string, 
  orchProjectId: string, taskId: string, skill: string, content: string
) {
  await sc.from("brain_outputs").insert({
    user_id: userId,
    skill: skill || "code",
    request: `orchestrator_task:${taskId}`,
    response: content.slice(0, 5000),
    status: "done",
    brain_project_id: brainProjectId,
  }).catch(() => {});
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

      if (fileCount > 0) {
        await sc.from("cirius_projects").update({
          status: "live",
          current_step: "done",
          progress_pct: 100,
          generation_ended_at: new Date().toISOString(),
          error_message: null,
        }).eq("id", ciriusProject.id);

        await addLog(sc, orchProjectId,
          `🔧 [refine] HTTP ${refineRes.status} on refine — fallback applied (marked live with existing files)`,
          "warn", { refine_status: refineRes.status, refine_body: refineBody.slice(0, 180), file_count: fileCount });
      } else {
        await addLog(sc, orchProjectId,
          `🔧 [refine] HTTP ${refineRes.status} on refine and no files available`,
          "error", { refine_status: refineRes.status, refine_body: refineBody.slice(0, 180), file_count: 0 });
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
          // Recovery path for legacy/partial records
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
              status: "completed", completed_at: new Date().toISOString(),
            }).in("id", runningIds);

            await sc.from("orchestrator_projects").update({
              status: "completed", next_tick_at: null,
            }).eq("id", project.id);

            await addLog(sc, project.id as string,
              `🛠️ [tick] Recovery: force-completed ${runningIds.length} running tasks`, "warn");
            tickLog.push(`→ [exec] ${projId8}: recovery finalize`);
            processed++;
            continue;
          }

          await sc.from("orchestrator_projects").update({ status: "paused" }).eq("id", project.id);
          tickLog.push(`→ [exec] ${projId8}: no project ID → paused`);
          processed++;
          continue;
        }

        const account = await getBusyAccountForProject(sc, lovableProjectId);
        if (!account) {
          await addLog(sc, project.id as string,
            `⚠️ [tick] No account for brain ${lovableProjectId.slice(0, 8)}`, "warn");
          tickLog.push(`→ [exec] ${projId8}: no account → skip`);
          skipped++;
          continue;
        }

        const token = account.accessToken;

        const { data: runningTasks } = await sc.from("orchestrator_tasks")
          .select("*")
          .eq("project_id", project.id)
          .eq("status", "running")
          .order("task_index", { ascending: true });

        if (!runningTasks || runningTasks.length === 0) {
          await releaseBrainchainAccount(sc, account.id);
          await sc.from("orchestrator_projects").update({ status: "paused" }).eq("id", project.id);
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
          const taskPhase = (runningTask as any).phase as string || "code_generation";

          // Timeout check
          if (elapsed > EXECUTING_TIMEOUT_MS) {
            try {
              const timeoutSync = await syncLatestMarkdownFiles(
                sc, project.id as string, lovableProjectId, token,
                false, runningTask.id as string
              );
              await addLog(sc, project.id as string,
                `⏰ [tick] Task #${taskIdx} TIMEOUT (${Math.round(elapsed / 1000)}s) — sync: ${timeoutSync.ok ? `✅ ${timeoutSync.fileCount} files` : `⚠ ${timeoutSync.reason}`}`, "warn",
                { task_id: runningTask.id, sync_result: timeoutSync }, runningTask.id as string);
            } catch { /* ignore */ }

            await sc.from("orchestrator_tasks").update({
              status: "completed", completed_at: new Date().toISOString(),
            }).eq("id", runningTask.id);
            anyCompleted = true;
            continue;
          }

          // ★ COMPLETION DETECTION via source-code (PRIMARY)
          const completion = await checkTaskCompletion(lovableProjectId, token, startedAt);

          if (completion.completed) {
            const taskOutputMarker = (runningTask as any).metadata?.output_marker as string | undefined;
            const syncResult = await syncLatestMarkdownFiles(
              sc, project.id as string, lovableProjectId, token,
              false, runningTask.id as string, taskOutputMarker,
            );

            // ★ If this is a PRD expansion task, extract sub-tasks
            if (taskPhase === "prd_expansion") {
              const subTaskCount = await extractPrdSubTasks(
                sc, project.id as string, lovableProjectId, token, runningTask.id as string
              );
              await addLog(sc, project.id as string,
                `🧠 [tick] PRD expansion task #${taskIdx} completed → ${subTaskCount} sub-tasks created`, "info",
                { phase: "prd_expansion", sub_tasks: subTaskCount }, runningTask.id as string);
            }

            // Register brain output for tracking
            const sourceContent = await readSourceCode(lovableProjectId, token);
            if (sourceContent) {
              await registerBrainOutput(
                sc, project.user_id as string, lovableProjectId,
                project.id as string, runningTask.id as string,
                (runningTask as any).brain_type || "code", sourceContent
              );
            }

            await sc.from("orchestrator_tasks").update({
              status: "completed", completed_at: new Date().toISOString(),
            }).eq("id", runningTask.id);

            await addLog(sc, project.id as string,
              `✅ [tick] Task #${taskIdx} completed (${completion.reason}) after ${Math.round(elapsed / 1000)}s`, "info",
              { task_index: taskIdx, reason: completion.reason, markdown_sync: syncResult }, runningTask.id as string);
            tickLog.push(`→ [exec] ${projId8}: task #${taskIdx} ✅ (${completion.reason})`);
            anyCompleted = true;
          } else {
            allDone = false;
            tickLog.push(`→ [exec] ${projId8}: task #${taskIdx} ⏳ (${Math.round(elapsed / 1000)}s)`);
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

          const { count: pendingCount } = await sc
            .from("orchestrator_tasks")
            .select("id", { count: "exact", head: true })
            .eq("project_id", project.id)
            .eq("status", "pending");

          const { count: stillRunning } = await sc
            .from("orchestrator_tasks")
            .select("id", { count: "exact", head: true })
            .eq("project_id", project.id)
            .eq("status", "running");

          if ((pendingCount || 0) === 0 && (stillRunning || 0) === 0) {
            await sc.from("orchestrator_projects").update({
              status: "completed",
              current_task_index: completedCount || 0,
              quality_score: 100,
              next_tick_at: null,
            }).eq("id", project.id);

            await addLog(sc, project.id as string,
              `🎉 [tick] All ${completedCount} tasks completed — finalizing!`, "info");
            tickLog.push(`→ [exec] ${projId8}: ✅ all done!`);

            await autoCapture(sc, project.id as string, lovableProjectId, project.user_id as string);
            processed++;
          } else {
            await sc.from("orchestrator_projects").update({
              status: "paused",
              current_task_index: completedCount || 0,
              next_tick_at: new Date(Date.now() + (allDone ? 5_000 : INTER_TASK_DELAY_MS)).toISOString(),
            }).eq("id", project.id);
            processed++;
          }
        } else {
          skipped++;
        }
      } catch (e) {
        const errMsg = (e as Error).message;
        await addLog(sc, project.id as string,
          `❌ [tick] EXCEPTION: ${errMsg}`, "error",
          { error: errMsg, stack: (e as Error).stack?.slice(0, 200) });
        tickLog.push(`→ [exec] ${projId8}: ❌ ${errMsg.slice(0, 60)}`);
      }
    }

    // ═══════════════════════════════════════════════════════
    // PHASE 2: Process "paused" projects — dispatch next task(s)
    // ═══════════════════════════════════════════════════════
    const MAX_PARALLEL = 3;
    const now = new Date().toISOString();
    const { data: pausedProjects, error: pauseErr } = await sc
      .from("orchestrator_projects")
      .select("*")
      .eq("status", "paused")
      .or(`next_tick_at.is.null,next_tick_at.lte.${now}`)
      .limit(5);

    if (pauseErr) {
      console.error("[tick] Failed to fetch paused projects:", pauseErr.message);
    }

    for (const project of (pausedProjects || [])) {
      const projId8 = (project.id as string).slice(0, 8);
      try {
        const { count: runningCount } = await sc
          .from("orchestrator_tasks")
          .select("id", { count: "exact", head: true })
          .eq("project_id", project.id)
          .eq("status", "running");

        const currentRunning = runningCount || 0;
        const slotsAvailable = MAX_PARALLEL - currentRunning;

        const { data: allTasks } = await sc
          .from("orchestrator_tasks")
          .select("id, task_index, title, status, brain_type, depends_on, prompt, phase")
          .eq("project_id", project.id)
          .order("task_index", { ascending: true });

        const completedIndexes = new Set(
          (allTasks || []).filter(t => t.status === "completed").map(t => t.task_index as number)
        );

        const pendingTasks = (allTasks || [])
          .filter(t => t.status === "pending")
          .filter(t => {
            const deps = (t.depends_on as number[]) || [];
            return deps.every(d => completedIndexes.has(d));
          })
          .slice(0, Math.max(slotsAvailable, 1));

        if (!pendingTasks || pendingTasks.length === 0) {
          if (currentRunning > 0) {
            await sc.from("orchestrator_projects").update({
              status: "executing",
              next_tick_at: new Date(Date.now() + 5_000).toISOString(),
            }).eq("id", project.id);
            tickLog.push(`→ [paused] ${projId8}: ${currentRunning} running → executing`);
            skipped++;
            continue;
          }

          const { count: failedCount } = await sc
            .from("orchestrator_tasks")
            .select("id", { count: "exact", head: true })
            .eq("project_id", project.id)
            .eq("status", "failed");

          if ((failedCount || 0) > 0) {
            await sc.from("orchestrator_projects").update({ status: "failed" }).eq("id", project.id);
            tickLog.push(`→ [paused] ${projId8}: failed`);
            processed++;
            continue;
          }

          // All done!
          await sc.from("orchestrator_projects").update({
            status: "completed",
            current_task_index: project.total_tasks as number,
            quality_score: 100,
          }).eq("id", project.id);
          tickLog.push(`→ [paused] ${projId8}: ✅ all done!`);
          processed++;

          await autoCapture(sc, project.id as string, project.lovable_project_id as string, project.user_id as string);
          continue;
        }

        // Dispatch tasks
        const tasksToDispatch = slotsAvailable > 0 ? pendingTasks.slice(0, slotsAvailable) : [pendingTasks[0]];
        let anySuccess = false;
        let anyBackoff = false;

        for (const nextTask of tasksToDispatch) {
          // Enrich review tasks with file inventory
          if ((nextTask as any).brain_type === "review") {
            const { data: ciriusPrj } = await sc.from("cirius_projects")
              .select("source_files_json")
              .eq("orchestrator_project_id", project.id)
              .maybeSingle();
            const filesMap = (ciriusPrj?.source_files_json || {}) as Record<string, string>;
            const fileList = Object.keys(filesMap);
            if (fileList.length > 0) {
              const fileSummary = fileList.map(f => `- ${f} (${filesMap[f].length} chars)`).join("\n");
              const enrichedPrompt = (nextTask as any).prompt + `\n\n--- CURRENT PROJECT FILES (${fileList.length} files) ---\n${fileSummary}\n\nReview ALL these files holistically.`;
              await sc.from("orchestrator_tasks").update({ prompt: enrichedPrompt }).eq("id", nextTask.id);
            }
          }

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
          const execData = await execRes.json().catch(() => ({})) as Record<string, unknown>;

          if (execRes.status === 503) {
            anyBackoff = true;
            tickLog.push(`→ [paused] ${projId8}: no accounts for #${nextTask.task_index} → backoff`);
            break;
          } else if (execRes.status >= 400) {
            tickLog.push(`→ [paused] ${projId8}: dispatch #${nextTask.task_index} failed (${execRes.status})`);
          } else {
            anySuccess = true;
            tickLog.push(`→ [paused] ${projId8}: dispatched #${nextTask.task_index} ✅`);
          }
        }

        if (anySuccess) {
          processed++;
        } else if (anyBackoff) {
          await sc.from("orchestrator_projects").update({
            next_tick_at: new Date(Date.now() + 30_000).toISOString(),
          }).eq("id", project.id);
          skipped++;
        } else {
          skipped++;
        }
      } catch (e) {
        const errMsg = (e as Error).message;
        await addLog(sc, project.id as string,
          `❌ [tick] EXCEPTION in paused: ${errMsg}`, "error");
        tickLog.push(`→ [paused] ${projId8}: ❌ ${errMsg.slice(0, 60)}`);
      }
    }

    const tickDuration = Date.now() - tickStartMs;
    return json({
      ok: true,
      tick_duration_ms: tickDuration,
      processed,
      skipped,
      log: tickLog,
    });
  } catch (err) {
    console.error("[tick] Fatal error:", err);
    return json({ error: "Internal error", details: (err as Error).message }, 500);
  }
});
