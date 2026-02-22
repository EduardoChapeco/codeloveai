import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API = "https://api.lovable.dev";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require admin authentication OR a valid CODELOVE_ADMIN_SECRET header (for cron jobs)
    const adminSecret = Deno.env.get("CODELOVE_ADMIN_SECRET");
    const providedSecret = req.headers.get("x-admin-secret");

    let isAuthorized = false;

    // Path 1: Admin secret for cron/automation
    if (adminSecret && providedSecret && providedSecret === adminSecret) {
      isAuthorized = true;
    }

    // Path 2: JWT-based admin auth
    if (!isAuthorized) {
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
      const { data, error } = await supabase.auth.getClaims(token);
      if (error || !data?.claims) {
        return new Response(JSON.stringify({ error: "Não autenticado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = data.claims.sub as string;

      // Verify admin role
      const serviceCheck = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: roleData } = await serviceCheck
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) {
        return new Response(JSON.stringify({ error: "Acesso negado — requer admin" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      isAuthorized = true;
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all active lovable accounts
    const { data: accounts } = await serviceClient
      .from("lovable_accounts")
      .select("id, user_id, token_encrypted, last_verified_at")
      .eq("status", "active");

    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ message: "No active accounts" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { user_id: string; valid: boolean }[] = [];

    for (const account of accounts) {
      try {
        // Verify token against Lovable API
        const verifyRes = await fetch(`${LOVABLE_API}/user/workspaces`, {
          headers: { Authorization: `Bearer ${account.token_encrypted}` },
        });

        const isValid = verifyRes.ok || verifyRes.status === 403;

        if (isValid) {
          await serviceClient
            .from("lovable_accounts")
            .update({ last_verified_at: new Date().toISOString() })
            .eq("id", account.id);
          results.push({ user_id: account.user_id, valid: true });
        } else {
          // Mark as expired
          await serviceClient
            .from("lovable_accounts")
            .update({ status: "expired" })
            .eq("id", account.id);
          results.push({ user_id: account.user_id, valid: false });
        }
      } catch {
        // Network error — skip, don't expire
        results.push({ user_id: account.user_id, valid: true });
      }
    }

    return new Response(JSON.stringify({
      processed: results.length,
      valid: results.filter(r => r.valid).length,
      expired: results.filter(r => !r.valid).length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
