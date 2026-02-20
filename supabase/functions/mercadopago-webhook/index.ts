import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLAN_DAYS: Record<string, number> = {
  "1_day": 1,
  "7_days": 7,
  "1_month": 30,
  "12_months": 365,
};

const PLAN_PRICES: Record<string, number> = {
  "1_day": 9.99,
  "7_days": 49.9,
  "1_month": 149.9,
  "12_months": 499.0,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    if (body.type !== "payment" && body.action !== "payment.updated") {
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymentId = body.data?.id;
    if (!paymentId || (typeof paymentId !== "number" && typeof paymentId !== "string")) {
      return new Response(JSON.stringify({ error: "Invalid payment ID" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sanitizedPaymentId = String(paymentId).replace(/[^0-9]/g, "");
    if (!sanitizedPaymentId || sanitizedPaymentId.length > 20) {
      return new Response(JSON.stringify({ error: "Invalid payment ID format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Config error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymentResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${sanitizedPaymentId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!paymentResponse.ok) {
      console.error("Failed to fetch payment:", paymentResponse.status);
      return new Response(JSON.stringify({ error: "Failed to verify payment" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payment = await paymentResponse.json();

    if (payment.status !== "approved") {
      return new Response(JSON.stringify({ status: "not_approved", payment_status: payment.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let refData: { user_id: string; plan: string; email: string; affiliate_code?: string };
    try {
      refData = JSON.parse(payment.external_reference);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid reference" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!refData.user_id || typeof refData.user_id !== "string" ||
        !refData.plan || typeof refData.plan !== "string" || !PLAN_DAYS[refData.plan]) {
      return new Response(JSON.stringify({ error: "Invalid plan data" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(refData.user_id)) {
      return new Response(JSON.stringify({ error: "Invalid user reference" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Price validation - allow affiliate discount (up to 20% off)
    const paidAmount = payment.transaction_amount;
    const expectedPrice = PLAN_PRICES[refData.plan];
    const minPrice = expectedPrice * 0.79; // 20% discount + rounding tolerance
    if (typeof paidAmount === "number" && (paidAmount < minPrice || paidAmount > expectedPrice + 0.01)) {
      console.error(`Price mismatch: paid ${paidAmount}, expected ${expectedPrice} (min ${minPrice}) for plan ${refData.plan}`);
      return new Response(JSON.stringify({ error: "Price mismatch" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check for duplicate
    const { data: existing } = await supabaseAdmin
      .from("subscriptions").select("id").eq("payment_id", sanitizedPaymentId).limit(1);

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ status: "already_processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const days = PLAN_DAYS[refData.plan];
    const startsAt = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    // Insert subscription with affiliate_code
    const { data: newSub, error: insertError } = await supabaseAdmin
      .from("subscriptions")
      .insert({
        user_id: refData.user_id,
        plan: refData.plan,
        status: "active",
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        payment_id: sanitizedPaymentId,
        affiliate_code: refData.affiliate_code || null,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to activate subscription" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create admin notification for new purchase
    const planLabels: Record<string, string> = {
      "1_day": "1 Dia", "7_days": "7 Dias", "1_month": "1 Mês", "12_months": "12 Meses",
    };
    await supabaseAdmin.from("admin_notifications").insert({
      type: "purchase",
      title: `Nova compra: ${planLabels[refData.plan] || refData.plan}`,
      description: `Usuário ${refData.email || refData.user_id} adquiriu o plano ${planLabels[refData.plan] || refData.plan}. Pagamento #${sanitizedPaymentId}.`,
      user_id: refData.user_id,
      reference_id: newSub?.id || null,
    });

    // If affiliate_code present, create referral record
    if (refData.affiliate_code && newSub) {
      const { data: aff } = await supabaseAdmin
        .from("affiliates")
        .select("id, user_id")
        .eq("affiliate_code", refData.affiliate_code)
        .maybeSingle();

      if (aff && aff.user_id !== refData.user_id) {
        await supabaseAdmin.from("affiliate_referrals").insert({
          affiliate_id: aff.id,
          referred_user_id: refData.user_id,
          subscription_id: newSub.id,
          confirmed: false,
        });
        console.log(`Referral created for affiliate ${refData.affiliate_code}`);
      }
    }

    console.log(`Subscription activated for user ${refData.user_id}, plan: ${refData.plan}`);

    return new Response(JSON.stringify({ status: "activated" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
