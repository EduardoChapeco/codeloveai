// speed-chat v5.0.0 — CLF1-only auth (no admin token, no Firebase)
// Clone exato do lovable-proxy

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateTypeId } from "../_shared/crypto.ts";
import { logExtensionUsage, hashLicenseKey } from "../_shared/usage-logger.ts";

const LOVABLE_API = "https://api.lovable.dev";
const GIT_SHA = "3d7a3673c6f02b606137a12ddc0ab88f6b775113";

// ANTI_QUESTION_PREFIX removed — no text injection in standard chat

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-clf-token, x-clf-extension, x-speed-client",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function makeAiMsgId(): string {
  return generateTypeId("aimsg");
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getUserTokenFromAccount(adminClient: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  const { data } = await adminClient
    .from("lovable_accounts")
    .select("token_encrypted")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1);
  return data?.[0]?.token_encrypted?.trim() || null;
}

async function resolveLovableToken(req: Request, body: Record<string, unknown>): Promise<string | null> {
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

  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    try {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (!userError && user?.id) {
        const byUser = await getUserTokenFromAccount(adminClient, user.id);
        if (byUser) return byUser;
      }
    } catch { /* ignore */ }
  }

  const headerClf = (req.headers.get("x-clf-token") || "").trim();
  const bodyClf = (
    (body.licenseKey as string) ||
    (body.clf_license as string) ||
    (body.clfToken as string) ||
    ""
  ).trim();
  const clf = headerClf.startsWith("CLF1.") ? headerClf : bodyClf.startsWith("CLF1.") ? bodyClf : "";

  if (clf) {
    const { data: licenseRows } = await adminClient
      .from("licenses")
      .select("user_id")
      .eq("key", clf)
      .eq("active", true)
      .limit(1);

    const licenseUserId = licenseRows?.[0]?.user_id;
    if (licenseUserId) {
      const byLicenseUser = await getUserTokenFromAccount(adminClient, String(licenseUserId));
      if (byLicenseUser) return byLicenseUser;
    }
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const startTime = Date.now();
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }

  const task = ((body.task as string) || (body.message as string) || "").trim();
  const projectId = ((body.project_id as string) || (body.projectId as string) || "").trim();
  const runtimeErrors = Array.isArray(body.runtime_errors) ? body.runtime_errors : [];
  const view = body.view ?? null;
  const viewDescription = body.view_description ?? null;

  if (!task) return json({ ok: false, error: "task/message is required" }, 400);
  if (!projectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId))
    return json({ ok: false, error: "project_id invalid (UUID expected)" }, 400);

  const lovableToken = await resolveLovableToken(req, body);
  if (!lovableToken) return json({ ok: false, error: "Token não encontrado. Envie CLF1 via x-clf-token header ou autentique via JWT." }, 401);

  const msgId = crypto.randomUUID();
  const aiMsgId = makeAiMsgId();

  const payload = {
    id: msgId,
    message: task,
    intent: "security_fix_v2",
    chat_only: false,
    ai_message_id: aiMsgId,
    thread_id: "main",
    view, view_description: viewDescription,
    model: null, session_replay: "[]",
    client_logs: [], network_requests: [],
    runtime_errors: runtimeErrors,
    integration_metadata: { browser: { preview_viewport_width: 1280, preview_viewport_height: 854 } },
  };

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
    console.error("[speed-chat] Network error:", e);
    return json({ ok: false, error: "Connection failed" }, 502);
  }

  const lovableBody = await lovableRes.text().catch(() => "");
  let lovableJson: unknown = null;
  try { lovableJson = JSON.parse(lovableBody); } catch { lovableJson = lovableBody; }

  if (lovableRes.ok) {
    // Log usage
    logExtensionUsage({
      userId: "speed-user",
      functionName: "speed-chat",
      projectId: projectId,
      ipAddress: req.headers.get("x-forwarded-for") || "",
      userAgent: req.headers.get("user-agent") || "",
      responseStatus: lovableRes.status,
      durationMs: Date.now() - startTime,
    });
    return json({ ok: true, status: lovableRes.status, lovable_response: lovableJson, messageId: msgId, aiMessageId: aiMsgId });
  }
  return json({ ok: false, error: `Lovable API returned ${lovableRes.status}`, lovable_status: lovableRes.status, details: lovableJson },
    lovableRes.status >= 500 ? 502 : lovableRes.status);
});
