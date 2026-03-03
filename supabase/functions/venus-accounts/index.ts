import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "content-type, x-clf-token, authorization, apikey, x-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // --- Auth: validate license from header ---
  const licenseKey = req.headers.get("x-clf-token") || "";
  if (!licenseKey || !licenseKey.startsWith("CLF1.")) {
    return json({ ok: false, error: "Missing or invalid x-clf-token" }, 401);
  }

  const { data: license } = await supabase
    .from("licenses")
    .select("id, plan, status, expires_at")
    .eq("key", licenseKey)
    .eq("active", true)
    .maybeSingle();

  if (!license) return json({ ok: false, error: "license_invalid" }, 401);

  const now = new Date();
  if (license.status !== "active" && license.status !== "trial") {
    return json({ ok: false, error: "license_invalid" }, 401);
  }
  if (license.expires_at && new Date(license.expires_at) < now) {
    return json({ ok: false, error: "license_expired" }, 403);
  }

  // --- Parse body ---
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const action = body.action as string;

  // ── validate_license ──
  if (action === "validate_license") {
    return json({
      ok: true,
      plan: license.plan,
      expires_at: license.expires_at,
    });
  }

  // ── upsert_account ──
  if (action === "upsert_account") {
    const email = (body.email as string) || null;
    const uid = (body.uid as string) || null;
    const refreshToken = body.refresh_token as string;
    if (!refreshToken) return json({ error: "refresh_token is required" }, 400);

    const row = {
      license_key: licenseKey,
      email,
      uid,
      label: (body.label as string) || email || uid || null,
      access_token: (body.access_token as string) || null,
      refresh_token: refreshToken,
      brain_project_id: (body.brain_project_id as string) || null,
      updated_at: new Date().toISOString(),
    };

    // Try upsert by email first, then by uid
    if (email) {
      const { data: existing } = await supabase
        .from("venus_client_accounts")
        .select("id")
        .eq("license_key", licenseKey)
        .eq("email", email)
        .maybeSingle();

      if (existing) {
        await supabase.from("venus_client_accounts").update(row).eq("id", existing.id);
        return json({ ok: true, id: existing.id });
      }
    }

    if (uid) {
      const { data: existing } = await supabase
        .from("venus_client_accounts")
        .select("id")
        .eq("license_key", licenseKey)
        .eq("uid", uid)
        .maybeSingle();

      if (existing) {
        await supabase.from("venus_client_accounts").update(row).eq("id", existing.id);
        return json({ ok: true, id: existing.id });
      }
    }

    // No existing match — insert new
    const { data, error } = await supabase
      .from("venus_client_accounts")
      .insert(row)
      .select("id")
      .single();

    if (error) {
      console.error("insert error:", error.message);
      return json({ ok: false, error: "Failed to save account" }, 500);
    }
    return json({ ok: true, id: data.id });
  }

  // ── list_accounts ──
  if (action === "list_accounts") {
    const { data: accounts, error } = await supabase
      .from("venus_client_accounts")
      .select("id, email, uid, label, brain_project_id, updated_at, access_token")
      .eq("license_key", licenseKey)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("list error:", error.message);
      return json({ ok: false, error: "Failed to list accounts" }, 500);
    }

    // Mask access_token — only show last 8 chars
    const masked = (accounts || []).map((a: Record<string, unknown>) => ({
      id: a.id,
      email: a.email,
      uid: a.uid,
      label: a.label,
      brain_project_id: a.brain_project_id,
      updated_at: a.updated_at,
      access_token_preview: typeof a.access_token === "string" && a.access_token.length > 8
        ? "…" + a.access_token.slice(-8)
        : null,
    }));

    return json({ ok: true, accounts: masked });
  }

  // ── refresh_tokens (batch) ──
  if (action === "refresh_tokens") {
    const firebaseKey = Deno.env.get("FIREBASE_API_KEY");
    if (!firebaseKey) return json({ ok: false, error: "Firebase key not configured" }, 500);

    const { data: stale } = await supabase
      .from("venus_client_accounts")
      .select("id, refresh_token")
      .eq("license_key", licenseKey)
      .lt("updated_at", new Date(Date.now() - 45 * 60 * 1000).toISOString())
      .limit(20);

    let refreshed = 0;
    for (const account of stale || []) {
      try {
        const res = await fetch(
          `https://securetoken.googleapis.com/v1/token?key=${firebaseKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(account.refresh_token)}`,
          }
        );
        if (!res.ok) continue;
        const data = await res.json();
        if (data.access_token) {
          await supabase
            .from("venus_client_accounts")
            .update({
              access_token: data.access_token,
              refresh_token: data.refresh_token || account.refresh_token,
              updated_at: new Date().toISOString(),
            })
            .eq("id", account.id);
          refreshed++;
        }
      } catch {
        // skip failed refreshes silently
      }
    }

    return json({ ok: true, refreshed });
  }

  return json({ error: "Unknown action" }, 400);
});
