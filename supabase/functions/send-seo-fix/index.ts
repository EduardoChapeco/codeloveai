import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function makeAiMessageId(): string {
  return `aimsg_${crypto.randomUUID().replace(/-/g, "").slice(0, 26)}`;
}

function sanitizeFiles(files: unknown): unknown[] {
  return Array.isArray(files) ? files : [];
}

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
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { licenseKey, hwid, token, projectId, prompt, files, messageId, aiMessageId, runtimeErrors } = body as Record<string, unknown>;

    if (!licenseKey || !token || !projectId || !prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof token !== "string" || token.length < 20) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof projectId !== "string" || !isUuid(projectId)) {
      return new Response(JSON.stringify({ error: "Invalid projectId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const licenseCheck = await validateLicense(adminClient, String(licenseKey), typeof hwid === "string" ? hwid : "");
    if (!licenseCheck.valid) {
      return new Response(JSON.stringify({ error: licenseCheck.error }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      id: typeof messageId === "string" && messageId ? messageId : crypto.randomUUID(),
      message: prompt.trim(),
      intent: "security_fix_v2",
      chat_only: false,
      ai_message_id: typeof aiMessageId === "string" && aiMessageId ? aiMessageId : makeAiMessageId(),
      thread_id: "main",
      view: "security",
      view_description: "The user is currently viewing the security view for their project.",
      model: null,
      files: sanitizeFiles(files),
      optimisticImageUrls: [],
      selected_elements: [],
      debug_mode: false,
      session_replay: "[]",
      client_logs: [],
      network_requests: [],
      runtime_errors: Array.isArray(runtimeErrors) ? runtimeErrors : [],
      integration_metadata: {
        browser: {
          preview_viewport_width: 1280,
          preview_viewport_height: 854,
        },
      },
    };

    const res = await fetch(`https://api.lovable.dev/projects/${projectId}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Origin: "https://lovable.dev",
        Referer: "https://lovable.dev/",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("Lovable API error (send-seo-fix):", res.status, errText);
      return new Response(JSON.stringify({ error: "Upstream API error", status: res.status }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json().catch(() => ({}));
    return new Response(JSON.stringify({ success: true, messageId: payload.id, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-seo-fix error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
