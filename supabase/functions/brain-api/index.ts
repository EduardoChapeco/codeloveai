/**
 * brain-api — Public API for Brain access (orchestrator/editor/external consumers)
 *
 * Supported actions:
 *   send, capture, review, refine
 *
 * Auth modes:
 *   - User JWT (Authorization: Bearer <access_token>)
 *   - Internal server-to-server (x-orchestrator-internal: true + x-admin-secret)
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-orchestrator-internal, x-admin-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API = "https://api.lovable.dev";
const GIT_SHA = "3d7a3673c6f02b606137a12ddc0ab88f6b775113";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

async function lovFetch(url: string, token: string, init: RequestInit = {}) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Origin: "https://lovable.dev",
    Referer: "https://lovable.dev/",
    "X-Client-Git-SHA": GIT_SHA,
    ...(init.headers as Record<string, string> || {}),
  };

  if (["POST", "PUT", "PATCH"].includes((init.method || "GET").toUpperCase()) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(url, { ...init, headers });
}

async function refreshLovableToken(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
  refreshToken: string,
) {
  const fbKey = Deno.env.get("FIREBASE_API_KEY");
  if (!fbKey) return null;

  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${fbKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
  });
  if (!res.ok) return null;

  const payload = await res.json().catch(() => null);
  const newToken = payload?.id_token || payload?.access_token;
  if (!newToken) return null;

  await serviceClient
    .from("lovable_accounts")
    .update({
      token_encrypted: newToken,
      ...(payload?.refresh_token ? { refresh_token_encrypted: payload.refresh_token } : {}),
    })
    .eq("user_id", userId)
    .eq("status", "active");

  return newToken as string;
}

async function getActiveLovableToken(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
) {
  const { data: account } = await serviceClient
    .from("lovable_accounts")
    .select("token_encrypted, refresh_token_encrypted")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  let token = account?.token_encrypted?.trim() || "";
  if (!token) return null;

  const probe = await lovFetch(`${LOVABLE_API}/user/workspaces`, token, { method: "GET" });
  if (probe.ok) return token;

  if ((probe.status === 401 || probe.status === 403) && account?.refresh_token_encrypted) {
    const refreshed = await refreshLovableToken(serviceClient, userId, account.refresh_token_encrypted);
    if (!refreshed) return null;

    const check = await lovFetch(`${LOVABLE_API}/user/workspaces`, refreshed, { method: "GET" });
    if (check.ok) return refreshed;
    return null;
  }

  return null;
}

async function getBrainProjectId(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
  brainId?: string,
) {
  let query = serviceClient
    .from("user_brain_projects")
    .select("id, lovable_project_id, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (brainId) query = query.eq("id", brainId);

  const { data } = await query.maybeSingle();
  if (!data || data.status !== "active" || !data.lovable_project_id || data.lovable_project_id === "creating") {
    return null;
  }

  return data.lovable_project_id as string;
}

async function captureLatest(projectId: string, lovableToken: string) {
  const res = await lovFetch(`${LOVABLE_API}/projects/${projectId}/chat/latest-message`, lovableToken, {
    method: "GET",
  });

  if (!res.ok) {
    return { ok: false, status: res.status, error: `capture_failed_${res.status}` };
  }

  const payload = await res.json().catch(() => null);
  const content =
    payload?.content ||
    payload?.message ||
    payload?.text ||
    payload?.data?.content ||
    payload?.data?.message ||
    null;

  return {
    ok: true,
    content,
    raw: payload,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "Server configuration error" }, 500);
  }

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const action = typeof body?.action === "string" ? body.action : "send";
  const isInternal = req.headers.get("x-orchestrator-internal") === "true";

  let userId: string | null = null;

  if (isInternal) {
    const expectedSecret = Deno.env.get("CODELOVE_ADMIN_SECRET") || "";
    const providedSecret = req.headers.get("x-admin-secret") || "";
    const internalUserId = typeof body?._internal_user_id === "string" ? body._internal_user_id.trim() : "";

    if (!expectedSecret || providedSecret !== expectedSecret || !isUuid(internalUserId)) {
      return json({ error: "Unauthorized" }, 401);
    }

    userId = internalUserId;
  } else {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user?.id) return json({ error: "Unauthorized" }, 401);
    userId = user.id;
  }

  if (!userId) return json({ error: "Unauthorized" }, 401);

  const serviceClient = createClient(supabaseUrl, serviceKey);

  const lovableToken = await getActiveLovableToken(serviceClient, userId);
  if (!lovableToken) {
    return json({ error: "Lovable token unavailable", code: "no_token" }, 503);
  }

  const brainId = typeof body?.brain_id === "string" ? body.brain_id.trim() : "";
  const projectId = await getBrainProjectId(serviceClient, userId, brainId || undefined);

  if (!projectId) {
    return json({ error: "Brain inactive or not found", code: "brain_inactive" }, 404);
  }

  if (action === "capture") {
    const captured = await captureLatest(projectId, lovableToken);
    if (!captured.ok) {
      return json({ error: "Capture failed", code: "capture_failed" }, 502);
    }

    return json({
      project_id: projectId,
      response: captured.content,
      data: captured.raw,
    });
  }

  let task = "";
  if (action === "refine") {
    task = typeof body?.message === "string" ? body.message : (typeof body?.prompt === "string" ? body.prompt : "");
  } else if (action === "review") {
    const projectName = typeof body?.project_name === "string" ? body.project_name.trim() : "projeto";
    const projectRef = typeof body?.project_id === "string" ? body.project_id.trim() : "não informado";
    task = `Faça um code review técnico completo do projeto \"${projectName}\" (id: ${projectRef}). Retorne: problemas críticos, riscos, correções sugeridas e checklist final.`;
  } else {
    task = typeof body?.message === "string" ? body.message : "";
  }

  task = task.trim();
  if (!task || task.length > 10000) {
    return json({ error: "Invalid message" }, 400);
  }

  const venusRes = await fetch(`${supabaseUrl}/functions/v1/venus-chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      task,
      project_id: projectId,
      mode: "task",
      lovable_token: lovableToken,
      files: Array.isArray(body?.files) ? body.files : [],
    }),
  });

  const venusPayload = await venusRes.json().catch(() => ({}));
  if (!venusRes.ok || !venusPayload?.ok) {
    return json({ error: "Brain send failed", details: venusPayload }, 502);
  }

  return json({
    ok: true,
    action,
    project_id: projectId,
    result: venusPayload,
  });
});
