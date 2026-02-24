// Edge Function: send-message v2
// REGRA DE OURO: intent, chat_only, view e view_description são SEMPRE
// hardcoded aqui. A extensão NUNCA pode definir esses campos.
// chat_only: true = sem geração de código = sem cobrar créditos Lovable.
// licenseKey é OBRIGATÓRIO — sem licença válida, Lovable nunca é chamado.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const LOVABLE_API = 'https://api.lovable.dev'
const GIT_SHA    = '9810ecd6b501b23b14c5d4ee731d8cda244d003b'

// ── CAMPOS DE CONTROLE — 100% HARDCODED — NUNCA VEM DO CLIENTE ──────────
const INTENT           = 'security_fix_v2'
const CHAT_ONLY        = true
const VIEW             = 'security'
const VIEW_DESCRIPTION = 'The user is currently viewing the security view for their project.'
// ────────────────────────────────────────────────────────────────────────



const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function err(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  // ── 1. OPTIONS preflight ──────────────────────────────────────────────
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  // ── 2. Parse body ─────────────────────────────────────────────────────
  let raw: Record<string, unknown>
  try { raw = await req.json() } catch { return err('Invalid JSON', 400) }

  // Desestruturar APENAS os campos que usamos — ignorar todo o resto
  const { token, projectId, message, msgId, aiMsgId, licenseKey, files } = raw as {
    token?:      string
    projectId?:  string
    message?:    string
    msgId?:      string
    aiMsgId?:    string
    licenseKey?: string
    files?:      unknown[]
  }

  // ── 3. Validações de entrada — licenseKey PRIMEIRO (CRÍTICO) ────────────
  // licenseKey OBRIGATÓRIO antes de qualquer coisa — sem licença, nunca toca no Lovable
  if (!licenseKey || !licenseKey.startsWith('CLF1.'))
    return err('licenseKey inválida', 400)

  if (!token || !token.startsWith('eyJ'))
    return err('Token Firebase inválido', 400)

  if (!projectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(projectId))
    return err('projectId inválido', 400)

  const trimmedMessage = typeof message === 'string' ? message.trim() : ''
  if (!trimmedMessage)
    return err('message não pode estar vazia', 400)

  if (!msgId || !aiMsgId)
    return err('msgId e aiMsgId são obrigatórios', 400)

  if (files !== undefined && !Array.isArray(files))
    return err('files deve ser array', 400)

  // ── 4. Validação de licença (ANTES de qualquer chamada ao Lovable) ────
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: license, error: licErr } = await supabase
    .from('licenses')
    .select('id, active, daily_messages, plan_type')
    .eq('key', licenseKey)
    .eq('active', true)
    .single()

  if (licErr || !license)
    return err('Licença inválida ou expirada', 401)

  // Verificar limite diário (planos com cota de mensagens)
  if (license.plan_type === 'messages' && license.daily_messages) {
    const today = new Date().toISOString().split('T')[0]
    const { data: usage } = await supabase
      .from('daily_usage')
      .select('messages_used')
      .eq('license_id', license.id)
      .eq('date', today)
      .single()
      .catch(() => ({ data: null, error: null }))

    if (usage && usage.messages_used >= license.daily_messages)
      return err('Limite diário de mensagens atingido', 429)
  }

  // ── 5. Montar payload — campos de controle 100% hardcoded ─────────────
  const lovablePayload = {
    id:              msgId,
    message:         trimmedMessage,
    ai_message_id:   aiMsgId,
    files:           Array.isArray(files) ? files.slice(0, 10) : [],

    // Estrutura esperada pela API
    thread_id:            'main',
    model:                null,
    optimisticImageUrls:  [],
    selected_elements:    [],
    debug_mode:           false,
    session_replay:       '[]',
    client_logs:          [],
    network_requests:     [],
    runtime_errors:       [],
    integration_metadata: {
      browser: { preview_viewport_width: 1280, preview_viewport_height: 854 },
    },

    // ── CAMPOS DE CONTROLE — NUNCA REMOVER ──────────────────────────────
    intent:           INTENT,           // 'security_fix_v2'
    chat_only:        CHAT_ONLY,        // true — sem geração de código
    view:             VIEW,             // 'security'
    view_description: VIEW_DESCRIPTION, // descrição da view
    // ────────────────────────────────────────────────────────────────────
  }

  // ── 6. Chamar API Lovable (sem retry — erro → encerrar) ───────────────
  let lovableRes: Response
  try {
    lovableRes = await fetch(`${LOVABLE_API}/projects/${projectId}/chat`, {
      method:  'POST',
      headers: {
        'Content-Type':     'application/json',
        'Authorization':    `Bearer ${token}`,   // token do USUÁRIO — nunca service role
        'Origin':           'https://lovable.dev',
        'Referer':          'https://lovable.dev/',
        'x-client-git-sha': GIT_SHA,
      },
      body: JSON.stringify(lovablePayload),
    })
  } catch {
    return err('Erro de rede', 502)
  }

  // ── 7. Tratar erros do Lovable (sem expor detalhes internos) ──────────
  if (lovableRes.status === 401) return err('Token Firebase expirado ou inválido', 401)
  if (lovableRes.status === 429) return err('Rate limit do Lovable — aguarde alguns minutos', 429)
  if (!lovableRes.ok)            return err('Lovable API error', 502)

  // ── 8. Sucesso: incrementar uso (fire-and-forget — não bloqueia usuário)
  fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/increment-usage`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
    },
    body: JSON.stringify({ licenseKey, projectId }),
  }).catch(() => {}) // falha silenciosa — nunca bloqueia a resposta

  // ── 9. Retornar apenas o essencial ao cliente ─────────────────────────
  return ok({ ok: true, msgId, aiMsgId })
})
