import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateVenusLicense, venusJson, VENUS_CORS } from "../_shared/venus-license.ts";

const GITHUB_API = "https://api.github.com";

function json(data: unknown, status = 200) { return venusJson(data, status); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: VENUS_CORS });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "";

  // ── OAuth start (GET) ──
  if (req.method === "GET" && action === "oauth_start") {
    const clientId = Deno.env.get("GITHUB_CLIENT_ID");
    if (!clientId) return json({ error: "GitHub OAuth not configured" }, 500);
    const licenseKey = url.searchParams.get("licenseKey") || "";
    const state = btoa(JSON.stringify({ licenseKey }));
    const ghUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo&state=${encodeURIComponent(state)}`;
    return Response.redirect(ghUrl, 302);
  }

  // ── OAuth callback (GET) ──
  if (req.method === "GET" && action === "oauth_callback") {
    const code = url.searchParams.get("code") || "";
    const stateRaw = url.searchParams.get("state") || "";
    if (!code) return json({ error: "missing code" }, 400);

    const clientId = Deno.env.get("GITHUB_CLIENT_ID") || "";
    const clientSecret = Deno.env.get("GITHUB_CLIENT_SECRET") || "";

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    const tokenData = await tokenRes.json();
    const ghToken = tokenData.access_token;
    if (!ghToken) return json({ error: "OAuth failed" }, 400);

    // Get GitHub user
    const userRes = await fetch(`${GITHUB_API}/user`, { headers: { Authorization: `Bearer ${ghToken}` } });
    const ghUser = await userRes.json();

    // Save token
    let licenseKey = "";
    try { licenseKey = JSON.parse(atob(stateRaw)).licenseKey || ""; } catch { /* ignore */ }

    if (licenseKey) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await supabase.from("venus_github_tokens").upsert(
        { license_key: licenseKey, gh_token: ghToken, gh_user: ghUser.login, updated_at: new Date().toISOString() },
        { onConflict: "license_key" }
      );
    }

    const html = `<!DOCTYPE html><html><body><script>
      window.opener.postMessage({ type: 'VENUS_GH_TOKEN', token: '${ghToken}', user: '${ghUser.login || ""}' }, '*');
      window.close();
    </script><p>Autenticado! Pode fechar esta janela.</p></body></html>`;
    return new Response(html, { status: 200, headers: { "Content-Type": "text/html", ...VENUS_CORS } });
  }

  // ── POST actions ──
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const licenseKey = ((body.licenseKey as string) || req.headers.get("x-clf-token") || "").trim();
  const { valid, error: licErr } = await validateVenusLicense(licenseKey);
  if (!valid) return json({ error: licErr || "invalid_key" }, 401);

  const postAction = (body.action as string) || "";
  const ghToken = (body.gh_token as string) || "";
  if (!ghToken) return json({ error: "gh_token required" }, 400);

  // Helper: push file to GitHub
  async function pushFile(owner: string, repo: string, path: string, content: string, message: string, branch = "main") {
    // Check if file exists to get sha
    const existRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, {
      headers: { Authorization: `Bearer ${ghToken}` },
    });
    let sha: string | undefined;
    if (existRes.ok) {
      const existing = await existRes.json();
      sha = existing.sha;
    }

    const putRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${ghToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message, content: btoa(unescape(encodeURIComponent(content))), branch, ...(sha ? { sha } : {}) }),
    });

    if (!putRes.ok) {
      const errData = await putRes.json().catch(() => ({}));
      throw new Error(errData.message || `GitHub API ${putRes.status}`);
    }
    return await putRes.json();
  }

  if (postAction === "push" || postAction === "create_md" || postAction === "create_task") {
    const { filename, content, message, branch } = body as Record<string, string>;
    if (!filename || !content) return json({ error: "filename and content required" }, 400);

    // Extract owner/repo - user must provide or we get from projectId mapping
    const owner = (body.owner as string) || "";
    const repo = (body.repo as string) || "";
    if (!owner || !repo) return json({ error: "owner and repo required" }, 400);

    try {
      const result = await pushFile(owner, repo, filename, content, message || `Venus: ${postAction}`, branch || "main");
      return json({ ok: true, message: "File pushed successfully", url: result.content?.html_url || "" });
    } catch (e) {
      return json({ error: (e as Error).message }, 500);
    }
  }

  return json({ error: "unknown_action" }, 400);
});
