/**
 * Star AI Brain v2.0 — Clean rewrite
 *
 * Key fixes:
 * - Uses /chat/latest-message (not /latest-message) as PRIMARY capture
 * - Simplified project creation (no 10-phase bootstrap)
 * - Better error handling and logging
 * - Split into index.ts + helpers.ts
 *
 * Actions: status, setup, send, capture, history, reset, delete, list, bootstrap, review_code
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  json, lovFetch, getUserToken, getValidToken, refreshToken,
  getWorkspaceId, verifyProject, getBrain, getBrainRaw, listBrains,
  cleanupStaleBrains, createFreshBrain, sendViaBrain, captureResponse,
  buildBrainPrompt, VALID_SKILLS, SKILL_LABELS,
  type BrainSkill,
} from "./helpers.ts";
import { obfuscate } from "../_shared/crypto.ts";

const API = "https://api.lovable.dev";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_ACTIONS = new Set(["status", "setup", "send", "capture", "history", "reset", "delete", "list", "bootstrap", "review_code"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: "Token inválido" }, 401);

    const sc = createClient(supabaseUrl, serviceRole);
    const userId = user.id;

    let body: any;
    try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

    const action = typeof body?.action === "string" ? body.action : "";
    if (!VALID_ACTIONS.has(action)) return json({ error: "Ação desconhecida" }, 400);

    // ── STATUS ──
    if (action === "status") {
      await cleanupStaleBrains(sc, userId, 60_000);
      const token = await getUserToken(sc, userId);
      if (!token) return json({ active: false, connected: false, reason: "no_token" });

      const brains = await listBrains(sc, userId);
      const activeBrains = brains.filter(b => b.status === "active" && !b.lovable_project_id?.startsWith("creating"));

      return json({
        active: activeBrains.length > 0,
        connected: true,
        brains: activeBrains.map(b => ({
          id: b.id,
          name: b.name,
          project_id: b.lovable_project_id,
          project_url: `https://lovable.dev/projects/${b.lovable_project_id}`,
          skill: b.brain_skill,
          skills: b.brain_skills || [b.brain_skill],
          workspace_id: b.lovable_workspace_id,
          last_message_at: b.last_message_at,
          created_at: b.created_at,
          skill_phase: b.skill_phase || 0,
          status: b.status,
        })),
        creating: brains.some(b => b.status === "creating"),
      });
    }

    // ── LIST ──
    if (action === "list") {
      const brains = await listBrains(sc, userId);
      return json({
        brains: brains.map(b => ({
          id: b.id, name: b.name, project_id: b.lovable_project_id,
          project_url: !b.lovable_project_id?.startsWith("creating") ? `https://lovable.dev/projects/${b.lovable_project_id}` : null,
          status: b.status, skill: b.brain_skill, skills: b.brain_skills || [b.brain_skill],
          workspace_id: b.lovable_workspace_id, last_message_at: b.last_message_at,
          created_at: b.created_at, skill_phase: b.skill_phase || 0,
        })),
      });
    }

    // ── HISTORY ──
    if (action === "history") {
      const limit = Math.min(Math.max(1, body?.limit || 50), 100);
      const brainId = typeof body?.brain_id === "string" ? body.brain_id : null;

      let query = supabase.from("loveai_conversations")
        .select("*").eq("user_id", userId)
        .order("created_at", { ascending: false }).limit(limit);

      if (brainId) {
        const brain = await getBrain(sc, userId, brainId);
        if (brain) query = query.eq("target_project_id", brain.lovable_project_id);
      }

      const { data } = await query;
      return json({ conversations: data || [] });
    }

    // ── RESET ──
    if (action === "reset") {
      const brainId = typeof body?.brain_id === "string" ? body.brain_id : null;
      if (brainId) {
        // Get project ID before deleting
        const { data: brainRow } = await sc.from("user_brain_projects")
          .select("lovable_project_id").eq("id", brainId).eq("user_id", userId).maybeSingle();
        await sc.from("user_brain_projects").delete().eq("id", brainId).eq("user_id", userId);
        // Delete Lovable project
        if (brainRow?.lovable_project_id && !brainRow.lovable_project_id.startsWith("creating")) {
          const tok = await getValidToken(sc, userId);
          if (tok) {
            lovFetch(`${API}/projects/${brainRow.lovable_project_id}`, tok, { method: "DELETE" }).catch(() => {});
          }
        }
      } else {
        // Delete all brains + their projects
        const { data: allBrains } = await sc.from("user_brain_projects")
          .select("lovable_project_id").eq("user_id", userId);
        await sc.from("user_brain_projects").delete().eq("user_id", userId);
        await sc.from("loveai_conversations").delete().eq("user_id", userId);
        const tok = await getValidToken(sc, userId);
        if (tok && allBrains?.length) {
          for (const b of allBrains) {
            if (b.lovable_project_id && !b.lovable_project_id.startsWith("creating")) {
              lovFetch(`${API}/projects/${b.lovable_project_id}`, tok, { method: "DELETE" }).catch(() => {});
            }
          }
        }
      }
      return json({ success: true });
    }

    // ── DELETE ──
    if (action === "delete") {
      const brainId = typeof body?.brain_id === "string" ? body.brain_id : "";
      if (!brainId) return json({ error: "brain_id obrigatório" }, 400);
      // Get project ID before deleting
      const { data: brainRow } = await sc.from("user_brain_projects")
        .select("lovable_project_id").eq("id", brainId).eq("user_id", userId).maybeSingle();
      await sc.from("user_brain_projects").delete().eq("id", brainId).eq("user_id", userId);
      // Delete Lovable project
      if (brainRow?.lovable_project_id && !brainRow.lovable_project_id.startsWith("creating")) {
        const tok = await getValidToken(sc, userId);
        if (tok) {
          lovFetch(`${API}/projects/${brainRow.lovable_project_id}`, tok, { method: "DELETE" }).catch(() => {});
        }
      }
      return json({ success: true });
    }

    // Token required for remaining actions
    const lovableToken = await getValidToken(sc, userId);
    if (!lovableToken) {
      return json({ error: "Token Lovable inválido. Reconecte via /lovable/connect.", code: "no_token" }, 503);
    }

    // ── SETUP ──
    if (action === "setup") {
      const rawSkills = Array.isArray(body?.skills) ? body.skills.filter((s: string) => VALID_SKILLS.has(s)) : [];
      const skills: BrainSkill[] = rawSkills.length > 0 ? rawSkills : ["general"];
      const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim().slice(0, 60) : `Star AI — ${skills.join(", ")}`;

      await cleanupStaleBrains(sc, userId, 60_000);

      // Check for existing reusable brain
      const existingBrains = await listBrains(sc, userId);
      for (const existing of existingBrains) {
        if (existing.lovable_project_id?.startsWith("creating")) continue;
        if (existing.status !== "active") continue;

        const access = await verifyProject(existing.lovable_project_id, lovableToken);
        if (access === "accessible" || access === "unknown") {
          console.log(`[Brain] Reusing brain ${existing.id.slice(0, 8)}`);
          return json({
            success: true,
            brain_id: existing.id,
            project_id: existing.lovable_project_id,
            project_url: `https://lovable.dev/projects/${existing.lovable_project_id}`,
            skills: existing.brain_skills || [existing.brain_skill],
            name: existing.name || name,
            reused: true,
          });
        }
        // not_found — skip
      }

      // Create new brain
      const result = await createFreshBrain(sc, userId, lovableToken, skills, name);
      if ("error" in result) {
        return json({ error: result.error, creating: result.error.includes("sendo criado"), code: "brain_creating" }, 502);
      }

      return json({
        success: true,
        brain_id: result.brainId,
        project_id: result.projectId,
        project_url: `https://lovable.dev/projects/${result.projectId}`,
        skills, name,
      });
    }

    // ── BOOTSTRAP ──
    if (action === "bootstrap") {
      const brainId = typeof body?.brain_id === "string" ? body.brain_id : undefined;
      const brain = await getBrainRaw(sc, userId, brainId) || await getBrainRaw(sc, userId);
      if (!brain?.id) return json({ error: "Brain não encontrado." }, 404);
      if (brain.lovable_project_id?.startsWith("creating")) return json({ error: "Projeto Brain ainda não está pronto." }, 409);

      // Mark as bootstrapping
      const alreadyRunning = (brain.skill_phase || 0) > 0;
      if (!alreadyRunning) {
        await sc.from("user_brain_projects")
          .update({ skill_phase: 1 })
          .eq("id", brain.id);
      }

      return json({ success: true, started: !alreadyRunning, brain_id: brain.id, project_id: brain.lovable_project_id });
    }

    // ── SEND ──
    if (action === "send") {
      const message = typeof body?.message === "string" ? body.message.trim() : "";
      const rawSkill = typeof body?.brain_type === "string" ? body.brain_type : "";
      const brainId = typeof body?.brain_id === "string" ? body.brain_id : undefined;
      const questionTs = Date.now();

      if (!message || message.length > 10_000) return json({ error: "Mensagem inválida (1-10000 chars)" }, 400);

      // Get brain raw (including those with skill_phase > 0) to check bootstrap status
      const brainRaw = await getBrainRaw(sc, userId, brainId) || await getBrainRaw(sc, userId);
      if (brainRaw && (brainRaw.skill_phase || 0) > 0) {
        return json({ error: "Brain está sendo configurado. Aguarde a conclusão de todas as fases.", code: "brain_bootstrapping" }, 503);
      }

      let brain = await getBrain(sc, userId, brainId) || await getBrain(sc, userId);
      if (!brain) return json({ error: "Star AI não está ativo. Crie um Brain primeiro.", code: "brain_inactive" }, 400);

      let brainProjectId = brain.lovable_project_id;
      if (!brainProjectId || brainProjectId.startsWith("creating")) {
        return json({ error: "Brain sendo criado. Aguarde.", code: "brain_creating" }, 503);
      }

      // Verify project access
      const access = await verifyProject(brainProjectId, lovableToken);
      if (access === "not_found") {
        return json({ error: "Projeto Brain não encontrado. Crie um novo Brain.", code: "project_not_found" }, 409);
      }

      const skill: BrainSkill = (VALID_SKILLS.has(rawSkill) ? rawSkill : (brain.brain_skill || "general")) as BrainSkill;
      const prompt = buildBrainPrompt(skill, message);

      console.log(`[Brain:send] user=${obfuscate(userId)} brain=${brain.id.slice(0, 8)} project=${brainProjectId.slice(0, 8)} skill=${skill}`);

      // Save conversation
      const { data: convoRow } = await sc.from("loveai_conversations").insert({
        user_id: userId,
        user_message: message,
        brain_type: skill,
        status: "processing",
        target_project_id: brainProjectId,
      }).select("id").single();
      const convoId = convoRow?.id;

      // Send via venus-chat
      let sendResult = await sendViaBrain(brainProjectId, lovableToken, prompt, false);

      // Retry with refreshed token on 401/403
      if (!sendResult.ok && (sendResult.status === 401 || sendResult.status === 403)) {
        const newToken = await refreshToken(sc, userId);
        if (newToken) {
          sendResult = await sendViaBrain(brainProjectId, newToken, prompt, false);
        }
      }

      if (!sendResult.ok) {
        if (convoId) await sc.from("loveai_conversations").update({ status: "failed" }).eq("id", convoId);
        return json({ error: `Erro ao enviar: ${sendResult.error}`, conversation_id: convoId }, 502);
      }

      console.log(`[Brain:send] Message sent, mining response... convo=${convoId?.slice(0, 8)}`);

      // Quick capture (15s window — increased from 8s)
      let quickResponse: string | null = null;
      try {
        const result = await captureResponse(brainProjectId, lovableToken, 15_000, 3_000, 5_000, questionTs);
        if (result.status === "completed") quickResponse = result.response;
      } catch (e) {
        console.warn("[Brain:send] Quick capture error:", e);
      }

      if (quickResponse && convoId) {
        await sc.from("loveai_conversations").update({
          ai_response: quickResponse,
          status: "completed",
        }).eq("id", convoId);

        await sc.from("brain_outputs").insert({
          user_id: userId, conversation_id: convoId, skill,
          request: message, response: quickResponse, status: "done",
          brain_project_id: brainProjectId,
        }).catch(() => {});
      }

      await sc.from("user_brain_projects")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", brain.id);

      return json({
        conversation_id: convoId,
        response: quickResponse,
        status: quickResponse ? "completed" : "processing",
        skill, brain_id: brain.id,
      });
    }

    // ── CAPTURE ──
    if (action === "capture") {
      const conversationId = typeof body?.conversation_id === "string" ? body.conversation_id : "";
      if (!conversationId) return json({ error: "conversation_id obrigatório" }, 400);

      const { data: convo } = await sc.from("loveai_conversations")
        .select("id, user_id, ai_response, status, target_project_id, created_at")
        .eq("id", conversationId).eq("user_id", userId).maybeSingle();

      if (!convo) return json({ error: "Conversa não encontrada" }, 404);

      if (convo.ai_response && convo.ai_response.length > 0) {
        return json({ response: convo.ai_response, status: convo.status });
      }

      const projectId = convo.target_project_id;
      if (!projectId) return json({ response: null, status: "processing" });

      const convoTs = convo.created_at ? new Date(convo.created_at).getTime() : undefined;
      const capture = await captureResponse(projectId, lovableToken, 45_000, 4_000, 0, convoTs);

      if (capture.response) {
        await sc.from("loveai_conversations").update({
          ai_response: capture.response,
          status: "completed",
        }).eq("id", conversationId);

        await sc.from("brain_outputs").insert({
          user_id: userId, conversation_id: conversationId, skill: "general",
          request: "", response: capture.response, status: "done",
          brain_project_id: projectId,
        }).catch(() => {});
      }

      return json({ response: capture.response, status: capture.status });
    }

    // ── REVIEW_CODE ──
    if (action === "review_code") {
      const targetProjectId = typeof body?.project_id === "string" ? body.project_id : "";
      if (!targetProjectId) return json({ error: "project_id obrigatório" }, 400);

      const brain = await getBrain(sc, userId);
      if (!brain) return json({ error: "Star AI não está ativo.", code: "brain_inactive" }, 400);

      const brainProjectId = brain.lovable_project_id;
      if (!brainProjectId || brainProjectId.startsWith("creating")) {
        return json({ error: "Brain sendo criado.", code: "brain_creating" }, 503);
      }

      const projectName = body?.project_name || targetProjectId.slice(0, 8);
      const prompt = `Faca um code review tecnico completo do projeto "${projectName}" (id: ${targetProjectId}). Retorne: problemas criticos, riscos, correcoes sugeridas e checklist final.`;
      const questionTs = Date.now();

      const { data: convoRow } = await sc.from("loveai_conversations").insert({
        user_id: userId, user_message: `Code Review: ${projectName}`,
        brain_type: "code_review", status: "processing", target_project_id: brainProjectId,
      }).select("id").single();
      const convoId = convoRow?.id;

      const sendResult = await sendViaBrain(brainProjectId, lovableToken, prompt, false);
      if (!sendResult.ok) {
        if (convoId) await sc.from("loveai_conversations").update({ status: "failed" }).eq("id", convoId);
        return json({ error: `Erro ao enviar: ${sendResult.error}` }, 502);
      }

      let quickResponse: string | null = null;
      try {
        const result = await captureResponse(brainProjectId, lovableToken, 15_000, 3_000, 6_000, questionTs);
        if (result.status === "completed") quickResponse = result.response;
      } catch { /* cron handles it */ }

      if (quickResponse && convoId) {
        await sc.from("loveai_conversations").update({ ai_response: quickResponse, status: "completed" }).eq("id", convoId);
      }

      return json({
        conversation_id: convoId,
        response: quickResponse,
        status: quickResponse ? "completed" : "processing",
        skill: "code_review",
      });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (err) {
    console.error("[Brain] Unhandled error:", err);
    return json({ error: "Erro interno no Brain" }, 500);
  }
});
