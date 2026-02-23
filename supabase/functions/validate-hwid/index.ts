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
    const { licenseKey, hwid } = body;

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

    // Tenta coluna "key" (schema renomeado)
    let license: any = null;

    const { data: d1, error: e1 } = await supabase
      .from("licenses")
      .select("*")
      .eq("key", licenseKey)
      .maybeSingle();

    console.log("[validate-hwid] busca por 'key':", d1 ? "ENCONTRADO" : "não encontrado", e1?.message);

    if (d1) {
      license = d1;
    } else {
      // Tenta coluna "token" (schema original)
      const { data: d2, error: e2 } = await supabase
        .from("licenses")
        .select("*")
        .eq("token", licenseKey)
        .maybeSingle();

      console.log("[validate-hwid] busca por 'token':", d2 ? "ENCONTRADO" : "não encontrado", e2?.message);
      if (d2) license = d2;
    }

    if (!license) {
      // Log das primeiras linhas da tabela para diagnóstico
      const { data: sample } = await supabase
        .from("licenses")
        .select("id, key, token, active, is_active, plan, expires_at")
        .limit(3);
      console.log("[validate-hwid] amostra da tabela licenses:", JSON.stringify(sample));

      return new Response(
        JSON.stringify({ valid: false, error: "License not found or inactive" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[validate-hwid] licença encontrada, id:", license.id);

    // Verifica ativo (tenta as duas variações)
    const isActive = license.active ?? license.is_active ?? true;
    if (!isActive) {
      return new Response(
        JSON.stringify({ valid: false, error: "License inactive" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verifica expiração
    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ valid: false, error: "License expired" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // HWID: registra no primeiro uso, verifica nos seguintes
    if (hwid) {
      if (!license.hwid) {
        await supabase.from("licenses").update({ hwid }).eq("id", license.id);
        console.log("[validate-hwid] hwid registrado pela primeira vez");
      } else if (license.hwid !== hwid) {
        console.log("[validate-hwid] hwid mismatch");
        return new Response(
          JSON.stringify({ valid: false, error: "Device not authorized" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Busca perfil
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("user_id", license.user_id)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        valid: true,
        plan: {
          expires_at: license.expires_at,
          plan: license.plan,
          plan_type: license.plan_type,
          daily_messages: license.daily_messages,
          hourly_limit: license.hourly_limit,
        },
        name: profile?.name ?? null,
        email: profile?.email ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[validate-hwid] erro:", err);
    return new Response(
      JSON.stringify({ valid: false, error: "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
