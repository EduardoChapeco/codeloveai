const GIT_SHA     = '9810ecd6b501b23b14c5d4ee731d8cda244d003b';
const LOVABLE_API = 'https://api.lovable.dev';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return fail('Method not allowed', 405);

  let body: any;
  try { body = await req.json(); }
  catch { return fail('Body JSON invalido'); }

  const { token, projectId, message, msgId, aiMsgId, licenseKey, files } = body;

  if (!token || typeof token !== 'string' || !token.startsWith('eyJ'))
    return fail('Token Firebase invalido ou ausente', 401);

  if (!projectId || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(projectId))
    return fail('projectId invalido');

  if (!message || typeof message !== 'string' || !message.trim())
    return fail('message obrigatoria');

  if (!licenseKey || typeof licenseKey !== 'string' || !licenseKey.startsWith('CLF1.'))
    return fail('licenseKey invalida', 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (supabaseUrl && serviceKey) {
    try {
      const licRes = await fetch(
        `${supabaseUrl}/rest/v1/licenses?key=eq.${encodeURIComponent(licenseKey)}&status=eq.active&select=id`,
        { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
      );
      if (licRes.ok) {
        const lics = await licRes.json();
        if (!Array.isArray(lics) || lics.length === 0)
          return fail('Licenca invalida ou expirada', 401);
      }
    } catch (e) { console.error('[send-message] Erro ao checar licenca:', e); }
  }

  const payload = {
    id:               (typeof msgId === 'string' && msgId) ? msgId : makeUuid(),
    message:          message.trim(),
    ai_message_id:    (typeof aiMsgId === 'string' && aiMsgId) ? aiMsgId : makeAiMsgId(),
    intent:           'security_fix_v2',
    chat_only:        true,
    view:             'security',
    view_description: 'The user is viewing the security analysis.',
    thread_id:        'main',
    model:            null,
    files:            Array.isArray(files) ? files : [],
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
  } catch (e: any) {
    console.error('[send-message] Falha de rede:', e.message);
    return fail(`Falha de conexao: ${e.message}`, 502);
  }

  if (lovableRes.status === 401) return fail('Token expirado - recarregue o Lovable', 401);
  if (lovableRes.status === 429) return fail('Rate limit - aguarde alguns segundos', 429);

  if (lovableRes.status === 200 || lovableRes.status === 202) {
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (supabaseUrl && anonKey) {
      fetch(`${supabaseUrl}/functions/v1/increment-usage`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
        body:    JSON.stringify({ licenseKey }),
      }).catch((e) => console.error('[send-message] Erro increment-usage:', e));
    }
    return succeed({ msgId: payload.id, aiMsgId: payload.ai_message_id });
  }

  const errBody = await lovableRes.text().catch(() => '(sem body)');
  console.error(`[send-message] Lovable ${lovableRes.status}:`, errBody.slice(0, 300));
  return fail(`Lovable retornou ${lovableRes.status}: ${errBody.slice(0, 80)}`, 502);
});
