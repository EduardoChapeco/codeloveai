import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { project_id, dest_supabase_url, dest_service_role_key } = body;

    if (!project_id || !dest_supabase_url || !dest_service_role_key) {
      return new Response(JSON.stringify({ error: "project_id, dest_supabase_url e dest_service_role_key são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate dest URL format
    try {
      const url = new URL(dest_supabase_url);
      if (!url.hostname.includes("supabase")) {
        return new Response(JSON.stringify({ error: "URL do Supabase inválida" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch {
      return new Response(JSON.stringify({ error: "URL inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Lovable token to access source project
    const { data: account } = await serviceClient
      .from("lovable_accounts")
      .select("token_encrypted, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!account || account.status !== "active") {
      return new Response(JSON.stringify({ error: "Lovable não conectado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lovableToken = account.token_encrypted;
    const LOVABLE_API = "https://api.lovable.dev";

    // Get source project cloud config
    let sourceSupabaseUrl = "";
    try {
      const cloudRes = await fetch(`${LOVABLE_API}/projects/${project_id}/cloud/config`, {
        headers: { Authorization: `Bearer ${lovableToken}` },
      });
      if (cloudRes.ok) {
        const cloudData = await cloudRes.json();
        sourceSupabaseUrl = cloudData?.supabase_url || cloudData?.url || "";
      }
    } catch (e) {
      console.warn("Failed to get cloud config:", e);
    }

    // Get source code to find migration files
    let migrationFiles: { path: string; content: string }[] = [];
    try {
      const srcRes = await fetch(`${LOVABLE_API}/projects/${project_id}/source-code`, {
        headers: { Authorization: `Bearer ${lovableToken}` },
      });
      if (srcRes.ok) {
        const srcData = await srcRes.json();
        const files = srcData?.files || (Array.isArray(srcData) ? srcData : []);
        migrationFiles = files.filter((f: { path: string }) =>
          f.path?.startsWith("supabase/migrations/") && f.path.endsWith(".sql")
        );
      }
    } catch (e) {
      console.warn("Failed to get source code:", e);
    }

    // Create migration job
    const { data: job, error: jobErr } = await serviceClient
      .from("supabase_migration_jobs")
      .insert({
        user_id: user.id,
        project_id,
        source_supabase_url: sourceSupabaseUrl,
        dest_supabase_url: dest_supabase_url,
        dest_service_role_key_encrypted: dest_service_role_key,
        status: "running",
      })
      .select("id")
      .single();

    if (jobErr) {
      return new Response(JSON.stringify({ error: "Falha ao criar job de migração" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Connect to destination Supabase and run migrations
    const destClient = createClient(dest_supabase_url, dest_service_role_key);
    const migratedTables: string[] = [];
    const errors: string[] = [];

    for (const migFile of migrationFiles) {
      try {
        // Execute SQL migration via RPC or direct query
        const { error: migErr } = await destClient.rpc("exec_sql", { sql: migFile.content });
        if (migErr) {
          errors.push(`${migFile.path}: ${migErr.message}`);
        } else {
          migratedTables.push(migFile.path);
        }
      } catch (e) {
        errors.push(`${migFile.path}: ${(e as Error).message}`);
      }
    }

    // Update job status
    const finalStatus = errors.length === 0 ? "completed" : (migratedTables.length > 0 ? "partial" : "failed");
    await serviceClient
      .from("supabase_migration_jobs")
      .update({
        status: finalStatus,
        tables_migrated: migratedTables,
        error_log: errors.length > 0 ? errors.join("\n") : null,
      })
      .eq("id", job.id);

    return new Response(JSON.stringify({
      success: true,
      job_id: job.id,
      status: finalStatus,
      migrations_applied: migratedTables.length,
      errors: errors.length,
      error_details: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Migration error:", error);
    return new Response(JSON.stringify({ error: "Erro interno na migração" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
