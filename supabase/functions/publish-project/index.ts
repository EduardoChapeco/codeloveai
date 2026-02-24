import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function validateLicense(adminClient: ReturnType<typeof createClient>, licenseKey: string, hwid: string) {
  const { data: license } = await adminClient
    .from("licenses")
    .select("key, plan, expires_at, active, device_id")
    .eq("key", licenseKey)
    .eq("active", true)
    .maybeSingle();

  if (!license) return { valid: false, error: "License not found or inactive" };
  if (new Date(license.expires_at) < new Date()) return { valid: false, error: "License expired" };

  if (hwid && license.device_id && license.device_id !== hwid) {
    return { valid: false, error: "Device not authorized" };
  }
  if (hwid && !license.device_id) {
    await adminClient.from("licenses").update({ device_id: hwid }).eq("key", licenseKey);
  }

  return { valid: true, plan: license.plan };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { licenseKey, hwid, token, projectId } = await req.json();

    if (!licenseKey || !token || !projectId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const licenseCheck = await validateLicense(adminClient, licenseKey, hwid || "");
    if (!licenseCheck.valid) {
      return new Response(JSON.stringify({ error: licenseCheck.error }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch(`https://api.lovable.dev/projects/${projectId}/deployments?async=true`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Origin: "https://lovable.dev",
        Referer: "https://lovable.dev/",
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Lovable API error:", res.status, errText);
      return new Response(JSON.stringify({ error: "Upstream API error", status: res.status }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    return new Response(JSON.stringify({ success: true, data }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("publish-project error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
