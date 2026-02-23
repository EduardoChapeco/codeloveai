import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API = "https://api.lovable.dev";

// Firebase token refresh endpoint
// Lovable uses Firebase Auth — refresh tokens can generate new ID tokens
const FIREBASE_TOKEN_REFRESH_URL = "https://securetoken.googleapis.com/v1/token";

/**
 * Attempt to refresh a Firebase ID token using the refresh_token.
 * Returns { id_token, refresh_token } on success, or null on failure.
 */
async function refreshFirebaseToken(
  refreshToken: string,
  firebaseApiKey: string
): Promise<{ id_token: string; refresh_token: string; expires_in: string } | null> {
  try {
    const res = await fetch(`${FIREBASE_TOKEN_REFRESH_URL}?key=${firebaseApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`Firebase refresh failed (${res.status}):`, errBody);
      return null;
    }

    const data = await res.json();
    if (data.id_token && data.refresh_token) {
      return {
        id_token: data.id_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in || "3600",
      };
    }
    return null;
  } catch (e) {
    console.error("Firebase refresh error:", e);
    return null;
  }
}

/**
 * Try to detect Lovable's Firebase API key.
 * We try to use the stored secret first, fallback to well-known keys.
 */
function getFirebaseApiKey(): string | null {
  // Primary: explicit secret set by admin
  const key = Deno.env.get("LOVABLE_FIREBASE_API_KEY");
  if (key) return key;

  // If not set, return null — admin needs to configure it
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require admin authentication OR a valid Starble_ADMIN_SECRET header (for cron jobs)
    const adminSecret = Deno.env.get("Starble_ADMIN_SECRET");
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

    const firebaseApiKey = getFirebaseApiKey();

    // Get all active lovable accounts
    const { data: accounts } = await serviceClient
      .from("lovable_accounts")
      .select("id, user_id, token_encrypted, refresh_token_encrypted, last_verified_at, token_expires_at, auto_refresh_enabled, refresh_failure_count")
      .eq("status", "active");

    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ message: "No active accounts" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { user_id: string; valid: boolean; refreshed: boolean; method: string }[] = [];

    for (const account of accounts) {
      try {
        // Step 1: Check if current token is still valid
        const verifyRes = await fetch(`${LOVABLE_API}/user/workspaces`, {
          headers: { Authorization: `Bearer ${account.token_encrypted}` },
        });

        const isValid = verifyRes.ok || verifyRes.status === 403;

        if (isValid) {
          // Token still valid — update last_verified_at
          await serviceClient
            .from("lovable_accounts")
            .update({
              last_verified_at: new Date().toISOString(),
              refresh_failure_count: 0,
            })
            .eq("id", account.id);
          results.push({ user_id: account.user_id, valid: true, refreshed: false, method: "verify" });
          continue;
        }

        // Step 2: Token expired — try to refresh using refresh_token
        if (
          account.auto_refresh_enabled &&
          account.refresh_token_encrypted &&
          firebaseApiKey &&
          (account.refresh_failure_count || 0) < 5 // Stop after 5 consecutive failures
        ) {
          console.log(`[Token Refresh] Attempting Firebase refresh for user ${account.user_id}`);

          const refreshResult = await refreshFirebaseToken(
            account.refresh_token_encrypted,
            firebaseApiKey
          );

          if (refreshResult) {
            // Success! Update with new tokens
            const expiresIn = parseInt(refreshResult.expires_in || "3600", 10);
            const tokenExpiresAt = new Date(Date.now() + (expiresIn - 300) * 1000).toISOString(); // 5 min safety margin

            await serviceClient
              .from("lovable_accounts")
              .update({
                token_encrypted: refreshResult.id_token,
                refresh_token_encrypted: refreshResult.refresh_token,
                token_expires_at: tokenExpiresAt,
                last_verified_at: new Date().toISOString(),
                status: "active",
                refresh_failure_count: 0,
              })
              .eq("id", account.id);

            console.log(`[Token Refresh] ✅ Successfully refreshed token for user ${account.user_id}`);
            results.push({ user_id: account.user_id, valid: true, refreshed: true, method: "firebase_refresh" });
            continue;
          } else {
            // Refresh failed — increment failure count
            const newFailCount = (account.refresh_failure_count || 0) + 1;
            const shouldExpire = newFailCount >= 5;

            await serviceClient
              .from("lovable_accounts")
              .update({
                refresh_failure_count: newFailCount,
                ...(shouldExpire ? { status: "expired" } : {}),
              })
              .eq("id", account.id);

            if (shouldExpire) {
              console.warn(`[Token Refresh] ❌ Max failures reached for user ${account.user_id}, marking expired`);
              results.push({ user_id: account.user_id, valid: false, refreshed: false, method: "max_failures" });
            } else {
              console.warn(`[Token Refresh] ⚠️ Refresh failed for user ${account.user_id} (attempt ${newFailCount}/5)`);
              results.push({ user_id: account.user_id, valid: true, refreshed: false, method: "retry_later" });
            }
            continue;
          }
        }

        // Step 3: No refresh token available or auto_refresh disabled — mark expired
        await serviceClient
          .from("lovable_accounts")
          .update({ status: "expired" })
          .eq("id", account.id);
        results.push({ user_id: account.user_id, valid: false, refreshed: false, method: "no_refresh_token" });
      } catch {
        // Network error — skip, don't expire
        results.push({ user_id: account.user_id, valid: true, refreshed: false, method: "network_error" });
      }
    }

    return new Response(JSON.stringify({
      processed: results.length,
      valid: results.filter(r => r.valid).length,
      expired: results.filter(r => !r.valid).length,
      refreshed: results.filter(r => r.refreshed).length,
      firebase_api_key_configured: !!firebaseApiKey,
      details: results,
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
