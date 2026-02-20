import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const userEmail = claimsData.claims.email;

    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return new Response(JSON.stringify({ error: "Código inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sanitizedCode = code.replace(/[^A-Za-z0-9_-]/g, "").substring(0, 50);

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate the free plan code exists in admin_notifications as a generated link
    // The code format is: FREE_<timestamp>_<random>
    if (!sanitizedCode.startsWith("FREE_")) {
      return new Response(JSON.stringify({ error: "Código inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already used a free plan
    const { data: existingFree } = await serviceClient
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("payment_id", `free_${sanitizedCode}`)
      .limit(1);

    if (existingFree && existingFree.length > 0) {
      return new Response(JSON.stringify({ error: "Você já utilizou este plano gratuito" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already has any free plan
    const { data: anyFree } = await serviceClient
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .like("payment_id", "free_%")
      .limit(1);

    if (anyFree && anyFree.length > 0) {
      return new Response(JSON.stringify({ error: "Cada usuário pode usar apenas 1 plano gratuito" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create 1-day subscription
    const startsAt = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1);

    const { error: insertError } = await serviceClient
      .from("subscriptions")
      .insert({
        user_id: userId,
        plan: "1_day",
        status: "active",
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        payment_id: `free_${sanitizedCode}`,
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Erro ao ativar plano" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Notify admin
    await serviceClient.from("admin_notifications").insert({
      type: "free_plan",
      title: "Plano gratuito ativado",
      description: `Usuário ${userEmail || userId} ativou o plano gratuito de 1 dia. Código: ${sanitizedCode}`,
      user_id: userId,
    });

    // Call external webhook for token generation
    const webhookSecret = Deno.env.get("CODELOVE_WEBHOOK_SECRET");
    console.log(`CODELOVE_WEBHOOK_SECRET present: ${!!webhookSecret}`);
    if (webhookSecret) {
      try {
        const requestBody = {
          webhookSecret,
          email: userEmail || "",
          name: userEmail?.split("@")[0] || "",
          plan: "test_1d",
        };
        console.log(`Calling external webhook for user ${userId}, email: ${userEmail}, plan: test_1d`);
        
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
              // Store the auto-generated token
              await serviceClient.from("tokens").update({ is_active: false }).eq("user_id", userId);
              await serviceClient.from("tokens").insert({
                user_id: userId,
                token: webhookData.token,
                is_active: true,
              });
              console.log(`Auto-generated token stored for user ${userId}`);
            } else {
              console.warn(`External webhook responded OK but no token in response: ${responseText}`);
            }
          } catch (parseErr) {
            console.error(`Failed to parse webhook response: ${responseText}`);
          }
        } else {
          console.error(`External webhook returned error ${webhookResponse.status}: ${responseText}`);
        }
      } catch (webhookErr) {
        console.error("External webhook network error:", webhookErr);
        // Don't fail the main flow
      }
    } else {
      console.warn("CODELOVE_WEBHOOK_SECRET not configured, skipping external token generation");
    }

    return new Response(JSON.stringify({ status: "activated" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Free plan error:", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
