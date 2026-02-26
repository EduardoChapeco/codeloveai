import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveTenant } from "../_shared/tenant-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-tenant-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WORKER_URL = "https://Starble-fix-api.eusoueduoficial.workers.dev";

// Tenant costs (platform fee)
const DEFAULT_TOKEN_COST = 2.90;   // R$2,90 per 24h token
const DEFAULT_MONTHLY_COST = 29.90; // R$29,90/month unlimited

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve tenant
    const tenantInfo = await resolveTenant(serviceClient, req, userId);
    const tenantId = tenantInfo.id || tenantInfo.tenant_id;

    // Verify admin (global) or tenant_admin
    const { data: roleData } = await serviceClient
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").limit(1);

    const isGlobalAdmin = roleData && roleData.length > 0;

    // Tenant cost config — loaded for all users, used only for non-admins
    const { data: tenantConfig } = await serviceClient
      .from("tenants").select("token_cost, monthly_user_cost").eq("id", tenantId).maybeSingle();
    const effectiveTokenCost = (tenantConfig?.token_cost && tenantConfig.token_cost > 0)
      ? tenantConfig.token_cost
      : DEFAULT_TOKEN_COST;
    const effectiveMonthlyCost = (tenantConfig?.monthly_user_cost && tenantConfig.monthly_user_cost > 0)
      ? tenantConfig.monthly_user_cost
      : DEFAULT_MONTHLY_COST;
    let effectiveCost = effectiveTokenCost; // default; updated per action

    if (!isGlobalAdmin) {
      const { data: tenantRole } = await serviceClient
        .from("tenant_users").select("role").eq("user_id", userId).eq("tenant_id", tenantId).maybeSingle();
      if (!tenantRole || !["tenant_owner", "tenant_admin"].includes(tenantRole.role)) {
        return new Response(JSON.stringify({ error: "Acesso negado" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    const { action } = body;

    const adminSecret = Deno.env.get("Starble_ADMIN_SECRET");
    const webhookSecret = Deno.env.get("Starble_WEBHOOK_SECRET");

    if (!adminSecret || !webhookSecret) {
      return new Response(JSON.stringify({ error: "Secrets não configurados" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: unbind
    if (action === "unbind") {
      const { token: userToken } = body;
      if (!userToken || typeof userToken !== "string") {
        return new Response(JSON.stringify({ error: "Token inválido" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const resp = await fetch(`${WORKER_URL}/admin/unbind`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
        body: JSON.stringify({ token: userToken }),
      });

      await serviceClient.from("licenses").update({ device_id: null })
        .eq("key", userToken);

      const data = await resp.text();
      return new Response(data, {
        status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: info
    if (action === "info") {
      const { email } = body;
      if (!email || typeof email !== "string") {
        return new Response(JSON.stringify({ error: "Email inválido" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sanitizedEmail = email.trim().toLowerCase().substring(0, 254);

      const resp = await fetch(`${WORKER_URL}/admin/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
        body: JSON.stringify({ email: sanitizedEmail }),
      });

      const data = await resp.text();
      return new Response(data, {
        status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: generate
    if (action === "generate") {
      const { email, name, plan } = body;
      if (!email || typeof email !== "string") {
        return new Response(JSON.stringify({ error: "Email obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Map v2 plan types to worker-compatible plans
      const planToWorkerMap: Record<string, string> = {
        "test_5h": "test_5h", "test_1d": "test_1d", "days_15": "days_15",
        "days_30": "days_30", "days_90": "days_90", "days_1000": "days_90",
        "1_day": "test_1d", "7_days": "days_15", "1_month": "days_30", "12_months": "days_90", "lifetime": "days_90",
        "daily_token": "test_1d", "free_trial": "test_1d", "messages": "days_30", "hourly": "days_30",
      };

      // Expiry days for v2 licenses
      const planDaysMap: Record<string, number> = {
        "test_5h": 1, "test_1d": 1, "days_15": 15,
        "days_30": 30, "days_90": 90, "days_1000": 3650,
        "1_day": 1, "7_days": 7, "1_month": 30, "12_months": 365, "lifetime": 36500,
        "daily_token": 1, "free_trial": 365, "messages": 30, "hourly": 30,
      };

      // Default limits per v2 plan type
      const planLimitsMap: Record<string, { daily_messages: number | null; hourly_limit: number | null }> = {
        "daily_token": { daily_messages: null, hourly_limit: null },
        "free_trial": { daily_messages: 10, hourly_limit: null },
        "messages": { daily_messages: null, hourly_limit: null }, // monthly unlimited
        "hourly": { daily_messages: null, hourly_limit: 20 },
        "1_day": { daily_messages: null, hourly_limit: null },
        "7_days": { daily_messages: null, hourly_limit: null },
        "1_month": { daily_messages: null, hourly_limit: null }, // monthly unlimited
        "12_months": { daily_messages: null, hourly_limit: null },
        "lifetime": { daily_messages: null, hourly_limit: null },
      };

      const requestedPlan = plan || "daily_token";
      const workerPlan = planToWorkerMap[requestedPlan];

      if (!workerPlan) {
        return new Response(JSON.stringify({ error: `Plano inválido: ${requestedPlan}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Determine cost: monthly plans = R$29,90, daily tokens = R$2,90
      const isMonthlyPlan = ["messages", "days_30", "1_month", "days_90", "12_months", "days_1000"].includes(requestedPlan);
      effectiveCost = isMonthlyPlan ? effectiveMonthlyCost : effectiveTokenCost;

      // Wallet check — tenants ALWAYS pay
      if (!isGlobalAdmin) {
        const { data: wallet } = await serviceClient
          .from("tenant_wallets").select("balance").eq("tenant_id", tenantId).maybeSingle();
        if (!wallet || wallet.balance < effectiveCost) {
          const label = isMonthlyPlan ? "mensal ilimitado" : "token 24h";
          return new Response(JSON.stringify({
            error: `Saldo insuficiente para ${label}. Custo: R$${effectiveCost.toFixed(2)}. Saldo: R$${(wallet?.balance ?? 0).toFixed(2)}`
          }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const sanitizedEmail = email.trim().toLowerCase().substring(0, 254);
      const sanitizedName = (name || sanitizedEmail.split("@")[0]).substring(0, 100);

      const resp = await fetch(`${WORKER_URL}/webhook/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookSecret, email: sanitizedEmail, name: sanitizedName, plan: workerPlan }),
      });

      const responseText = await resp.text();

      if (resp.ok) {
        try {
          const data = JSON.parse(responseText);
          if (data.token && body.user_id) {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (uuidRegex.test(body.user_id)) {
              // v1: write to tokens table (backward compat with Worker)
              await serviceClient.from("tokens").update({ is_active: false }).eq("user_id", body.user_id);
              await serviceClient.from("tokens").insert({
                user_id: body.user_id, token: data.token, is_active: true, tenant_id: tenantId,
              });

              // v2: also write to licenses table (dual-write)
              const expiresAt = new Date();
              expiresAt.setDate(expiresAt.getDate() + (planDaysMap[requestedPlan] || 30));
              const limits = planLimitsMap[requestedPlan] || { daily_messages: null, hourly_limit: null };

              await serviceClient.from("licenses").update({ active: false, status: "expired" })
                .eq("user_id", body.user_id).eq("active", true);
              await serviceClient.from("licenses").insert({
                user_id: body.user_id,
                key: data.token,
                active: true,
                status: "active",
                plan: requestedPlan,
                plan_type: isMonthlyPlan ? "messages" : requestedPlan,
                type: isMonthlyPlan ? "monthly" : "daily_token",
                expires_at: expiresAt.toISOString(),
                daily_messages: limits.daily_messages,
                hourly_limit: limits.hourly_limit,
                messages_used_today: 0,
                tenant_id: tenantId,
              });

              // Debit tenant wallet — always charge tenants
              if (!isGlobalAdmin) {
                const { data: tw } = await serviceClient
                  .from("tenant_wallets").select("balance, total_debited").eq("tenant_id", tenantId).maybeSingle();
                if (tw) {
                  const label = isMonthlyPlan ? "mensal ilimitado" : "token 24h";
                  await serviceClient.from("tenant_wallets").update({
                    balance: tw.balance - effectiveCost,
                    total_debited: tw.total_debited + effectiveCost,
                  }).eq("tenant_id", tenantId);

                  await serviceClient.from("tenant_wallet_transactions").insert({
                    tenant_id: tenantId, amount: -effectiveCost, type: "token_cost",
                    description: `Licença ${label} para ${sanitizedEmail} (R$${effectiveCost.toFixed(2)})`,
                  });
                }
              }
            }
          }
          if (data.token) {
            return new Response(JSON.stringify(data), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } catch {}
      }

      let workerError = responseText;
      try { const parsed = JSON.parse(responseText); workerError = parsed.error || parsed.message || responseText; } catch {}

      return new Response(JSON.stringify({ error: `Erro ao gerar token: ${workerError}` }), {
        status: resp.status >= 400 ? resp.status : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Admin token action error:", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
