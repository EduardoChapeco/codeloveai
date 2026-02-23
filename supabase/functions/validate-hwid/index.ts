import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ valid: false, error: 'Invalid JSON' }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const licenseKey = body.licenseKey as string | undefined
  const hwid = body.hwid as string | undefined

  if (!licenseKey?.startsWith('CLF1.')) {
    return new Response(JSON.stringify({ valid: false, error: 'Invalid license format' }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Query license by key + active
  const { data: license, error } = await supabase
    .from('licenses')
    .select('*')
    .eq('key', licenseKey)
    .eq('active', true)
    .single()

  if (error || !license) {
    return new Response(JSON.stringify({ valid: false, error: 'License not found or inactive' }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Check expiry
  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    return new Response(JSON.stringify({ valid: false, error: 'License expired' }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Fetch profile separately (resilient even without FK)
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, email')
    .eq('user_id', license.user_id)
    .maybeSingle()

  // Register or verify HWID (Allow up to 2)
  if (hwid) {
    const currentHwids = license.hwid ? (license.hwid as string).split(',') : []
    if (!currentHwids.includes(hwid)) {
      if (currentHwids.length >= 2) {
        return new Response(JSON.stringify({ valid: false, error: 'Maximum devices reached (2)' }), {
          status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }
      const updatedHwids = [...currentHwids, hwid].join(',')
      await supabase.from('licenses').update({ hwid: updatedHwids }).eq('key', licenseKey)
    }
  }

  // Fetch usage today
  const today = new Date().toISOString().split('T')[0]
  const { data: usage } = await supabase
    .from('daily_usage')
    .select('messages_used')
    .eq('license_id', license.id)
    .eq('date', today)
    .maybeSingle()

  return new Response(JSON.stringify({
    valid: true,
    plan: {
      expires_at: license.expires_at || null,
      planName: license.plan || 'Chat Booster',
      type: license.plan_type || 'messages',
      dailyLimit: license.daily_messages || 100,
      usedToday: usage?.messages_used || 0
    },
    name: profile?.name || 'Usuário',
    email: profile?.email || '',
    tenantId: license.tenant_id || null,
  }), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
