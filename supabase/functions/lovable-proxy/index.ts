import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_BASE = "https://api.lovable.dev";

async function getLovableToken(serviceClient: any, userId: string): Promise<string | null> {
  const { data } = await serviceClient
    .from("lovable_accounts")
    .select("token_encrypted, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || data.status !== "active") return null;
  return data.token_encrypted;
}

async function logApiCall(
  serviceClient: any,
  userId: string | null,
  endpoint: string,
  method: string,
  responseStatus: number | null,
  durationMs: number
) {
  try {
    await serviceClient.from("lovable_api_calls_log").insert({
      user_id: userId,
      endpoint,
      method,
      response_status: responseStatus,
      duration_ms: durationMs,
    });
  } catch (e) {
    console.error("Failed to log API call:", e);
  }
}

async function markTokenExpired(serviceClient: any, userId: string) {
  await serviceClient
    .from("lovable_accounts")
    .update({ status: "expired" })
    .eq("user_id", userId);
}

async function getUserIdFromJwt(authHeader: string, supabaseUrl: string, anonKey: string): Promise<string | null> {
  try {
    // Use getClaims for proper JWT verification instead of manual decode
    const token = authHeader.replace("Bearer ", "");
    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data, error } = await client.auth.getClaims(token);
    if (error || !data?.claims) return null;
    return (data.claims.sub as string) || null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get userId via verified JWT claims, fallback to getUser()
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    let userId = await getUserIdFromJwt(authHeader, supabaseUrl, supabaseAnonKey);
    if (!userId) {
      const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error } = await anonClient.auth.getUser();
      if (error || !user) {
        return new Response(JSON.stringify({ error: "Não autenticado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    const body = req.method !== "GET" ? await req.json().catch(() => ({})) : {};
    const action = body.action || "";
    const lovableRoute = body.route || "";
    const lovableMethod = body.method || "GET";
    const lovableBody = body.payload || null;

    if (!lovableRoute && action !== "save-token" && action !== "delete-token" && action !== "verify" && action !== "refresh-token") {
      return new Response(JSON.stringify({ error: "Route é obrigatória" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate lovableRoute to prevent SSRF
    if (lovableRoute) {
      if (
        !lovableRoute.startsWith("/") ||
        lovableRoute.includes("..") ||
        lovableRoute.includes("://") ||
        lovableRoute.includes("\\") ||
        lovableRoute.includes("\n") ||
        lovableRoute.includes("\r") ||
        lovableRoute.includes("\0")
      ) {
        return new Response(JSON.stringify({ error: "Route inválida" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const allowedPrefixes = [
        "/projects/", "/workspaces/", "/profile/", "/user/", "/users/",
        "/permissions", "/files/",
      ];
      const isAllowed = allowedPrefixes.some(prefix => lovableRoute.startsWith(prefix));
      if (!isAllowed) {
        return new Response(JSON.stringify({ error: "Route não permitida" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ─── Handle token management actions ───
    if (action === "save-token") {
      const tokenValue = body.token;
      if (!tokenValue || typeof tokenValue !== "string" || tokenValue.length < 10) {
        return new Response(JSON.stringify({ error: "Token inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify token against Lovable API
      // Try /user/workspaces as a reliable verification endpoint
      let tokenValid = false;
      try {
        const verifyRes = await fetch(`${LOVABLE_API_BASE}/user/workspaces`, {
          headers: { Authorization: `Bearer ${tokenValue}` },
        });
        tokenValid = verifyRes.ok || verifyRes.status === 403; // 403 = authenticated but no access
        
        // If /user/workspaces fails, try /permissions as fallback
        if (!tokenValid) {
          const permRes = await fetch(`${LOVABLE_API_BASE}/permissions`, {
            headers: { Authorization: `Bearer ${tokenValue}` },
          });
          tokenValid = permRes.ok || permRes.status === 403;
        }
      } catch (fetchErr) {
        console.error("Token verification fetch error:", fetchErr);
        // Network error — allow saving as "unverified" to not block users
        // The token will be marked expired on first actual API call if invalid
        tokenValid = true;
        console.warn("Token saved without external verification due to network error");
      }

      if (!tokenValid) {
        return new Response(JSON.stringify({ error: "Token Lovable inválido ou expirado" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: upsertError } = await serviceClient
        .from("lovable_accounts")
        .upsert(
          { user_id: userId, token_encrypted: tokenValue, status: "active", last_verified_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );

      if (upsertError) {
        console.error("Upsert error:", upsertError);
        return new Response(JSON.stringify({ error: "Erro ao salvar token: " + upsertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const duration = Date.now() - startTime;
      await logApiCall(serviceClient, userId, "save-token", "POST", 200, duration);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete-token") {
      await serviceClient.from("lovable_accounts").delete().eq("user_id", userId);
      const duration = Date.now() - startTime;
      await logApiCall(serviceClient, userId, "delete-token", "POST", 200, duration);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Handle refresh-token action ───
    if (action === "refresh-token") {
      // Re-verify the existing token against Lovable API
      const existingToken = await getLovableToken(serviceClient, userId);
      if (!existingToken) {
        return new Response(JSON.stringify({ error: "Nenhum token configurado para renovar." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify if the token is still valid
      let tokenValid = false;
      try {
        const verifyRes = await fetch(`${LOVABLE_API_BASE}/user/workspaces`, {
          headers: { Authorization: `Bearer ${existingToken}` },
        });
        tokenValid = verifyRes.ok || verifyRes.status === 403;
      } catch {
        tokenValid = false;
      }

      if (!tokenValid) {
        await markTokenExpired(serviceClient, userId);
        const duration = Date.now() - startTime;
        await logApiCall(serviceClient, userId, "refresh-token", "POST", 401, duration);
        return new Response(JSON.stringify({ error: "Token expirado. Reconecte sua conta." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Token is still valid — update last_verified_at
      await serviceClient
        .from("lovable_accounts")
        .update({ status: "active", last_verified_at: new Date().toISOString() })
        .eq("user_id", userId);

      const duration = Date.now() - startTime;
      await logApiCall(serviceClient, userId, "refresh-token", "POST", 200, duration);
      return new Response(JSON.stringify({ success: true, refreshed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Proxy to Lovable API ───
    const lovableToken = await getLovableToken(serviceClient, userId);
    if (!lovableToken) {
      return new Response(JSON.stringify({ error: "Token Lovable não configurado. Conecte sua conta primeiro." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiUrl = `${LOVABLE_API_BASE}${lovableRoute}`;

    const fetchOptions: RequestInit = {
      method: lovableMethod,
      headers: {
        Authorization: `Bearer ${lovableToken}`,
        "Content-Type": "application/json",
      },
    };

    if (lovableBody && lovableMethod !== "GET") {
      fetchOptions.body = JSON.stringify(lovableBody);
    }

    const apiRes = await fetch(apiUrl, fetchOptions);
    const duration = Date.now() - startTime;

    // Handle 401 from Lovable — mark token as expired
    if (apiRes.status === 401) {
      await markTokenExpired(serviceClient, userId);
      await logApiCall(serviceClient, userId, lovableRoute, lovableMethod, 401, duration);
      return new Response(JSON.stringify({ error: "Token Lovable expirado. Reconecte sua conta." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await logApiCall(serviceClient, userId, lovableRoute, lovableMethod, apiRes.status, duration);

    const contentType = apiRes.headers.get("content-type") || "application/json";
    const responseBody = await apiRes.text();

    return new Response(responseBody, {
      status: apiRes.status,
      headers: { ...corsHeaders, "Content-Type": contentType },
    });
  } catch (error) {
    console.error("Lovable proxy error:", error);
    return new Response(JSON.stringify({ error: "Erro interno no proxy" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
