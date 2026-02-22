import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API = "https://api.lovable.dev";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all active lovable accounts
    const { data: accounts } = await serviceClient
      .from("lovable_accounts")
      .select("id, user_id, token_encrypted")
      .eq("status", "active");

    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ message: "No active accounts" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSynced = 0;

    for (const account of accounts) {
      try {
        // Get workspaces
        const wsRes = await fetch(`${LOVABLE_API}/user/workspaces`, {
          headers: { Authorization: `Bearer ${account.token_encrypted}` },
        });

        if (!wsRes.ok) {
          if (wsRes.status === 401) {
            await serviceClient
              .from("lovable_accounts")
              .update({ status: "expired" })
              .eq("id", account.id);
          }
          continue;
        }

        const wsBody = await wsRes.json();
        // Handle multiple response formats: array, { workspaces: [...] }, { data: [...] }
        const workspaces = Array.isArray(wsBody) ? wsBody : (wsBody?.workspaces || wsBody?.data || []);

        for (const ws of workspaces) {
          try {
            const projRes = await fetch(
              `${LOVABLE_API}/workspaces/${ws.id}/projects?limit=50&visibility=all&user_id=${account.user_id}`,
              { headers: { Authorization: `Bearer ${account.token_encrypted}` } }
            );

            if (!projRes.ok) continue;

            const projects = await projRes.json();
            const projectList = projects?.projects || projects || [];

            for (const proj of projectList) {
              const projectId = proj.id || proj.project_id;
              if (!projectId) continue;

              // Upsert project
              await serviceClient
                .from("lovable_projects")
                .upsert({
                  user_id: account.user_id,
                  lovable_project_id: projectId,
                  workspace_id: ws.id,
                  name: proj.name || null,
                  display_name: proj.display_name || proj.name || null,
                  latest_screenshot_url: proj.latest_screenshot_url || null,
                  published_url: proj.published_url || null,
                  preview_build_commit_sha: proj.preview_build_commit_sha || null,
                  updated_at: new Date().toISOString(),
                }, { onConflict: "user_id,lovable_project_id", ignoreDuplicates: false });

              totalSynced++;
            }
          } catch {
            // Skip workspace errors
          }
        }
      } catch {
        // Skip account errors
      }
    }

    return new Response(JSON.stringify({
      synced: totalSynced,
      accounts_processed: accounts.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Projects sync error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
