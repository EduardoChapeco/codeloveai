import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const LOVABLE_API = "https://api.lovable.dev";
const GIT_SHA = "9810ecd6b501b23b14c5d4ee731d8cda244d003b";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const modeConfig: Record<string, { chat_only?: boolean; view: string; view_description: string; intent?: string; mode?: string }> = {
  build: {
    chat_only: false,
    view: "preview",
    view_description: "O usuário está visualizando a prévia de seu projeto.",
    intent: "security_fix_v2",
  },
  chat: {
    chat_only: true,
    view: "preview",
    view_description: "O usuário está visualizando a prévia de seu projeto.",
    intent: "chat",
  },
  security: {
    chat_only: false,
    view: "security",
    view_description: "O usuário está visualizando a aba de segurança do projeto.",
    intent: "security_fix_v2",
  },
  debug: {
    view: "debug",
    view_description: "O usuário está visualizando a depuração do projeto.",
    mode: "instant",
  },
  github_file: {
    chat_only: false,
    view: "preview",
    view_description: "O usuário está visualizando a prévia de seu projeto.",
    intent: "security_fix_v2",
  },
  task: {
    chat_only: false,
    view: "preview",
    view_description: "O usuário está visualizando a prévia de seu projeto.",
    intent: "security_fix_v2",
  },
};

serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const {
      token,
      projectId,
      message,
      msgId,
      aiMsgId,
      licenseKey,
      mode = "chat",
      files = [],
      runtime_errors = [],
      file_path,
    } = body;

    // 1. Validation: Token Firebase
    if (!token || !token.startsWith("eyJ")) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Validation: ProjectId (UUID)
    if (!projectId || !/^[0-9a-f-]{36}$/.test(projectId)) {
      return new Response(JSON.stringify({ error: "projectId inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Validation: Message
    if (!message || typeof message !== "string" || !message.trim()) {
      return new Response(JSON.stringify({ error: "message obrigatória" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Validation: License
    const valResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/validate-hwid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: licenseKey }),
    });
    const valData = await valResp.json();
    if (!valResp.ok || !valData.ok) {
      return new Response(JSON.stringify({ error: "Licença inválida ou expirada" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine final mode configuration
    const activeMode = modeConfig[mode] ? mode : "chat";
    const cfg = modeConfig[activeMode];

    let finalMessage = message;

    // Mode-specific logic
    if (activeMode === "debug") {
      const errorLines = (runtime_errors ?? [])
        .map((e: any, i: number) => `${i + 1}. ${e.message}${e.filename ? ` (${e.filename}:${e.lineno ?? '?'})` : ''}`)
        .join('\n');

      finalMessage = runtime_errors?.length
        ? `Os seguintes erros de execução foram detectados na prévia do projeto:\n\`\`\`\n${errorLines}\n\`\`\`\n\nInstrução do usuário: ${message}`
        : message;
    } else if (activeMode === "github_file" && file_path) {
      // Fetch source-code
      const srcResp = await fetch(
        `${LOVABLE_API}/projects/${projectId}/source-code`,
        {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Origin": "https://lovable.dev",
            "Referer": "https://lovable.dev/",
            "x-client-git-sha": GIT_SHA
          }
        }
      );

      if (!srcResp.ok) {
        return new Response(JSON.stringify({ error: "Não foi possível acessar o repositório" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const srcData = await srcResp.json();
      const file = (srcData.files ?? []).find((f: any) => f.name === file_path);
      const fileContent = file?.contents ?? "(arquivo não encontrado)";

      finalMessage = `Arquivo: \`${file_path}\`\n\`\`\`\n${fileContent.slice(0, 8000)}\n\`\`\`\n\n${message}`;
    } else if (activeMode === "task") {
      const taskName = `task_${Date.now()}`;
      finalMessage =
        `Crie o arquivo \`.lovable/tasks/${taskName}.md\` com o conteúdo abaixo e, em seguida, execute a tarefa descrita nele:\n\n` +
        `# Tarefa: ${taskName}\n\n${message}`;
    }

    // Construct Lovable Payload
    const lovablePayload: Record<string, any> = {
      id: msgId,
      message: finalMessage,
      ai_message_id: aiMsgId,
      thread_id: "main",
      model: null,
      files: files ?? [],
      optimisticImageUrls: [],
      selected_elements: [],
      debug_mode: false,
      session_replay: "[]",
      client_logs: [],
      network_requests: [],
      runtime_errors: activeMode === "debug" ? (runtime_errors ?? []) : [],
      integration_metadata: {
        browser: {
          preview_viewport_width: 1280,
          preview_viewport_height: 854
        }
      },
      chat_only: cfg.chat_only ?? false,
      view: cfg.view,
      view_description: cfg.view_description,
    };

    if ("intent" in cfg) {
      lovablePayload.intent = cfg.intent;
    }
    if ("mode" in cfg) {
      lovablePayload.mode = cfg.mode;
    }

    // Send to Lovable
    const lovableRes = await fetch(`${LOVABLE_API}/projects/${projectId}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "Origin": "https://lovable.dev",
        "Referer": "https://lovable.dev/",
        "x-client-git-sha": GIT_SHA,
      },
      body: JSON.stringify(lovablePayload),
    });

    if (lovableRes.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de taxa do Lovable atingido" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!lovableRes.ok) {
      const errText = await lovableRes.text();
      console.error("Lovable API error:", lovableRes.status, errText);
      return new Response(JSON.stringify({ error: "Erro inesperado do Lovable" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        msgId,
        aiMsgId,
        mode: activeMode,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("send-message error:", err);
    return new Response(JSON.stringify({ error: "Erro interno no servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
