// Edge Function: send-message v2.2
// REGRA DE OURO: intent, chat_only, view e view_description são SEMPRE
// definidos pelo MODE_MAP server-side. O cliente NUNCA controla esses campos.
// O cliente envia apenas "mode" (string whitelisted).
//
// Modos disponíveis:
//   chat       → security_fix_v2, chat_only: true   — conversa sem editar código (FREE)
//   task       → security_fix_v2, chat_only: false  — executa tarefa, edita código (FREE)
//   task_error → security_fix_v2, chat_only: false  — tarefa disfarçada de bug (FREE, mais agressivo)
//   security   → security_fix_v2, chat_only: false  — auditoria de segurança (FREE)
//   build      → intent: null,    chat_only: false  — ⚠️ GASTA CRÉDITO LOVABLE
//
// licenseKey é OBRIGATÓRIO — sem licença válida, Lovable nunca é chamado.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const LOVABLE_API = 'https://api.lovable.dev'
const GIT_SHA    = '9810ecd6b501b23b14c5d4ee731d8cda244d003b'

// ── MODE_MAP: único ponto de verdade sobre os modos ─────────────────────────
// O cliente NUNCA envia intent ou chat_only — apenas "mode".
// O servidor mapeia para os campos corretos aqui.
// ─────────────────────────────────────────────────────────────────────────────
interface ModeConfig {
  intent:           string | null
  chat_only:        boolean
  view:             string | null
  view_description: string | null
  costs_credits:    boolean     // documentação — nunca alterado em runtime
}

const MODE_MAP: Record<string, ModeConfig> = {
  // Conversa pura — sem tocar no código do projeto
  chat: {
    intent:           'security_fix_v2',
    chat_only:        true,
    view:             null,
    view_description: null,
    costs_credits:    false,
  },

  // Executa tarefa genérica — pode editar código, mas SEM cobrar créditos Lovable
  task: {
    intent:           'security_fix_v2',
    chat_only:        false,
    view:             null,
    view_description: null,
    costs_credits:    false,
  },

  // Tarefa disfarçada como runtime error — IA prioriza correção imediata (mais agressivo)
  task_error: {
    intent:           'security_fix_v2',
    chat_only:        false,
    view:             'editor',
    view_description: 'The user is currently viewing the editor view for their project.',
    costs_credits:    false,
  },

  // Auditoria e correção de problemas de segurança
  security: {
    intent:           'security_fix_v2',
    chat_only:        false,
    view:             'security',
    view_description: 'The user is currently viewing the security view for their project.',
    costs_credits:    false,
  },

  // ⚠️ MODO BUILD — GASTA CRÉDITOS LOVABLE ⚠️
  // Só ativado com campo extra { allow_build: true } para evitar acidentes
  build: {
    intent:           null,
    chat_only:        false,
    view:             null,
    view_description: null,
    costs_credits:    true,
  },
}

// Modo padrão quando nenhum modo é especificado (comportamento da extensão atual)
const DEFAULT_MODE = 'chat'
// ─────────────────────────────────────────────────────────────────────────────

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
  const { token, projectId, message, msgId, aiMsgId, licenseKey, files, mode, allow_build, runtime_errors } = raw as {
    token?:          string
    projectId?:      string
    message?:        string
    msgId?:          string
    aiMsgId?:        string
    licenseKey?:     string
    files?:          unknown[]
    mode?:           string
    allow_build?:    boolean     // proteção extra obrigatória para modo build
    runtime_errors?: unknown[]   // apenas para task_error
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

  // ── 3b. Resolver o modo ────────────────────────────────────────────────
  const resolvedMode = (mode && MODE_MAP[mode]) ? mode : DEFAULT_MODE
  const modeConfig   = MODE_MAP[resolvedMode]

  // Modo build exige campo extra para evitar ativação acidental
  if (resolvedMode === 'build' && !allow_build)
    return err('Modo build requer allow_build: true', 400)

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

  // ── 5. Montar payload — campos de controle vindos do MODE_MAP ─────────
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
    // runtime_errors: apenas para task_error (passados diretamente)
    runtime_errors:       (resolvedMode === 'task_error' && Array.isArray(runtime_errors))
                            ? runtime_errors
                            : [],
    integration_metadata: {
      browser: { preview_viewport_width: 1280, preview_viewport_height: 854 },
    },

    // ── CAMPOS DE CONTROLE — NUNCA VEM DO CLIENTE — SEMPRE DO MODE_MAP ──
    intent:           modeConfig.intent,
    chat_only:        modeConfig.chat_only,
    view:             modeConfig.view,
    view_description: modeConfig.view_description,
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
  } catch (e: any) {
    console.error('[send-message] Erro de rede ao chamar Lovable:', e?.message)
    return err('Erro de rede', 502)
  }

  // ── 7. Tratar erros do Lovable ────────────────────────────────────────
  console.log('[send-message] Lovable status:', lovableRes.status, '| mode:', resolvedMode, '| projectId:', projectId)

  if (lovableRes.status === 401) return err('Token Firebase expirado ou inválido', 401)
  if (lovableRes.status === 429) return err('Rate limit do Lovable — aguarde alguns minutos', 429)

  // Sucesso: Lovable retorna 202 Accepted (resposta da IA chega via Firestore, não HTTP)
  if (lovableRes.status === 202 || lovableRes.status === 200) {
    // tudo certo — segue para increment-usage
  } else {
    let errBody = ''
    try { errBody = await lovableRes.text() } catch { /* ignore */ }
    console.error('[send-message] Lovable erro inesperado:', lovableRes.status, errBody.slice(0, 500))
    return err(`Lovable API error ${lovableRes.status}: ${errBody.slice(0, 200)}`, 502)
  }

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
  return ok({ ok: true, msgId, aiMsgId, mode: resolvedMode })
})
