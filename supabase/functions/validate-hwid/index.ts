import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ valid: false, error: 'Method not allowed' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  let body: any
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ valid: false, error: 'Invalid JSON' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const { licenseKey, hwid } = body

  if (!licenseKey || !hwid) {
    return new Response(JSON.stringify({ valid: false, error: 'Missing licenseKey or hwid' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // 1. Fetch license by key
  const { data: license, error } = await supabase
    .from('licenses')
    .select('id, key, hwid, plan, plan_type, daily_messages, hourly_limit, expires_at, tenant_id')
    .eq('key', licenseKey)
    .eq('active', true)
    .single()

  if (error || !license) {
    return new Response(JSON.stringify({ valid: false }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // 2. HWID not registered yet — bind it
  if (!license.hwid) {
    const { error: updateErr } = await supabase
      .from('licenses')
      .update({ hwid })
      .eq('id', license.id)

    if (updateErr) {
      return new Response(JSON.stringify({ valid: false, error: 'Failed to register HWID' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
  } else if (license.hwid !== hwid) {
    // 3. Different HWID — reject
    return new Response(JSON.stringify({ valid: false }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // 4. Valid — return plan info
  return new Response(JSON.stringify({
    valid: true,
    plan: {
      type: license.plan_type || 'messages',
      dailyLimit: license.daily_messages || 10,
      hourlyLimit: license.hourly_limit || null,
      expires_at: license.expires_at,
      planName: license.plan || 'Grátis',
    },
    tenantId: license.tenant_id || null,
  }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
})
