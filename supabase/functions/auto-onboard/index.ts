import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Default deadline: Feb 20, 2026 18:00 BRT (21:00 UTC)
const ONBOARD_DEADLINE = new Date("2026-02-20T21:00:00Z").getTime();

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

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if onboarding is active: deadline not passed OR admin override exists
    const now = Date.now();
    let onboardActive = now < ONBOARD_DEADLINE;

    if (!onboardActive) {
      // Check for admin override: admin_notifications with type "onboard_override" and is_read=false
      const { data: override } = await serviceClient
        .from("admin_notifications")
        .select("id")
        .eq("type", "onboard_override")
        .eq("is_read", false)
        .limit(1);

      onboardActive = !!(override && override.length > 0);
    }

    if (!onboardActive) {
      return new Response(JSON.stringify({ status: "onboard_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already has ANY subscription (paid or trial)
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

    // Create 5-hour trial subscription
    const startsAt = new Date();
    const expiresAt = new Date(startsAt.getTime() + 5 * 60 * 60 * 1000); // 5 hours

    const { error: insertError } = await serviceClient
      .from("subscriptions")
      .insert({
        user_id: userId,
        plan: "1_day",
        status: "active",
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        payment_id: `onboard_${userId.substring(0, 8)}`,
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Erro ao ativar trial" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Notify admin
    await serviceClient.from("admin_notifications").insert({
      type: "onboarding",
      title: "Novo trial de 5h ativado",
      description: `Usuário ${userEmail || userId} recebeu trial automático de 5 horas.`,
      user_id: userId,
    });

    // Call external webhook for token generation (5h = test_5h or test_1d as fallback)
    let generatedToken: string | null = null;
    const webhookSecret = Deno.env.get("CODELOVE_WEBHOOK_SECRET");
    if (webhookSecret) {
      try {
        const requestBody = {
          webhookSecret,
          email: userEmail || "",
          name: userEmail?.split("@")[0] || "",
          plan: "test_5h",
        };
        console.log(`Auto-onboard: calling webhook for ${userEmail}, plan: test_5h`);

        const webhookResponse = await fetch(
          "https://codelove-fix-api.eusoueduoficial.workers.dev/webhook/purchase",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          }
        );

        const responseText = await webhookResponse.text();
        console.log(`Webhook response: ${webhookResponse.status}, body: ${responseText}`);

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
              });
              console.log(`Onboard token stored for ${userId}`);
            }
          } catch (parseErr) {
            console.error(`Failed to parse webhook response: ${responseText}`);
          }
        } else {
          console.error(`Webhook error ${webhookResponse.status}: ${responseText}`);
        }
      } catch (webhookErr) {
        console.error("Webhook network error:", webhookErr);
      }
    } else {
      console.warn("CODELOVE_WEBHOOK_SECRET not configured");
    }

    return new Response(
      JSON.stringify({
        status: "activated",
        trial_hours: 5,
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
