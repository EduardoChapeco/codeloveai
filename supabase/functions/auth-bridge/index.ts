import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-tenant-id",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não suportado" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { idToken, email, workspaceId } = body;

    if (!idToken || !email) {
      return new Response(
        JSON.stringify({ error: "idToken e email obrigatórios" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate email format to prevent injection
    const sanitizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitizedEmail) || sanitizedEmail.length > 254) {
      return new Response(
        JSON.stringify({ error: "Email inválido" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate idToken format (must be non-empty string, reasonable length)
    if (typeof idToken !== "string" || idToken.length < 10 || idToken.length > 10000) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Try to validate the token as a Supabase session token first
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${idToken}` } } }
    );

    const {
      data: { user },
      error: userError,
    } = await anonClient.auth.getUser();

    if (!userError && user) {
      // Valid Supabase token — return session info
      const { data: tokenData } = await serviceClient
        .from("tokens")
        .select("token, is_active")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      const { data: profile } = await serviceClient
        .from("profiles")
        .select("name")
        .eq("user_id", user.id)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          ok: true,
          uid: user.id,
          email: user.email,
          name: profile?.name || user.email?.split("@")[0] || "",
          licenseActive: tokenData?.is_active || false,
          workspaceId: workspaceId || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If not a valid Supabase token, try to find user by email
    // and verify the idToken against their license token
    // sanitizedEmail already declared above from input validation

    const { data: profileByEmail } = await serviceClient
      .from("profiles")
      .select("user_id, name, email")
      .eq("email", sanitizedEmail)
      .maybeSingle();

    if (!profileByEmail) {
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify the token matches user's active license token
    const { data: tokenMatch } = await serviceClient
      .from("tokens")
      .select("token, is_active")
      .eq("user_id", profileByEmail.user_id)
      .eq("token", idToken)
      .eq("is_active", true)
      .maybeSingle();

    if (!tokenMatch) {
      return new Response(
        JSON.stringify({ error: "Token inválido ou expirado" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        uid: profileByEmail.user_id,
        email: sanitizedEmail,
        name: profileByEmail.name || sanitizedEmail.split("@")[0],
        licenseActive: true,
        workspaceId: workspaceId || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Auth bridge error:", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
