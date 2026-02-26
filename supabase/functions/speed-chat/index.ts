const GIT_SHA     = '9810ecd6b501b23b14c5d4ee731d8cda244d003b';
const LOVABLE_API = 'https://api.lovable.dev';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Speed-Client',
};

function fail(msg: string, status = 400): Response {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function succeed(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ ok: true, ...data }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function makeUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function makeAiMsgId(): string {
  const C = '01PbWWqgKDBDorh525uecKaGZD21FGSoCeR';
  return 'aimsg_' + Array.from({ length: 26 }, () => C[Math.floor(Math.random() * 32)]).join('');
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return fail('Method not allowed', 405);

  // ── 1. Header X-Speed-Client ──────────────────────────────────────
  const speedHeader = req.headers.get('X-Speed-Client');
  if (speedHeader !== '1') {
    return fail('Forbidden — missing Speed client header', 403);
  }

  // ── Parse body ────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return fail('Body JSON invalido'); }

  const { token, projectId, message, msgId, aiMsgId, licenseKey, clientVersion } = body as any;

  // ── 2. clientVersion ──────────────────────────────────────────────
  if (!clientVersion || typeof clientVersion !== 'string' || !clientVersion.startsWith('speed-')) {
    return fail('Forbidden — invalid client version', 403);
  }

  // ── 3. token ──────────────────────────────────────────────────────
  if (!token || typeof token !== 'string' || !token.startsWith('eyJ'))
    return fail('Token Firebase invalido ou ausente', 401);

  // ── 4. projectId ──────────────────────────────────────────────────
  if (!projectId || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(projectId as string))
    return fail('projectId invalido');

  // ── 5. message ────────────────────────────────────────────────────
  if (!message || typeof message !== 'string' || !(message as string).trim())
    return fail('message obrigatoria');

  // ── 6. licenseKey ──────────────────────────────────────────────────
  if (!licenseKey || typeof licenseKey !== 'string' || !(licenseKey as string).startsWith('CLF1.'))
    return fail('licenseKey invalida', 401);

  // ── 7. Validate license with smart lifecycle guard ────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  let licenseId: string | null = null;
  let isAdmin = false;

  if (supabaseUrl && serviceKey) {
    try {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const { guardLicense } = await import("../_shared/license-guard.ts");
      const adminClient = createClient(supabaseUrl, serviceKey);

      const guard = await guardLicense(adminClient, licenseKey as string);
      if (!guard.allowed) {
        return fail(guard.error || 'Licença inválida', 401);
      }

      isAdmin = !!guard.isAdmin;
      licenseId = (guard.license as any)?.id || null;

      // Check plan allows "speed" extension (admin bypasses)
      if (!isAdmin && licenseId) {
        const planId = (guard.license as any)?.plan_id;
        if (planId) {
          const { data: peData } = await adminClient
            .from("plan_extensions").select("extension_id").eq("plan_id", planId);
          if (peData) {
            const extIds = peData.map((pe: any) => pe.extension_id);
            if (extIds.length > 0) {
              const { data: exts } = await adminClient
                .from("extension_catalog").select("slug").in("id", extIds);
              const slugs = (exts || []).map((e: any) => e.slug);
              if (!slugs.includes('speed')) {
                return fail('Seu plano não inclui a extensão Speed. Faça upgrade.', 403);
              }
            }
          }
        }
      }
    } catch (e) { console.error('[speed-chat] Erro ao checar licenca:', e); }
  }

  // ── Build Lovable payload (hardcoded values — NEVER CHANGE) ────────
  const payload = {
    id:               (typeof msgId === 'string' && msgId) ? msgId : makeUuid(),
    message:          (message as string).trim(),
    ai_message_id:    (typeof aiMsgId === 'string' && aiMsgId) ? aiMsgId : makeAiMsgId(),
    intent:           'security_fix_v2',   // NEVER CHANGE
    chat_only:        true,                // NEVER CHANGE
    view:             'security',          // NEVER CHANGE
    view_description: 'The user is viewing the security analysis.',
    thread_id:        'main',
    model:            null,
    files:            [],
    optimisticImageUrls: [],
    selected_elements:   [],
    debug_mode:          false,
    session_replay:      '[]',
    client_logs:         [],
    network_requests:    [],
    runtime_errors:      [],
    integration_metadata: {
      browser: { preview_viewport_width: 1280, preview_viewport_height: 854 },
    },
  };

  // ── Send to Lovable API ────────────────────────────────────────────
  let lovableRes: Response;
  try {
    lovableRes = await fetch(`${LOVABLE_API}/projects/${projectId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type':     'application/json',
        'Authorization':    `Bearer ${token}`,
        'x-client-git-sha': GIT_SHA,
        'Origin':           'https://lovable.dev',
        'Referer':          'https://lovable.dev/',
      },
      body: JSON.stringify(payload),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[speed-chat] Falha de rede:', msg);
    return fail(`Falha de conexao: ${msg}`, 502);
  }

  // ── Handle Lovable response ────────────────────────────────────────
  if (lovableRes.status === 401) return fail('Token expirado — recarregue o Lovable', 401);
  if (lovableRes.status === 429) return fail('Rate limit — aguarde alguns segundos', 429);

  if (lovableRes.status === 200 || lovableRes.status === 202) {
    // Increment usage ONLY on confirmed successful delivery (not cancelled)
    if (licenseId && supabaseUrl && serviceKey) {
      try {
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const { incrementUsage } = await import("../_shared/license-guard.ts");
        const adminClient = createClient(supabaseUrl, serviceKey);
        await incrementUsage(adminClient, licenseId);
      } catch (e) { console.error('[speed-chat] Erro increment-usage:', e); }
    }
    return succeed({ msgId: payload.id, aiMsgId: payload.ai_message_id, isAdmin });
  }

  // ── Any other error ────────────────────────────────────────────────
  const errBody = await lovableRes.text().catch(() => '(sem body)');
  console.error(`[speed-chat] Lovable ${lovableRes.status}:`, errBody.slice(0, 300));
  return fail(`Lovable retornou ${lovableRes.status}: ${errBody.slice(0, 80)}`, 502);
});
