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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminUserId = user.id;

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify admin role (global admin OR tenant_admin)
    const tenantInfo = await resolveTenant(serviceClient, req, adminUserId);
    const tenantId = tenantInfo.id || tenantInfo.tenant_id;

    // Check global admin first
    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", adminUserId)
      .eq("role", "admin")
      .limit(1);

    const isGlobalAdmin = roleData && roleData.length > 0;

    if (!isGlobalAdmin) {
      // Check tenant admin
      const { data: tenantRole } = await serviceClient
        .from("tenant_users")
        .select("role")
        .eq("user_id", adminUserId)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (!tenantRole || !["tenant_owner", "tenant_admin"].includes(tenantRole.role)) {
        return new Response(JSON.stringify({ error: "Acesso negado" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    const { email, name, password, plan, generate_token, role } = body;

    if (!email || typeof email !== "string" || email.length > 254) {
      return new Response(JSON.stringify({ error: "Email inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: "Formato de email inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!password || typeof password !== "string" || password.length < 6 || password.length > 128) {
      return new Response(JSON.stringify({ error: "Senha deve ter entre 6 e 128 caracteres" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedName = (name || sanitizedEmail.split("@")[0]).substring(0, 100);
    const validRoles = ["member", "admin", "affiliate"];
    const sanitizedRole = (role && validRoles.includes(role)) ? role : "member";

    const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
      email: sanitizedEmail,
      password,
      email_confirm: true,
      user_metadata: { name: sanitizedName },
    });

    if (createError) {
      console.error("Create user error:", createError.message);
      const safeMessage = createError.message?.includes("already been registered")
        ? "Email já cadastrado"
        : "Erro ao criar usuário";
      return new Response(JSON.stringify({ error: safeMessage }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = newUser.user.id;

    if (sanitizedRole !== "member") {
      await serviceClient.from("user_roles").update({ role: sanitizedRole }).eq("user_id", newUserId);
    }

    // Assign user to tenant
    await serviceClient.from("tenant_users").upsert({
      tenant_id: tenantId,
      user_id: newUserId,
      role: "tenant_member",
      is_primary: true,
    }, { onConflict: "tenant_id,user_id" });

    // Set tenant_id on profile
    await serviceClient.from("profiles").update({ tenant_id: tenantId }).eq("user_id", newUserId);

    const result: any = {
      success: true,
      user_id: newUserId,
      email: sanitizedEmail,
      name: sanitizedName,
      role: sanitizedRole,
      tenant_id: tenantId,
    };

    if (plan) {
      const planDays: Record<string, number> = {
        "1_day": 1, "7_days": 7, "1_month": 30, "12_months": 365,
      };
      const days = planDays[plan];
      if (days) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
        await serviceClient.from("subscriptions").insert({
          user_id: newUserId,
          plan,
          status: "active",
          starts_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          tenant_id: tenantId,
        });
        result.plan = plan;
      }
    }

    if (generate_token) {
      // Check tenant wallet balance for token cost
      const tenantConfig = await serviceClient
        .from("tenants").select("token_cost").eq("id", tenantId).maybeSingle();
      
      const tokenCost = tenantConfig?.data?.token_cost ?? 0;
      if (tokenCost > 0) {
        const { data: wallet } = await serviceClient
          .from("tenant_wallets").select("balance").eq("tenant_id", tenantId).maybeSingle();
        
        if (!wallet || wallet.balance < tokenCost) {
          result.token_error = "Saldo insuficiente no wallet do tenant para gerar token";
          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const webhookSecret = Deno.env.get("CODELOVE_WEBHOOK_SECRET");
      if (webhookSecret) {
        const workerPlan = plan === "1_day" ? "test_1d" :
                          plan === "7_days" ? "days_15" :
                          plan === "1_month" ? "days_30" :
                          plan === "12_months" ? "days_1000" : "days_30";

        try {
          const resp = await fetch(`${WORKER_URL}/webhook/purchase`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              webhookSecret,
              email: sanitizedEmail,
              name: sanitizedName,
              plan: workerPlan,
            }),
          });

          if (resp.ok) {
            const tokenData = await resp.json();
            if (tokenData.token) {
              await serviceClient.from("tokens").insert({
                user_id: newUserId,
                token: tokenData.token,
                is_active: true,
                tenant_id: tenantId,
              });
              result.token = tokenData.token;
              result.token_expires = tokenData.expires;

              // Debit tenant wallet
              if (tokenCost > 0) {
                const { data: tw } = await serviceClient
                  .from("tenant_wallets").select("balance, total_debited").eq("tenant_id", tenantId).maybeSingle();
                if (tw) {
                  await serviceClient.from("tenant_wallets").update({
                    balance: tw.balance - tokenCost,
                    total_debited: tw.total_debited + tokenCost,
                  }).eq("tenant_id", tenantId);

                  await serviceClient.from("tenant_wallet_transactions").insert({
                    tenant_id: tenantId,
                    amount: -tokenCost,
                    type: "token_cost",
                    description: `Token gerado para ${sanitizedEmail}`,
                  });
                }
              }
            }
          }
        } catch (e) {
          console.error("Token generation error:", e);
          result.token_error = "Falha ao gerar token automaticamente";
        }
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Admin create user error:", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
