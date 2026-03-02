import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-clf-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FIREBASE_KEY = Deno.env.get('FIREBASE_API_KEY') || '';
const C = '0123456789abcdefghjkmnpqrstvwxyz';
const rb32 = (n: number) => Array.from({ length: n }, () => C[Math.floor(Math.random() * 32)]).join('');

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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const body = await req.json().catch(() => ({}));
  const { message, brain_type = 'general', user_id } = body;
  const licenseKey = req.headers.get('x-clf-token') || user_id || 'anonymous';

  if (!message) {
    return new Response(JSON.stringify({ error: 'message obrigatório' }), { status: 400, headers: corsHeaders });
  }

  const account = await selectAccount(supabase, brain_type);

  if (!account) {
    const { data: queued } = await supabase.from('brainchain_queue').insert({
      user_id: licenseKey,
      brain_type,
      message,
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
    brain_type,
    message,
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

    const msgId = 'usermsg_' + rb32(26);
    const aiMsgId = 'aimsg_' + rb32(26);

    const lvPayload = {
      id: msgId,
      message,
      chat_only: false,
      ai_message_id: aiMsgId,
      thread_id: 'main',
      view: 'editor',
      view_description: 'User is requesting Brain analysis and response.',
      model: null,
      session_replay: '[]',
      client_logs: [],
      network_requests: [],
      runtime_errors: [],
      files: [],
      integration_metadata: {
        browser: { preview_viewport_width: 1280, preview_viewport_height: 854, auth_token: token },
        supabase: { auth_token: token },
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

    // Poll for response
    let response: string | null = null;
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 3000));
      try {
        const latestRes = await fetch(
          `https://api.lovable.dev/projects/${projectId}/latest-message`,
          { headers: { 'Authorization': `Bearer ${token}`, 'Origin': 'https://lovable.dev' } }
        );
        if (latestRes.ok) {
          const latest = await latestRes.json();
          const content = latest?.content || latest?.message || latest?.text || '';
          if (content && content.length > 20 && latest?.id !== msgId) {
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
        brain_type,
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
        brain_project_id: projectId,
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
