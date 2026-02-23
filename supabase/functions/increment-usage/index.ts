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
    return new Response(JSON.stringify({ ok: false }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const { licenseKey } = body
  if (!licenseKey) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: license } = await supabase
    .from('licenses')
    .select('id')
    .eq('key', licenseKey)
    .eq('active', true)
    .single()

  if (!license) {
    return new Response(JSON.stringify({ ok: false, error: 'License not found' }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
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
