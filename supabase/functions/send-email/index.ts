import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/**
 * send-email — Envia emails via Resend API
 *
 * POST body:
 *  { to, subject, html }                    — envio direto
 *  { template: "slug", variables: {...} }   — envio via template
 *  { action: "list_templates" }             — lista templates
 *  { action: "save_template", template }    — cria/atualiza template
 *  { action: "delete_template", id }        — deleta template
 *  { action: "list_logs", limit?, offset? } — lista logs
 *  { action: "test_connection" }            — testa chave Resend
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sc = createClient(supabaseUrl, serviceKey);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty */ }

  const action = (body.action as string) || "send";

  try {
    // ── Get Resend API key from api_key_vault table or env ──
    async function getResendKey(): Promise<string> {
      const { data } = await sc
        .from("api_key_vault")
        .select("api_key_encrypted, extra_config")
        .eq("provider", "resend")
        .eq("is_active", true)
        .order("requests_count", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data?.api_key_encrypted) return data.api_key_encrypted;
      // Fallback to env variable
      const envKey = Deno.env.get("RESEND_API_KEY");
      if (envKey) return envKey;
      throw new Error("Nenhuma chave Resend configurada. Vá em Admin > Integrações ou configure RESEND_API_KEY.");
    }

    // ── Get from_email from api_keys extra_config or default ──
    async function getFromEmail(): Promise<string> {
      const { data } = await sc
        .from("api_key_vault")
        .select("extra_config")
        .eq("provider", "resend")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      const cfg = data?.extra_config as Record<string, string> | null;
      return cfg?.from_email || "noreply@resend.dev";
    }

    // ── Test Connection ──
    if (action === "test_connection") {
      const apiKey = await getResendKey();
      const res = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) {
        const err = await res.text();
        return json({ ok: false, error: `Resend respondeu ${res.status}: ${err}` }, 400);
      }
      const domains = await res.json();
      return json({ ok: true, domains: domains.data || [] });
    }

    // ── List Templates ──
    if (action === "list_templates") {
      const { data, error } = await sc
        .from("email_templates")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return json({ templates: data });
    }

    // ── Save Template ──
    if (action === "save_template") {
      const t = body.template as Record<string, unknown>;
      if (!t?.name || !t?.slug) return json({ error: "name e slug obrigatórios" }, 400);

      if (t.id) {
        const { error } = await sc.from("email_templates").update({
          name: t.name, slug: t.slug, subject: t.subject || "",
          html_body: t.html_body || "", description: t.description || "",
          variables: t.variables || [], is_active: t.is_active ?? true,
        }).eq("id", t.id as string);
        if (error) throw error;
      } else {
        const { error } = await sc.from("email_templates").insert({
          name: t.name, slug: t.slug, subject: t.subject || "",
          html_body: t.html_body || "", description: t.description || "",
          variables: t.variables || [], is_active: t.is_active ?? true,
        });
        if (error) throw error;
      }
      return json({ ok: true });
    }

    // ── Delete Template ──
    if (action === "delete_template") {
      const { error } = await sc.from("email_templates").delete().eq("id", body.id as string);
      if (error) throw error;
      return json({ ok: true });
    }

    // ── List Logs ──
    if (action === "list_logs") {
      const limit = Math.min((body.limit as number) || 50, 200);
      const offset = (body.offset as number) || 0;
      const { data, error, count } = await sc
        .from("email_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      return json({ logs: data, total: count });
    }

    // ── Send Email (direct or template) ──
    const apiKey = await getResendKey();
    const fromEmail = await getFromEmail();

    let toEmail = body.to as string;
    let subject = body.subject as string;
    let html = body.html as string;
    let templateSlug = body.template as string | undefined;

    // Template-based send
    if (templateSlug) {
      const { data: tpl } = await sc
        .from("email_templates")
        .select("*")
        .eq("slug", templateSlug)
        .eq("is_active", true)
        .single();
      if (!tpl) return json({ error: `Template '${templateSlug}' não encontrado ou inativo` }, 404);

      const vars = (body.variables || {}) as Record<string, string>;
      subject = tpl.subject;
      html = tpl.html_body;

      // Replace {{var}} placeholders
      for (const [key, val] of Object.entries(vars)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
        subject = subject.replace(regex, val);
        html = html.replace(regex, val);
      }
    }

    if (!toEmail) return json({ error: "Destinatário (to) obrigatório" }, 400);
    if (!subject) return json({ error: "Assunto (subject) obrigatório" }, 400);
    if (!html) return json({ error: "Corpo HTML (html) obrigatório" }, 400);

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject,
        html,
      }),
    });

    const resendData = await resendRes.json();

    // Log the send
    await sc.from("email_logs").insert({
      template_slug: templateSlug || null,
      to_email: toEmail,
      to_name: (body.to_name as string) || null,
      subject,
      status: resendRes.ok ? "sent" : "failed",
      resend_id: resendData.id || null,
      error_message: resendRes.ok ? null : JSON.stringify(resendData),
      metadata: { from: fromEmail, template: templateSlug || "direct" },
      sent_by: (body.sent_by as string) || null,
    });

    // Update usage counter (best effort)
    const { data: keyData } = await sc
      .from("api_key_vault")
      .select("id, requests_count")
      .eq("provider", "resend")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (keyData) {
      await sc.from("api_key_vault").update({ 
        requests_count: (keyData.requests_count || 0) + 1,
        last_used_at: new Date().toISOString()
      }).eq("id", keyData.id).then(() => {}).catch(() => {});
    }

    if (!resendRes.ok) {
      return json({ ok: false, error: resendData.message || "Erro ao enviar email", details: resendData }, resendRes.status);
    }

    return json({ ok: true, id: resendData.id });

  } catch (e) {
    console.error("[send-email]", e);
    return json({ error: (e as Error).message }, 500);
  }
});
