import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateTypeId } from "../_shared/crypto.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-clf-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API = "https://api.lovable.dev";
const GIT_SHA     = "3d7a3673c6f02b606137a12ddc0ab88f6b775113";
const ANTI_Q      = "IMPORTANTE: Não faça perguntas, não peça confirmação, não liste planos. Execute diretamente. Se houver ambiguidade, escolha a opção mais segura e execute.\n\n";

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json().catch(() => ({}));

    const authHeader = req.headers.get("authorization") || "";
    const clfHeader  = req.headers.get("x-clf-token") || "";
    const licenseKey = body.licenseKey
      || clfHeader
      || (authHeader.startsWith("Bearer CLF1.") ? authHeader.slice(7) : null)
      || (authHeader.startsWith("Bearer ") && authHeader.slice(7).startsWith("CLF1.") ? authHeader.slice(7) : null);

    if (!licenseKey) {
      return new Response(JSON.stringify({ error: "CLF1 token obrigatório via x-clf-token, Authorization ou body.licenseKey" }), {
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
      message:          ANTI_Q + message,
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

    return new Response(JSON.stringify({
      ok: true, status: lovableRes.status, aiMsgId, msgId, lovable: lovableData
    }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" }
    });
  }
});
