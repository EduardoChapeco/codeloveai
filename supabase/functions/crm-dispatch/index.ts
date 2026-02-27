import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth: require JWT and verify tenant admin ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const tenantId = body.tenant_id;
    const campaignId = body.campaign_id;
    const batchSize = Math.min(body.batch_size || 10, 20);

    if (!tenantId || !/^[0-9a-f-]{36}$/i.test(tenantId)) {
      return new Response(JSON.stringify({ ok: false, error: "tenant_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is tenant admin via service client
    const sc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tenantRole } = await sc
      .from("tenant_users")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const isAdmin = tenantRole?.role === "tenant_owner" || tenantRole?.role === "tenant_admin";
    if (!isAdmin) {
      return new Response(JSON.stringify({ ok: false, error: "Forbidden: tenant admin required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get WhatsApp session config for this tenant
    const { data: session } = await sc
      .from("crm_whatsapp_sessions")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!session || !session.webhook_url || !session.api_key_encrypted) {
      return new Response(JSON.stringify({
        ok: false,
        error: "WhatsApp not configured. Set up Evolution API or Z-API in CRM settings.",
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Pick pending messages
    let query = sc
      .from("crm_message_queue")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (campaignId) query = query.eq("campaign_id", campaignId);

    const { data: messages, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;
    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: "No pending messages" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Send one-by-one with throttle
    let sent = 0;
    let failed = 0;
    const results: { id: string; status: string; error?: string }[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      await sc.from("crm_message_queue")
        .update({ status: "sending" })
        .eq("id", msg.id);

      try {
        const apiUrl = session.webhook_url.replace(/\/$/, "");
        const instanceName = session.instance_name || "default";

        const payload: Record<string, unknown> = {
          number: msg.phone.replace(/\D/g, ""),
          text: msg.message,
        };

        let endpoint = `${apiUrl}/message/sendText/${instanceName}`;
        if (msg.media_url) {
          endpoint = `${apiUrl}/message/sendMedia/${instanceName}`;
          payload.mediatype = "document";
          payload.media = msg.media_url;
          payload.caption = msg.message;
          delete payload.text;
        }

        const resp = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: session.api_key_encrypted,
          },
          body: JSON.stringify(payload),
        });

        if (!resp.ok) {
          const errText = await resp.text().catch(() => "Unknown error");
          throw new Error(`API ${resp.status}: ${errText.substring(0, 200)}`);
        }

        await sc.from("crm_message_queue")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", msg.id);

        sent++;
        results.push({ id: msg.id, status: "sent" });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        await sc.from("crm_message_queue")
          .update({ status: "failed", error_message: errMsg.substring(0, 500) })
          .eq("id", msg.id);

        failed++;
        results.push({ id: msg.id, status: "failed", error: errMsg.substring(0, 200) });
      }

      // Throttle: 5-15 seconds between messages
      if (i < messages.length - 1) {
        const delay = 5000 + Math.random() * 10000;
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    // 4. Update campaign stats if campaign_id provided
    if (campaignId) {
      const { data: stats } = await sc
        .from("crm_message_queue")
        .select("status")
        .eq("campaign_id", campaignId);

      if (stats) {
        const sentCount = stats.filter((s) => s.status === "sent").length;
        const failedCount = stats.filter((s) => s.status === "failed").length;
        await sc.from("crm_campaigns").update({
          sent_count: sentCount,
          failed_count: failedCount,
        }).eq("id", campaignId);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, failed, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[crm-dispatch] Error:", err);
    return new Response(JSON.stringify({ ok: false, error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
