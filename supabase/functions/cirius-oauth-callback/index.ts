/**
 * Cirius OAuth Callback — Processes OAuth callbacks for GitHub, Vercel, Netlify
 * GET ?provider=github&code=xxx&state=xxx
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function errorHtml(msg: string) {
  return new Response(
    `<!DOCTYPE html><html><body><p>Erro: ${msg}</p><script>setTimeout(()=>window.close(),3000)</script></body></html>`,
    { status: 400, headers: { "Content-Type": "text/html" } }
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const url = new URL(req.url);
  const provider = url.searchParams.get("provider") || "";
  const code = url.searchParams.get("code") || "";
  const stateRaw = url.searchParams.get("state") || "";

  if (!provider || !code || !stateRaw) return errorHtml("Missing params");

  // Decode state — contains user_id
  let userId: string;
  try {
    const decoded = JSON.parse(atob(stateRaw));
    userId = decoded.user_id;
    if (!userId) throw new Error("no user_id");
  } catch {
    return errorHtml("Invalid state");
  }

  const sc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let accessToken = "";
  let refreshToken = "";
  let accountLogin = "";
  let accountId = "";
  let expiresAt: string | null = null;

  try {
    if (provider === "github") {
      const clientId = Deno.env.get("CIRIUS_GITHUB_CLIENT_ID") || "";
      const clientSecret = Deno.env.get("CIRIUS_GITHUB_CLIENT_SECRET") || "";
      if (!clientId || !clientSecret) return errorHtml("GitHub OAuth not configured");

      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
      });
      const tokenData = await tokenRes.json();
      accessToken = tokenData.access_token || "";
      if (!accessToken) return errorHtml("GitHub OAuth failed");

      const userRes = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": "Cirius-Starble" },
      });
      const ghUser = await userRes.json();
      accountLogin = ghUser.login || "";
      accountId = String(ghUser.id || "");
    }

    else if (provider === "vercel") {
      const clientId = Deno.env.get("CIRIUS_VERCEL_CLIENT_ID") || "";
      const clientSecret = Deno.env.get("CIRIUS_VERCEL_CLIENT_SECRET") || "";
      if (!clientId || !clientSecret) return errorHtml("Vercel OAuth not configured");

      const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/cirius-oauth-callback?provider=vercel`;
      const tokenRes = await fetch("https://api.vercel.com/v2/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId, client_secret: clientSecret,
          code, redirect_uri: redirectUri, grant_type: "authorization_code",
        }),
      });
      const tokenData = await tokenRes.json();
      accessToken = tokenData.access_token || "";
      if (!accessToken) return errorHtml("Vercel OAuth failed");

      const userRes = await fetch("https://api.vercel.com/v2/user", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const vUser = await userRes.json();
      accountLogin = vUser.user?.username || vUser.user?.email || "";
      accountId = vUser.user?.uid || "";
    }

    else if (provider === "netlify") {
      const clientId = Deno.env.get("CIRIUS_NETLIFY_CLIENT_ID") || "";
      const clientSecret = Deno.env.get("CIRIUS_NETLIFY_CLIENT_SECRET") || "";
      if (!clientId || !clientSecret) return errorHtml("Netlify OAuth not configured");

      const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/cirius-oauth-callback?provider=netlify`;
      const tokenRes = await fetch("https://api.netlify.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId, client_secret: clientSecret,
          code, redirect_uri: redirectUri, grant_type: "authorization_code",
        }),
      });
      const tokenData = await tokenRes.json();
      accessToken = tokenData.access_token || "";
      refreshToken = tokenData.refresh_token || "";
      if (!accessToken) return errorHtml("Netlify OAuth failed");

      const userRes = await fetch("https://api.netlify.com/api/v1/user", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const nUser = await userRes.json();
      accountLogin = nUser.email || nUser.full_name || "";
      accountId = nUser.id || "";
    }

    else {
      return errorHtml(`Provider "${provider}" not supported`);
    }

    // Upsert integration
    await sc.from("cirius_integrations").upsert({
      user_id: userId,
      provider,
      access_token_enc: accessToken,
      refresh_token_enc: refreshToken || null,
      token_expires_at: expiresAt,
      account_login: accountLogin,
      account_id: accountId,
      is_active: true,
      last_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,provider" });

    // Redirect back to app
    const appUrl = Deno.env.get("CIRIUS_APP_URL") || "https://starble.lovable.app";
    return Response.redirect(`${appUrl}/cirius/integrations?connected=${provider}`, 302);
  } catch (e) {
    console.error(`[cirius-oauth] ${provider} error:`, (e as Error).message);
    return errorHtml((e as Error).message);
  }
});
