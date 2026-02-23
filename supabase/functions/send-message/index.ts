import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const LOVABLE_API = 'https://api.lovable.dev'
const GIT_SHA = '9810ecd6b501b23b14c5d4ee731d8cda244d003b'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  let body: any
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const { token, projectId, message, msgId, aiMsgId, files, licenseKey } = body

  if (!token || !projectId || !message || !msgId || !aiMsgId) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  if (!token.startsWith('eyJ')) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Validate license if provided
  if (licenseKey) {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { data: license } = await supabase
      .from('licenses')
      .select('id, active, daily_messages, plan_type')
      .eq('key', licenseKey)
      .eq('active', true)
      .single()

    if (!license) {
      return new Response(JSON.stringify({ error: 'License invalid' }), {
        status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
  }

  // Sensitive fields hardcoded server-side — never exposed in the extension
  const lovableBody = {
    id: msgId,
    message: message,
    intent: 'chat',                   // HARDCODED
    chat_only: true,                   // HARDCODED
    ai_message_id: aiMsgId,
    thread_id: 'main',
    view: 'preview',                   // HARDCODED
    view_description: 'The user is currently viewing the preview of their project.', // HARDCODED
    model: null,
    files: files || [],
    optimisticImageUrls: [],
    selected_elements: [],
    debug_mode: false,
    session_replay: '[]',
    client_logs: [],
    network_requests: [],
    runtime_errors: [],
    integration_metadata: {
      browser: { preview_viewport_width: 1280, preview_viewport_height: 854 },
    },
  }

  // DEBUG: log exact payload sent to Lovable — check in Supabase Edge Functions logs
  console.log('[send-message] payload to Lovable:', JSON.stringify(lovableBody))

  try {
    const res = await fetch(`${LOVABLE_API}/projects/${projectId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Origin': 'https://lovable.dev',
        'Referer': 'https://lovable.dev/',
        'x-client-git-sha': GIT_SHA,
      },
      body: JSON.stringify(lovableBody),
    })

    const text = await res.text().catch(() => '')
    return new Response(text || JSON.stringify({ ok: res.ok }), {
      status: res.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (_e: unknown) {
    return new Response(JSON.stringify({ error: 'Upstream error' }), {
      status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
