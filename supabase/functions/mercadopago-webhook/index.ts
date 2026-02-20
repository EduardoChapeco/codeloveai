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

const COMMISSION_PERCENT = 30;

function getWeekBounds() {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return {
    week_start: monday.toISOString().split("T")[0],
    week_end: sunday.toISOString().split("T")[0],
  };
}

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
    const minPrice = expectedPrice * 0.79;
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

    // Insert subscription
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

    // Create admin notification
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

    // ===== AFFILIATE COMMISSION (30%) =====
    if (refData.affiliate_code && newSub) {
      const { data: aff } = await supabaseAdmin
        .from("affiliates")
        .select("id, user_id")
        .eq("affiliate_code", refData.affiliate_code)
        .maybeSingle();

      if (aff && aff.user_id !== refData.user_id) {
        const saleAmount = typeof paidAmount === "number" ? paidAmount : expectedPrice;
        const commissionAmount = Math.round(saleAmount * COMMISSION_PERCENT) / 100;

        // Auto-confirm referral with commission + client info
        const clientEmail = refData.email || "";
        const clientName = clientEmail.split("@")[0] || "";

        const { data: referralData } = await supabaseAdmin.from("affiliate_referrals").insert({
          affiliate_id: aff.id,
          referred_user_id: refData.user_id,
          subscription_id: newSub.id,
          confirmed: true,
          commission_amount: commissionAmount,
          sale_amount: saleAmount,
          subscription_plan: refData.plan,
          referred_email: clientEmail,
          referred_name: clientName,
        }).select("id").single();

        // Add codecoin
        const { data: coins } = await supabaseAdmin
          .from("codecoins").select("*").eq("user_id", aff.user_id).maybeSingle();
        if (coins) {
          await supabaseAdmin.from("codecoins").update({
            balance: coins.balance + 1,
            total_earned: coins.total_earned + 1,
            updated_at: new Date().toISOString(),
          }).eq("user_id", aff.user_id);
        }

        // Log codecoin transaction
        const { week_start } = getWeekBounds();
        await supabaseAdmin.from("codecoin_transactions").insert({
          user_id: aff.user_id, amount: 1, type: "earned",
          description: `Indicação confirmada (${planLabels[refData.plan]})`,
          week_start,
        });

        // ===== WEEKLY INVOICE =====
        const weekBounds = getWeekBounds();
        const { data: existingInvoice } = await supabaseAdmin
          .from("affiliate_invoices")
          .select("id, total_sales, total_commission")
          .eq("affiliate_id", aff.id)
          .eq("week_start", weekBounds.week_start)
          .maybeSingle();

        if (existingInvoice) {
          await supabaseAdmin.from("affiliate_invoices").update({
            total_sales: existingInvoice.total_sales + 1,
            total_commission: Number(existingInvoice.total_commission) + commissionAmount,
          }).eq("id", existingInvoice.id);

          // Add invoice line item
          await supabaseAdmin.from("affiliate_invoice_items").insert({
            invoice_id: existingInvoice.id,
            referral_id: referralData?.id || null,
            client_email: clientEmail,
            client_name: clientName,
            plan: refData.plan,
            sale_amount: saleAmount,
            commission_amount: commissionAmount,
          });
        } else {
          const { data: newInvoice } = await supabaseAdmin.from("affiliate_invoices").insert({
            affiliate_id: aff.id,
            user_id: aff.user_id,
            week_start: weekBounds.week_start,
            week_end: weekBounds.week_end,
            total_sales: 1,
            total_commission: commissionAmount,
            status: "open",
          }).select("id").single();

          // Add invoice line item
          if (newInvoice) {
            await supabaseAdmin.from("affiliate_invoice_items").insert({
              invoice_id: newInvoice.id,
              referral_id: referralData?.id || null,
              client_email: clientEmail,
              client_name: clientName,
              plan: refData.plan,
              sale_amount: saleAmount,
              commission_amount: commissionAmount,
            });
          }
        }

        // Notify admin about commission
        await supabaseAdmin.from("admin_notifications").insert({
          type: "commission",
          title: `Comissão afiliado: R$${commissionAmount.toFixed(2)}`,
          description: `Afiliado ${refData.affiliate_code} ganhou R$${commissionAmount.toFixed(2)} de comissão pela venda do plano ${planLabels[refData.plan]}.`,
          user_id: aff.user_id,
        });

        console.log(`Referral + commission R$${commissionAmount.toFixed(2)} for affiliate ${refData.affiliate_code}`);
      }
    }

    console.log(`Subscription activated for user ${refData.user_id}, plan: ${refData.plan}`);

    // Call external webhook for automatic token generation
    const webhookSecret = Deno.env.get("CODELOVE_WEBHOOK_SECRET");
    console.log(`CODELOVE_WEBHOOK_SECRET present: ${!!webhookSecret}`);
    if (webhookSecret) {
      try {
        const planMap: Record<string, string> = {
          "1_day": "test_1d",
          "7_days": "days_15",
          "1_month": "days_30",
          "12_months": "days_90",
        };
        const externalPlan = planMap[refData.plan] || "days_30";

        const requestBody = {
          webhookSecret,
          email: refData.email || "",
          name: refData.email?.split("@")[0] || "",
          plan: externalPlan,
        };
        console.log(`Calling external webhook for user ${refData.user_id}, plan: ${externalPlan}`);

        const webhookResponse = await fetch("https://codelove-fix-api.eusoueduoficial.workers.dev/webhook/purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        const responseText = await webhookResponse.text();
        console.log(`External webhook response status: ${webhookResponse.status}, body: ${responseText}`);

        if (webhookResponse.ok) {
          try {
            const webhookData = JSON.parse(responseText);
            if (webhookData.token) {
              await supabaseAdmin.from("tokens").update({ is_active: false }).eq("user_id", refData.user_id);
              await supabaseAdmin.from("tokens").insert({
                user_id: refData.user_id,
                token: webhookData.token,
                is_active: true,
              });
              console.log(`Auto-generated token stored for user ${refData.user_id}: ${webhookData.token.substring(0, 8)}...`);
            } else {
              console.warn(`External webhook responded OK but no token: ${responseText}`);
            }
          } catch (parseErr) {
            console.error(`Failed to parse webhook response: ${responseText}`);
          }
        } else {
          console.error(`External webhook error ${webhookResponse.status}: ${responseText}`);
        }
      } catch (webhookErr) {
        console.error("External webhook network error:", webhookErr);
      }
    } else {
      console.warn("CODELOVE_WEBHOOK_SECRET not configured, skipping token generation");
    }

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
