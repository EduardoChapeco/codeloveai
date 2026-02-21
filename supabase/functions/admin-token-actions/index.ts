import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WORKER_URL = "https://codelove-fix-api.eusoueduoficial.workers.dev";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Verify admin role via service client
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .limit(1);

    if (!roleData || roleData.length === 0) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    const adminSecret = Deno.env.get("CODELOVE_ADMIN_SECRET");
    const webhookSecret = Deno.env.get("CODELOVE_WEBHOOK_SECRET");

    if (!adminSecret || !webhookSecret) {
      return new Response(JSON.stringify({ error: "Secrets não configurados" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: unbind - Unbind device from token
    if (action === "unbind") {
      const { token: userToken } = body;
      if (!userToken || typeof userToken !== "string") {
        return new Response(JSON.stringify({ error: "Token inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const resp = await fetch(`${WORKER_URL}/admin/unbind`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Secret": adminSecret,
        },
        body: JSON.stringify({ token: userToken }),
      });

      const data = await resp.text();
      return new Response(data, {
        status: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: info - Get tokens by email
    if (action === "info") {
      const { email } = body;
      if (!email || typeof email !== "string") {
        return new Response(JSON.stringify({ error: "Email inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sanitizedEmail = email.trim().toLowerCase().substring(0, 254);

      const resp = await fetch(`${WORKER_URL}/admin/info`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Secret": adminSecret,
        },
        body: JSON.stringify({ email: sanitizedEmail }),
      });

      const data = await resp.text();
      return new Response(data, {
        status: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: generate - Generate token via Worker
    if (action === "generate") {
      const { email, name, plan } = body;
      if (!email || typeof email !== "string") {
        return new Response(JSON.stringify({ error: "Email obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Map internal plan IDs to Worker-accepted plan IDs
      const planMap: Record<string, string> = {
        "test_5h": "test_5h",
        "test_1d": "test_1d",
        "days_15": "days_15",
        "days_30": "days_30",
        "days_90": "days_90",
        "days_1000": "days_90",
      };

      const requestedPlan = plan || "days_30";
      const workerPlan = planMap[requestedPlan];

      if (!workerPlan) {
        return new Response(JSON.stringify({ 
          error: `Plano inválido: ${requestedPlan}. Planos aceitos: ${Object.keys(planMap).join(", ")}. Entre em contato com o suporte.` 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sanitizedEmail = email.trim().toLowerCase().substring(0, 254);
      const sanitizedName = (name || sanitizedEmail.split("@")[0]).substring(0, 100);

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

      const responseText = await resp.text();

      if (resp.ok) {
        try {
          const data = JSON.parse(responseText);
          if (data.token) {
            // If a user_id was provided, store the token in the DB
            if (body.user_id) {
              const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
              if (uuidRegex.test(body.user_id)) {
                await serviceClient.from("tokens").update({ is_active: false }).eq("user_id", body.user_id);
                await serviceClient.from("tokens").insert({
                  user_id: body.user_id,
                  token: data.token,
                  is_active: true,
                });
              }
            }
            return new Response(JSON.stringify(data), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } catch {
          // parse error
        }
      }

      // Worker rejected the request — provide a clear error
      let workerError = responseText;
      try {
        const parsed = JSON.parse(responseText);
        workerError = parsed.error || parsed.message || responseText;
      } catch {}

      return new Response(JSON.stringify({ 
        error: `Erro ao gerar token: ${workerError}. Verifique o plano ou entre em contato com o suporte.` 
      }), {
        status: resp.status >= 400 ? resp.status : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Admin token action error:", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
