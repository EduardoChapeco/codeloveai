import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * api-key-router — unified key management + routing
 *
 * Actions (admin CRUD via service role + routing via internal call):
 *  POST { action: "get", provider }          → best available key
 *  POST { action: "list_all" }               → all keys (admin)
 *  POST { action: "add", provider, label, key_encrypted, extra_config?, daily_limit?, monthly_limit?, notes? }
 *  POST { action: "toggle", id, is_active }  → activate/deactivate
 *  POST { action: "delete", id }             → hard delete
 *  POST { action: "update_usage", id, tokens_used? } → increment counters
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
        .from("api_keys")
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
        .from("api_keys")
        .insert({ provider, label, key_encrypted, extra_config: extra_config || {}, daily_limit: daily_limit || null, monthly_limit: monthly_limit || null, notes: notes || null })
        .select()
        .single();
      if (error) throw error;
      return json({ key: data });
    }

    if (action === "toggle") {
      const { id, is_active } = body;
      const { error } = await sc.from("api_keys").update({ is_active }).eq("id", id as string);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "delete") {
      const { error } = await sc.from("api_keys").delete().eq("id", body.id as string);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "update_usage") {
      const { id, tokens_used = 0 } = body as { id: string; tokens_used?: number };
      const { data: k } = await sc.from("api_keys").select("requests_today,requests_month,tokens_today,tokens_month").eq("id", id).single();
      if (k) {
        await sc.from("api_keys").update({
          requests_today:  (k.requests_today  || 0) + 1,
          requests_month:  (k.requests_month  || 0) + 1,
          tokens_today:    (k.tokens_today    || 0) + (tokens_used as number),
          tokens_month:    (k.tokens_month    || 0) + (tokens_used as number),
          last_used_at:    new Date().toISOString(),
        }).eq("id", id);
      }
      return json({ ok: true });
    }

    // ── Default action: "get" — pick best key for provider ─────
    const provider = (body.provider as string) || "";
    if (!provider) return json({ error: "provider required" }, 400);

    // Reset daily counters for stale keys
    await sc.rpc("reset_api_key_daily_counters").catch(() => null);

    const { data: keys, error: keysErr } = await sc
      .from("api_keys")
      .select("id,key_encrypted,extra_config,daily_limit,monthly_limit,requests_today,requests_month")
      .eq("provider", provider)
      .eq("is_active", true)
      .order("requests_today", { ascending: true });

    if (keysErr) throw keysErr;
    if (!keys || keys.length === 0) {
      return json({ error: `Nenhuma chave ativa para ${provider}. Configure em Admin > Integrações.` }, 404);
    }

    // Filter within limits
    const available = keys.filter(k => {
      const dayOk = !k.daily_limit   || k.requests_today  < k.daily_limit;
      const monOk = !k.monthly_limit || k.requests_month < k.monthly_limit;
      return dayOk && monOk;
    });

    if (available.length === 0) {
      return json({
        error: `Todas as chaves de ${provider} atingiram o limite. Adicione mais chaves em Admin > Integrações ou aguarde o reset diário.`,
        provider,
        total_keys: keys.length,
        rate_limited: true,
      }, 429);
    }

    const chosen = available[0];

    // Increment optimistically
    await sc.from("api_keys").update({
      requests_today:  chosen.requests_today  + 1,
      requests_month:  chosen.requests_month  + 1,
      last_used_at:    new Date().toISOString(),
    }).eq("id", chosen.id);

    return json({
      id:           chosen.id,
      key:          chosen.key_encrypted,
      extra_config: chosen.extra_config || {},
    });

  } catch (e) {
    console.error("[api-key-router]", e);
    return json({ error: (e as Error).message }, 500);
  }
});
