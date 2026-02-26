import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-clf-token",
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
    const clfToken = req.headers.get("x-clf-token") || "";
    const licenseKey = body.licenseKey
      || (clfToken.startsWith("CLF1.") ? clfToken : null);

    if (!licenseKey?.startsWith("CLF1.")) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find license
    const { data: license } = await supabase
      .from("licenses")
      .select("id, user_id, tenant_id, active, expires_at, daily_messages, plan_id")
      .eq("key", licenseKey)
      .eq("active", true)
      .maybeSingle();

    if (!license) {
      return new Response(JSON.stringify({ ok: false, error: "License not found or inactive" }), {
        status: 403, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }

    // Check expiry
    if (license.expires_at && new Date(license.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ ok: false, error: "License expired" }), {
        status: 403, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }

    // Increment daily usage using the DB function
    const today = new Date().toISOString().split("T")[0];
    const { data: usedToday } = await supabase.rpc("increment_daily_usage", {
      p_license_id: license.id,
      p_date: today,
    });

    return new Response(JSON.stringify({ ok: true, usedToday: usedToday || 0 }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" }
    });
  }
});
