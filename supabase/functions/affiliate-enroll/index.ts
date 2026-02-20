import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateAffiliateCode(name: string): string {
  const clean = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .substring(0, 10);
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${clean || "aff"}${rand}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const userEmail = claimsData.claims.email;

    const body = await req.json();
    const displayName = (body.display_name || userEmail?.split("@")[0] || "Afiliado")
      .substring(0, 50)
      .replace(/[<>"'&]/g, "");

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if user is already an affiliate
    const { data: existing } = await serviceClient
      .from("affiliates")
      .select("id, affiliate_code")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: "Você já é um afiliado!", affiliate_code: existing.affiliate_code }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check user has an active subscription (requirement to become affiliate)
    const { data: activeSub } = await serviceClient
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1);

    if (!activeSub || activeSub.length === 0) {
      return new Response(JSON.stringify({ error: "Você precisa ter uma assinatura ativa para se tornar afiliado." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate unique affiliate code
    let affiliateCode = generateAffiliateCode(displayName);
    let attempts = 0;
    while (attempts < 5) {
      const { data: codeExists } = await serviceClient
        .from("affiliates")
        .select("id")
        .eq("affiliate_code", affiliateCode)
        .maybeSingle();
      if (!codeExists) break;
      affiliateCode = generateAffiliateCode(displayName);
      attempts++;
    }

    // Create affiliate record
    const { data: newAffiliate, error: insertError } = await serviceClient
      .from("affiliates")
      .insert({
        user_id: userId,
        affiliate_code: affiliateCode,
        display_name: displayName,
        discount_percent: 20,
      })
      .select("id, affiliate_code, display_name, discount_percent")
      .single();

    if (insertError) {
      console.error("Affiliate insert error:", insertError);
      return new Response(JSON.stringify({ error: "Erro ao criar conta de afiliado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Add affiliate role
    await serviceClient.from("user_roles").insert({
      user_id: userId,
      role: "affiliate",
    });

    // Create codecoins wallet
    await serviceClient.from("codecoins").insert({
      user_id: userId,
      balance: 0,
      total_earned: 0,
      total_spent: 0,
    });

    // Notify admin
    await serviceClient.from("admin_notifications").insert({
      type: "new_affiliate",
      title: "Novo afiliado cadastrado",
      description: `${userEmail || userId} se cadastrou como afiliado. Código: ${affiliateCode}`,
      user_id: userId,
    });

    return new Response(JSON.stringify({
      status: "created",
      affiliate: newAffiliate,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Affiliate enrollment error:", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
