/**
 * Cirius OAuth Callback — Processes OAuth callbacks for GitHub, Vercel, Netlify
 * GET ?provider=github&code=xxx&state=xxx
 * State is HMAC-signed to prevent forgery.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function errorHtml(msg: string) {
  // Escape HTML to prevent XSS
  const safe = msg.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return new Response(
    `<!DOCTYPE html><html><body><p>Erro: ${safe}</p><script>setTimeout(()=>window.close(),3000)</script></body></html>`,
    { status: 400, headers: { "Content-Type": "text/html" } }
  );
}

/** HMAC-SHA256 sign */
async function hmacSign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** HMAC-SHA256 verify */
async function hmacVerify(data: string, signature: string, secret: string): Promise<boolean> {
  const expected = await hmacSign(data, secret);
  if (expected.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const url = new URL(req.url);
  const provider = url.searchParams.get("provider") || "";
  const code = url.searchParams.get("code") || "";
  const stateRaw = url.searchParams.get("state") || "";

  if (!provider || !code || !stateRaw) return errorHtml("Missing params");

  // Decode & verify signed state
  const stateSecret = Deno.env.get("CLF_TOKEN_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  let userId: string;
  try {
    // State format: base64({ user_id, ts, sig })
    const decoded = JSON.parse(atob(stateRaw));
    userId = decoded.user_id;
    const ts = decoded.ts;
    const sig = decoded.sig;
    if (!userId || !ts || !sig) throw new Error("incomplete state");

    // Verify HMAC signature
    const payload = `${userId}:${ts}`;
    const valid = await hmacVerify(payload, sig, stateSecret);
    if (!valid) throw new Error("invalid signature");

    // Check timestamp (max 10 min)
    const age = Date.now() - Number(ts);
    if (age > 600_000 || age < 0) throw new Error("state expired");
  } catch {
    return errorHtml("Invalid or expired state");
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
      if (!accessToken) return errorHtml("Authentication failed. Please try again.");

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
      if (!accessToken) return errorHtml("Authentication failed. Please try again.");

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
      if (!accessToken) return errorHtml("Authentication failed. Please try again.");

      const userRes = await fetch("https://api.netlify.com/api/v1/user", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const nUser = await userRes.json();
      accountLogin = nUser.email || nUser.full_name || "";
      accountId = nUser.id || "";
    }

    else {
      return errorHtml("Provider not supported");
    }

    // Upsert integration — tokens stored server-side only
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
    return errorHtml("Authentication failed. Please try again.");
  }
});
