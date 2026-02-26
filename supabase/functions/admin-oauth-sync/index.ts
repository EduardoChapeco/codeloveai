// admin-oauth-sync v5.0.0 — Simplified (no Firebase, no admin token refresh)
// Only saves/checks user lovable account tokens. No more Firebase refresh.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const adminSecret = Deno.env.get("CODELOVE_ADMIN_SECRET");
    const providedSecret = req.headers.get("x-admin-secret");
    let isAuthorized = !!(adminSecret && providedSecret && providedSecret === adminSecret);

    const sc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (!isAuthorized) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

      const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error } = await userClient.auth.getUser();
      if (error || !user) return json({ error: "Não autenticado" }, 401);

      const { data: roleData } = await sc.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!roleData) return json({ error: "Acesso negado — requer admin" }, 403);
      isAuthorized = true;
    }

    if (!isAuthorized) return json({ error: "Não autorizado" }, 403);

    const body = await req.json();
    const { action } = body;

    if (action === "status") {
      const { data: accounts } = await sc.from("lovable_accounts")
        .select("id, user_id, status, last_verified_at, token_expires_at")
        .order("created_at", { ascending: false })
        .limit(10);

      return json({
        accounts: (accounts || []).map((a: any) => ({
          id: a.id,
          user_id: a.user_id,
          status: a.status,
          last_verified_at: a.last_verified_at,
          token_expires_at: a.token_expires_at,
        })),
        firebase_removed: true,
        auth_method: "CLF1_only",
      });
    }

    return json({ error: "Ação não reconhecida. Ações disponíveis: status" }, 400);
  } catch (error) {
    console.error("[Admin OAuth] Error:", error);
    return json({ error: "Erro interno" }, 500);
  }
});
