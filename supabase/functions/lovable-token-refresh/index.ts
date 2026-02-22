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
