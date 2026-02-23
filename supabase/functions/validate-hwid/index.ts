import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  let body: any
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ valid: false, error: 'Invalid JSON' }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const { licenseKey, hwid } = body

  if (!licenseKey?.startsWith('CLF1.')) {
    return new Response(JSON.stringify({ valid: false, error: 'Invalid license format' }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: license, error } = await supabase
    .from('licenses')
    .select('*, tenants(id, branding, plan_type, commission_rate, status)')
    .eq('key', licenseKey)
    .eq('active', true)
    .single()

  if (error || !license) {
    return new Response(JSON.stringify({ valid: false, error: 'License not found' }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Check expiry
  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    return new Response(JSON.stringify({ valid: false, error: 'License expired' }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Register or verify HWID
  if (!license.hwid) {
    await supabase.from('licenses').update({ hwid }).eq('key', licenseKey)
  } else if (license.hwid !== hwid) {
    return new Response(JSON.stringify({ valid: false, error: 'Device not authorized' }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({
    valid: true,
    plan: {
      type: license.plan_type || 'messages',
      dailyLimit: license.daily_messages || 10,
      hourlyLimit: license.hourly_limit || null,
      expires_at: license.expires_at || null,
      planName: license.plan || 'Grátis',
    },
    tenantId: license.tenant_id || null,
  }), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
