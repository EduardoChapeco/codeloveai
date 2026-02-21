import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-tenant-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
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

    let userId: string;
    let userEmail: string;

    try {
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      if (!claimsError && claimsData?.claims) {
        userId = claimsData.claims.sub;
        userEmail = claimsData.claims.email;
      } else {
        throw new Error("getClaims failed");
      }
    } catch {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
      userEmail = user.email || "";
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { plan_id, period, affiliate_wl_code, payment_method } = body;

    // Validate plan_id (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!plan_id || typeof plan_id !== "string" || !uuidRegex.test(plan_id)) {
      return new Response(JSON.stringify({ error: "Plano inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate period
    const validPeriods = ["monthly", "yearly"];
    const selectedPeriod = validPeriods.includes(period) ? period : "monthly";

    // Fetch plan
    const { data: plan, error: planError } = await serviceClient
      .from("white_label_plans")
      .select("*")
      .eq("id", plan_id)
      .eq("is_active", true)
      .maybeSingle();

    if (planError || !plan) {
      return new Response(JSON.stringify({ error: "Plano não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate prices
    const setupPriceCents = plan.setup_is_free ? 0 : (plan.setup_price_cents || 0);
    const subscriptionPriceCents = selectedPeriod === "yearly" && plan.yearly_price_cents
      ? plan.yearly_price_cents
      : plan.monthly_price_cents;

    const totalCents = setupPriceCents + subscriptionPriceCents;
    const totalBRL = totalCents / 100;

    if (totalBRL <= 0) {
      return new Response(JSON.stringify({ error: "Valor do plano inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate affiliate WL code (optional)
    let validAffiliateWlCode: string | null = null;
    if (affiliate_wl_code && typeof affiliate_wl_code === "string") {
      const sanitizedCode = affiliate_wl_code.replace(/[^A-Za-z0-9]/g, "").substring(0, 30);
      const { data: wlAff } = await serviceClient
        .from("white_label_affiliates")
        .select("id, code, user_id")
        .eq("code", sanitizedCode)
        .eq("is_active", true)
        .maybeSingle();

      if (wlAff && wlAff.user_id !== userId) {
        validAffiliateWlCode = wlAff.code;
      }
    }

    // Check for MP access token
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

    const externalReference = JSON.stringify({
      type: "white_label",
      user_id: userId,
      email: userEmail,
      wl_plan_id: plan_id,
      period: selectedPeriod,
      setup_price_cents: setupPriceCents,
      subscription_price_cents: subscriptionPriceCents,
      affiliate_wl_code: validAffiliateWlCode,
    });

    // Build items
    const items = [];
    if (setupPriceCents > 0) {
      items.push({
        title: `Setup White Label: ${plan.name}`,
        quantity: 1,
        unit_price: setupPriceCents / 100,
        currency_id: "BRL",
      });
    }
    items.push({
      title: `White Label ${plan.name} (${selectedPeriod === "yearly" ? "Anual" : "Mensal"})`,
      quantity: 1,
      unit_price: subscriptionPriceCents / 100,
      currency_id: "BRL",
    });

    // ===== PIX DIRECT PAYMENT =====
    if (payment_method === "pix") {
      console.log(`Creating PIX payment for WL plan ${plan.name}, user ${userId}, total: R$${totalBRL}`);

      const pixPayload = {
        transaction_amount: totalBRL,
        description: `White Label ${plan.name} (${selectedPeriod})`,
        payment_method_id: "pix",
        payer: {
          email: userEmail || `user-${userId.substring(0, 8)}@codelove.ai`,
        },
        external_reference: externalReference,
        notification_url: webhookUrl,
      };

      const pixResponse = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "X-Idempotency-Key": `wl-${userId}-${plan_id}-${Date.now()}`,
        },
        body: JSON.stringify(pixPayload),
        signal: AbortSignal.timeout(90000),
      });

      const contentType = pixResponse.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        const textResponse = await pixResponse.text();
        console.error("MP PIX returned non-JSON:", textResponse.substring(0, 200));
        return new Response(JSON.stringify({ error: "Erro ao gerar PIX. Tente novamente." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let pixData;
      try {
        pixData = await pixResponse.json();
      } catch {
        return new Response(JSON.stringify({ error: "Resposta inválida do gateway" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!pixResponse.ok) {
        console.error("MP PIX error:", pixResponse.status, JSON.stringify(pixData).substring(0, 500));
        return new Response(JSON.stringify({ error: "Erro ao criar pagamento PIX" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const transactionData = pixData.point_of_interaction?.transaction_data;
      const pixCode = transactionData?.qr_code || pixData.pix_copy_paste || pixData.qr_code_text;
      const pixQrBase64 = transactionData?.qr_code_base64 || null;
      const ticketUrl = transactionData?.ticket_url || pixData.ticket_url || null;

      return new Response(
        JSON.stringify({
          payment_method: "pix",
          pix_code: pixCode || null,
          pix_qr_base64: pixQrBase64,
          ticket_url: ticketUrl,
          payment_id: pixData.id,
          total_brl: totalBRL,
          plan_name: plan.name,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== STANDARD CHECKOUT (redirect) =====
    const preference = {
      items,
      external_reference: externalReference,
      back_urls: {
        success: `${origin}/admin-global?wl_payment=success`,
        failure: `${origin}/admin-global?wl_payment=failure`,
        pending: `${origin}/admin-global?wl_payment=pending`,
      },
      auto_return: "approved",
      notification_url: webhookUrl,
      statement_descriptor: "WHITE LABEL CODELOVE",
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
        total_brl: totalBRL,
        plan_name: plan.name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("WL Checkout error:", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
