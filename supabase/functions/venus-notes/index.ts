import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateVenusLicense, venusJson, VENUS_CORS } from "../_shared/venus-license.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: VENUS_CORS });
  if (req.method !== "POST") return venusJson({ error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return venusJson({ error: "Invalid JSON" }, 400); }

  const licenseKey = ((body.licenseKey as string) || req.headers.get("x-clf-token") || "").trim();
  const { valid, error: licErr } = await validateVenusLicense(licenseKey);
  if (!valid) return venusJson({ error: licErr || "invalid_key" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const action = (body.action as string) || "";
  const projectId = (body.projectId as string) || (body.project_id as string) || "";

  // ── SAVE ──
  if (action === "save") {
    const { text, color, ts } = body as Record<string, unknown>;
    if (!text || !projectId) return venusJson({ error: "text and projectId required" }, 400);
    const { data, error } = await supabase
      .from("venus_notes")
      .insert({
        license_key: licenseKey,
        project_id: projectId,
        text,
        color: color || "#7c3aed",
        ts: ts || Date.now(),
      })
      .select("id")
      .single();
    if (error) return venusJson({ error: error.message }, 500);
    return venusJson({ id: data.id });
  }

  // ── LIST ──
  if (action === "list") {
    if (!projectId) return venusJson({ error: "projectId required" }, 400);
    const { data } = await supabase
      .from("venus_notes")
      .select("id, text, color, x, y, ts, updated_at")
      .eq("license_key", licenseKey)
      .eq("project_id", projectId)
      .order("created_at");
    return venusJson({ notes: data || [] });
  }

  // ── SYNC ── (load notes when switching projects)
  if (action === "sync") {
    if (!projectId) return venusJson({ error: "projectId required" }, 400);
    const { data: notes } = await supabase
      .from("venus_notes")
      .select("id, text, color, x, y, ts, created_at, updated_at")
      .eq("license_key", licenseKey)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(50);
    return venusJson({
      notes: notes || [],
      project_id: projectId,
      synced_at: new Date().toISOString(),
    });
  }

  // ── DELETE ──
  if (action === "delete") {
    const noteId = body.id as string;
    if (!noteId) return venusJson({ error: "id required" }, 400);
    // Security: only delete note belonging to this license AND project
    const query = supabase.from("venus_notes").delete().eq("id", noteId).eq("license_key", licenseKey);
    if (projectId) query.eq("project_id", projectId);
    await query;
    return venusJson({ ok: true });
  }

  // ── UPDATE POSITION ──
  if (action === "update_position") {
    const { id, x, y } = body as Record<string, unknown>;
    if (!id) return venusJson({ error: "id required" }, 400);
    await supabase.from("venus_notes")
      .update({ x, y, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("license_key", licenseKey);
    return venusJson({ ok: true });
  }

  // ── UPDATE TEXT ──
  if (action === "update") {
    const { id, text, color } = body as Record<string, unknown>;
    if (!id) return venusJson({ error: "id required" }, 400);
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (text !== undefined) updates.text = text;
    if (color !== undefined) updates.color = color;
    await supabase.from("venus_notes")
      .update(updates)
      .eq("id", id)
      .eq("license_key", licenseKey);
    return venusJson({ ok: true });
  }

  return venusJson({ error: "unknown_action" }, 400);
});
