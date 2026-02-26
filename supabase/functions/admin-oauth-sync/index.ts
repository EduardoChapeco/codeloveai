import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-secret",
};

const FIREBASE_TOKEN_URL = "https://securetoken.googleapis.com/v1/token";

/**
 * admin-oauth-sync
 *
 * Manages the admin's Lovable OAuth tokens:
 * - action: "save" — Saves admin tokens (id_token, refresh_token) into internal.admin_secrets
 * - action: "refresh" — Refreshes admin token using stored refresh_token
 * - action: "status" — Returns current admin token status
 *
 * Only accessible by global admins or via Starble_ADMIN_SECRET.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // Auth: admin secret or JWT admin
    const adminSecret = Deno.env.get("Starble_ADMIN_SECRET");
    const providedSecret = req.headers.get("x-admin-secret");
    let isAuthorized = !!(adminSecret && providedSecret && providedSecret === adminSecret);

    const sc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (!isAuthorized) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims) return json({ error: "Não autenticado" }, 401);

      const userId = claimsData.claims.sub as string;
      const { data: roleData } = await sc
        .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
      if (!roleData) return json({ error: "Acesso negado — requer admin" }, 403);
      isAuthorized = true;
    }

    if (!isAuthorized) return json({ error: "Não autorizado" }, 403);

    const body = await req.json();
    const { action } = body;

    // ─── SAVE: Store admin tokens ───
    if (action === "save") {
      const { id_token, refresh_token } = body;
      if (!id_token || !refresh_token) return json({ error: "id_token e refresh_token obrigatórios" }, 400);

      // Store in internal.admin_secrets
      await sc.rpc("exec_sql", {
        query: `
          INSERT INTO internal.admin_secrets (key, value, updated_at)
          VALUES ('admin_lovable_token', '${id_token.replace(/'/g, "''")}', now()),
                 ('admin_lovable_refresh_token', '${refresh_token.replace(/'/g, "''")}', now())
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
        `,
      });

      // Fallback: try direct SQL if rpc doesn't exist
      try {
        const { error: e1 } = await sc.from("admin_secrets" as any)
          .upsert({ key: "admin_lovable_token", value: id_token, updated_at: new Date().toISOString() })
          .select();
        if (e1) throw e1;
        await sc.from("admin_secrets" as any)
          .upsert({ key: "admin_lovable_refresh_token", value: refresh_token, updated_at: new Date().toISOString() })
          .select();
      } catch {
        // Try raw fetch to PostgREST with proper schema header
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        
        for (const [k, v] of [["admin_lovable_token", id_token], ["admin_lovable_refresh_token", refresh_token]]) {
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
      }

      console.log("[Admin OAuth] ✅ Tokens saved to internal.admin_secrets");
      return json({ success: true, message: "Admin tokens saved" });
    }

    // ─── REFRESH: Auto-refresh admin token ───
    if (action === "refresh") {
      const firebaseApiKey = Deno.env.get("FIREBASE_API_KEY");
      if (!firebaseApiKey) return json({ error: "FIREBASE_API_KEY not configured" }, 500);

      // Read refresh token from internal.admin_secrets
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      
      const secretsRes = await fetch(
        `${supabaseUrl}/rest/v1/admin_secrets?key=eq.admin_lovable_refresh_token&select=value`,
        {
          headers: {
            "apikey": serviceKey,
            "Authorization": `Bearer ${serviceKey}`,
            "Accept-Profile": "internal",
          },
        }
      );
      const secrets = await secretsRes.json();
      const refreshToken = Array.isArray(secrets) && secrets.length > 0 ? secrets[0].value : null;

      if (!refreshToken) {
        return json({ error: "No admin refresh token stored. Use 'save' action first." }, 404);
      }

      // Call Firebase to refresh
      const fbRes = await fetch(`${FIREBASE_TOKEN_URL}?key=${firebaseApiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
      });

      if (!fbRes.ok) {
        const errBody = await fbRes.text();
        console.error("[Admin OAuth] Firebase refresh failed:", fbRes.status, errBody);
        return json({ error: "Firebase refresh failed", details: errBody }, 502);
      }

      const fbData = await fbRes.json();
      if (!fbData.id_token) {
        return json({ error: "No id_token in Firebase response" }, 502);
      }

      // Save new tokens
      for (const [k, v] of [
        ["admin_lovable_token", fbData.id_token],
        ["admin_lovable_refresh_token", fbData.refresh_token],
      ]) {
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

      console.log("[Admin OAuth] ✅ Admin token refreshed successfully");
      return json({ success: true, refreshed: true });
    }

    // ─── STATUS: Check admin token status ───
    if (action === "status") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      const secretsRes = await fetch(
        `${supabaseUrl}/rest/v1/admin_secrets?select=key,updated_at&key=in.("admin_lovable_token","admin_lovable_refresh_token")`,
        {
          headers: {
            "apikey": serviceKey,
            "Authorization": `Bearer ${serviceKey}`,
            "Accept-Profile": "internal",
          },
        }
      );
      const secrets = await secretsRes.json();

      const tokenEntry = Array.isArray(secrets) ? secrets.find((s: any) => s.key === "admin_lovable_token") : null;
      const refreshEntry = Array.isArray(secrets) ? secrets.find((s: any) => s.key === "admin_lovable_refresh_token") : null;

      return json({
        has_token: !!tokenEntry,
        has_refresh_token: !!refreshEntry,
        token_updated_at: tokenEntry?.updated_at || null,
        refresh_updated_at: refreshEntry?.updated_at || null,
        env_token_configured: !!Deno.env.get("ADMIN_LOVABLE_TOKEN"),
        firebase_key_configured: !!Deno.env.get("FIREBASE_API_KEY"),
      });
    }

    return json({ error: "Ação não reconhecida" }, 400);
  } catch (error) {
    console.error("[Admin OAuth] Error:", error);
    return json({ error: "Erro interno" }, 500);
  }
});
