import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_KEY = Deno.env.get('BRAINCHAIN_ADMIN_KEY') || '';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Auth: admin key OR Supabase JWT admin
  const adminKey = req.headers.get('x-admin-key') || '';
  const authHeader = req.headers.get('authorization') || '';
  let isAuthed = false;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  if (ADMIN_KEY && adminKey === ADMIN_KEY) {
    isAuthed = true;
  } else if (authHeader.startsWith('Bearer ')) {
    // Check if user is admin via JWT
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (user) {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin');
      if (roles && roles.length > 0) isAuthed = true;
    }
  }

  if (!isAuthed) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  if (action === 'list_accounts') {
    const { data } = await supabase
      .from('brainchain_accounts')
      .select('id, email, label, brain_type, is_active, is_busy, access_expires_at, brain_project_id, request_count, error_count, last_used_at, created_at')
      .order('brain_type')
      .order('created_at');
    return new Response(JSON.stringify({ accounts: data || [] }), { headers: corsHeaders });
  }

  if (action === 'upsert_account') {
    const { email, label, brain_type, refresh_token, access_token, brain_project_id, id } = body;
    if (!refresh_token) {
      return new Response(JSON.stringify({ error: 'refresh_token obrigatório' }), { status: 400, headers: corsHeaders });
    }

    let access_expires_at = null;
    if (access_token) {
      try {
        const payload = JSON.parse(atob(access_token.split('.')[1]));
        access_expires_at = new Date(payload.exp * 1000).toISOString();
      } catch (_) { access_expires_at = new Date(Date.now() + 3600000).toISOString(); }
    }

    const record: Record<string, unknown> = {
      email, label,
      brain_type: brain_type || 'general',
      refresh_token,
      access_token: access_token || null,
      access_expires_at,
      brain_project_id: brain_project_id || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (id) {
      result = await supabase.from('brainchain_accounts').update(record).eq('id', id).select().single();
    } else {
      result = await supabase.from('brainchain_accounts').insert({ ...record, error_count: 0, request_count: 0 }).select().single();
    }

    if (result.error) {
      return new Response(JSON.stringify({ error: result.error.message }), { status: 500, headers: corsHeaders });
    }
    return new Response(JSON.stringify({ ok: true, account: result.data }), { headers: corsHeaders });
  }

  if (action === 'import_accounts') {
    const { accounts } = body;
    if (!Array.isArray(accounts) || !accounts.length) {
      return new Response(JSON.stringify({ error: 'accounts array obrigatório' }), { status: 400, headers: corsHeaders });
    }

    const results = [];
    for (const acc of accounts) {
      if (!acc.refresh_token) continue;
      let access_expires_at = null;
      if (acc.access_token) {
        try {
          const payload = JSON.parse(atob(acc.access_token.split('.')[1]));
          access_expires_at = new Date(payload.exp * 1000).toISOString();
        } catch (_) {}
      }
      const { error } = await supabase.from('brainchain_accounts').insert({
        email:             acc.email,
        label:             acc.label,
        brain_type:        acc.brain_type || 'general',
        refresh_token:     acc.refresh_token,
        access_token:      acc.access_token,
        access_expires_at,
        brain_project_id:  acc.brain_project_id || null,
        is_active:         true,
        error_count:       0,
        request_count:     0,
        updated_at:        new Date().toISOString(),
      });
      results.push({ email: acc.email, ok: !error, error: error?.message });
    }
    return new Response(JSON.stringify({ ok: true, imported: results.filter(r => r.ok).length, results }), { headers: corsHeaders });
  }

  if (action === 'toggle_account') {
    const { id, is_active } = body;
    await supabase.from('brainchain_accounts').update({ is_active, updated_at: new Date().toISOString() }).eq('id', id);
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  }

  if (action === 'delete_account') {
    const { id } = body;
    await supabase.from('brainchain_accounts').delete().eq('id', id);
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  }

  if (action === 'force_release') {
    const { id } = body;
    await supabase.from('brainchain_accounts').update({ is_busy: false, busy_since: null, busy_user_id: null }).eq('id', id);
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  }

  if (action === 'pool_status') {
    const { data: accounts } = await supabase
      .from('brainchain_accounts')
      .select('brain_type, is_active, is_busy, error_count');
    const { data: queue } = await supabase
      .from('brainchain_queue')
      .select('brain_type, status')
      .in('status', ['pending', 'processing']);

    const summary: Record<string, { total: number; active: number; busy: number; queued: number }> = {};
    for (const acc of accounts || []) {
      const t = acc.brain_type;
      if (!summary[t]) summary[t] = { total: 0, active: 0, busy: 0, queued: 0 };
      summary[t].total++;
      if (acc.is_active) summary[t].active++;
      if (acc.is_busy) summary[t].busy++;
    }
    for (const q of queue || []) {
      const t = q.brain_type;
      if (!summary[t]) summary[t] = { total: 0, active: 0, busy: 0, queued: 0 };
      summary[t].queued++;
    }
    return new Response(JSON.stringify({ pool: summary }), { headers: corsHeaders });
  }

  // ─── register_from_extension (auth via x-extension-secret, NOT admin key) ───
  if (action === 'register_from_extension') {
    const extensionSecret = req.headers.get('x-extension-secret') || '';
    const EXTENSION_SECRET = Deno.env.get('BRAINCHAIN_EXTENSION_SECRET') || '';

    if (!EXTENSION_SECRET || extensionSecret !== EXTENSION_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { email, refresh_token, access_token, brain_type, label } = body;

    if (!refresh_token) {
      return new Response(JSON.stringify({ error: 'refresh_token obrigatório' }), { status: 400, headers: corsHeaders });
    }

    let access_expires_at: string | null = null;
    if (access_token) {
      try {
        const payload = JSON.parse(atob(access_token.split('.')[1]));
        access_expires_at = new Date(payload.exp * 1000).toISOString();
      } catch (_) {
        access_expires_at = new Date(Date.now() + 3600000).toISOString();
      }
    }

    const { data: existing } = await supabase
      .from('brainchain_accounts')
      .select('id')
      .or(`email.eq.${email},refresh_token.eq.${refresh_token}`)
      .single();

    let result;
    if (existing?.id) {
      result = await supabase
        .from('brainchain_accounts')
        .update({
          access_token,
          refresh_token,
          access_expires_at,
          is_active: true,
          error_count: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('id, email, brain_type')
        .single();
    } else {
      result = await supabase
        .from('brainchain_accounts')
        .insert({
          email,
          label: label || email || 'conta-' + Date.now(),
          brain_type: brain_type || 'general',
          refresh_token,
          access_token,
          access_expires_at,
          is_active: true,
          is_busy: false,
          error_count: 0,
          request_count: 0,
          updated_at: new Date().toISOString(),
        })
        .select('id, email, brain_type')
        .single();
    }

    if (result.error) {
      return new Response(JSON.stringify({ error: result.error.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      ok: true,
      action: existing?.id ? 'updated' : 'created',
      account: result.data,
    }), { headers: corsHeaders });
  }

  return new Response(JSON.stringify({ error: 'action não reconhecida' }), { status: 400, headers: corsHeaders });
});
