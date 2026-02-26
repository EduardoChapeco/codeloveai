// lovable-automation v3.0.0 — Automation rules CRUD + execution
// CRITICAL: All Lovable API calls use intent=security_fix_v2, chat_only=false
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const GIT_SHA = "9810ecd6b501b23b14c5d4ee731d8cda244d003b";
const LOVABLE_API = "https://api.lovable.dev";

// ── HARDCODED — NUNCA ALTERAR ──
const INTENT = "security_fix_v2";
const CHAT_ONLY = false; // NUNCA true
const VIEW = "security";
const VIEW_DESC = "The user is currently viewing the security view for their project.";

function fail(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function ok(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  // Auth via JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return fail("Unauthorized", 401);
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return fail("Unauthorized", 401);

  const { data: roleData } = await admin.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  const isAdmin = roleData?.role === "admin";

  let body: Record<string, unknown> = {};
  if (req.method !== "GET") {
    try { body = await req.json(); } catch { body = {}; }
  }
  const action = (body.action as string) || new URL(req.url).searchParams.get("action") || "list";

  // ─── LIST ───
  if (action === "list") {
    const query = admin.from("automation_rules").select("*").order("created_at", { ascending: false });
    if (!isAdmin) query.eq("user_id", user.id);
    const { data, error } = await query;
    if (error) return fail(error.message, 500);
    return ok({ rules: data || [] });
  }

  // ─── CREATE ───
  if (action === "create") {
    const { name, trigger_type, action_type, project_id, message_template, cron_expression } = body as Record<string, string>;
    if (!name || !action_type || !project_id) return fail("name, action_type, project_id required");
    const { data, error } = await admin.from("automation_rules").insert({
      name, trigger_type: trigger_type || "manual", action_type, project_id,
      message_template: message_template || "", cron_expression: cron_expression || null,
      user_id: user.id, is_active: true,
    }).select().single();
    if (error) return fail(error.message, 500);
    return ok({ rule: data });
  }

  // ─── UPDATE ───
  if (action === "update") {
    const { id, ...updates } = body as Record<string, unknown>;
    if (!id) return fail("id required");
    const query = admin.from("automation_rules").update(updates).eq("id", id);
    if (!isAdmin) query.eq("user_id", user.id);
    const { data, error } = await query.select().single();
    if (error) return fail(error.message, 500);
    return ok({ rule: data });
  }

  // ─── DELETE ───
  if (action === "delete") {
    const { id } = body as Record<string, string>;
    if (!id) return fail("id required");
    const query = admin.from("automation_rules").delete().eq("id", id);
    if (!isAdmin) query.eq("user_id", user.id);
    const { error } = await query;
    if (error) return fail(error.message, 500);
    return ok({ deleted: true });
  }

  // ─── RUN ───
  if (action === "run") {
    const { id } = body as Record<string, string>;
    if (!id) return fail("id required");
    const ruleQuery = admin.from("automation_rules").select("*").eq("id", id);
    if (!isAdmin) ruleQuery.eq("user_id", user.id);
    const { data: rule, error } = await ruleQuery.single();
    if (error || !rule) return fail("Rule not found", 404);

    const { data: account } = await admin.from("lovable_accounts")
      .select("token_encrypted").eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (!account?.token_encrypted) return fail("No active Lovable account connected", 400);

    const lovableToken = account.token_encrypted;

    if (rule.action_type === "publish") {
      const res = await fetch(`${LOVABLE_API}/projects/${rule.project_id}/deployments?async=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableToken}`, Origin: "https://lovable.dev", Referer: "https://lovable.dev/" },
        body: JSON.stringify({}),
      });
      const status = res.ok ? "success" : "error";
      const resBody = await res.text().catch(() => "");
      await admin.from("automation_runs").insert({ rule_id: id, user_id: user.id, status, result: resBody.slice(0, 500) });
      await admin.from("automation_rules").update({ last_run_at: new Date().toISOString(), run_count: (rule.run_count || 0) + 1 }).eq("id", id);
      return ok({ status, message: res.ok ? "Published" : `Publish failed: ${res.status}` });
    }

    // Send message — ALL HARDCODED
    const msgId = crypto.randomUUID();
    const aiMsgId = "aimsg_" + Array.from({ length: 26 }, () => "01PDx4Vtw4YF6XfduRwwS6nKZ6sPAC9nCeR"[Math.floor(Math.random() * 32)]).join("");
    const payload = {
      id: msgId,
      message: rule.message_template || `Automated ${rule.action_type} run`,
      ai_message_id: aiMsgId,
      intent: INTENT,          // HARDCODED
      chat_only: CHAT_ONLY,    // HARDCODED — NUNCA true
      view: VIEW,              // HARDCODED
      view_description: VIEW_DESC, // HARDCODED
      thread_id: "main",
      model: null,
      files: [],
      optimisticImageUrls: [],
      selected_elements: [],
      debug_mode: false,
      session_replay: "[]",
      client_logs: [],
      network_requests: [],
      runtime_errors: [],
      integration_metadata: { browser: { preview_viewport_width: 1280, preview_viewport_height: 854 } },
    };

    const res = await fetch(`${LOVABLE_API}/projects/${rule.project_id}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableToken}`, "x-client-git-sha": GIT_SHA, Origin: "https://lovable.dev", Referer: "https://lovable.dev/" },
      body: JSON.stringify(payload),
    });
    const status = res.ok ? "success" : "error";
    const resBody = await res.text().catch(() => "");
    await admin.from("automation_runs").insert({ rule_id: id, user_id: user.id, status, result: resBody.slice(0, 500) });
    await admin.from("automation_rules").update({ last_run_at: new Date().toISOString(), run_count: (rule.run_count || 0) + 1 }).eq("id", id);
    return ok({ status, msgId, aiMsgId });
  }

  // ─── LOGS ───
  if (action === "logs") {
    const ruleId = (body.rule_id as string) || new URL(req.url).searchParams.get("rule_id");
    const query = admin.from("automation_runs").select("*").order("created_at", { ascending: false }).limit(50);
    if (ruleId) query.eq("rule_id", ruleId);
    if (!isAdmin) query.eq("user_id", user.id);
    const { data, error } = await query;
    if (error) return fail(error.message, 500);
    return ok({ logs: data || [] });
  }

  return fail("Unknown action: " + action);
});
