import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Always return 200 to MP to prevent retries
  const ok = (body: Record<string, unknown> = { received: true }) =>
    new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = await req.json();
    const action = body.action || body.type;
    const paymentId = body.data?.id;

    if (!paymentId || !["payment.updated", "payment.created", "payment"].includes(action)) {
      return ok();
    }

    const mpToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!mpToken) {
      console.error("MP token not configured");
      return ok();
    }

    // Fetch payment details from MP
    const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mpToken}` },
    });

    if (!payRes.ok) {
      console.error("Failed to fetch payment:", payRes.status);
      return ok();
    }

    const payment = await payRes.json();

    if (payment.status !== "approved") {
      return ok();
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const licenseKey = payment.external_reference;
    const amount = payment.transaction_amount;

    if (!licenseKey) {
      console.error("No external_reference in payment");
      return ok();
    }

    // Fetch license
    const { data: license } = await admin
      .from("licenses")
      .select("id, user_id, tenant_id, affiliate_id")
      .eq("token", licenseKey)
      .maybeSingle();

    if (!license) {
      console.error("License not found for key:", licenseKey);
      return ok();
    }

    // Activate/extend license (30 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await admin
      .from("licenses")
      .update({ is_active: true, expires_at: expiresAt.toISOString() })
      .eq("id", license.id);

    // Record subscription transaction
    await admin.from("transactions").insert({
      type: "subscription",
      amount,
      user_id: license.user_id,
      tenant_id: license.tenant_id,
      mp_payment_id: String(paymentId),
      status: "approved",
      description: `Subscription payment R$${amount}`,
    });

    // Affiliate commission (30%)
    if (license.affiliate_id) {
      const { data: affiliate } = await admin
        .from("affiliates")
        .select("id, commission_rate, total_earned")
        .eq("id", license.affiliate_id)
        .maybeSingle();

      if (affiliate) {
        const rate = affiliate.commission_rate || 0.30;
        const commission = amount * rate;

        await admin.from("transactions").insert({
          type: "commission_affiliate",
          amount: commission,
          affiliate_id: affiliate.id,
          user_id: license.user_id,
          tenant_id: license.tenant_id,
          mp_payment_id: String(paymentId),
          commission_percent: rate * 100,
          status: "approved",
          description: `Affiliate commission ${(rate * 100).toFixed(0)}% of R$${amount}`,
        });

        await admin
          .from("affiliates")
          .update({ total_earned: (affiliate.total_earned || 0) + commission })
          .eq("id", affiliate.id);
      }
    }

    // Platform commission for tenant users (20%)
    if (license.tenant_id) {
      const { data: tenant } = await admin
        .from("tenants")
        .select("id, commission_percent")
        .eq("id", license.tenant_id)
        .maybeSingle();

      if (tenant) {
        const platformRate = (tenant.commission_percent || 20) / 100;
        const platformCommission = amount * platformRate;

        await admin.from("transactions").insert({
          type: "commission_platform",
          amount: platformCommission,
          tenant_id: tenant.id,
          user_id: license.user_id,
          mp_payment_id: String(paymentId),
          commission_percent: tenant.commission_percent || 20,
          status: "approved",
          description: `Platform commission ${tenant.commission_percent || 20}% of R$${amount}`,
        });
      }
    }

    return ok({ processed: true });
  } catch (err) {
    console.error("mp-webhook error:", err);
    return ok();
  }
});
