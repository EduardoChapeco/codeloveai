import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FIREBASE_KEY = Deno.env.get('FIREBASE_API_KEY') || 'AIzaSyDePbPuDMK7YXNKS4f78N7Ni9GkYQ7bLRw';
const REFRESH_URL = `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_KEY}`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, authorization, x-admin-key',
};

async function refreshToken(rt: string): Promise<{ access_token: string; refresh_token: string; expires_at: string } | null> {
  try {
    const res = await fetch(REFRESH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(rt)}`,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const accessToken = data.id_token || data.access_token;
    if (!accessToken) return null;

    let expiresAt = new Date(Date.now() + 3600000).toISOString();
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      expiresAt = new Date(payload.exp * 1000).toISOString();
    } catch (_) {}

    return {
      access_token: accessToken,
      refresh_token: data.refresh_token || rt,
      expires_at: expiresAt,
    };
  } catch (_) { return null; }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const threshold = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { data: accounts } = await supabase
    .from('brainchain_accounts')
    .select('id, email, refresh_token, access_expires_at')
    .eq('is_active', true)
    .or(`access_expires_at.is.null,access_expires_at.lt.${threshold}`);

  if (!accounts?.length) {
    return new Response(JSON.stringify({ ok: true, renewed: 0, message: 'Nenhum token precisa de renovação' }), { headers: corsHeaders });
  }

  const results = [];
  for (const acc of accounts) {
    if (!acc.refresh_token) {
      results.push({ id: acc.id, email: acc.email, ok: false, error: 'sem refresh_token' });
      continue;
    }

    const renewed = await refreshToken(acc.refresh_token);
    if (!renewed) {
      await supabase.rpc('increment_errors', { acc_id: acc.id });
      results.push({ id: acc.id, email: acc.email, ok: false, error: 'refresh falhou' });
      continue;
    }

    await supabase.from('brainchain_accounts').update({
      access_token: renewed.access_token,
      refresh_token: renewed.refresh_token,
      access_expires_at: renewed.expires_at,
      error_count: 0,
      updated_at: new Date().toISOString(),
    }).eq('id', acc.id);

    results.push({ id: acc.id, email: acc.email, ok: true, expires_at: renewed.expires_at });
  }

  const renewedCount = results.filter(r => r.ok).length;
  return new Response(JSON.stringify({ ok: true, renewed: renewedCount, total: accounts.length, results }), { headers: corsHeaders });
});
