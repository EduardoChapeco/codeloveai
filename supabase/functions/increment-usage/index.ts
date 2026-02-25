import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-clf-token, x-clf-extension',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  // SECURITY: Require CLF1 license token
  const clfToken = req.headers.get('x-clf-token') || ''
  if (!clfToken.startsWith('CLF1.')) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Validate the license token matches a real active license
  const { data: license } = await supabase
    .from('licenses')
    .select('id')
    .eq('key', clfToken)
    .eq('active', true)
    .maybeSingle()

  if (!license) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid license' }), {
      status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase.rpc('increment_daily_usage', {
    p_license_id: license.id,
    p_date: today,
  })

  return new Response(JSON.stringify({ ok: true, usedToday: data || 0 }), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
