// supabase/functions/send-message/index.ts
// REGRA: usa EXCLUSIVAMENTE security_fix_v2 — NUNCA gasta crédito do usuário

const GIT_SHA = '3d7a3673c6f02b606137a12ddc0ab88f6b775113';

const AQ_PREFIX = 'IMPORTANTE: Não faça perguntas, não peça confirmação, não liste planos. Execute diretamente. Se houver ambiguidade, escolha a opção mais segura e execute.\n\n';

// Modos gratuitos — ÚNICA fonte de verdade
// build está AUSENTE propositalmente — é pago e proibido
const MODE_MAP: Record<string, { intent: string; chat_only: boolean; view: string | null; view_description: string | null }> = {
  chat:       { intent: 'security_fix_v2', chat_only: true,  view: null,       view_description: null },
  security:   { intent: 'security_fix_v2', chat_only: false, view: 'security', view_description: 'The user is currently viewing the security view for their project.' },
  task:       { intent: 'security_fix_v2', chat_only: false, view: null,       view_description: null },
  task_error: { intent: 'security_fix_v2', chat_only: false, view: 'editor',   view_description: 'The user encountered a critical runtime error that needs immediate fixing.' },
  git:        { intent: 'security_fix_v2', chat_only: false, view: 'editor',   view_description: null },
};

const DEFAULT_MODE = 'task'; // fallback seguro — nunca build

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function aiMsgId(): string {
  const C = '01PbWWqgKDBDorh525uecKaGZD21FGSoCeR';
  return 'aimsg_' + Array.from({ length: 26 }, () => C[Math.floor(Math.random() * 32)]).join('');
}

function err(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return err('Method not allowed', 405);
  }

  // Parse body
  let body: any;
  try {
    body = await req.json();
  } catch {
    return err('Body JSON inválido');
  }

  const { token, projectId, message, msgId, aiMsgId: aiMsgIdIn, licenseKey, files, mode: modeIn } = body;

  // ── Validações ───────────────────────────────────────────────────────────
  if (!token || !token.startsWith('eyJ')) {
    return err('Token Firebase inválido', 401);
  }
  if (!projectId || !/^[0-9a-f-]{36}$/.test(projectId)) {
    return err('projectId inválido');
  }
  if (!message || typeof message !== 'string' || !message.trim()) {
    return err('message obrigatória');
  }

  // ── Selecionar modo — NUNCA build, NUNCA intent:null ────────────────────
  // Se vier "build" ou qualquer modo desconhecido → forçar "task"
  const modeKey = (modeIn && modeIn !== 'build' && MODE_MAP[modeIn]) ? modeIn : DEFAULT_MODE;
  const mode = MODE_MAP[modeKey];

  // Log para diagnóstico
  console.log(`[send-message] mode recebido: "${modeIn}" → usando: "${modeKey}"`);
  console.log(`[send-message] intent: ${mode.intent} | chat_only: ${mode.chat_only} | view: ${mode.view}`);

  // ── Validar licença (opcional — não bloqueia se validate-hwid falhar) ───
  if (licenseKey) {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (supabaseUrl && serviceKey) {
        const licResp = await fetch(`${supabaseUrl}/rest/v1/licenses?key=eq.${licenseKey}&status=eq.active&select=id`, {
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'apikey': serviceKey,
          },
        });
        if (licResp.ok) {
          const licenses = await licResp.json();
          if (!licenses || licenses.length === 0) {
            console.warn('[send-message] licença não encontrada:', licenseKey.slice(0, 20));
            return err('Licença inválida ou expirada', 401);
          }
        }
      }
    } catch (e) {
      // Não bloquear por falha de rede na validação
      console.warn('[send-message] validate license error:', e.message);
    }
  }

  // ── Montar payload para o Lovable ────────────────────────────────────────
  // Aplicar AQ_PREFIX para modos que editam código (chat_only: false)
  const finalMessage = mode.chat_only
    ? message.trim()
    : (AQ_PREFIX + message.trim());

  const lovablePayload = {
    id: msgId || uuid(),
    message: finalMessage,
    ai_message_id: aiMsgIdIn || aiMsgId(),
    intent: mode.intent,           // SEMPRE 'security_fix_v2'
    chat_only: mode.chat_only,     // NUNCA true para modos de edição
    view: mode.view,
    view_description: mode.view_description,
    thread_id: 'main',
    model: null,
    files: files ?? [],
    optimisticImageUrls: [],
    selected_elements: [],
    debug_mode: false,
    session_replay: '[]',          // STRING obrigatória, não array
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

  // Log do payload crítico antes de enviar
  console.log('[send-message] lovablePayload crítico:', JSON.stringify({
    intent: lovablePayload.intent,
    chat_only: lovablePayload.chat_only,
    view: lovablePayload.view,
    message_preview: lovablePayload.message.slice(0, 80),
  }));

  // ── Enviar ao Lovable ────────────────────────────────────────────────────
  let lovableRes: Response;
  try {
    lovableRes = await fetch(`https://api.lovable.dev/projects/${projectId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Client-Git-SHA': GIT_SHA,
        'Origin': 'https://lovable.dev',
        'Referer': 'https://lovable.dev/',
      },
      body: JSON.stringify(lovablePayload),
    });
  } catch (e) {
    console.error('[send-message] fetch error:', e.message);
    return err(`Falha de conexão com Lovable: ${e.message}`, 502);
  }

  // Log do status retornado pelo Lovable
  console.log('[send-message] Lovable status:', lovableRes.status);

  // ── Tratar resposta ──────────────────────────────────────────────────────
  // Lovable retorna 202 Accepted (assíncrono) — a IA responde via Firestore
  if (lovableRes.status === 202 || lovableRes.status === 200) {
    // Incrementar uso (não bloqueia se falhar)
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
      if (supabaseUrl && anonKey && licenseKey) {
        fetch(`${supabaseUrl}/functions/v1/increment-usage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
          body: JSON.stringify({ licenseKey }),
        }).catch(() => {});
      }
    } catch (_) {}

    return new Response(
      JSON.stringify({
        ok: true,
        msgId: lovablePayload.id,
        aiMsgId: lovablePayload.ai_message_id,
        mode: modeKey,
        intent: mode.intent,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  if (lovableRes.status === 401) {
    return err('Token Firebase expirado — recarregue o Lovable', 401);
  }

  if (lovableRes.status === 429) {
    return err('Rate limit do Lovable — aguarde alguns segundos', 429);
  }

  // Erro inesperado — logar body completo para diagnóstico
  let errBody = '';
  try { errBody = await lovableRes.text(); } catch (_) {}
  console.error('[send-message] Lovable error:', lovableRes.status, errBody.slice(0, 500));

  return err(`Lovable retornou ${lovableRes.status}: ${errBody.slice(0, 200)}`, 502);
});
