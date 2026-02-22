import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isDisposableEmail } from "../_shared/disposable-emails.ts";
import { resolveTenant } from "../_shared/tenant-resolver.ts";

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
    // Authenticate user
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
    const userEmail = claimsData.claims.email;

    // Block disposable/temporary emails
    if (userEmail && isDisposableEmail(userEmail)) {
      return new Response(JSON.stringify({ error: "Emails temporários não são permitidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve tenant
    const tenantInfo = await resolveTenant(serviceClient, req, userId);
    const tenantId = tenantInfo.id || tenantInfo.tenant_id;

    // Check if user already has ANY subscription
    const { data: existingSubs } = await serviceClient
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    if (existingSubs && existingSubs.length > 0) {
      return new Response(JSON.stringify({ status: "already_onboarded" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already has a token
    const { data: existingTokens } = await serviceClient
      .from("tokens")
      .select("id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1);

    if (existingTokens && existingTokens.length > 0) {
      return new Response(JSON.stringify({ status: "already_onboarded" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create 365-day free subscription
    const startsAt = new Date();
    const expiresAt = new Date(startsAt.getTime() + 365 * 24 * 60 * 60 * 1000); // 365 days

    const { error: insertError } = await serviceClient
      .from("subscriptions")
      .insert({
        user_id: userId,
        plan: "1_day",
        status: "active",
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        payment_id: `free_${userId.substring(0, 8)}`,
        tenant_id: tenantId,
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Erro ao ativar acesso gratuito" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate token via webhook
    let generatedToken: string | null = null;
    const webhookSecret = Deno.env.get("CODELOVE_WEBHOOK_SECRET");
    if (webhookSecret) {
      try {
        const requestBody = {
          webhookSecret,
          email: userEmail || "",
          name: userEmail?.split("@")[0] || "",
          plan: "days_365",
        };

        const webhookResponse = await fetch(
          "https://codelove-fix-api.eusoueduoficial.workers.dev/webhook/purchase",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          }
        );

        const responseText = await webhookResponse.text();

        if (webhookResponse.ok) {
          try {
            const webhookData = JSON.parse(responseText);
            if (webhookData.token) {
              generatedToken = webhookData.token;
              await serviceClient
                .from("tokens")
                .update({ is_active: false })
                .eq("user_id", userId);
              await serviceClient.from("tokens").insert({
                user_id: userId,
                token: webhookData.token,
                is_active: true,
                tenant_id: tenantId,
              });
            }
          } catch {
            console.error(`Failed to parse webhook response`);
          }
        }
      } catch (webhookErr) {
        console.error("Webhook network error:", webhookErr);
      }
    }

    return new Response(
      JSON.stringify({
        status: "activated",
        days: 365,
        expires_at: expiresAt.toISOString(),
        has_token: !!generatedToken,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Auto-onboard error:", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
