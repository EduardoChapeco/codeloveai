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
    const { licenseKey, hwid } = await req.json();

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

    // Busca pela coluna "key" (nome atual após renomeação)
    // Tenta as duas variações do nome da coluna para garantir compatibilidade
    let license = null;
    let fetchError = null;

    // Tentativa 1: coluna "key" (schema mais recente)
    const res1 = await supabase
      .from("licenses")
      .select("*")
      .eq("key", licenseKey)
      .single();

    if (!res1.error && res1.data) {
      license = res1.data;
    } else {
      // Tentativa 2: coluna "token" (schema antigo)
      const res2 = await supabase
        .from("licenses")
        .select("*")
        .eq("token", licenseKey)
        .single();

      if (!res2.error && res2.data) {
        license = res2.data;
      } else {
        fetchError = res2.error;
      }
    }

    // Log para diagnóstico (remover após confirmar funcionamento)
    console.log("licenseKey recebido:", licenseKey?.slice(0, 30) + "...");
    console.log("license encontrada:", license ? "SIM" : "NÃO");
    console.log("fetchError:", fetchError?.message);

    if (!license) {
      return new Response(
        JSON.stringify({ valid: false, error: "License not found or inactive" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verifica se está ativa (tenta as duas variações do nome da coluna)
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
        // Primeiro uso — registra o hwid
        await supabase
          .from("licenses")
          .update({ hwid })
          .eq("id", license.id);
        license.hwid = hwid;
        console.log("HWID registrado pela primeira vez:", hwid);
      } else if (license.hwid !== hwid) {
        // HWID diferente — dispositivo não autorizado
        console.log("HWID mismatch. Esperado:", license.hwid, "Recebido:", hwid);
        return new Response(
          JSON.stringify({ valid: false, error: "Device not authorized. Contact support." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Busca dados do perfil do usuário
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("user_id", license.user_id)
      .single();

    // Retorna sucesso
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
        name: profile?.name || null,
        email: profile?.email || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("validate-hwid error:", err);
    return new Response(
      JSON.stringify({ valid: false, error: "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
