// Edge Function: send-message
// Supabase project: qlhhmmboxlufvdtpbrsm
//
// REGRA DE OURO: intent, chat_only, view e view_description são SEMPRE
// hardcoded aqui. A extensão NUNCA pode definir esses campos.
// chat_only: true = sem geração de código = sem cobrar créditos Lovable.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const LOVABLE_API = 'https://api.lovable.dev'
const GIT_SHA = '9810ecd6b501b23b14c5d4ee731d8cda244d003b'

// ── CAMPOS HARDCODED — NUNCA MUDAR SEM TESTAR ────────────────────────────
const INTENT           = 'security_fix_v2'   // Método que não cria deploy/plano
const CHAT_ONLY        = true                // true = sem cobrar crédito
const VIEW             = 'security'
const VIEW_DESCRIPTION = 'The user is currently viewing the security view for their project.'
// ─────────────────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const { token, projectId, message, msgId, aiMsgId, files, licenseKey } = body as {
    token?: string
    projectId?: string
    message?: string
    msgId?: string
    aiMsgId?: string
    files?: unknown[]
    licenseKey?: string
  }

  // ── Validação básica ──────────────────────────────────────────────────
  if (!token || !projectId || !message || !msgId || !aiMsgId) {
    return json({ error: 'Missing required fields: token, projectId, message, msgId, aiMsgId' }, 400)
  }
  if (!token.startsWith('eyJ')) {
    return json({ error: 'Invalid Firebase token format' }, 401)
  }

  // ── Validar licença (se enviada) ──────────────────────────────────────
  if (licenseKey) {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { data: license, error } = await supabase
      .from('licenses')
      .select('id, active, daily_messages, plan_type')
      .eq('key', licenseKey)
      .eq('active', true)
      .single()

    if (error || !license) {
      return json({ error: 'License invalid or inactive' }, 403)
    }

    // Verificar limite diário (se plan_type === 'messages')
    if (license.plan_type === 'messages' && license.daily_messages) {
      const today = new Date().toISOString().split('T')[0]
      const { data: usage } = await supabase
        .from('daily_usage')
        .select('messages_used')
        .eq('license_id', license.id)
        .eq('date', today)
        .single()
        .catch(() => ({ data: null }))

      if (usage && usage.messages_used >= license.daily_messages) {
        return json({ error: 'Daily message limit reached' }, 429)
      }
    }
  }

  // ── Montar body para a API Lovable ────────────────────────────────────
  // CRÍTICO: intent, chat_only, view SEMPRE vêm daqui — nunca do cliente.
  const lovableBody = {
    id: msgId,
    message: String(message),
    ai_message_id: aiMsgId,
    thread_id: 'main',
    model: null,
    files: Array.isArray(files) ? files : [],
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
    // ── HARDCODED — NÃO REMOVER ──────────────────────────
    intent: INTENT,
    chat_only: CHAT_ONLY,
    view: VIEW,
    view_description: VIEW_DESCRIPTION,
    // ─────────────────────────────────────────────────────
  }

  // ── Chamar API Lovable ────────────────────────────────────────────────
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

    const responseText = await res.text().catch(() => '')

    if (res.status === 401) {
      return json({ error: 'Firebase token expired or invalid' }, 401)
    }
    if (res.status === 429) {
      return json({ error: 'Lovable rate limit — aguarde alguns minutos' }, 429)
    }

    // Passa a resposta da Lovable de volta para a extensão
    return new Response(responseText || JSON.stringify({ ok: res.ok, status: res.status }), {
      status: res.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return json({ error: 'Upstream error: ' + msg }, 502)
  }
})
