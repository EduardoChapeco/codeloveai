import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * api-key-router — unified key management + routing
 * Uses table: api_key_vault (not api_keys)
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sc = createClient(supabaseUrl, serviceKey);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body */ }

  const action = (body.action as string) || "get";

  try {
    // ── Admin CRUD ─────────────────────────────────────────────
    if (action === "list_all") {
      const { data, error } = await sc
        .from("api_key_vault")
        .select("*")
        .order("provider")
        .order("created_at");
      if (error) throw error;
      return json({ keys: data });
    }

    if (action === "add") {
      const { provider, label, key_encrypted, extra_config, daily_limit, monthly_limit, notes } = body;
      if (!provider || !label || !key_encrypted) return json({ error: "provider, label and key_encrypted are required" }, 400);
      const { data, error } = await sc
        .from("api_key_vault")
        .insert({
          provider,
          label,
          api_key_encrypted: key_encrypted,
          is_active: true,
        })
        .select()
        .single();
      if (error) throw error;
      return json({ key: data });
    }

    if (action === "toggle") {
      const { id, is_active } = body;
      const { error } = await sc.from("api_key_vault").update({ is_active }).eq("id", id as string);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "delete") {
      const { error } = await sc.from("api_key_vault").delete().eq("id", body.id as string);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "update_usage") {
      const { id } = body as { id: string };
      const { data: k } = await sc.from("api_key_vault")
        .select("requests_count")
        .eq("id", id)
        .single();
      if (k) {
        await sc.from("api_key_vault").update({
          requests_count: (k.requests_count || 0) + 1,
          last_used_at: new Date().toISOString(),
        }).eq("id", id);
      }
      return json({ ok: true });
    }

    // ── Default action: "get" — pick best key for provider ─────
    const provider = (body.provider as string) || "";
    if (!provider) return json({ error: "provider required" }, 400);

    const { data: keys, error: keysErr } = await sc
      .from("api_key_vault")
      .select("id, api_key_encrypted, requests_count")
      .eq("provider", provider)
      .eq("is_active", true)
      .order("requests_count", { ascending: true });

    if (keysErr) throw keysErr;
    if (!keys || keys.length === 0) {
      return json({ error: `Nenhuma chave ativa para ${provider}. Configure em Admin > Integrações.` }, 404);
    }

    const chosen = keys[0];

    // Increment usage
    await sc.from("api_key_vault").update({
      requests_count: (chosen.requests_count || 0) + 1,
      last_used_at: new Date().toISOString(),
    }).eq("id", chosen.id);

    return json({
      id: chosen.id,
      key: chosen.api_key_encrypted,
      extra_config: {},
    });

  } catch (e) {
    console.error("[api-key-router]", e);
    return json({ error: (e as Error).message }, 500);
  }
});
