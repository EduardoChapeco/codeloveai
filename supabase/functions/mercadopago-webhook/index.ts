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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Mercado Pago sends different notification types
    if (body.type !== "payment" && body.action !== "payment.updated") {
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymentId = body.data?.id;
    
    // Sanitize paymentId - must be a number
    if (!paymentId || (typeof paymentId !== "number" && typeof paymentId !== "string")) {
      return new Response(JSON.stringify({ error: "Invalid payment ID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sanitizedPaymentId = String(paymentId).replace(/[^0-9]/g, "");
    if (!sanitizedPaymentId || sanitizedPaymentId.length > 20) {
      return new Response(JSON.stringify({ error: "Invalid payment ID format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Config error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch payment details from Mercado Pago API (server-side verification)
    const paymentResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${sanitizedPaymentId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!paymentResponse.ok) {
      console.error("Failed to fetch payment:", paymentResponse.status);
      return new Response(JSON.stringify({ error: "Failed to verify payment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payment = await paymentResponse.json();

    if (payment.status !== "approved") {
      return new Response(JSON.stringify({ status: "not_approved", payment_status: payment.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse and validate external reference
    let refData: { user_id: string; plan: string; email: string };
    try {
      refData = JSON.parse(payment.external_reference);
    } catch {
      console.error("Invalid external_reference");
      return new Response(JSON.stringify({ error: "Invalid reference" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate all fields
    if (
      !refData.user_id || typeof refData.user_id !== "string" ||
      !refData.plan || typeof refData.plan !== "string" ||
      !PLAN_DAYS[refData.plan]
    ) {
      return new Response(JSON.stringify({ error: "Invalid plan data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate UUID format for user_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(refData.user_id)) {
      return new Response(JSON.stringify({ error: "Invalid user reference" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify price matches expected plan price (prevent price manipulation)
    const expectedPrices: Record<string, number> = {
      "1_day": 9.99,
      "7_days": 49.9,
      "1_month": 149.9,
      "12_months": 499.0,
    };
    
    const paidAmount = payment.transaction_amount;
    const expectedPrice = expectedPrices[refData.plan];
    if (typeof paidAmount === "number" && Math.abs(paidAmount - expectedPrice) > 0.01) {
      console.error(`Price mismatch: paid ${paidAmount}, expected ${expectedPrice} for plan ${refData.plan}`);
      return new Response(JSON.stringify({ error: "Price mismatch" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to insert subscription
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const days = PLAN_DAYS[refData.plan];
    const startsAt = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    // Check for duplicate payment
    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("payment_id", sanitizedPaymentId)
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ status: "already_processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insertError } = await supabaseAdmin
      .from("subscriptions")
      .insert({
        user_id: refData.user_id,
        plan: refData.plan,
        status: "active",
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        payment_id: sanitizedPaymentId,
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to activate subscription" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Subscription activated for user ${refData.user_id}, plan: ${refData.plan}`);

    return new Response(JSON.stringify({ status: "activated" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
