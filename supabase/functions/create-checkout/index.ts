import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLANS: Record<string, { title: string; price: number; days: number }> = {
  "1_day": { title: "CodeLove AI - 1 Dia", price: 9.99, days: 1 },
  "7_days": { title: "CodeLove AI - 7 Dias", price: 49.9, days: 7 },
  "1_month": { title: "CodeLove AI - 1 Mês", price: 149.9, days: 30 },
  "12_months": { title: "CodeLove AI - 12 Meses (Ilimitado)", price: 499.0, days: 365 },
};

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
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const userEmail = claimsData.claims.email;

    const { plan, affiliate_code } = await req.json();

    // Validate plan input
    const validPlans = ["1_day", "7_days", "1_month", "12_months"];
    if (!plan || typeof plan !== "string" || !validPlans.includes(plan)) {
      return new Response(JSON.stringify({ error: "Plano inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const planData = PLANS[plan];
    let finalPrice = planData.price;
    let discountApplied = 0;

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Auto-detect: check if user IS an affiliate and apply their own discount
    const { data: ownAffiliate } = await serviceClient
      .from("affiliates")
      .select("affiliate_code, discount_percent")
      .eq("user_id", userId)
      .maybeSingle();

    let validAffiliateCode: string | null = null;

    if (ownAffiliate) {
      // User is an affiliate — auto-apply their discount
      discountApplied = ownAffiliate.discount_percent;
      finalPrice = Math.round(planData.price * (1 - discountApplied / 100) * 100) / 100;
      validAffiliateCode = ownAffiliate.affiliate_code;
    }

    // 2. If an external affiliate_code is provided (referral), validate it
    if (!ownAffiliate && affiliate_code && typeof affiliate_code === "string") {
      const sanitizedCode = affiliate_code.replace(/[^A-Za-z0-9]/g, "").substring(0, 20);

      const { data: aff } = await serviceClient
        .from("affiliates")
        .select("affiliate_code, user_id, discount_percent")
        .eq("affiliate_code", sanitizedCode)
        .maybeSingle();

      if (aff && aff.user_id !== userId) {
        validAffiliateCode = aff.affiliate_code;
        // Referral affiliate codes don't give discount to buyer (only commission to affiliate)
      }
    }

    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Configuração de pagamento inválida" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawOrigin = req.headers.get("origin");
    const allowedOrigins = ["https://codeloveai.lovable.app", "https://id-preview--804f123e-068a-44af-90b4-2843ed8e7d2a.lovable.app"];
    const origin = rawOrigin && allowedOrigins.some(o => rawOrigin.startsWith(o)) ? rawOrigin : "https://codeloveai.lovable.app";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const webhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;

    const preference = {
      items: [
        {
          title: planData.title,
          quantity: 1,
          unit_price: finalPrice,
          currency_id: "BRL",
        },
      ],
      external_reference: JSON.stringify({
        user_id: userId, plan, email: userEmail,
        affiliate_code: validAffiliateCode,
      }),
      back_urls: {
        success: `${origin}/dashboard?payment=success`,
        failure: `${origin}/dashboard?payment=failure`,
        pending: `${origin}/dashboard?payment=pending`,
      },
      auto_return: "approved",
      notification_url: webhookUrl,
      statement_descriptor: "CODELOVE AI",
    };

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preference),
    });

    if (!mpResponse.ok) {
      console.error("Mercado Pago error:", await mpResponse.text());
      return new Response(JSON.stringify({ error: "Erro ao criar checkout" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mpData = await mpResponse.json();

    return new Response(
      JSON.stringify({ 
        init_point: mpData.init_point,
        discount_applied: discountApplied,
        final_price: finalPrice,
        original_price: planData.price,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Checkout error:", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
