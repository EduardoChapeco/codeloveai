import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Support both authenticated (user) and public (with optional API key) access
  const authHeader = req.headers.get("Authorization");

  // Parse query params for GET, body for POST
  let skill: string | null = null;
  let limit = 1;
  let conversationId: string | null = null;

  if (req.method === "GET") {
    const url = new URL(req.url);
    skill = url.searchParams.get("skill");
    limit = Math.min(parseInt(url.searchParams.get("limit") || "1", 10) || 1, 50);
    conversationId = url.searchParams.get("conversation_id");
  } else if (req.method === "POST") {
    try {
      const body = await req.json();
      skill = body.skill || null;
      limit = Math.min(body.limit || 1, 50);
      conversationId = body.conversation_id || null;
    } catch {
      return json({ error: "JSON inválido" }, 400);
    }
  }

  // Authenticate user
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Não autenticado" }, 401);
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return json({ error: "Token inválido" }, 401);

  const sc = createClient(supabaseUrl, serviceKey);

  // If conversation_id provided, return that specific output
  if (conversationId) {
    const { data } = await sc.from("brain_outputs")
      .select("id, skill, request, response, status, brain_project_id, created_at")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!data) return json({ error: "Output não encontrado" }, 404);
    return json({ output: data });
  }

  // Otherwise return latest outputs
  let query = sc.from("brain_outputs")
    .select("id, skill, request, response, status, brain_project_id, conversation_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (skill) {
    query = query.eq("skill", skill);
  }

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 500);

  return json({
    outputs: data || [],
    count: data?.length || 0,
  });
});
