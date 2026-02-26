// lovable-token-refresh v5.0.0 — Verify-only (no Firebase refresh)
// Simply checks if stored tokens in lovable_accounts are still valid.
// If expired, marks as "expired" so user must reconnect.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API = "https://api.lovable.dev";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth: admin secret or JWT admin
    const adminSecret = Deno.env.get("CODELOVE_ADMIN_SECRET");
    const providedSecret = req.headers.get("x-admin-secret");
    let isAuthorized = !!(adminSecret && providedSecret && providedSecret === adminSecret);

    if (!isAuthorized) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Não autenticado" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error } = await userClient.auth.getUser();
      if (error || !user) {
        return new Response(JSON.stringify({ error: "Não autenticado" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const sc = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: roleData } = await sc.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!roleData) {
        return new Response(JSON.stringify({ error: "Acesso negado — requer admin" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get all active lovable accounts
    const { data: accounts } = await serviceClient
      .from("lovable_accounts")
      .select("id, user_id, token_encrypted, last_verified_at, token_expires_at")
      .eq("status", "active");

    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ message: "No active accounts" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { user_id: string; valid: boolean; method: string }[] = [];

    for (const account of accounts) {
      try {
        // Verify token against Lovable API
        const verifyRes = await fetch(`${LOVABLE_API}/user/workspaces`, {
          headers: { Authorization: `Bearer ${account.token_encrypted}` },
        });

        const isValid = verifyRes.ok || verifyRes.status === 403;

        if (isValid) {
          await serviceClient.from("lovable_accounts").update({
            last_verified_at: new Date().toISOString(),
          }).eq("id", account.id);
          results.push({ user_id: account.user_id, valid: true, method: "verify" });
        } else {
          // Token expired — mark as expired, user must reconnect
          await serviceClient.from("lovable_accounts").update({
            status: "expired",
          }).eq("id", account.id);
          results.push({ user_id: account.user_id, valid: false, method: "expired" });
        }
      } catch (err) {
        console.error(`[Token Refresh] Error for account ${account.id}:`, err);
        results.push({ user_id: account.user_id, valid: true, method: "network_error" });
      }
    }

    return new Response(JSON.stringify({
      processed: results.length,
      valid: results.filter(r => r.valid).length,
      expired: results.filter(r => !r.valid).length,
      details: results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
