import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all active sync jobs
    const { data: jobs } = await serviceClient
      .from("supabase_migration_jobs")
      .select("*")
      .eq("sync_active", true)
      .in("status", ["completed", "partial"]);

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ message: "No active sync jobs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API = "https://api.lovable.dev";
    const results: { project_id: string; synced: boolean; error?: string }[] = [];

    for (const job of jobs) {
      try {
        // Get Lovable token for the user
        const { data: account } = await serviceClient
          .from("lovable_accounts")
          .select("token_encrypted, status")
          .eq("user_id", job.user_id)
          .maybeSingle();

        if (!account || account.status !== "active") {
          results.push({ project_id: job.project_id, synced: false, error: "Token expired" });
          continue;
        }

        const lovableToken = account.token_encrypted;

        // Get current source code
        const srcRes = await fetch(`${LOVABLE_API}/projects/${job.project_id}/source-code`, {
          headers: { Authorization: `Bearer ${lovableToken}` },
        });

        if (!srcRes.ok) {
          results.push({ project_id: job.project_id, synced: false, error: "Failed to fetch source" });
          continue;
        }

        const srcData = await srcRes.json();
        const files = srcData?.files || (Array.isArray(srcData) ? srcData : []);

        // Get migration files
        const migrationFiles = files.filter((f: { path: string }) =>
          f.path?.startsWith("supabase/migrations/") && f.path.endsWith(".sql")
        );

        // Check snapshot hash
        const { data: snapshot } = await serviceClient
          .from("project_source_snapshots")
          .select("snapshot_hash")
          .eq("project_id", job.project_id)
          .maybeSingle();

        // Hash current migrations
        const migContent = migrationFiles.map((f: { content: string }) => f.content).join("\n");
        const encoder = new TextEncoder();
        const hashBuf = await crypto.subtle.digest("SHA-256", encoder.encode(migContent));
        const currentHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("");

        if (snapshot?.snapshot_hash === currentHash) {
          results.push({ project_id: job.project_id, synced: true });
          continue; // No changes
        }

        // Find new migrations (not in tables_migrated)
        const alreadyMigrated = new Set(job.tables_migrated || []);
        const newMigrations = migrationFiles.filter((f: { path: string }) => !alreadyMigrated.has(f.path));

        if (newMigrations.length === 0) {
          // Update hash only
          await serviceClient.from("project_source_snapshots").upsert({
            project_id: job.project_id,
            snapshot_hash: currentHash,
            last_checked: new Date().toISOString(),
          }, { onConflict: "project_id" });
          results.push({ project_id: job.project_id, synced: true });
          continue;
        }

        // Apply new migrations to destination
        const destClient = createClient(job.dest_supabase_url!, job.dest_service_role_key_encrypted!);
        const newlyMigrated: string[] = [];

        for (const mig of newMigrations) {
          try {
            const { error } = await destClient.rpc("exec_sql", { sql: mig.content });
            if (!error) newlyMigrated.push(mig.path);
          } catch { /* skip failed */ }
        }

        // Update job
        const allMigrated = [...(job.tables_migrated || []), ...newlyMigrated];
        await serviceClient
          .from("supabase_migration_jobs")
          .update({
            tables_migrated: allMigrated,
            last_sync_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        // Update snapshot
        await serviceClient.from("project_source_snapshots").upsert({
          project_id: job.project_id,
          snapshot_hash: currentHash,
          last_checked: new Date().toISOString(),
        }, { onConflict: "project_id" });

        results.push({ project_id: job.project_id, synced: true });
      } catch (e) {
        results.push({ project_id: job.project_id, synced: false, error: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Sync cron error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
