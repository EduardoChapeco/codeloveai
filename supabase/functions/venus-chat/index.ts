// venus-chat v4.0.0 — JSON Encode Engine
// Supports all modes: task, chat, security, build_error, git, seo, debug, shield, scan, launch, refactor, brain, chain, amplify, upload
// Token resolution: explicit > JWT user > CLF1 license

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateTypeId } from "../_shared/crypto.ts";
import {
  encodeTaskAsViewDesc,
  EXECUTE_CMD,
  MODE_CONFIG,
  buildGitViewPrefix,
  isEncoderEnabled,
  AQ_PREFIX_LEGACY,
  type ModeConfig,
} from "../_shared/task-encoder.ts";

const LOVABLE_API = "https://api.lovable.dev";
const GIT_SHA = "3d7a3673c6f02b606137a12ddc0ab88f6b775113";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-clf-token, x-clf-extension, x-speed-client, x-orchestrator-internal, x-admin-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Helpers ───
function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function makeAiMsgId(): string {
  return generateTypeId("aimsg");
}

const B32 = "0123456789abcdefghjkmnpqrstvwxyz";
function rb32(n: number): string {
  return Array.from({ length: n }, () => B32[Math.floor(Math.random() * 32)]).join("");
}

// ─── Token resolution ───
function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function shouldTreatAsUserJwt(authHeader: string): boolean {
  if (!authHeader.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7).trim();
  if (!token || token.startsWith("CLF1.")) return false;
  const payload = parseJwtPayload(token);
  if (!payload) return true;
  const role = typeof payload.role === "string" ? payload.role : "";
  const sub = typeof payload.sub === "string" ? payload.sub : "";
  if (!sub) return false;
  if (role === "service_role" || role === "anon") return false;
  return true;
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

async function getUserTokenFromAccount(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
): Promise<string | null> {
  const { data } = await adminClient
    .from("lovable_accounts")
    .select("token_encrypted")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1);
  return data?.[0]?.token_encrypted?.trim() || null;
}

async function resolveLovableToken(
  req: Request,
  body: Record<string, unknown>,
): Promise<string | null> {
  const explicit = (
    (body.lovable_token as string) ||
    (body.lovableToken as string) ||
    (body.token as string) ||
    ""
  ).trim();
  if (explicit.length >= 10) return explicit;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return null;

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Internal orchestrator route
  const isInternal = req.headers.get("x-orchestrator-internal") === "true";
  if (isInternal) {
    const expectedSecret = Deno.env.get("CODELOVE_ADMIN_SECRET") || "";
    const providedSecret = req.headers.get("x-admin-secret") || "";
    const internalUserId = typeof body?._internal_user_id === "string" ? body._internal_user_id.trim() : "";
    if (expectedSecret && providedSecret === expectedSecret && isUuid(internalUserId)) {
      const tok = await getUserTokenFromAccount(adminClient, internalUserId);
      if (tok) return tok;
    }
  }

  // JWT user → lovable_accounts
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (shouldTreatAsUserJwt(authHeader)) {
    try {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error } = await userClient.auth.getUser();
      if (!error && user?.id) {
        const tok = await getUserTokenFromAccount(adminClient, user.id);
        if (tok) return tok;
      }
    } catch { /* ignore */ }
  }

  // CLF1 license → user_id → lovable_accounts
  const headerClf = (req.headers.get("x-clf-token") || "").trim();
  const bodyClf = (
    (body.licenseKey as string) ||
    (body.clf_license as string) ||
    (body.clfToken as string) ||
    ""
  ).trim();
  const clf = headerClf.startsWith("CLF1.") ? headerClf : bodyClf.startsWith("CLF1.") ? bodyClf : "";

  if (clf) {
    const { data: rows } = await adminClient
      .from("licenses")
      .select("user_id")
      .eq("key", clf)
      .eq("active", true)
      .limit(1);
    const userId = rows?.[0]?.user_id;
    if (userId) {
      const tok = await getUserTokenFromAccount(adminClient, String(userId));
      if (tok) return tok;
    }
  }

  return null;
}

// ─── Rate limiting ───
async function checkRateLimit(licenseKey: string, action: string, maxPerMinute = 30): Promise<boolean> {
  if (!licenseKey) return true;
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const windowStart = new Date();
    windowStart.setSeconds(0, 0);
    const { data } = await supabase
      .from("venus_rate_limits")
      .upsert(
        { license_key: licenseKey, action, window_start: windowStart.toISOString(), request_count: 1 },
        { onConflict: "license_key,action,window_start" },
      )
      .select("request_count")
      .single();
    if (data && data.request_count > maxPerMinute) return false;
    if (data && data.request_count > 1) return true;
    await supabase.rpc("increment_rate_limit_noop").catch(() => {});
    return true;
  } catch {
    return true;
  }
}

// ─── Image Upload (corrected 3-step flow) ───
async function handleImageUpload(
  fileBase64: string,
  fileName: string,
  fileType: string,
  lovableToken: string,
): Promise<{ ok: boolean; file_id?: string; download_url?: string; error?: string }> {
  let fileBuffer: Uint8Array;
  try {
    fileBuffer = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));
  } catch {
    return { ok: false, error: "Base64 inválido" };
  }

  const uid = crypto.randomUUID();

  // Step 1: generate-upload-url
  let uploadRes: Response;
  try {
    uploadRes = await fetch(`${LOVABLE_API}/files/generate-upload-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableToken}`,
      },
      body: JSON.stringify({
        file_name: uid,
        content_type: fileType || "application/octet-stream",
        status: "uploading",
      }),
    });
  } catch (e) {
    return { ok: false, error: "Upload URL request failed: " + (e as Error).message };
  }

  if (!uploadRes.ok) {
    // Fallback: try legacy generate-download-url for backward compat
    try {
      const ext = fileName.split(".").pop() || "bin";
      const today = new Date().toISOString().split("T")[0].replace(/-/g, "/");
      const dirName = `tool-images/${today}`;
      const gcsName = `${uid}.${ext}`;

      const legacyRes = await fetch(`${LOVABLE_API}/files/generate-download-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableToken}` },
        body: JSON.stringify({ dir_name: dirName, file_name: gcsName }),
      });

      if (legacyRes.ok) {
        const legacyData = await legacyRes.json();
        const legacyUrl = legacyData.url || legacyData.upload_url || legacyData.signed_url;
        if (legacyUrl) {
          let putRes = await fetch(legacyUrl, { method: "PUT", body: fileBuffer });
          if (!putRes.ok && fileType?.startsWith("image/")) {
            await putRes.text().catch(() => {});
            putRes = await fetch(legacyUrl, {
              method: "PUT",
              headers: { "Content-Type": fileType },
              body: fileBuffer,
            });
          }
          if (putRes.ok) {
            await putRes.text().catch(() => {});
            const publicUrl = legacyData.public_url || legacyData.download_url ||
              `https://storage.googleapis.com/gpt-engineer-file-uploads/${dirName}/${gcsName}`;
            return { ok: true, file_id: uid, download_url: publicUrl };
          }
        }
      }
    } catch { /* fallback failed too */ }
    return { ok: false, error: `Upload URL failed: ${uploadRes.status}` };
  }

  const uploadData = await uploadRes.json();
  const signedUploadUrl = uploadData.url || uploadData.upload_url || uploadData.signed_url;
  const fileId = uploadData.file_id || uid;

  if (!signedUploadUrl) {
    return { ok: false, error: "No upload URL returned" };
  }

  // Step 2: PUT binary to GCS
  let putRes = await fetch(signedUploadUrl, {
    method: "PUT",
    headers: { "Content-Type": fileType || "application/octet-stream" },
    body: fileBuffer,
  });

  if (!putRes.ok) {
    await putRes.text().catch(() => {});
    // Retry without Content-Type for GCS signed URL compatibility
    putRes = await fetch(signedUploadUrl, { method: "PUT", body: fileBuffer });
    if (!putRes.ok) {
      return { ok: false, error: `GCS upload failed: ${putRes.status}` };
    }
  }
  await putRes.text().catch(() => {});

  // Step 3: generate-download-url for public reference
  let downloadUrl = "";
  try {
    let userUid = "unknown";
    try {
      const payload = parseJwtPayload(lovableToken);
      userUid = (payload?.user_id as string) || (payload?.sub as string) || "unknown";
    } catch { /* use default */ }

    const dlRes = await fetch(`${LOVABLE_API}/files/generate-download-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableToken}`,
      },
      body: JSON.stringify({ dir_name: userUid, file_name: fileId }),
    });
    if (dlRes.ok) {
      const dlData = await dlRes.json();
      downloadUrl = dlData.url || dlData.download_url || dlData.public_url || "";
    }
  } catch { /* non-critical */ }

  return { ok: true, file_id: fileId, download_url: downloadUrl };
}

// ─── Build view prefix with contextual info ───
function resolveViewPrefix(mode: string, body: Record<string, unknown>, modeConfig: ModeConfig): string {
  if (mode === "git") {
    return buildGitViewPrefix(
      (body.git_branch as string) || "",
      (body.git_sha as string) || "",
    );
  }
  return modeConfig.viewPrefix;
}

// ─── Main handler ───
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const action = ((body.action as string) || "").trim();

  // ─── ACTION: amplify ───
  if (action === "amplify") {
    const message = ((body.message as string) || "").trim();
    const lovableToken = ((body.lovable_token as string) || (body.lovableToken as string) || "").trim();
    const projectId = ((body.project_id as string) || (body.projectId as string) || "").trim();

    if (!message || !lovableToken || !projectId) {
      return json({ error: "message, lovable_token e project_id obrigatórios" }, 400);
    }

    let lastAiMsgId: string | null = null;
    let lastTools = "lov-view, lov-copy, screenshot";

    try {
      const latestRes = await fetch(
        `${LOVABLE_API}/projects/${projectId}/latest-message`,
        { headers: { Authorization: `Bearer ${lovableToken}`, Origin: "https://lovable.dev" } },
      );
      if (latestRes.ok) {
        const latestData = await latestRes.json();
        lastAiMsgId = latestData?.id ?? latestData?.ai_message_id ?? null;
        if (latestData?.tools_executed) lastTools = latestData.tools_executed;
      } else {
        await latestRes.text().catch(() => {});
      }
    } catch { /* use fallback */ }

    const msgId = "usermsg_" + rb32(26);
    const aiMsgId = "aimsg_" + rb32(26);

    const viewDescription = lastAiMsgId
      ? `The Details view shows the full trajectory of agent actions for a message, including thinking content and tool calls. The user is viewing the Timeline tab on the Activity view. This tab shows the agent's step-by-step activity: tool calls, plans, text responses, and errors. Users can expand tool items to see details like file diffs, generated images or videos, browser screenshots, or HITL inputs. Message ID: ${lastAiMsgId}. Tools executed: ${lastTools}.`
      : `The Details view shows the full trajectory of agent actions for a message, including thinking content and tool calls. The user is viewing the Timeline tab on the Activity view.`;

    const amplifyPayload = {
      id: msgId,
      message,
      chat_only: false,
      ai_message_id: aiMsgId,
      thread_id: "main",
      view: "activity",
      view_description: viewDescription,
      model: null,
      session_replay: "[]",
      client_logs: [],
      network_requests: [],
      runtime_errors: [],
      integration_metadata: {
        browser: { preview_viewport_width: 1280, preview_viewport_height: 854, auth_token: lovableToken },
        supabase: { auth_token: lovableToken },
      },
    };

    try {
      const lvRes = await fetch(`${LOVABLE_API}/projects/${projectId}/chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableToken}`,
          "Content-Type": "application/json",
          Origin: "https://lovable.dev",
          Referer: "https://lovable.dev/",
        },
        body: JSON.stringify(amplifyPayload),
      });
      const lvBody = await lvRes.text().catch(() => "");
      if (lvRes.status === 202 || lvRes.ok) {
        return json({ ok: true, msg_id: msgId, ai_msg_id: aiMsgId });
      }
      return json(
        { error: "Lovable retornou " + lvRes.status, detail: lvBody.slice(0, 200) },
        lvRes.status >= 500 ? 502 : lvRes.status,
      );
    } catch (e) {
      return json({ ok: false, error: "Connection failed: " + (e as Error).message }, 502);
    }
  }

  // ─── ACTION: upload ───
  if (action === "upload") {
    const fileBase64 = (body.file_base64 as string) || "";
    const fileName = (body.file_name as string) || "";
    const fileType = (body.file_type as string) || "";
    const lovableToken = ((body.lovable_token as string) || (body.lovableToken as string) || "").trim();

    if (!fileBase64 || !fileName || !lovableToken) {
      return json({ error: "file_base64, file_name e lovable_token obrigatórios" }, 400);
    }

    const result = await handleImageUpload(fileBase64, fileName, fileType, lovableToken);
    if (!result.ok) {
      return json({ error: result.error }, 502);
    }
    return json({ ok: true, public_url: result.download_url, file_id: result.file_id, name: fileName });
  }

  // ─── Standard message flow ───
  const task = ((body.task as string) || (body.message as string) || "").trim();
  const projectId = ((body.project_id as string) || (body.projectId as string) || "").trim();
  const mode = ((body.mode as string) || "task").trim();
  const inlineFiles = Array.isArray(body.files) ? body.files : [];

  if (!task) return json({ ok: false, error: "task/message is required" }, 400);
  if (!projectId || !isUuid(projectId))
    return json({ ok: false, error: "project_id invalid (UUID expected)" }, 400);

  // Resolve token
  const lovableToken = await resolveLovableToken(req, body);
  if (!lovableToken) {
    return json(
      { ok: false, error: "Token não encontrado. Envie CLF1 via x-clf-token ou autentique via JWT." },
      401,
    );
  }

  // Rate limiting
  const headerClf = (req.headers.get("x-clf-token") || "").trim();
  const bodyClf = ((body.licenseKey as string) || (body.clf_license as string) || (body.clfToken as string) || "").trim();
  const rateLimitKey = headerClf.startsWith("CLF1.") ? headerClf : bodyClf.startsWith("CLF1.") ? bodyClf : "";
  if (rateLimitKey) {
    const allowed = await checkRateLimit(rateLimitKey, "message", 30);
    if (!allowed) {
      return json({ ok: false, error: "Rate limit exceeded. Aguarde 1 minuto." }, 429);
    }
  }

  // ─── Resolve mode config ───
  const modeConfig = MODE_CONFIG[mode] || MODE_CONFIG.task;
  const msgId = (body.msgId as string) || crypto.randomUUID();
  const aiMsgId = (body.aiMsgId as string) || makeAiMsgId();

  // ─── Process file uploads ───
  const lovableFiles: Array<{ file_id: string; file_name: string; type: string }> = [];
  const optimisticImageUrls: string[] = [];

  for (const f of inlineFiles) {
    const fileData = (f as Record<string, unknown>).data as string || "";
    const fileName = (f as Record<string, unknown>).name as string || "file";
    const fileType = (f as Record<string, unknown>).content_type as string ||
      (f as Record<string, unknown>).type as string || "application/octet-stream";

    if (fileData && fileData.length > 0) {
      const uploadResult = await handleImageUpload(fileData, fileName, fileType, lovableToken);
      if (uploadResult.ok && uploadResult.file_id) {
        lovableFiles.push({ file_id: uploadResult.file_id, file_name: fileName, type: "user_upload" });
        if (uploadResult.download_url) {
          optimisticImageUrls.push(uploadResult.download_url);
        }
      }
    }
  }

  // ─── Build runtime errors ───
  const runtimeErrors: Array<{ level: string; message: string; file: string; line: number }> = [];

  // From body.runtime_errors (extension-provided)
  if (Array.isArray(body.runtime_errors)) {
    for (const e of body.runtime_errors as Array<Record<string, unknown>>) {
      runtimeErrors.push({
        level: "error",
        message: typeof e.message === "string" ? e.message.slice(0, 500) : "",
        file: (e.source as string) || "unknown",
        line: 1,
      });
    }
  }

  // Git context as runtime error info
  if (mode === "git") {
    const gitBranch = ((body.git_branch as string) || "").trim();
    const gitSha = ((body.git_sha as string) || "").trim();
    if (gitBranch) {
      runtimeErrors.push({
        level: "info",
        message: `GIT_CONTEXT: branch=${gitBranch}${gitSha ? ` sha=${gitSha.slice(0, 7)}` : ""}`,
        file: "venus-extension",
        line: 1,
      });
    }
  }

  // ─── Build payload using JSON Encode Engine ───
  const viewPrefix = resolveViewPrefix(mode, body, modeConfig);
  let payloadMessage: string;
  let payloadViewDescription: string;

  if (modeConfig.useEncoder) {
    // ENCODER: task content → view_description as agent_security finding
    payloadMessage = EXECUTE_CMD;
    payloadViewDescription = encodeTaskAsViewDesc(task, {
      name: (body.task_name as string) || undefined,
      internalId: `venus_${mode}_${Date.now()}`,
      viewPrefix,
    });
  } else {
    // NON-ENCODER: direct message (chat/build modes)
    payloadMessage = task;
    payloadViewDescription = viewPrefix;
  }

  const payload = {
    id: msgId,
    message: payloadMessage,
    intent: modeConfig.intent,
    chat_only: modeConfig.chatOnly,
    ai_message_id: aiMsgId,
    thread_id: "main",
    view: modeConfig.view,
    view_description: payloadViewDescription,
    model: null,
    session_replay: "[]",
    client_logs: [],
    network_requests: [],
    runtime_errors: runtimeErrors,
    files: lovableFiles,
    selected_elements: [],
    optimisticImageUrls,
    debug_mode: false,
    integration_metadata: {
      browser: { preview_viewport_width: 1280, preview_viewport_height: 854 },
    },
  };

  console.log(`[venus-chat] project=${projectId} mode=${mode} encoder=${modeConfig.useEncoder} token_prefix=${lovableToken.slice(0, 20)}...`);

  // Send to Lovable
  let lovableRes: Response;
  try {
    lovableRes = await fetch(`${LOVABLE_API}/projects/${projectId}/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableToken}`,
        "Content-Type": "application/json",
        "X-Client-Git-SHA": GIT_SHA,
        Origin: "https://lovable.dev",
        Referer: "https://lovable.dev/",
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("[venus-chat] Network error:", e);
    return json({ ok: false, error: "Connection to Lovable failed" }, 502);
  }

  const lovableBody = await lovableRes.text().catch(() => "");
  let lovableJson: unknown = null;
  try {
    lovableJson = JSON.parse(lovableBody);
  } catch {
    lovableJson = lovableBody;
  }

  if (lovableRes.status === 401) {
    return json({ ok: false, error: "Token Lovable expirado.", lovable_status: 401 }, 401);
  }
  if (lovableRes.status === 429) {
    return json({ ok: false, error: "Rate limit — aguarde.", lovable_status: 429 }, 429);
  }
  if (!lovableRes.ok) {
    return json(
      {
        ok: false,
        error: `Lovable API returned ${lovableRes.status}`,
        lovable_status: lovableRes.status,
        details: lovableJson,
      },
      lovableRes.status >= 500 ? 502 : lovableRes.status,
    );
  }

  return json({
    ok: true,
    status: lovableRes.status,
    aiMsgId,
    msgId,
    mode_used: mode,
    encoder_used: modeConfig.useEncoder,
    lovable_response: lovableJson,
  });
});
