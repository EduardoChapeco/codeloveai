import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveTenant } from "../_shared/tenant-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-tenant-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CORS_ORIGINS = [
  "https://Starbleai.lovable.app",
  "https://id-preview--804f123e-068a-44af-90b4-2843ed8e7d2a.lovable.app",
];

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

    let userId: string;
    let userEmail: string = "";

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

    // Resolve tenant
    const tenantInfo = await resolveTenant(serviceClient, req, userId);
    const tenantId = tenantInfo.id || tenantInfo.tenant_id;

    const { plan, affiliate_code, payment_method } = await req.json();

    // ── Fetch plan EXCLUSIVELY from DB — no hardcoded fallback ───────────────
    // plan must be a valid UUID referencing the plans table
    if (!plan || typeof plan !== "string") {
      return new Response(JSON.stringify({ error: "Plano inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(plan);
    if (!isUUID) {
      return new Response(JSON.stringify({ error: "ID de plano inválido. Use o UUID do plano." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: dbPlan } = await serviceClient
      .from("plans")
      .select("id, name, price, billing_cycle, type, is_active, is_public")
      .eq("id", plan)
      .maybeSingle();

    if (!dbPlan || !dbPlan.is_active || !dbPlan.is_public) {
      return new Response(JSON.stringify({ error: "Plano não encontrado ou inativo" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Block free/trial plans from paid checkout
    if (dbPlan.type === "trial" || dbPlan.type === "free") {
      return new Response(JSON.stringify({ error: "Este plano é gratuito e não requer checkout" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let days = 30;
    if (dbPlan.billing_cycle === "daily") days = 1;
    if (dbPlan.billing_cycle === "weekly") days = 7;
    if (dbPlan.billing_cycle === "yearly") days = 365;
    if (dbPlan.billing_cycle === "lifetime") days = 3650;

    // price stored in cents in DB — convert to BRL
    const planData = {
      title: dbPlan.name,
      price: dbPlan.price / 100,
      days,
    };
    const selectedPlanId = dbPlan.id;

    let finalPrice = planData.price;
    let discountApplied = 0;

    // 1. Auto-detect: check if user IS an affiliate — only apply discount if they have ≥1 confirmed paying referral
    const { data: ownAffiliate } = await serviceClient
      .from("affiliates")
      .select("id, affiliate_code, discount_percent")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    let validAffiliateCode: string | null = null;

    if (ownAffiliate) {
      // Check if this affiliate has at least 1 confirmed referral (someone who actually paid)
      const { data: confirmedReferrals } = await serviceClient
        .from("affiliate_referrals")
        .select("id")
        .eq("affiliate_id", ownAffiliate.id)
        .eq("confirmed", true)
        .limit(1);

      if (confirmedReferrals && confirmedReferrals.length > 0) {
        // Affiliate has at least 1 paying referral — apply discount
        discountApplied = ownAffiliate.discount_percent;
        finalPrice = Math.round(planData.price * (1 - discountApplied / 100) * 100) / 100;
      }
      validAffiliateCode = ownAffiliate.affiliate_code;
    }

    // 2. If an external affiliate_code is provided (referral), validate it
    if (!ownAffiliate && affiliate_code && typeof affiliate_code === "string") {
      const sanitizedCode = affiliate_code.replace(/[^A-Za-z0-9]/g, "").substring(0, 20);

      const { data: aff } = await serviceClient
        .from("affiliates")
        .select("affiliate_code, user_id, discount_percent")
        .eq("affiliate_code", sanitizedCode)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (aff && aff.user_id !== userId) {
        validAffiliateCode = aff.affiliate_code;
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
    const allowedOrigins = ["https://Starbleai.lovable.app", "https://id-preview--804f123e-068a-44af-90b4-2843ed8e7d2a.lovable.app"];
    const origin = rawOrigin && allowedOrigins.some(o => rawOrigin.startsWith(o)) ? rawOrigin : "https://Starbleai.lovable.app";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const webhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;

    const externalReference = JSON.stringify({
      user_id: userId, plan, email: userEmail,
      affiliate_code: validAffiliateCode,
      tenant_id: tenantId,
    });

    // ===== PIX DIRECT PAYMENT =====
    if (payment_method === "pix") {
      console.log(`Creating PIX payment for user ${userId}, plan: ${plan}, price: ${finalPrice}, tenant: ${tenantId}`);

      const pixPayload = {
        transaction_amount: finalPrice,
        description: planData.title,
        payment_method_id: "pix",
        payer: {
          email: userEmail || `user-${userId.substring(0, 8)}@Starble.ai`,
        },
        external_reference: externalReference,
        notification_url: webhookUrl,
      };

      const pixResponse = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "X-Idempotency-Key": `${userId}-${plan}-${Date.now()}`,
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
      } catch (parseError) {
        console.error("Failed to parse PIX response:", parseError);
        return new Response(JSON.stringify({ error: "Resposta inválida do gateway de pagamento" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!pixResponse.ok) {
        console.error("MP PIX error status:", pixResponse.status, "body:", JSON.stringify(pixData).substring(0, 500));
        return new Response(JSON.stringify({ error: "Erro ao criar pagamento PIX", details: pixData?.message || pixData?.error || "unknown" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const transactionData = pixData.point_of_interaction?.transaction_data;
      const pixCode = transactionData?.qr_code ||
                      pixData.pix_copy_paste ||
                      pixData.pix?.copy_paste ||
                      pixData.pix?.code ||
                      pixData.qr_code_text;

      const pixQrBase64 = transactionData?.qr_code_base64 || null;
      const ticketUrl = transactionData?.ticket_url || pixData.ticket_url || null;

      if (!pixCode) {
        console.error("PIX code not found in response:", JSON.stringify(pixData).substring(0, 500));
        if (ticketUrl) {
          return new Response(
            JSON.stringify({
              payment_method: "pix",
              ticket_url: ticketUrl,
              payment_id: pixData.id,
              discount_applied: discountApplied,
              final_price: finalPrice,
              original_price: planData.price,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(JSON.stringify({ error: "Chave PIX não encontrada na resposta" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`PIX payment created: id=${pixData.id}, code_length=${pixCode.length}`);

      return new Response(
        JSON.stringify({
          payment_method: "pix",
          pix_code: pixCode,
          pix_qr_base64: pixQrBase64,
          ticket_url: ticketUrl,
          payment_id: pixData.id,
          discount_applied: discountApplied,
          final_price: finalPrice,
          original_price: planData.price,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== STANDARD CHECKOUT (redirect) =====
    const preference = {
      items: [
        {
          title: planData.title,
          quantity: 1,
          unit_price: finalPrice,
          currency_id: "BRL",
        },
      ],
      external_reference: externalReference,
      back_urls: {
        success: `${origin}/dashboard?payment=success`,
        failure: `${origin}/dashboard?payment=failure`,
        pending: `${origin}/dashboard?payment=pending`,
      },
      auto_return: "approved",
      notification_url: webhookUrl,
      statement_descriptor: "PLATAFORMA DIGITAL",
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
