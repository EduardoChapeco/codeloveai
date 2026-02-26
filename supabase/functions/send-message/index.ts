import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateTypeId } from "../_shared/crypto.ts";
import { logExtensionUsage, hashLicenseKey } from "../_shared/usage-logger.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-clf-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API = "https://api.lovable.dev";
const GIT_SHA     = "3d7a3673c6f02b606137a12ddc0ab88f6b775113";
const ANTI_Q      = "IMPORTANTE: Não faça perguntas, não peça confirmação, não liste planos. Execute diretamente. Se houver ambiguidade, escolha a opção mais segura e execute.\n\n";

function genUUID(): string {
  return crypto.randomUUID();
}

function genAiMsgId(): string {
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
  } catch {
    return null;
  }
}

async function verifyCLF1Signature(token: string): Promise<boolean> {
  const secret = Deno.env.get("CLF_TOKEN_SECRET");
  if (!secret) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "CLF1") return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(parts[1]));
    const computed = btoa(String.fromCharCode(...new Uint8Array(sig)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return computed === parts[2];
  } catch { return false; }
}

async function validateLicense(licenseKey: string): Promise<boolean> {
  if (!licenseKey?.startsWith("CLF1.")) return false;
  // Verify HMAC signature first — reject forged tokens
  const sigValid = await verifyCLF1Signature(licenseKey);
  if (!sigValid) return false;
  const payload = decodeCLF1(licenseKey);
  if (!payload) return false;
  const now = Date.now();
  const expMs = typeof payload.exp === "number"
    ? (payload.exp > 1e12 ? payload.exp : payload.exp * 1000)
    : 0;
  if (expMs > 0 && expMs < now) return false;
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { data, error } = await supabase
      .from("licenses")
      .select("active, expires_at, status")
      .eq("key", licenseKey)
      .single();
    // SECURITY: license MUST exist in DB — reject unknown tokens
    if (error || !data) return false;
    if (!data.active) return false;
    if (data.status === "suspended") return false;
    if (data.expires_at && new Date(data.expires_at).getTime() < now) return false;
    return true;
  } catch {
    // SECURITY: fail closed — deny on error
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const startTime = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const {
      token,
      projectId,
      message,
      msgId,
      aiMsgId: clientAiMsgId,
      files = [],
      licenseKey,
    } = body;

    const authHeader = req.headers.get("authorization") || req.headers.get("x-clf-token") || "";
    const licKey = licenseKey
      || (authHeader.startsWith("Bearer CLF1.") ? authHeader.slice(7) : null)
      || (authHeader.startsWith("CLF1.") ? authHeader : null);

    if (!licKey) {
      return new Response(JSON.stringify({ error: "Licença não informada" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }
    const valid = await validateLicense(licKey);
    if (!valid) {
      return new Response(JSON.stringify({ error: "Licença inativa ou expirada" }), {
        status: 403, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }
    if (!projectId || !message) {
      return new Response(JSON.stringify({ error: "projectId e message são obrigatórios" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }
    if (!token) {
      return new Response(JSON.stringify({ error: "Token Lovable não disponível. Abra o Lovable.dev e tente novamente." }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }

    const finalAiMsgId = clientAiMsgId || genAiMsgId();
    const finalMsgId   = msgId || genUUID();

    const lovableBody = {
      id:               finalMsgId,
      message:          ANTI_Q + message,
      intent:           "security_fix_v2",
      chat_only:        false,
      ai_message_id:    finalAiMsgId,
      thread_id:        "main",
      view:             null,
      view_description: null,
      model:            null,
      session_replay:   "[]",
      client_logs:      [],
      network_requests: [],
      runtime_errors:   [],
      files:            files || [],
      integration_metadata: {
        browser: {
          preview_viewport_width:  1280,
          preview_viewport_height: 854,
        },
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

    if (lovableRes.status === 401) {
      return new Response(JSON.stringify({ error: "Token Lovable expirado. Recarregue o Lovable.dev.", lovable_status: 401 }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }
    if (lovableRes.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit da Lovable. Aguarde alguns segundos.", lovable_status: 429 }), {
        status: 429, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }
    if (!lovableRes.ok) {
      return new Response(JSON.stringify({
        error: `Lovable API error ${lovableRes.status}`,
        lovable_status: lovableRes.status,
        details: lovableData,
      }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // Log usage
    const clfPayload = decodeCLF1(licKey);
    const resolvedUserId = (clfPayload?.sub as string) || (clfPayload?.user_id as string) || "unknown";
    logExtensionUsage({
      userId: resolvedUserId,
      functionName: "send-message",
      projectId: projectId,
      licenseKeyHash: hashLicenseKey(licKey),
      ipAddress: req.headers.get("x-forwarded-for") || "",
      userAgent: req.headers.get("user-agent") || "",
      responseStatus: lovableRes.status,
      durationMs: Date.now() - startTime,
    });

    return new Response(JSON.stringify({
      ok:      true,
      status:  lovableRes.status,
      aiMsgId: finalAiMsgId,
      msgId:   finalMsgId,
      lovable: lovableData,
    }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" }
    });
  }
});
