import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveTenant } from "../_shared/tenant-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-tenant-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WORKER_URL = "https://Starble-fix-api.eusoueduoficial.workers.dev";

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

    if (!isGlobalAdmin) {
      const { data: tenantRole } = await serviceClient
        .from("tenant_users").select("role").eq("user_id", userId).eq("tenant_id", tenantId).maybeSingle();
      if (!tenantRole || !["tenant_owner", "tenant_admin"].includes(tenantRole.role)) {
        return new Response(JSON.stringify({ error: "Acesso negado" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check tenant wallet for token cost
      const { data: tenantConfig } = await serviceClient
        .from("tenants").select("token_cost").eq("id", tenantId).maybeSingle();
      if (tenantConfig && tenantConfig.token_cost > 0) {
        const { data: wallet } = await serviceClient
          .from("tenant_wallets").select("balance").eq("tenant_id", tenantId).maybeSingle();
        if (!wallet || wallet.balance < tenantConfig.token_cost) {
          return new Response(JSON.stringify({ error: "Saldo insuficiente para gerar tokens" }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
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

      const planMap: Record<string, string> = {
        "test_5h": "test_5h", "test_1d": "test_1d", "days_15": "days_15",
        "days_30": "days_30", "days_90": "days_90", "days_1000": "days_90",
      };

      const requestedPlan = plan || "days_30";
      const workerPlan = planMap[requestedPlan];

      if (!workerPlan) {
        return new Response(JSON.stringify({ error: `Plano inválido: ${requestedPlan}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
              await serviceClient.from("tokens").update({ is_active: false }).eq("user_id", body.user_id);
              await serviceClient.from("tokens").insert({
                user_id: body.user_id, token: data.token, is_active: true, tenant_id: tenantId,
              });

              // Debit tenant wallet
              if (!isGlobalAdmin) {
                const { data: tc } = await serviceClient
                  .from("tenants").select("token_cost").eq("id", tenantId).maybeSingle();
                if (tc && tc.token_cost > 0) {
                  const { data: tw } = await serviceClient
                    .from("tenant_wallets").select("balance, total_debited").eq("tenant_id", tenantId).maybeSingle();
                  if (tw) {
                    await serviceClient.from("tenant_wallets").update({
                      balance: tw.balance - tc.token_cost,
                      total_debited: tw.total_debited + tc.token_cost,
                    }).eq("tenant_id", tenantId);

                    await serviceClient.from("tenant_wallet_transactions").insert({
                      tenant_id: tenantId, amount: -tc.token_cost, type: "token_cost",
                      description: `Token gerado para ${sanitizedEmail}`,
                    });
                  }
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
