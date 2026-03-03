import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "content-type, x-clf-token, authorization, apikey, x-client-info",
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
  if (!licenseKey) return json({ ok: false, error: "Missing x-clf-token" }, 401);

  const { data: license } = await supabase
    .from("licenses")
    .select("id, plan, status, expires_at")
    .eq("key", licenseKey)
    .eq("active", true)
    .maybeSingle();

  if (!license) return json({ ok: false, error: "Licença inválida ou inativa." }, 401);

  const now = new Date();
  if (license.status !== "active" && license.status !== "trial") {
    return json({ ok: false, error: "Licença inválida ou inativa." }, 401);
  }
  if (license.expires_at && new Date(license.expires_at) < now) {
    return json({ ok: false, error: "Licença expirada." }, 401);
  }

  // --- Parse body ---
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const action = body.action as string;

  // --- Actions ---
  if (action === "validate_license") {
    return json({
      ok: true,
      valid: true,
      plan: license.plan,
      expires_at: license.expires_at,
    });
  }

  if (action === "upsert_account") {
    const email = (body.email as string) || null;
    const refreshToken = body.refresh_token as string;
    if (!refreshToken) return json({ error: "refresh_token is required" }, 400);

    const row = {
      license_key: licenseKey,
      email,
      uid: (body.uid as string) || null,
      label: (body.label as string) || email || null,
      access_token: (body.access_token as string) || null,
      refresh_token: refreshToken,
      brain_project_id: (body.brain_project_id as string) || null,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (email) {
      // Upsert by (license_key, email)
      const { data, error } = await supabase
        .from("client_accounts")
        .upsert(row, { onConflict: "license_key,email" })
        .select("id")
        .single();

      if (error) {
        console.error("upsert error:", error.message);
        return json({ ok: false, error: "Failed to save account" }, 500);
      }
      return json({ ok: true, id: data.id });
    } else {
      // No email — deduplicate by refresh_token tail (last 16 chars)
      const tail = refreshToken.slice(-16);
      const { data: existing } = await supabase
        .from("client_accounts")
        .select("id")
        .eq("license_key", licenseKey)
        .is("email", null)
        .filter("refresh_token", "like", `%${tail}`)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("client_accounts")
          .update(row)
          .eq("id", existing.id);
        if (error) {
          console.error("update error:", error.message);
          return json({ ok: false, error: "Failed to update account" }, 500);
        }
        return json({ ok: true, id: existing.id });
      } else {
        const { data, error } = await supabase
          .from("client_accounts")
          .insert(row)
          .select("id")
          .single();
        if (error) {
          console.error("insert error:", error.message);
          return json({ ok: false, error: "Failed to save account" }, 500);
        }
        return json({ ok: true, id: data.id });
      }
    }
  }

  return json({ error: "Unknown action" }, 400);
});
