import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-tenant-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { tenant_id, amount_brl, payment_method } = body;

    // Validate tenant_id is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!tenant_id || typeof tenant_id !== "string" || !uuidRegex.test(tenant_id)) {
      return new Response(JSON.stringify({ error: "Tenant inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amount = Number(amount_brl);
    if (!amount_brl || isNaN(amount) || amount < 5 || amount > 50000) {
      return new Response(JSON.stringify({ error: "Valor inválido. Mínimo R$5,00, máximo R$50.000,00." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user is tenant admin
    const { data: membership } = await serviceClient
      .from("tenant_users")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant_id)
      .single();

    const isTenantAdmin = membership?.role === "tenant_owner" || membership?.role === "tenant_admin";
    
    // Also allow global admins
    const { data: globalRole } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!isTenantAdmin && !globalRole) {
      return new Response(JSON.stringify({ error: "Permissão negada" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const webhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;

    const externalReference = JSON.stringify({
      type: "wallet_topup",
      tenant_id,
      user_id: user.id,
      amount_brl: amount,
    });

    // PIX Payment
    if (payment_method === "pix") {
      const pixPayload = {
        transaction_amount: amount,
        description: `Crédito Wallet (Tenant ${tenant_id.substring(0, 8)})`,
        payment_method_id: "pix",
        payer: {
          email: user.email,
        },
        external_reference: externalReference,
        notification_url: webhookUrl,
      };

      const pixResponse = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "X-Idempotency-Key": `topup-${tenant_id}-${Date.now()}`,
        },
        body: JSON.stringify(pixPayload),
      });

      const pixData = await pixResponse.json();

      if (!pixResponse.ok) {
        console.error("MP PIX error:", pixData);
        return new Response(JSON.stringify({ error: "Erro ao gerar PIX" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const transactionData = pixData.point_of_interaction?.transaction_data;
      const pixCode = transactionData?.qr_code || pixData.pix_copy_paste;
      const pixQrBase64 = transactionData?.qr_code_base64;

      return new Response(JSON.stringify({
        pix_code: pixCode,
        pix_qr_base64: pixQrBase64,
        payment_id: pixData.id
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Método não suportado" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Topup error:", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
