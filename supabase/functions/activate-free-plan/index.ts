import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isDisposableEmail } from "../_shared/disposable-emails.ts";
import { resolveTenant } from "../_shared/tenant-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const clfSecret = Deno.env.get("CLF_TOKEN_SECRET");
    if (!clfSecret) {
      return new Response(JSON.stringify({ error: "CLF_TOKEN_SECRET not configured" }), {
        status: 500,
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
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const userEmail = user.email;

    // Block disposable/temporary emails
    if (userEmail && isDisposableEmail(userEmail)) {
      return new Response(JSON.stringify({ error: "Emails temporários não são permitidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Resolve tenant
    const tenantInfo = await resolveTenant(serviceClient, req, userId);
    const tenantId = tenantInfo.id || tenantInfo.tenant_id;

    // Validate code format
    if (!sanitizedCode.startsWith("FREE_")) {
      return new Response(JSON.stringify({ error: "Código inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already has any active license
    const { data: existingLicense } = await serviceClient
      .from("licenses")
      .select("id")
      .eq("user_id", userId)
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (existingLicense) {
      return new Response(JSON.stringify({ error: "Você já possui um plano ativo" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if code was already used by this user
    const { data: existingFree } = await serviceClient
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("payment_id", `free_${sanitizedCode}`)
      .limit(1);

    if (existingFree && existingFree.length > 0) {
      return new Response(JSON.stringify({ error: "Você já utilizou este código" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the "Grátis" plan in DB
    const { data: freePlan } = await serviceClient
      .from("plans")
      .select("id, daily_message_limit")
      .eq("name", "Grátis")
      .eq("is_active", true)
      .maybeSingle();

    const planId = freePlan?.id || null;
    const dailyMessages = freePlan?.daily_message_limit || 10;

    // Build proper CLF1.eyJ... HMAC-signed token
    const now = Date.now();
    const expiresMs = 100 * 365.25 * 24 * 60 * 60 * 1000;
    const exp = now + expiresMs;
    const expiresAt = new Date(exp).toISOString();

    const payload = JSON.stringify({
      uid: userId,
      email: userEmail || "",
      plan: "free",
      dailyMessages,
      exp,
      iat: now,
      v: 1,
    });

    const encodedPayload = base64urlEncode(payload);
    const signature = await hmacSign(encodedPayload, clfSecret);
    const licenseKey = `CLF1.${encodedPayload}.${signature}`;

    const { error: licenseError } = await serviceClient
      .from("licenses")
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        key: licenseKey,
        active: true,
        plan: "free",
        plan_id: planId,
        plan_type: "messages",
        type: "daily_token",
        status: "active",
        daily_messages: dailyMessages,
        expires_at: expiresAt,
      });

    if (licenseError) {
      console.error("License insert error:", licenseError);
      return new Response(JSON.stringify({ error: "Erro ao ativar plano" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Legacy: create subscription record for tracking
    await serviceClient
      .from("subscriptions")
      .insert({
        user_id: userId,
        plan: "free",
        status: "active",
        starts_at: new Date().toISOString(),
        expires_at: expiresAt,
        payment_id: `free_${sanitizedCode}`,
        tenant_id: tenantId,
      }).then(() => {}).catch(() => {});

    // Notify admin
    await serviceClient.from("admin_notifications").insert({
      type: "free_plan",
      title: "Plano Grátis ativado via código",
      description: `Usuário ${userEmail || userId} ativou o plano gratuito de ${dailyMessages} mensagens/dia. Código: ${sanitizedCode}`,
      user_id: userId,
      tenant_id: tenantId,
    }).then(() => {}).catch(() => {});

    return new Response(JSON.stringify({ status: "activated", daily_messages: dailyMessages, token: licenseKey }), {
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
