// Starble — redeem-plan v1.0.0
// Allows affiliates to redeem accumulated commissions for plan activations
// Rule: only commissions older than 7 days can be redeemed

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveTenant } from "../_shared/tenant-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-tenant-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function base64url(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlEncode(str: string): string {
  return base64url(new TextEncoder().encode(str));
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return base64url(new Uint8Array(sig));
}

async function generateSignedLicenseKey(userId: string, userEmail: string, planName: string, dailyMessages: number | null, expiresAt: Date): Promise<string> {
  const clfSecret = Deno.env.get("CLF_TOKEN_SECRET");
  if (!clfSecret) throw new Error("CLF_TOKEN_SECRET not configured");

  const payload = JSON.stringify({
    uid: userId,
    email: userEmail,
    plan: planName,
    dailyMessages,
    exp: expiresAt.getTime(),
    iat: Date.now(),
    v: 1,
  });

  const encodedPayload = base64urlEncode(payload);
  const signature = await hmacSign(encodedPayload, clfSecret);
  return `CLF1.${encodedPayload}.${signature}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const tenantInfo = await resolveTenant(serviceClient, req, userId);
    const tenantId = tenantInfo.id || tenantInfo.tenant_id;

    const { plan_id } = await req.json();
    if (!plan_id || typeof plan_id !== "string") {
      return new Response(JSON.stringify({ error: "plan_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch affiliate
    const { data: affiliate } = await serviceClient
      .from("affiliates")
      .select("id, user_id, total_earned")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!affiliate) {
      return new Response(JSON.stringify({ error: "Você não é um afiliado." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch plan
    const { data: plan } = await serviceClient
      .from("plans")
      .select("id, name, price, billing_cycle, type, is_active, daily_message_limit, hourly_limit")
      .eq("id", plan_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!plan) {
      return new Response(JSON.stringify({ error: "Plano não encontrado ou inativo" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const planPriceBRL = plan.price / 100;

    // 3. Calculate redeemable balance (commissions older than 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: redeemableCommissions } = await serviceClient
      .from("commissions")
      .select("id, amount")
      .eq("affiliate_id", affiliate.id)
      .eq("status", "approved")
      .lte("created_at", sevenDaysAgo);

    const redeemableBalance = (redeemableCommissions || []).reduce(
      (sum: number, c: any) => sum + Number(c.amount), 0
    );

    if (redeemableBalance < planPriceBRL) {
      return new Response(
        JSON.stringify({
          error: `Saldo resgatável insuficiente. Disponível: R$${redeemableBalance.toFixed(2)}, necessário: R$${planPriceBRL.toFixed(2)}. Apenas comissões com mais de 7 dias podem ser resgatadas.`,
          available: redeemableBalance,
          required: planPriceBRL,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Deduct from commissions (mark as paid, oldest first)
    let remaining = planPriceBRL;
    const commissionIds: string[] = [];
    for (const c of (redeemableCommissions || []).sort((a: any, b: any) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )) {
      if (remaining <= 0) break;
      commissionIds.push(c.id);
      remaining -= Number(c.amount);
    }

    // Mark used commissions as paid
    if (commissionIds.length > 0) {
      await serviceClient
        .from("commissions")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .in("id", commissionIds);
    }

    // 5. Calculate plan duration
    let days = 30;
    if (plan.billing_cycle === "daily") days = 1;
    if (plan.billing_cycle === "weekly") days = 7;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const userEmail = user.email || "";
    const licenseKey = await generateSignedLicenseKey(userId, userEmail, plan.name, plan.daily_message_limit, expiresAt);

    // 6. Deactivate existing licenses
    await serviceClient
      .from("licenses")
      .update({ active: false, status: "expired" })
      .eq("user_id", userId)
      .eq("active", true);

    // 7. Create new license
    const { data: newLicense, error: licError } = await serviceClient
      .from("licenses")
      .insert({
        user_id: userId,
        key: licenseKey,
        plan: plan.name,
        plan_id: plan.id,
        plan_type: plan.type,
        type: plan.billing_cycle === "daily" ? "daily_token" : "monthly",
        status: "active",
        active: true,
        expires_at: expiresAt.toISOString(),
        token_valid_until: plan.billing_cycle === "daily"
          ? new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
          : expiresAt.toISOString(),
        daily_messages: plan.daily_message_limit,
        hourly_limit: plan.hourly_limit,
        tenant_id: tenantId,
      })
      .select("id, key, plan, expires_at")
      .single();

    if (licError) {
      console.error("License insert error:", licError);
      return new Response(JSON.stringify({ error: "Erro ao ativar plano" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 8. Log the redemption as a codecoin transaction
    await serviceClient.from("codecoin_transactions").insert({
      user_id: userId,
      amount: -Math.round(planPriceBRL * 100),
      type: "redeem",
      description: `Resgate de comissões por plano ${plan.name}`,
      tenant_id: tenantId,
    });

    // 9. Create subscription record
    await serviceClient.from("subscriptions").insert({
      user_id: userId,
      plan: plan.billing_cycle === "daily" ? "daily" : "monthly",
      status: "active",
      starts_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      tenant_id: tenantId,
      payment_id: `redeem_${newLicense.id}`,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        message: `Plano ${plan.name} ativado com sucesso via resgate de comissões!`,
        license: newLicense,
        deducted: planPriceBRL,
        remainingBalance: redeemableBalance - planPriceBRL,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("redeem-plan error:", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});