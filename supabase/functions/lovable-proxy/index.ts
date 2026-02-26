import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_BASE = "https://api.lovable.dev";

function getFirebaseApiKey(): string | null {
  const key = Deno.env.get("FIREBASE_API_KEY");
  if (!key || typeof key !== "string") return null;
  return key.trim() || null;
}

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
    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    // Use getUser for proper JWT verification (compatible with all supabase-js v2)
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}

function isProjectChatRoute(route: string): boolean {
  return /^\/projects\/[0-9a-f-]{36}\/chat(?:$|\?)/i.test(route);
}

function normalizeChatPayload(rawPayload: unknown): Record<string, unknown> {
  const payload = rawPayload && typeof rawPayload === "object"
    ? { ...(rawPayload as Record<string, unknown>) }
    : {};

  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  if (!message) {
    throw new Error("Message é obrigatória para rota de chat.");
  }

  return {
    ...payload,
    id: typeof payload.id === "string" && payload.id ? payload.id : crypto.randomUUID(),
    message,
    intent: "security_fix_v2",
    chat_only: false,
    ai_message_id:
      typeof payload.ai_message_id === "string" && payload.ai_message_id
        ? payload.ai_message_id
        : `aimsg_${crypto.randomUUID().replace(/-/g, "").slice(0, 26)}`,
    thread_id: typeof payload.thread_id === "string" && payload.thread_id ? payload.thread_id : "main",
    view: "security",
    view_description:
      typeof payload.view_description === "string" && payload.view_description.trim()
        ? payload.view_description
        : "The user is currently viewing the security view for their project.",
    model: null,
    files: Array.isArray(payload.files) ? payload.files : [],
    optimisticImageUrls: Array.isArray(payload.optimisticImageUrls) ? payload.optimisticImageUrls : [],
    selected_elements: Array.isArray(payload.selected_elements) ? payload.selected_elements : [],
    debug_mode: false,
    session_replay: typeof payload.session_replay === "string" ? payload.session_replay : "[]",
    client_logs: Array.isArray(payload.client_logs) ? payload.client_logs : [],
    network_requests: Array.isArray(payload.network_requests) ? payload.network_requests : [],
    runtime_errors: Array.isArray(payload.runtime_errors) ? payload.runtime_errors : [],
    integration_metadata:
      payload.integration_metadata && typeof payload.integration_metadata === "object"
        ? payload.integration_metadata
        : {
            browser: {
              preview_viewport_width: 1280,
              preview_viewport_height: 854,
            },
          },
  };
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

    // Get userId via verified JWT claims
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userId = await getUserIdFromJwt(authHeader, supabaseUrl, supabaseAnonKey);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = req.method !== "GET" ? await req.json().catch(() => ({})) : {};
    const action = body.action || "";
    const lovableRoute = body.route || "";
    const lovableMethod = (body.method || "GET").toUpperCase();
    let lovableBody = body.payload || null;

    if (lovableRoute && lovableMethod !== "GET" && isProjectChatRoute(lovableRoute)) {
      try {
        lovableBody = normalizeChatPayload(lovableBody);
      } catch (normalizeErr) {
        return new Response(JSON.stringify({ error: normalizeErr instanceof Error ? normalizeErr.message : "Payload de chat inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

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
      const refreshTokenValue = body.refreshToken || null;
      if (!tokenValue || typeof tokenValue !== "string" || tokenValue.length < 10) {
        return new Response(JSON.stringify({ error: "Token inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify token against Lovable API
      let tokenValid = false;
      try {
        const verifyRes = await fetch(`${LOVABLE_API_BASE}/user/workspaces`, {
          headers: { Authorization: `Bearer ${tokenValue}` },
        });
        tokenValid = verifyRes.ok || verifyRes.status === 403;

        if (!tokenValid) {
          const permRes = await fetch(`${LOVABLE_API_BASE}/permissions`, {
            headers: { Authorization: `Bearer ${tokenValue}` },
          });
          tokenValid = permRes.ok || permRes.status === 403;
        }
      } catch (fetchErr) {
        console.error("Token verification fetch error:", fetchErr);
        tokenValid = true;
        console.warn("Token saved without external verification due to network error");
      }

      if (!tokenValid) {
        return new Response(JSON.stringify({ error: "Token Lovable inválido ou expirado" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: adminRole } = await serviceClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      const isAdminUser = !!adminRole;

      // Calculate token expiration (Firebase ID tokens expire in 1 hour)
      const tokenExpiresAt = new Date(Date.now() + 55 * 60 * 1000).toISOString(); // 55 min (safe margin)

      const upsertData: Record<string, unknown> = {
        user_id: userId,
        token_encrypted: tokenValue,
        status: "active",
        last_verified_at: new Date().toISOString(),
        token_expires_at: tokenExpiresAt,
        refresh_failure_count: 0,
        auto_refresh_enabled: true,
        ...(isAdminUser ? { is_admin_account: true } : {}),
      };

      // Store refresh_token if provided
      if (refreshTokenValue && typeof refreshTokenValue === "string" && refreshTokenValue.length > 10) {
        upsertData.refresh_token_encrypted = refreshTokenValue;
      }

      const { error: upsertError } = await serviceClient
        .from("lovable_accounts")
        .upsert(upsertData, { onConflict: "user_id" });

      if (upsertError) {
        console.error("Upsert error:", upsertError);
        return new Response(JSON.stringify({ error: "Erro ao salvar token: " + upsertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Keep admin OAuth secrets synced for Brain/backoffice automation
      if (isAdminUser && refreshTokenValue && typeof refreshTokenValue === "string" && refreshTokenValue.length > 10) {
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

          for (const [k, v] of [["admin_lovable_token", tokenValue], ["admin_lovable_refresh_token", refreshTokenValue]]) {
            await fetch(`${supabaseUrl}/rest/v1/admin_secrets?on_conflict=key`, {
              method: "POST",
              headers: {
                "apikey": serviceKey,
                "Authorization": `Bearer ${serviceKey}`,
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates",
                "Accept-Profile": "internal",
                "Content-Profile": "internal",
              },
              body: JSON.stringify({ key: k, value: v, updated_at: new Date().toISOString() }),
            });
          }
        } catch (syncErr) {
          console.error("Failed to sync admin secrets from save-token:", syncErr);
        }
      }

      const duration = Date.now() - startTime;
      await logApiCall(serviceClient, userId, "save-token", "POST", 200, duration);

      return new Response(JSON.stringify({ success: true, hasRefreshToken: !!refreshTokenValue, isAdminUser }), {
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
    const { data: accountData } = await serviceClient
      .from("lovable_accounts")
      .select("token_encrypted, refresh_token_encrypted, status, auto_refresh_enabled")
      .eq("user_id", userId)
      .maybeSingle();

    if (!accountData || accountData.status !== "active") {
      return new Response(JSON.stringify({ error: "Token Lovable não configurado. Conecte sua conta primeiro." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let lovableToken = accountData.token_encrypted;
    const apiUrl = `${LOVABLE_API_BASE}${lovableRoute}`;

    const fetchOptions: RequestInit = {
      method: lovableMethod,
      headers: {
        Authorization: `Bearer ${lovableToken}`,
        "Content-Type": "application/json",
        Origin: "https://lovable.dev",
        Referer: "https://lovable.dev/",
      },
    };

    if (lovableBody && lovableMethod !== "GET") {
      fetchOptions.body = JSON.stringify(lovableBody);
    }

    let apiRes = await fetch(apiUrl, fetchOptions);
    const duration = Date.now() - startTime;

    // Handle 401 from Lovable — try auto-refresh before marking expired
    if (apiRes.status === 401) {
      const firebaseApiKey = getFirebaseApiKey();

      if (
        accountData.auto_refresh_enabled &&
        accountData.refresh_token_encrypted &&
        firebaseApiKey
      ) {
        // Attempt Firebase token refresh
        try {
          const refreshRes = await fetch(
            `https://securetoken.googleapis.com/v1/token?key=${firebaseApiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(accountData.refresh_token_encrypted)}`,
            }
          );

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            if (refreshData.id_token) {
              // Update DB with new tokens
              const expiresIn = parseInt(refreshData.expires_in || "3600", 10);
              await serviceClient
                .from("lovable_accounts")
                .update({
                  token_encrypted: refreshData.id_token,
                  refresh_token_encrypted: refreshData.refresh_token || accountData.refresh_token_encrypted,
                  token_expires_at: new Date(Date.now() + (expiresIn - 300) * 1000).toISOString(),
                  last_verified_at: new Date().toISOString(),
                  status: "active",
                  refresh_failure_count: 0,
                })
                .eq("user_id", userId);

              // Retry the original API call with the new token
              lovableToken = refreshData.id_token;
              const retryOptions: RequestInit = {
                method: lovableMethod,
                headers: {
                  Authorization: `Bearer ${lovableToken}`,
                  "Content-Type": "application/json",
                  Origin: "https://lovable.dev",
                  Referer: "https://lovable.dev/",
                },
              };
              if (lovableBody && lovableMethod !== "GET") {
                retryOptions.body = JSON.stringify(lovableBody);
              }

              apiRes = await fetch(apiUrl, retryOptions);
              console.log(`[Proxy] Token auto-refreshed for user ${userId}, retry status: ${apiRes.status}`);

              if (apiRes.status !== 401) {
                // Refresh worked! Continue with the response below
                await logApiCall(serviceClient, userId, lovableRoute, lovableMethod, apiRes.status, Date.now() - startTime);
                const contentType = apiRes.headers.get("content-type") || "application/json";
                const responseBody = await apiRes.text();
                return new Response(responseBody, {
                  status: apiRes.status,
                  headers: { ...corsHeaders, "Content-Type": contentType },
                });
              }
            }
          }
        } catch (refreshErr) {
          console.error("[Proxy] Auto-refresh failed:", refreshErr);
        }
      }

      // Refresh failed or not available — mark expired
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
