import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateTypeId } from "../_shared/crypto.ts";
import { logExtensionUsage, hashLicenseKey } from "../_shared/usage-logger.ts";
import { guardClient } from "../_shared/client-guard.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-clf-token, x-starble-sig",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API = "https://api.lovable.dev";
const GIT_SHA     = "3d7a3673c6f02b606137a12ddc0ab88f6b775113";
// ANTI_Q removed — no text injection in standard proxy

function genUUID() { return crypto.randomUUID(); }
function genAiMsgId() {
  return generateTypeId("aimsg");
}

function decodeCLF1(token: string): Record<string, unknown> | null {
  if (!token?.startsWith("CLF1.")) return null;
  try {
    const parts = token.split(".");
    if (parts.length < 3) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    b64 += "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(b64));
  } catch { return null; }
}

async function validateLicense(licenseKey: string): Promise<boolean> {
  if (!licenseKey?.startsWith("CLF1.")) return false;
  const payload = decodeCLF1(licenseKey);
  if (!payload) return false;
  const now = Date.now();
  const expMs = typeof payload.exp === "number"
    ? (payload.exp > 1e12 ? payload.exp : payload.exp * 1000) : 0;
  if (expMs > 0 && expMs < now) return false;
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { data } = await supabase
      .from("licenses").select("active, expires_at")
      .eq("key", licenseKey).single();
    if (data?.active === false) return false;
    if (data?.expires_at && new Date(data.expires_at).getTime() < now) return false;
  } catch { /* trust local decode */ }
  return true;
}

/** Resolve user from Supabase JWT */
async function resolveJwtUser(authHeader: string) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  if (token.startsWith("CLF1.")) return null; // not a JWT
  try {
    const sc = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: { user }, error } = await sc.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch { return null; }
}

/** Resolve the user's active CLF1 license key from DB */
async function resolveUserLicense(userId: string): Promise<string | null> {
  try {
    const sc = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { data } = await sc
      .from("licenses")
      .select("key")
      .eq("user_id", userId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.key || null;
  } catch { return null; }
}

/** Handle management actions (save-token, delete-token, refresh-token, route-based proxy) */
async function handleManagementAction(body: Record<string, unknown>, userId: string) {
  const sc = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
  const action = body.action as string | undefined;

  if (action === "save-token") {
    const token = body.token as string;
    const refreshToken = body.refreshToken as string | undefined;
    const lovableEmail = body.lovableEmail as string | undefined;
    if (!token) return { error: "Token obrigatório", status: 400 };
    const encrypted = token; // already handled by previous flow
    
    // Try to extract email from Firebase JWT
    let detectedEmail = lovableEmail || null;
    if (!detectedEmail) {
      try {
        const parts = token.split(".");
        if (parts.length >= 2) {
          let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
          b64 += "=".repeat((4 - (b64.length % 4)) % 4);
          const payload = JSON.parse(atob(b64));
          detectedEmail = payload.email || null;
        }
      } catch { /* ignore */ }
    }

    const row: Record<string, unknown> = {
      user_id: userId,
      token_encrypted: encrypted,
      status: "active",
      updated_at: new Date().toISOString(),
    };
    if (refreshToken) row.refresh_token_encrypted = refreshToken;
    if (detectedEmail) row.lovable_email = detectedEmail;
    
    const { data: existing } = await sc.from("lovable_accounts").select("id").eq("user_id", userId).maybeSingle();
    if (existing) {
      await sc.from("lovable_accounts").update(row).eq("user_id", userId);
    } else {
      await sc.from("lovable_accounts").insert(row);
    }
    return { ok: true, lovable_email: detectedEmail };
  }

  if (action === "delete-token") {
    await sc.from("lovable_accounts").delete().eq("user_id", userId);
    return { ok: true };
  }

  if (action === "refresh-token") {
    const { data: acct } = await sc.from("lovable_accounts")
      .select("refresh_token_encrypted").eq("user_id", userId).maybeSingle();
    if (!acct?.refresh_token_encrypted) return { error: "Nenhum refresh token salvo", status: 400 };
    const firebaseKey = Deno.env.get("FIREBASE_API_KEY");
    if (!firebaseKey) return { error: "Firebase API Key não configurada", status: 500 };
    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${firebaseKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${acct.refresh_token_encrypted}`,
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error?.message || "Falha ao renovar", status: 502 };
    await sc.from("lovable_accounts").update({
      token_encrypted: data.id_token,
      refresh_token_encrypted: data.refresh_token,
      status: "active",
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
    return { ok: true, token: data.id_token };
  }

  // Route-based proxy (workspaces, projects, etc.)
  if (body.route) {
    const { data: acct } = await sc.from("lovable_accounts")
      .select("token_encrypted, refresh_token_encrypted, status")
      .eq("user_id", userId)
      .maybeSingle();

    if (!acct?.token_encrypted || acct.status !== "active") {
      return { error: "Conta Lovable não conectada. Vá em Lovable Connect.", status: 401 };
    }

    const method = (body.method as string) || "GET";
    const url = `${LOVABLE_API}${body.route}`;

    const callLovable = async (authToken: string) => {
      const fetchOpts: RequestInit = {
        method,
        headers: {
          "Authorization": `Bearer ${authToken}`,
          "Content-Type": "application/json",
          "X-Client-Git-SHA": GIT_SHA,
          "Origin": "https://lovable.dev",
          "Referer": "https://lovable.dev/",
        },
      };
      if (body.payload && method !== "GET") fetchOpts.body = JSON.stringify(body.payload);
      const res = await fetch(url, fetchOpts);
      const data = await res.json().catch(() => ({}));
      return { res, data };
    };

    let { res, data } = await callLovable(acct.token_encrypted);

    // Auto refresh expired Lovable token and retry once
    if ((res.status === 401 || res.status === 403) && acct.refresh_token_encrypted) {
      const firebaseKey = Deno.env.get("FIREBASE_API_KEY");
      if (firebaseKey) {
        const refreshRes = await fetch(`https://securetoken.googleapis.com/v1/token?key=${firebaseKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(acct.refresh_token_encrypted)}`,
        });

        if (refreshRes.ok) {
          const refreshed = await refreshRes.json().catch(() => ({}));
          const newToken = refreshed.id_token || refreshed.access_token;
          if (newToken) {
            await sc.from("lovable_accounts").update({
              token_encrypted: newToken,
              ...(refreshed.refresh_token ? { refresh_token_encrypted: refreshed.refresh_token } : {}),
              status: "active",
              updated_at: new Date().toISOString(),
            }).eq("user_id", userId);

            const retried = await callLovable(newToken);
            res = retried.res;
            data = retried.data;
          }
        }
      }
    }

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { error: "Token Lovable expirado. Reconecte sua conta.", status: 401, isTokenExpired: true };
      }
      return { error: data.message || `Lovable API error ${res.status}`, status: res.status, details: data };
    }

    return data;
  }

  return { error: "Ação desconhecida", status: 400 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Validate client signature — block unauthorized extensions/tools
  const clientBlock = await guardClient(req);
  if (clientBlock) return clientBlock;

  const startTime = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const authHeader = req.headers.get("authorization") || "";
    const clfHeader  = req.headers.get("x-clf-token") || "";

    // --- Path 1: Supabase JWT auth (from web app) ---
    const jwtUser = await resolveJwtUser(authHeader);
    if (jwtUser) {
      const action = body.action as string | undefined;
      const isManagement = action || body.route;
      
      if (isManagement) {
        const result = await handleManagementAction(body, jwtUser.id);
        const status = (result as any).status || 200;
        delete (result as any).status;
        return new Response(JSON.stringify(result), {
          status, headers: { ...CORS, "Content-Type": "application/json" }
        });
      }

      // Message sending via JWT - resolve CLF1 from user's license
      const licenseKey = await resolveUserLicense(jwtUser.id);
      if (!licenseKey) {
        return new Response(JSON.stringify({ error: "Nenhuma licença ativa encontrada. Ative um plano." }), {
          status: 403, headers: { ...CORS, "Content-Type": "application/json" }
        });
      }
      // Fall through to message sending with resolved license
      body._resolvedUserId = jwtUser.id;
      body._resolvedLicenseKey = licenseKey;
    }

    // --- Path 2: CLF1 token auth (from extensions) ---
    const licenseKey = body._resolvedLicenseKey
      || body.licenseKey
      || clfHeader
      || (authHeader.startsWith("Bearer CLF1.") ? authHeader.slice(7) : null);

    if (!licenseKey) {
      return new Response(JSON.stringify({ error: "Autenticação obrigatória. Faça login ou forneça CLF1 token." }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }

    const valid = await validateLicense(licenseKey);
    if (!valid) {
      return new Response(JSON.stringify({ error: "Licença inativa ou expirada" }), {
        status: 403, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }

    const message   = body.message   || body.task;
    const projectId = body.projectId || body.project_id;
    const token     = body.token;

    if (!message || !projectId) {
      return new Response(JSON.stringify({ error: "message (ou task) e projectId (ou project_id) são obrigatórios" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }
    if (!token) {
      return new Response(JSON.stringify({ error: "Token Lovable (body.token) não informado. Capture em lovable.dev." }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }

    const aiMsgId = body.aiMsgId || genAiMsgId();
    const msgId   = body.msgId   || genUUID();

    const lovableBody = {
      id:               msgId,
      message:          message,
      intent:           "security_fix_v2",
      chat_only:        false,
      ai_message_id:    aiMsgId,
      thread_id:        "main",
      view:             null,
      view_description: null,
      model:            null,
      session_replay:   "[]",
      client_logs:      [],
      network_requests: [],
      runtime_errors:   body.runtime_errors || [],
      files:            body.files || [],
      integration_metadata: {
        browser: { preview_viewport_width: 1280, preview_viewport_height: 854 }
      },
    };

    const lovableRes = await fetch(`${LOVABLE_API}/projects/${projectId}/chat`, {
      method: "POST",
      headers: {
        "Authorization":    `Bearer ${token}`,
        "Content-Type":     "application/json",
        "X-Client-Git-SHA": GIT_SHA,
        "Origin":           "https://lovable.dev",
        "Referer":          "https://lovable.dev/",
      },
      body: JSON.stringify(lovableBody),
    });

    const lovableData = await lovableRes.json().catch(() => ({}));

    if (!lovableRes.ok) {
      return new Response(JSON.stringify({
        ok: false, lovable_status: lovableRes.status, details: lovableData
      }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const resolvedUserId = body._resolvedUserId
      || (decodeCLF1(licenseKey)?.sub as string)
      || (decodeCLF1(licenseKey)?.user_id as string)
      || "unknown";

    logExtensionUsage({
      userId: resolvedUserId,
      functionName: "lovable-proxy",
      projectId: projectId,
      licenseKeyHash: hashLicenseKey(licenseKey),
      ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "",
      userAgent: req.headers.get("user-agent") || "",
      responseStatus: lovableRes.ok ? 200 : lovableRes.status,
      durationMs: Date.now() - startTime,
    });

    return new Response(JSON.stringify({
      ok: true, status: lovableRes.status, aiMsgId, msgId, lovable: lovableData
    }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[lovable-proxy] Internal error:", (err as Error).message);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" }
    });
  }
});
