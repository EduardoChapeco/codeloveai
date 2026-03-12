import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encodeTaskAsViewDesc, EXECUTE_CMD } from '../_shared/task-encoder.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-clf-token, x-brainchain-admin-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FIREBASE_KEY = Deno.env.get('FIREBASE_API_KEY') || '';
const BRAINCHAIN_ADMIN_KEY = Deno.env.get('BRAINCHAIN_ADMIN_KEY') || '';
const VALID_BRAIN_TYPES = new Set(['general', 'code', 'design', 'prd']);
const MAX_MESSAGE_LENGTH = 8000;
const C = '0123456789abcdefghjkmnpqrstvwxyz';
const rb32 = (n: number) => Array.from({ length: n }, () => C[Math.floor(Math.random() * 32)]).join('');

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

async function resolveRequester(req: Request, requestedUserId?: string) {
  // 1. Admin key header bypass
  const adminBypass = req.headers.get('x-brainchain-admin-key');
  if (BRAINCHAIN_ADMIN_KEY && adminBypass === BRAINCHAIN_ADMIN_KEY) {
    if (!requestedUserId || !isUuid(requestedUserId)) {
      return { ok: false as const, status: 400, error: 'Invalid or missing user_id for admin request' };
    }
    return { ok: true as const, userId: requestedUserId };
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false as const, status: 401, error: 'Unauthorized' };
  }

  // 2. Service role key bypass (internal service-to-service calls from cirius-generate, orchestrator-tick, etc.)
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceKey && authHeader === `Bearer ${serviceKey}`) {
    if (!requestedUserId || !isUuid(requestedUserId)) {
      return { ok: false as const, status: 400, error: 'Invalid or missing user_id for service call' };
    }
    return { ok: true as const, userId: requestedUserId };
  }

  // 3. Standard user JWT auth
  const authClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data, error } = await authClient.auth.getUser();
  if (error || !data?.user?.id) {
    return { ok: false as const, status: 401, error: 'Unauthorized' };
  }

  return { ok: true as const, userId: data.user.id };
}

async function selectAccount(supabase: ReturnType<typeof createClient>, brainType: string) {
  // Release stuck accounts (busy > 3 min)
  const stuckThreshold = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  await supabase.from('brainchain_accounts')
    .update({ is_busy: false, busy_since: null, busy_user_id: null })
    .eq('is_busy', true)
    .lt('busy_since', stuckThreshold);

  for (const type of [brainType, 'general']) {
    const { data: accounts } = await supabase
      .from('brainchain_accounts')
      .select('id, access_token, access_expires_at, refresh_token, brain_project_id, brain_type')
      .eq('is_active', true)
      .eq('is_busy', false)
      .eq('brain_type', type)
      .lt('error_count', 5)
      .not('brain_project_id', 'is', null)
      .order('last_used_at', { ascending: true, nullsFirst: true })
      .limit(1);

    if (accounts?.length) return accounts[0];
  }
  return null;
}

async function ensureValidToken(supabase: ReturnType<typeof createClient>, account: Record<string, any>) {
  const expiresAt = account.access_expires_at ? new Date(account.access_expires_at).getTime() : 0;
  const isExpired = expiresAt < Date.now() + 60000;

  if (!isExpired && account.access_token) return account.access_token;
  if (!account.refresh_token) return null;

  try {
    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(account.refresh_token)}`,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const newToken = data.id_token || data.access_token;
    if (!newToken) return null;

    let expiresAtStr = new Date(Date.now() + 3600000).toISOString();
    try {
      const payload = JSON.parse(atob(newToken.split('.')[1]));
      expiresAtStr = new Date(payload.exp * 1000).toISOString();
    } catch (_) {}

    await supabase.from('brainchain_accounts').update({
      access_token: newToken,
      refresh_token: data.refresh_token || account.refresh_token,
      access_expires_at: expiresAtStr,
      error_count: 0,
      updated_at: new Date().toISOString(),
    }).eq('id', account.id);

    return newToken;
  } catch (_) { return null; }
}

async function getInitialLatestMessageId(projectId: string, token: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.lovable.dev/projects/${projectId}/chat/latest-message`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Origin': 'https://lovable.dev' },
    });
    if (!res.ok) return null;
    const latest = await res.json();
    return latest?.id || null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const body = await req.json().catch(() => ({}));
  const { message, brain_type = 'general', user_id } = body;

  const requester = await resolveRequester(req, user_id);
  if (!requester.ok) {
    return new Response(JSON.stringify({ ok: false, error: requester.error }), {
      status: requester.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const normalizedMessage = typeof message === 'string' ? message.trim() : '';
  const normalizedBrainType = typeof brain_type === 'string' ? brain_type.trim().toLowerCase() : 'general';

  if (!normalizedMessage) {
    return new Response(JSON.stringify({ error: 'message obrigatório' }), { status: 400, headers: corsHeaders });
  }

  if (normalizedMessage.length > MAX_MESSAGE_LENGTH) {
    return new Response(JSON.stringify({ error: 'message muito longo' }), { status: 400, headers: corsHeaders });
  }

  if (!VALID_BRAIN_TYPES.has(normalizedBrainType)) {
    return new Response(JSON.stringify({ error: 'brain_type inválido' }), { status: 400, headers: corsHeaders });
  }

  const licenseKey = requester.userId;

  const account = await selectAccount(supabase, normalizedBrainType);

  if (!account) {
    const { data: queued } = await supabase.from('brainchain_queue').insert({
      user_id: licenseKey,
        brain_type: normalizedBrainType,
      message: normalizedMessage,
      status: 'pending',
      expires_at: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
    }).select('id').single();

    return new Response(JSON.stringify({
      ok: false,
      queued: true,
      queue_id: queued?.id,
      message: 'Todos os Brains desta categoria estão ocupados. Mensagem enfileirada.',
      retry_after: 30,
    }), { status: 202, headers: corsHeaders });
  }

  // Mark busy
  await supabase.from('brainchain_accounts').update({
    is_busy: true,
    busy_since: new Date().toISOString(),
    busy_user_id: licenseKey,
    last_used_at: new Date().toISOString(),
  }).eq('id', account.id);

  const { data: queueRecord } = await supabase.from('brainchain_queue').insert({
    user_id: licenseKey,
    brain_type: normalizedBrainType,
    message: normalizedMessage,
    status: 'processing',
    account_id: account.id,
    started_at: new Date().toISOString(),
  }).select('id').single();

  const startedAt = Date.now();

  try {
    const token = await ensureValidToken(supabase, account);
    if (!token) throw new Error('Token inválido e não foi possível renovar');

    const projectId = account.brain_project_id;
    if (!projectId) throw new Error('Brain project não configurado para esta conta');

    // Snapshot the current latest message ID BEFORE sending
    const initialMsgId = await getInitialLatestMessageId(projectId, token);

    const msgId = 'usermsg_' + rb32(26);
    const aiMsgId = 'aimsg_' + rb32(26);

    const encoded = encodeTaskAsViewDesc(normalizedMessage, {
      name: `BrainChain — ${normalizedBrainType}`,
      internalId: `bc_${normalizedBrainType}_${Date.now()}`,
      viewPrefix: "The user is viewing the Timeline tab on the Activity view.",
    });

    const lvPayload = {
      id: msgId,
      message: EXECUTE_CMD,
      intent: "security_fix_v2",
      chat_only: false,
      ai_message_id: aiMsgId,
      thread_id: 'main',
      view: 'editor',
      view_description: encoded,
      model: null,
      session_replay: '[]',
      client_logs: [],
      network_requests: [],
      runtime_errors: [],
      files: [],
      selected_elements: [],
      optimisticImageUrls: [],
      debug_mode: false,
      integration_metadata: {
        browser: { preview_viewport_width: 1280, preview_viewport_height: 854 },
      },
    };

    const lvRes = await fetch(`https://api.lovable.dev/projects/${projectId}/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Origin': 'https://lovable.dev',
        'Referer': 'https://lovable.dev/',
        'X-Client-Git-SHA': '3d7a3673c6f02b606137a12ddc0ab88f6b775113',
      },
      body: JSON.stringify(lvPayload),
    });

    if (lvRes.status === 429) throw new Error('Rate limit na conta mestre');
    if (lvRes.status === 401) throw new Error('Token expirado — renovação falhou');
    if (lvRes.status !== 202 && !lvRes.ok) {
      const d = await lvRes.json().catch(() => ({}));
      throw new Error(d.error || 'Lovable retornou HTTP ' + lvRes.status);
    }

    // Poll for response using correct URL
    let response: string | null = null;
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 3000));
      try {
        const latestRes = await fetch(
          `https://api.lovable.dev/projects/${projectId}/chat/latest-message`,
          { headers: { 'Authorization': `Bearer ${token}`, 'Origin': 'https://lovable.dev' } }
        );
        if (latestRes.ok) {
          const latest = await latestRes.json();
          const content = latest?.content || latest?.message || latest?.text || '';
          // Compare with initial snapshot to detect NEW responses
          if (content && content.length > 20 && latest?.id && latest.id !== initialMsgId) {
            response = content;
            break;
          }
        }
      } catch (_) {}
    }

    const durationMs = Date.now() - startedAt;

    // Update queue and release account
    await Promise.all([
      supabase.from('brainchain_queue').update({
        status: response ? 'done' : 'timeout',
        response,
        completed_at: new Date().toISOString(),
      }).eq('id', queueRecord?.id),

      supabase.from('brainchain_accounts').update({
        is_busy: false,
        busy_since: null,
        busy_user_id: null,
        error_count: 0,
        updated_at: new Date().toISOString(),
      }).eq('id', account.id),

      supabase.rpc('increment_requests', { acc_id: account.id }),

      supabase.from('brainchain_usage').insert({
        user_id: licenseKey,
        brain_type: normalizedBrainType,
        account_id: account.id,
        queue_id: queueRecord?.id,
        duration_ms: durationMs,
        success: !!response,
      }),
    ]);

    if (response) {
      return new Response(JSON.stringify({
        ok: true,
        response,
        brain_type: account.brain_type,
        duration_ms: durationMs,
      }), { headers: corsHeaders });
    } else {
      return new Response(JSON.stringify({
        ok: true,
        pending: true,
        brain_type: account.brain_type,
        message: 'Brain está processando — resposta disponível em breve',
        duration_ms: durationMs,
      }), { headers: corsHeaders });
    }

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);

    await supabase.from('brainchain_accounts').update({
      is_busy: false,
      busy_since: null,
      busy_user_id: null,
      updated_at: new Date().toISOString(),
    }).eq('id', account.id);

    await supabase.rpc('increment_errors', { acc_id: account.id });

    if (queueRecord?.id) {
      await supabase.from('brainchain_queue').update({
        status: 'error',
        error_msg: errMsg,
        completed_at: new Date().toISOString(),
      }).eq('id', queueRecord.id);
    }

    return new Response(JSON.stringify({ ok: false, error: 'Internal processing error' }), {
      status: 500, headers: corsHeaders,
    });
  }
});
