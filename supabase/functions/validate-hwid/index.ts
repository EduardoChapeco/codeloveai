import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json().catch(() => ({}));
    const licenseKey = body.licenseKey || body.token || body.key;
    const hwid       = body.hwid || "unknown";

    if (!licenseKey?.startsWith("CLF1.")) {
      return new Response(JSON.stringify({ valid: false, error: "Token inválido" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }

    const payload = decodeCLF1(licenseKey);
    if (!payload) {
      return new Response(JSON.stringify({ valid: false, error: "Token malformado" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }

    const now   = Date.now();
    const expMs = typeof payload.exp === "number"
      ? (payload.exp > 1e12 ? payload.exp : payload.exp * 1000)
      : 0;

    if (expMs > 0 && expMs < now) {
      return new Response(JSON.stringify({ valid: false, error: "Licença expirada" }), {
        status: 200, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let dbRecord: Record<string, unknown> | null = null;
    try {
      const { data, error } = await supabase
        .from("licenses")
        .select("*")
        .eq("key", licenseKey)
        .single();
      if (!error && data) dbRecord = data;
    } catch { /* table may not exist */ }

    if (dbRecord?.active === false) {
      return new Response(JSON.stringify({ valid: false, error: "Licença inativa" }), {
        status: 200, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }

    const planObj = {
      planName:   "Chat Booster",
      type:       "messages",
      dailyLimit: dbRecord?.daily_messages ?? 999,
      expires_at: dbRecord?.expires_at ?? (expMs > 0 ? new Date(expMs).toISOString() : null),
    };

    return new Response(JSON.stringify({
      valid:  true,
      name:   payload.name ?? payload.email ?? "Usuário",
      email:  payload.email ?? "",
      uid:    payload.uid ?? "",
      plan:   planObj,
      exp:    expMs || null,
    }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ valid: false, error: err.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" }
    });
  }
});
