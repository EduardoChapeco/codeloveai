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
    return new Response(JSON.stringify({ valid: false }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const { licenseKey } = body
  if (!licenseKey) {
    return new Response(JSON.stringify({ valid: false }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: license } = await supabase
    .from('licenses')
    .select('*, tenants(branding, plan_type, status)')
    .eq('key', licenseKey)
    .eq('active', true)
    .single()

  if (!license) {
    return new Response(JSON.stringify({ valid: false }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const today = new Date().toISOString().split('T')[0]
  const { data: usage } = await supabase
    .from('daily_usage')
    .select('messages_used')
    .eq('license_id', license.id)
    .eq('date', today)
    .single()

  const tenant = license.tenants
  const branding = tenant?.branding || {}

  return new Response(JSON.stringify({
    valid: true,
    plan: {
      type: license.plan_type || 'messages',
      dailyLimit: license.daily_messages || 10,
      hourlyLimit: license.hourly_limit || null,
      usedToday: usage?.messages_used || 0,
      planName: license.plan || 'Grátis',
      expires_at: license.expires_at,
    },
    branding: {
      appName: branding.appName || 'Starble Booster',
      primaryColor: branding.primaryColor || '7c3aed',
      secondaryColor: branding.secondaryColor || '9d5af5',
      logoUrl: branding.logo || null,
      isTenant: !!tenant,
      tenantId: license.tenant_id || null,
    },
    links: {
      dashboard: 'https://starble.lovable.app/dashboard',
      renew: 'https://starble.lovable.app/dashboard?action=renew',
      affiliate: 'https://starble.lovable.app/cadastro?tipo=afiliado',
    },
  }), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
