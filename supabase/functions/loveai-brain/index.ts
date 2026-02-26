/**
 * Star AI Brain v8.1 — Refactored into modules to fix bundle timeout
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserToken, getValidToken, refreshToken, lovFetch } from "./token-helpers.ts";
import {
  getBrain, verifyProject, createFreshBrain,
  buildPayload, buildBrainPrompt, captureResponse,
} from "./brain-helpers.ts";

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
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return json({ error: "Token inválido" }, 401);

    const userId = user.id;
    const sc = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const action = body.action;

    // ── STATUS ──
    if (action === "status") {
      const lovableToken = await getUserToken(sc, userId);
      if (!lovableToken) return json({ active: false, connected: false, reason: "no_token" });
      const brain = await getBrain(sc, userId);
      return json({ active: !!brain, connected: true, brain: brain || null });
    }

    // ── HISTORY ──
    if (action === "history") {
      const limit = Math.min(body.limit || 50, 100);
      const { data } = await supabase.from("loveai_conversations")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      return json({ conversations: data || [] });
    }

    // ── RESET ──
    if (action === "reset") {
      await sc.from("user_brain_projects").delete().eq("user_id", userId);
      await sc.from("loveai_conversations").delete().eq("user_id", userId);
      return json({ success: true, message: "Star AI resetado completamente." });
    }

    const lovableToken = await getValidToken(sc, userId);
    if (!lovableToken) {
      return json({ error: "Token Lovable inválido. Reconecte via /lovable/connect.", code: "no_token" }, 503);
    }

    // ── SETUP ──
    if (action === "setup") {
      const result = await createFreshBrain(sc, userId, lovableToken);
      if ("error" in result) return json({ error: result.error }, 502);
      return json({ success: true, project_id: result.projectId });
    }

    // ── SEND ──
    if (action === "send") {
      const { message, brain_type = "general" } = body;
      if (!message || typeof message !== "string" || message.length < 1 || message.length > 10000) {
        return json({ error: "Mensagem inválida (1-10000 chars)" }, 400);
      }

      let brain = await getBrain(sc, userId);

      if (brain) {
        const accessible = await verifyProject(brain.lovable_project_id, lovableToken);
        if (!accessible) {
          await sc.from("user_brain_projects").delete().eq("user_id", userId);
          brain = null;
        }
      }

      if (!brain) {
        const setupResult = await createFreshBrain(sc, userId, lovableToken);
        if ("error" in setupResult) return json({ error: setupResult.error }, 502);
        brain = { lovable_project_id: setupResult.projectId, lovable_workspace_id: setupResult.workspaceId };
      }

      const projectId = brain.lovable_project_id;
      const prompt = buildBrainPrompt(brain_type, message);
      const payload = buildPayload(prompt);

      const { data: convoRow } = await sc.from("loveai_conversations").insert({
        user_id: userId,
        user_message: message,
        brain_type: brain_type,
        status: "processing",
        target_project_id: projectId,
      }).select("id").single();

      const convoId = convoRow?.id;

      let chatRes = await lovFetch(
        `https://api.lovable.dev/projects/${projectId}/chat`,
        lovableToken,
        { method: "POST", body: JSON.stringify(payload) }
      );

      if (!chatRes.ok && (chatRes.status === 401 || chatRes.status === 403)) {
        const newToken = await refreshToken(sc, userId);
        if (newToken) {
          const accessible = await verifyProject(projectId, newToken);
          if (accessible) {
            chatRes = await lovFetch(
              `https://api.lovable.dev/projects/${projectId}/chat`,
              newToken,
              { method: "POST", body: JSON.stringify(payload) }
            );
          } else {
            const newBrain = await createFreshBrain(sc, userId, newToken);
            if ("error" in newBrain) {
              if (convoId) await sc.from("loveai_conversations").update({ status: "failed" }).eq("id", convoId);
              return json({ error: newBrain.error }, 502);
            }
            const newPayload = buildPayload(prompt);
            chatRes = await lovFetch(
              `https://api.lovable.dev/projects/${newBrain.projectId}/chat`,
              newToken,
              { method: "POST", body: JSON.stringify(newPayload) }
            );
            if (convoId) await sc.from("loveai_conversations").update({ target_project_id: newBrain.projectId }).eq("id", convoId);
          }
        } else {
          if (convoId) await sc.from("loveai_conversations").update({ status: "failed" }).eq("id", convoId);
          return json({ error: "Token expirado. Reconecte via /lovable/connect.", code: "no_token" }, 503);
        }
      }

      if (!chatRes.ok) {
        const errBody = await chatRes.text().catch(() => "");
        if (convoId) await sc.from("loveai_conversations").update({ status: "failed" }).eq("id", convoId);
        return json({ error: `Erro ao enviar (HTTP ${chatRes.status})` }, 502);
      }

      const activeToken = await getUserToken(sc, userId) || lovableToken;
      const activeProjectId = (await getBrain(sc, userId))?.lovable_project_id || projectId;

      const capture = await captureResponse(activeProjectId, activeToken, 90000, 4000, 8000);

      let finalResponse = capture.response;
      if (finalResponse) {
        finalResponse = finalResponse
          .replace(/^(?:SISTEMA (?:STARBLE|STAR AI|CODELOVE) BRAIN[\s\S]*?(?:REGRAS:|RESPONDA)[\s\S]*?\n)/i, "")
          .replace(/^(?:Analise e corrija[\s\S]*?\n)/i, "")
          .trim();
      }

      if (convoId) {
        await sc.from("loveai_conversations").update({
          ai_response: finalResponse || null,
          status: capture.status === "completed" ? "completed" : capture.status === "timeout" ? "timeout" : "failed",
        }).eq("id", convoId);
      }

      await sc.from("user_brain_projects").update({ last_message_at: new Date().toISOString() }).eq("user_id", userId).eq("status", "active");

      return json({
        conversation_id: convoId,
        response: finalResponse,
        status: capture.status,
      });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (err) {
    console.error("[Brain] Unhandled error:", err);
    return json({ error: "Erro interno no Star AI" }, 500);
  }
});
