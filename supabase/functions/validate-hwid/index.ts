import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    // Aceita licenseKey, token ou key — a extensão pode enviar qualquer um
    const licenseKey = body.licenseKey || body.token || body.key;
    const hwid = body.hwid;

    console.log("[validate-hwid] licenseKey recebido:", licenseKey?.slice(0, 40));
    console.log("[validate-hwid] hwid recebido:", hwid);

    if (!licenseKey || !licenseKey.startsWith("CLF1.")) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid license key format" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── BUSCA NA TABELA ───────────────────────────────────────────────────
    // Schema atual: coluna "key" (migration 20260223163000 aplicada)
    // Fallback: coluna "token" (schema original) — tentamos as duas
    let license: any = null;

    const { data: d1, error: e1 } = await supabase
      .from("licenses")
      .select("id, key, user_id, plan, plan_type, created_at, expires_at, active, device_id, last_validated_at, daily_messages, hourly_limit")
      .eq("key", licenseKey)
      .maybeSingle();

    console.log("[validate-hwid] busca por 'key':", d1 ? "ENCONTRADO" : "não encontrado", e1?.message);

    if (d1) {
      license = d1;
    } else {
      // Tenta coluna "token" (schema original sem migration)
      const { data: d2, error: e2 } = await supabase
        .from("licenses")
        .select("id, key, user_id, plan, plan_type, created_at, expires_at, active, device_id, last_validated_at, daily_messages, hourly_limit")
        .eq("token", licenseKey)
        .maybeSingle();

      console.log("[validate-hwid] busca por 'token':", d2 ? "ENCONTRADO" : "não encontrado", e2?.message);
      if (d2) license = d2;
    }

    if (!license) {
      console.log("[validate-hwid] licença não encontrada para key:", licenseKey?.slice(0, 40));
      return new Response(
        JSON.stringify({ valid: false, error: "License not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[validate-hwid] licença encontrada, id:", license.id);

    // ── VERIFICA ACTIVE ───────────────────────────────────────────────────
    const isActive = license.active ?? license.is_active ?? true;
    if (!isActive) {
      return new Response(
        JSON.stringify({ valid: false, error: "License inactive" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── VERIFICA EXPIRAÇÃO ────────────────────────────────────────────────
    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ valid: false, error: "License expired" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── HWID / DEVICE_ID ──────────────────────────────────────────────────
    // CORREÇÃO: a coluna real é "device_id", não "hwid"
    if (hwid) {
      if (!license.device_id) {
        // Primeiro uso — registrar o device
        const { error: updateErr } = await supabase
          .from("licenses")
          .update({ device_id: hwid, last_validated_at: new Date().toISOString() })
          .eq("id", license.id);

        if (updateErr) {
          console.log("[validate-hwid] erro ao registrar device_id:", updateErr.message);
        } else {
          console.log("[validate-hwid] device_id registrado pela primeira vez");
        }
      } else if (license.device_id !== hwid) {
        console.log("[validate-hwid] device_id mismatch — esperado:", license.device_id, "recebido:", hwid);
        return new Response(
          JSON.stringify({ valid: false, error: "Device not authorized" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Device já conhecido — atualizar last_validated_at
        await supabase
          .from("licenses")
          .update({ last_validated_at: new Date().toISOString() })
          .eq("id", license.id);
      }
    }

    // ── BUSCA PERFIL ──────────────────────────────────────────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("user_id", license.user_id)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        valid: true,
        plan: {
          expires_at:     license.expires_at,
          plan:           license.plan,
          plan_type:      license.plan_type,
          daily_messages: license.daily_messages,
          hourly_limit:   license.hourly_limit,
        },
        name:  profile?.name  ?? null,
        email: profile?.email ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[validate-hwid] erro inesperado:", err);
    return new Response(
      JSON.stringify({ valid: false, error: "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
