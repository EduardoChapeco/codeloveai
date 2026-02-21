import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLAN_DAYS: Record<string, number> = {
  "1_day": 1, "7_days": 7, "1_month": 30, "12_months": 365,
};

const PLAN_PRICES: Record<string, number> = {
  "1_day": 9.99, "7_days": 49.9, "1_month": 149.9, "12_months": 499.0,
};

const COMMISSION_PERCENT = 30;
const DEFAULT_TENANT_ID = "a0000000-0000-0000-0000-000000000001";

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

    let refData: Record<string, unknown>;
    try {
      refData = JSON.parse(payment.external_reference);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid reference" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ═══════════════════════════════════════════
    // BRANCH: WHITE LABEL PURCHASE
    // ═══════════════════════════════════════════
    if (refData.type === "white_label") {
      return await handleWhiteLabelPurchase(supabaseAdmin, refData, sanitizedPaymentId, payment, uuidRegex);
    }

    // ═══════════════════════════════════════════
    // BRANCH: STANDARD MEMBER PURCHASE
    // ═══════════════════════════════════════════
    return await handleMemberPurchase(supabaseAdmin, refData, sanitizedPaymentId, payment, uuidRegex);

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ═══════════════════════════════════════════════════
// WHITE LABEL PURCHASE HANDLER
// ═══════════════════════════════════════════════════
async function handleWhiteLabelPurchase(
  supabaseAdmin: ReturnType<typeof createClient>,
  refData: Record<string, unknown>,
  sanitizedPaymentId: string,
  payment: Record<string, unknown>,
  uuidRegex: RegExp
) {
  const userId = refData.user_id as string;
  const userEmail = refData.email as string;
  const wlPlanId = refData.wl_plan_id as string;
  const period = refData.period as string || "monthly";
  const setupPriceCents = Number(refData.setup_price_cents) || 0;
  const subscriptionPriceCents = Number(refData.subscription_price_cents) || 0;
  const affiliateWlCode = refData.affiliate_wl_code as string | null;

  if (!userId || !uuidRegex.test(userId) || !wlPlanId || !uuidRegex.test(wlPlanId)) {
    return new Response(JSON.stringify({ error: "Invalid WL reference data" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Dedup check
  const { data: existingWlSub } = await supabaseAdmin
    .from("white_label_subscriptions")
    .select("id")
    .eq("payment_id", sanitizedPaymentId)
    .limit(1);

  if (existingWlSub && existingWlSub.length > 0) {
    return new Response(JSON.stringify({ status: "already_processed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch plan for validation
  const { data: wlPlan } = await supabaseAdmin
    .from("white_label_plans")
    .select("*")
    .eq("id", wlPlanId)
    .maybeSingle();

  if (!wlPlan) {
    console.error("WL Plan not found:", wlPlanId);
    return new Response(JSON.stringify({ error: "Plan not found" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Price validation (21% tolerance for affiliate discounts)
  const expectedTotalCents = setupPriceCents + subscriptionPriceCents;
  const paidAmount = (payment.transaction_amount as number) * 100;
  const minPrice = expectedTotalCents * 0.79;
  if (paidAmount < minPrice || paidAmount > expectedTotalCents + 1) {
    console.error(`WL Price mismatch: paid ${paidAmount}, expected ${expectedTotalCents}`);
    return new Response(JSON.stringify({ error: "Price mismatch" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1. Create tenant
  const slug = `wl-${userId.substring(0, 8)}-${Date.now().toString(36)}`;
  const tenantName = userEmail?.split("@")[0] || `WL ${slug}`;

  const { data: newTenant, error: tenantError } = await supabaseAdmin
    .from("tenants")
    .insert({
      name: tenantName,
      slug,
      white_label_plan_id: wlPlanId,
      setup_paid: setupPriceCents > 0,
      global_split_percent: wlPlan.global_split_percent,
      affiliate_global_split_percent: wlPlan.affiliate_global_split_percent,
      commission_percent: wlPlan.global_split_percent,
      is_active: true,
    })
    .select("id")
    .single();

  if (tenantError || !newTenant) {
    console.error("Tenant creation error:", tenantError);
    return new Response(JSON.stringify({ error: "Failed to create tenant" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tenantId = newTenant.id;

  // 2. Assign user as tenant_owner
  await supabaseAdmin.from("tenant_users").insert({
    tenant_id: tenantId,
    user_id: userId,
    role: "tenant_owner",
    is_primary: false,
  });

  // 3. Create tenant wallet
  await supabaseAdmin.from("tenant_wallets").insert({
    tenant_id: tenantId,
    balance: 0,
    total_credited: 0,
    total_debited: 0,
  });

  // 4. Create WL subscription
  const startsAt = new Date();
  const expiresAt = new Date();
  if (period === "yearly") {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  }

  await supabaseAdmin.from("white_label_subscriptions").insert({
    tenant_id: tenantId,
    plan_id: wlPlanId,
    owner_user_id: userId,
    status: "active",
    period,
    amount_cents: subscriptionPriceCents,
    starts_at: startsAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    payment_id: sanitizedPaymentId,
    affiliate_wl_code: affiliateWlCode,
  });

  // 5. Ledger entries
  const totalAmountBRL = (payment.transaction_amount as number) || (expectedTotalCents / 100);

  // 5a. Setup fee → admin credit
  if (setupPriceCents > 0) {
    await supabaseAdmin.from("ledger_entries").insert({
      tenant_id: tenantId,
      entry_type: "SETUP_FEE",
      amount: setupPriceCents / 100,
      description: `Setup White Label: ${wlPlan.name}`,
      payment_id: sanitizedPaymentId,
      reference_user_id: userId,
    });
  }

  // 5b. WL subscription → admin credit
  await supabaseAdmin.from("ledger_entries").insert({
    tenant_id: tenantId,
    entry_type: "WL_SUBSCRIPTION",
    amount: subscriptionPriceCents / 100,
    description: `Assinatura WL ${wlPlan.name} (${period})`,
    payment_id: sanitizedPaymentId,
    reference_user_id: userId,
  });

  // 5c. Affiliate WL commission
  if (affiliateWlCode) {
    const { data: wlAff } = await supabaseAdmin
      .from("white_label_affiliates")
      .select("id, user_id, commission_percent")
      .eq("code", affiliateWlCode)
      .eq("is_active", true)
      .maybeSingle();

    if (wlAff && wlAff.user_id !== userId) {
      const affiliateCommission = Math.round(totalAmountBRL * (wlAff.commission_percent || 30) * 100) / 10000;

      await supabaseAdmin.from("ledger_entries").insert({
        tenant_id: tenantId,
        entry_type: "AFFILIATE_WL_CREDIT",
        amount: affiliateCommission,
        description: `Comissão afiliado WL: ${affiliateWlCode} (${wlAff.commission_percent}%)`,
        payment_id: sanitizedPaymentId,
        affiliate_id: wlAff.id,
        reference_user_id: wlAff.user_id,
      });

      // Track referral
      await supabaseAdmin.from("white_label_referrals").insert({
        affiliate_id: wlAff.id,
        tenant_id: tenantId,
        setup_commission_cents: Math.round(affiliateCommission * 100 * (setupPriceCents / (setupPriceCents + subscriptionPriceCents || 1))),
        subscription_commission_cents: Math.round(affiliateCommission * 100 * (subscriptionPriceCents / (setupPriceCents + subscriptionPriceCents || 1))),
      });

      // Weekly invoice for WL affiliate
      const weekBounds = getWeekBounds();
      const { data: existingInvoice } = await supabaseAdmin
        .from("white_label_affiliate_invoices")
        .select("id, total_sales, total_commission_cents")
        .eq("affiliate_id", wlAff.id)
        .eq("week_start", weekBounds.week_start)
        .maybeSingle();

      if (existingInvoice) {
        await supabaseAdmin.from("white_label_affiliate_invoices").update({
          total_sales: existingInvoice.total_sales + 1,
          total_commission_cents: Number(existingInvoice.total_commission_cents) + Math.round(affiliateCommission * 100),
        }).eq("id", existingInvoice.id);
      } else {
        await supabaseAdmin.from("white_label_affiliate_invoices").insert({
          affiliate_id: wlAff.id,
          user_id: wlAff.user_id,
          week_start: weekBounds.week_start,
          week_end: weekBounds.week_end,
          total_sales: 1,
          total_commission_cents: Math.round(affiliateCommission * 100),
          status: "open",
        });
      }

      console.log(`WL Affiliate ${affiliateWlCode} earned R$${affiliateCommission.toFixed(2)}`);
    }
  }

  // 6. Admin notification
  await supabaseAdmin.from("admin_notifications").insert({
    type: "wl_purchase",
    title: `Novo White Label: ${wlPlan.name}`,
    description: `${userEmail || userId} comprou WL ${wlPlan.name} (${period}). Pagamento #${sanitizedPaymentId}. Valor: R$${totalAmountBRL.toFixed(2)}`,
    user_id: userId,
    tenant_id: tenantId,
  });

  console.log(`WL activated: tenant=${tenantId}, user=${userId}, plan=${wlPlan.name}, period=${period}`);

  return new Response(JSON.stringify({ status: "wl_activated", tenant_id: tenantId }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ═══════════════════════════════════════════════════
// STANDARD MEMBER PURCHASE HANDLER (with WL split)
// ═══════════════════════════════════════════════════
async function handleMemberPurchase(
  supabaseAdmin: ReturnType<typeof createClient>,
  refData: Record<string, unknown>,
  sanitizedPaymentId: string,
  payment: Record<string, unknown>,
  uuidRegex: RegExp
) {
  const userId = refData.user_id as string;
  const plan = refData.plan as string;
  const email = refData.email as string;
  const affiliateCode = refData.affiliate_code as string | null;
  const refTenantId = refData.tenant_id as string | null;

  if (!userId || typeof userId !== "string" || !plan || typeof plan !== "string" || !PLAN_DAYS[plan]) {
    return new Response(JSON.stringify({ error: "Invalid plan data" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!uuidRegex.test(userId)) {
    return new Response(JSON.stringify({ error: "Invalid user reference" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tenantId = (refTenantId && uuidRegex.test(refTenantId)) ? refTenantId : DEFAULT_TENANT_ID;

  // Price validation
  const paidAmount = payment.transaction_amount as number;
  const expectedPrice = PLAN_PRICES[plan];
  const minPrice = expectedPrice * 0.79;
  if (typeof paidAmount === "number" && (paidAmount < minPrice || paidAmount > expectedPrice + 0.01)) {
    console.error(`Price mismatch: paid ${paidAmount}, expected ${expectedPrice}`);
    return new Response(JSON.stringify({ error: "Price mismatch" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Dedup
  const { data: existing } = await supabaseAdmin
    .from("subscriptions").select("id").eq("payment_id", sanitizedPaymentId).limit(1);

  if (existing && existing.length > 0) {
    return new Response(JSON.stringify({ status: "already_processed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const days = PLAN_DAYS[plan];
  const startsAt = new Date();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  const { data: newSub, error: insertError } = await supabaseAdmin
    .from("subscriptions")
    .insert({
      user_id: userId,
      plan,
      status: "active",
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      payment_id: sanitizedPaymentId,
      affiliate_code: affiliateCode || null,
      tenant_id: tenantId,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Insert error:", insertError);
    return new Response(JSON.stringify({ error: "Failed to activate subscription" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ===== TENANT FINANCIAL SPLIT (with WL affiliate) =====
  const saleAmount = typeof paidAmount === "number" ? paidAmount : expectedPrice;

  const { data: tenantData } = await supabaseAdmin
    .from("tenants")
    .select("commission_percent, global_split_percent, affiliate_global_split_percent")
    .eq("id", tenantId)
    .maybeSingle();

  const globalSplitPercent = tenantData?.global_split_percent ?? tenantData?.commission_percent ?? 0;
  const affiliateGlobalSplitPercent = tenantData?.affiliate_global_split_percent ?? 0;

  const globalAmount = Math.round(saleAmount * globalSplitPercent) / 100;
  const tenantRevenue = saleAmount - globalAmount;

  // Calculate WL affiliate commission from global amount
  let affiliateWlAmount = 0;
  let wlAffiliateId: string | null = null;
  let wlAffiliateUserId: string | null = null;

  if (affiliateGlobalSplitPercent > 0 && tenantId !== DEFAULT_TENANT_ID) {
    // Find the WL affiliate who referred this tenant
    const { data: wlRef } = await supabaseAdmin
      .from("white_label_referrals")
      .select("affiliate_id, white_label_affiliates(id, user_id)")
      .eq("tenant_id", tenantId)
      .limit(1)
      .maybeSingle();

    if (wlRef && wlRef.white_label_affiliates) {
      const wlAff = wlRef.white_label_affiliates as unknown as { id: string; user_id: string };
      wlAffiliateId = wlAff.id;
      wlAffiliateUserId = wlAff.user_id;
      affiliateWlAmount = Math.round(globalAmount * affiliateGlobalSplitPercent) / 100;
    }
  }

  const adminNetAmount = globalAmount - affiliateWlAmount;

  // Record admin commission
  if (globalSplitPercent > 0) {
    await supabaseAdmin.from("admin_commissions").insert({
      tenant_id: tenantId,
      subscription_id: newSub?.id,
      payment_id: sanitizedPaymentId,
      sale_amount: saleAmount,
      commission_percent: globalSplitPercent,
      commission_amount: globalAmount,
    });

    // Credit tenant wallet
    const { data: wallet } = await supabaseAdmin
      .from("tenant_wallets")
      .select("balance, total_credited")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (wallet) {
      await supabaseAdmin.from("tenant_wallets").update({
        balance: wallet.balance + tenantRevenue,
        total_credited: wallet.total_credited + tenantRevenue,
      }).eq("tenant_id", tenantId);
    }

    await supabaseAdmin.from("tenant_wallet_transactions").insert({
      tenant_id: tenantId,
      amount: tenantRevenue,
      type: "commission",
      description: `Receita venda plano ${plan} (payment: ${sanitizedPaymentId})`,
      reference_id: newSub?.id,
    });

    // Ledger: tenant credit
    await supabaseAdmin.from("ledger_entries").insert({
      tenant_id: tenantId,
      entry_type: "TENANT_CREDIT",
      amount: tenantRevenue,
      description: `Receita tenant: plano ${plan}`,
      payment_id: sanitizedPaymentId,
      subscription_id: newSub?.id,
      reference_user_id: userId,
    });

    // Ledger: global credit
    await supabaseAdmin.from("ledger_entries").insert({
      tenant_id: tenantId,
      entry_type: "GLOBAL_CREDIT",
      amount: adminNetAmount,
      description: `Comissão global: ${globalSplitPercent}% de R$${saleAmount.toFixed(2)}`,
      payment_id: sanitizedPaymentId,
      subscription_id: newSub?.id,
    });

    // Ledger + invoice: WL affiliate
    if (affiliateWlAmount > 0 && wlAffiliateId && wlAffiliateUserId) {
      await supabaseAdmin.from("ledger_entries").insert({
        tenant_id: tenantId,
        entry_type: "AFFILIATE_WL_CREDIT",
        amount: affiliateWlAmount,
        description: `Comissão recorrente afiliado WL: ${affiliateGlobalSplitPercent}% de R$${globalAmount.toFixed(2)}`,
        payment_id: sanitizedPaymentId,
        affiliate_id: wlAffiliateId,
        subscription_id: newSub?.id,
        reference_user_id: wlAffiliateUserId,
      });

      // Update WL referral total recurring
      await supabaseAdmin.rpc("increment_wl_referral_recurring", {
        p_affiliate_id: wlAffiliateId,
        p_tenant_id: tenantId,
        p_amount_cents: Math.round(affiliateWlAmount * 100),
      }).catch(() => {
        // RPC may not exist yet, update manually
        supabaseAdmin
          .from("white_label_referrals")
          .select("id, total_recurring_earned_cents")
          .eq("affiliate_id", wlAffiliateId!)
          .eq("tenant_id", tenantId)
          .maybeSingle()
          .then(({ data: wlRefData }) => {
            if (wlRefData) {
              supabaseAdmin.from("white_label_referrals").update({
                total_recurring_earned_cents: (wlRefData.total_recurring_earned_cents || 0) + Math.round(affiliateWlAmount * 100),
              }).eq("id", wlRefData.id);
            }
          });
      });

      // WL affiliate invoice
      const weekBounds = getWeekBounds();
      const { data: existingWlInvoice } = await supabaseAdmin
        .from("white_label_affiliate_invoices")
        .select("id, total_sales, total_commission_cents")
        .eq("affiliate_id", wlAffiliateId)
        .eq("week_start", weekBounds.week_start)
        .maybeSingle();

      if (existingWlInvoice) {
        await supabaseAdmin.from("white_label_affiliate_invoices").update({
          total_sales: existingWlInvoice.total_sales + 1,
          total_commission_cents: Number(existingWlInvoice.total_commission_cents) + Math.round(affiliateWlAmount * 100),
        }).eq("id", existingWlInvoice.id);
      } else {
        await supabaseAdmin.from("white_label_affiliate_invoices").insert({
          affiliate_id: wlAffiliateId,
          user_id: wlAffiliateUserId,
          week_start: weekBounds.week_start,
          week_end: weekBounds.week_end,
          total_sales: 1,
          total_commission_cents: Math.round(affiliateWlAmount * 100),
          status: "open",
        });
      }

      console.log(`WL Affiliate recurring: R$${affiliateWlAmount.toFixed(2)} from tenant ${tenantId}`);
    }
  }

  // Admin notification
  const planLabels: Record<string, string> = {
    "1_day": "1 Dia", "7_days": "7 Dias", "1_month": "1 Mês", "12_months": "12 Meses",
  };
  await supabaseAdmin.from("admin_notifications").insert({
    type: "purchase",
    title: `Nova compra: ${planLabels[plan] || plan}`,
    description: `Usuário ${email || userId} adquiriu ${planLabels[plan] || plan}. Payment #${sanitizedPaymentId}. Split: tenant R$${tenantRevenue.toFixed(2)}, global R$${adminNetAmount.toFixed(2)}${affiliateWlAmount > 0 ? `, afiliado WL R$${affiliateWlAmount.toFixed(2)}` : ""}.`,
    user_id: userId,
    reference_id: newSub?.id || null,
    tenant_id: tenantId,
  });

  // ===== MEMBER AFFILIATE COMMISSION =====
  if (affiliateCode && newSub) {
    const { data: aff } = await supabaseAdmin
      .from("affiliates")
      .select("id, user_id")
      .eq("affiliate_code", affiliateCode)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (aff && aff.user_id !== userId) {
      const commissionAmount = Math.round(saleAmount * COMMISSION_PERCENT) / 100;
      const clientEmail = email || "";
      const clientName = clientEmail.split("@")[0] || "";

      const { data: referralData } = await supabaseAdmin.from("affiliate_referrals").insert({
        affiliate_id: aff.id,
        referred_user_id: userId,
        subscription_id: newSub.id,
        confirmed: true,
        commission_amount: commissionAmount,
        sale_amount: saleAmount,
        subscription_plan: plan,
        referred_email: clientEmail,
        referred_name: clientName,
        tenant_id: tenantId,
      }).select("id").single();

      // Codecoin
      const { data: coins } = await supabaseAdmin
        .from("codecoins").select("*").eq("user_id", aff.user_id).eq("tenant_id", tenantId).maybeSingle();
      if (coins) {
        await supabaseAdmin.from("codecoins").update({
          balance: coins.balance + 1,
          total_earned: coins.total_earned + 1,
          updated_at: new Date().toISOString(),
        }).eq("user_id", aff.user_id).eq("tenant_id", tenantId);
      }

      const { week_start } = getWeekBounds();
      await supabaseAdmin.from("codecoin_transactions").insert({
        user_id: aff.user_id, amount: 1, type: "earned",
        description: `Indicação confirmada (${planLabels[plan]})`,
        week_start,
        tenant_id: tenantId,
      });

      // Weekly invoice
      const weekBounds = getWeekBounds();
      const { data: existingInvoice } = await supabaseAdmin
        .from("affiliate_invoices")
        .select("id, total_sales, total_commission")
        .eq("affiliate_id", aff.id)
        .eq("week_start", weekBounds.week_start)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (existingInvoice) {
        await supabaseAdmin.from("affiliate_invoices").update({
          total_sales: existingInvoice.total_sales + 1,
          total_commission: Number(existingInvoice.total_commission) + commissionAmount,
        }).eq("id", existingInvoice.id);

        await supabaseAdmin.from("affiliate_invoice_items").insert({
          invoice_id: existingInvoice.id,
          referral_id: referralData?.id || null,
          client_email: clientEmail,
          client_name: clientName,
          plan,
          sale_amount: saleAmount,
          commission_amount: commissionAmount,
          tenant_id: tenantId,
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
          tenant_id: tenantId,
        }).select("id").single();

        if (newInvoice) {
          await supabaseAdmin.from("affiliate_invoice_items").insert({
            invoice_id: newInvoice.id,
            referral_id: referralData?.id || null,
            client_email: clientEmail,
            client_name: clientName,
            plan,
            sale_amount: saleAmount,
            commission_amount: commissionAmount,
            tenant_id: tenantId,
          });
        }
      }

      await supabaseAdmin.from("admin_notifications").insert({
        type: "commission",
        title: `Comissão afiliado: R$${commissionAmount.toFixed(2)}`,
        description: `Afiliado ${affiliateCode} ganhou R$${commissionAmount.toFixed(2)} pela venda do plano ${planLabels[plan]}.`,
        user_id: aff.user_id,
        tenant_id: tenantId,
      });
    }
  }

  console.log(`Subscription activated: user=${userId}, plan=${plan}, tenant=${tenantId}`);

  // External webhook for token generation
  const webhookSecret = Deno.env.get("CODELOVE_WEBHOOK_SECRET");
  if (webhookSecret) {
    try {
      const planMap: Record<string, string> = {
        "1_day": "test_1d", "7_days": "days_15", "1_month": "days_30", "12_months": "days_90",
      };
      const externalPlan = planMap[plan] || "days_30";

      const requestBody = {
        webhookSecret,
        email: email || "",
        name: email?.split("@")[0] || "",
        plan: externalPlan,
      };

      const webhookResponse = await fetch("https://codelove-fix-api.eusoueduoficial.workers.dev/webhook/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const responseText = await webhookResponse.text();

      if (webhookResponse.ok) {
        try {
          const webhookData = JSON.parse(responseText);
          if (webhookData.token) {
            await supabaseAdmin.from("tokens").update({ is_active: false }).eq("user_id", userId);
            await supabaseAdmin.from("tokens").insert({
              user_id: userId,
              token: webhookData.token,
              is_active: true,
              tenant_id: tenantId,
            });

            // Debit tenant wallet for token cost
            const { data: tenantConfig } = await supabaseAdmin
              .from("tenants").select("token_cost").eq("id", tenantId).maybeSingle();
            if (tenantConfig && tenantConfig.token_cost > 0) {
              const { data: tw } = await supabaseAdmin
                .from("tenant_wallets").select("balance, total_debited").eq("tenant_id", tenantId).maybeSingle();
              if (tw) {
                await supabaseAdmin.from("tenant_wallets").update({
                  balance: tw.balance - tenantConfig.token_cost,
                  total_debited: tw.total_debited + tenantConfig.token_cost,
                }).eq("tenant_id", tenantId);

                await supabaseAdmin.from("tenant_wallet_transactions").insert({
                  tenant_id: tenantId,
                  amount: -tenantConfig.token_cost,
                  type: "token_cost",
                  description: `Custo token gerado para ${email}`,
                });
              }
            }
          }
        } catch {}
      }
    } catch (webhookErr) {
      console.error("External webhook network error:", webhookErr);
    }
  }

  return new Response(JSON.stringify({ status: "activated" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
