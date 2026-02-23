import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const LOVABLE_API = 'https://api.lovable.dev'
const GIT_SHA = '9810ecd6b501b23b14c5d4ee731d8cda244d003b'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

  const { token, projectId, message, msgId, aiMsgId, files } = body

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

  // Fields hardcoded server-side — NEVER exposed in the extension
  const lovableBody = {
    id: msgId,
    message: message,
    intent: 'security_fix_v2',           // HARDCODED
    chat_only: false,                      // HARDCODED
    ai_message_id: aiMsgId,
    thread_id: 'main',
    view: 'security',                      // HARDCODED
    view_description: 'The user is currently viewing the security view for their project.',
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
      browser: {
        preview_viewport_width: 1280,
        preview_viewport_height: 854,
      },
    },
  }

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
