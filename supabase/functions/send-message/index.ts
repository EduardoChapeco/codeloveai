// supabase/functions/send-message/index.ts
// REGRA ABSOLUTA: chat_only=true + intent=security_fix_v2 em TODOS os modos.
// NUNCA aceitar chat_only=false vindo da extensão ou de qualquer modo.

const GIT_SHA = '9810ecd6b501b23b14c5d4ee731d8cda244d003b';
const LOVABLE_API = 'https://api.lovable.dev';

// VIEW_MAP: apenas controla view/view_description por modo.
// chat_only é SEMPRE true — não está aqui para não dar margem a erro.
const VIEW_MAP: Record<string, { view: string; view_description: string }> = {
  chat:       { view: 'security', view_description: 'The user is viewing the security analysis.' },
  security:   { view: 'security', view_description: 'The user is performing a critical security refactor and code hardening.' },
  task:       { view: 'security', view_description: 'The user is viewing the security analysis.' },
  task_error: { view: 'editor',   view_description: 'The user encountered a critical runtime error that needs immediate fixing.' },
  git:        { view: 'editor',   view_description: 'The user is performing a git operation.' },
};

const DEFAULT_VIEW = VIEW_MAP.task;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

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

function errResponse(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errResponse('Method not allowed', 405);
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: any;
  try {
    body = await req.json();
  } catch {
    return errResponse('Body JSON inválido');
  }

  const {
    token,
    projectId,
    message,
    msgId,
    aiMsgId: aiMsgIdIn,
    licenseKey,
    files,
    mode: modeIn,
  } = body;

  // ── Validações obrigatórias ───────────────────────────────────────────────
  if (!token || typeof token !== 'string' || !token.startsWith('eyJ')) {
    return errResponse('Token Firebase inválido', 401);
  }

  if (
    !projectId ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(projectId)
  ) {
    return errResponse('projectId inválido');
  }

  if (!message || typeof message !== 'string' || !message.trim()) {
    return errResponse('message obrigatória');
  }

  if (!licenseKey || typeof licenseKey !== 'string' || !licenseKey.startsWith('CLF1.')) {
    return errResponse('licenseKey inválida', 401);
  }

  // ── Validar licença no banco ──────────────────────────────────────────────
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (supabaseUrl && serviceKey) {
      const licResp = await fetch(
        `${supabaseUrl}/rest/v1/licenses?key=eq.${encodeURIComponent(licenseKey)}&status=eq.active&select=id`,
        {
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
          },
        }
      );
      if (licResp.ok) {
        const lics = await licResp.json();
        if (!Array.isArray(lics) || lics.length === 0) {
          return errResponse('Licença inválida ou expirada', 401);
        }
      }
      // Se a chamada ao banco falhar, deixa passar (fail-open) para não bloquear o usuário
    }
  } catch (e) {
    console.error('[send-message] Erro ao validar licença:', e);
  }

  // ── Selecionar view por modo ──────────────────────────────────────────────
  const viewCfg = (modeIn && VIEW_MAP[modeIn]) ? VIEW_MAP[modeIn] : DEFAULT_VIEW;

  console.log(
    `[send-message] mode="${modeIn ?? 'undefined'}" → view="${viewCfg.view}" | chat_only=true (hardcoded)`
  );

  // ── Montar payload para o Lovable ─────────────────────────────────────────
  // CRÍTICO: chat_only é SEMPRE true — hardcoded aqui, nunca vindo de fora.
  // CRÍTICO: intent é SEMPRE security_fix_v2 — hardcoded aqui, nunca vindo de fora.
  const lovablePayload = {
    id: msgId || makeUuid(),
    message: message.trim(),
    ai_message_id: aiMsgIdIn || makeAiMsgId(),
    intent: 'security_fix_v2',        // HARDCODED — nunca alterar
    chat_only: true,                   // HARDCODED — nunca alterar
    view: viewCfg.view,
    view_description: viewCfg.view_description,
    thread_id: 'main',
    model: null,
    files: Array.isArray(files) ? files : [],
    optimisticImageUrls: [],
    selected_elements: [],
    debug_mode: false,
    session_replay: '[]',
    client_logs: [],
    network_requests: [],
    runtime_errors: [],
    integration_metadata: {
      browser: {
        preview_viewport_width: 1280,
        preview_viewport_height: 854,
      },
    },
  };

  // ── Enviar ao Lovable ─────────────────────────────────────────────────────
  let lovableRes: Response;
  try {
    lovableRes = await fetch(`${LOVABLE_API}/projects/${projectId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-client-git-sha': GIT_SHA,
        Origin: 'https://lovable.dev',
        Referer: 'https://lovable.dev/',
      },
      body: JSON.stringify(lovablePayload),
    });
  } catch (e: any) {
    console.error('[send-message] Falha de conexão com Lovable:', e);
    return errResponse(`Falha de conexão: ${e.message}`, 502);
  }

  // ── Tratar resposta do Lovable ────────────────────────────────────────────
  if (lovableRes.status === 401) {
    return errResponse('Token expirado — recarregue o Lovable', 401);
  }

  if (lovableRes.status === 429) {
    return errResponse('Rate limit do Lovable — aguarde alguns segundos', 429);
  }

  if (lovableRes.status === 202 || lovableRes.status === 200) {
    // Incrementar uso de forma assíncrona (não bloquear a resposta)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (supabaseUrl && anonKey) {
      fetch(`${supabaseUrl}/functions/v1/increment-usage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ licenseKey }),
      }).catch((e) => console.error('[send-message] Erro ao incrementar uso:', e));
    }

    return new Response(
      JSON.stringify({ ok: true, msgId: lovablePayload.id, aiMsgId: lovablePayload.ai_message_id }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Qualquer outro erro do Lovable
  const errTxt = await lovableRes.text().catch(() => '(sem body)');
  console.error(`[send-message] Lovable ${lovableRes.status}:`, errTxt.slice(0, 300));
  return errResponse(`Lovable ${lovableRes.status}: ${errTxt.slice(0, 80)}`, 502);
});
