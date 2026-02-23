import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { tenantId, mpPaymentId, mpAccessToken } = await req.json();

    if (!tenantId || !mpPaymentId) {
      return new Response(JSON.stringify({ success: false, error: "tenantId and mpPaymentId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mpPlatformToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!mpPlatformToken) {
      return new Response(JSON.stringify({ success: false, error: "Payment service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify payment with Mercado Pago
    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
      headers: { Authorization: `Bearer ${mpPlatformToken}` },
    });

    if (!paymentRes.ok) {
      return new Response(JSON.stringify({ success: false, error: "Payment verification failed" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payment = await paymentRes.json();

    if (payment.status !== "approved" || payment.transaction_amount < 299) {
      return new Response(JSON.stringify({ success: false, error: "Payment not approved or insufficient amount" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Update tenant
    const { data: tenant, error: tErr } = await admin
      .from("tenants")
      .update({
        setup_paid: true,
        status: "active",
        ...(mpAccessToken ? { mp_access_token: mpAccessToken } : {}),
      })
      .eq("id", tenantId)
      .select("slug")
      .single();

    if (tErr) {
      console.error("Tenant update error:", tErr);
      return new Response(JSON.stringify({ success: false, error: "Failed to activate tenant" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Record transaction
    await admin.from("transactions").insert({
      type: "setup",
      amount: 299,
      tenant_id: tenantId,
      mp_payment_id: mpPaymentId,
      status: "approved",
      description: "White Label setup fee",
    });

    return new Response(
      JSON.stringify({ success: true, tenantSlug: tenant.slug }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("process-wl-setup error:", err);
    return new Response(JSON.stringify({ success: false, error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
