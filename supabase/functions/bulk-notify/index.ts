import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_HTML = (name: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#13131a;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.4);">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#f59e0b,#f97316,#ef4444);padding:48px 40px 36px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:32px;font-weight:800;letter-spacing:-1px;">
                🚀 Nova Versão Disponível
              </h1>
              <p style="margin:12px 0 0;color:rgba(255,255,255,0.9);font-size:15px;font-weight:500;">
                Extensão Starble Booster — Atualização Importante
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#f5f5f5;font-size:24px;font-weight:700;">
                Olá, ${name}! 👋
              </h2>
              
              <p style="margin:0 0 24px;color:#a1a1aa;font-size:15px;line-height:1.7;">
                Acabamos de lançar uma <strong style="color:#f5f5f5;">nova versão da extensão</strong> com 
                melhorias significativas de performance e usabilidade. Sua experiência vai ficar muito melhor!
              </p>

              <!-- What's New -->
              <div style="background:#1a1a24;border-radius:16px;padding:28px;margin:0 0 28px;border:1px solid rgba(245,158,11,0.15);">
                <h3 style="margin:0 0 16px;color:#f59e0b;font-size:16px;font-weight:700;">
                  ✨ O que mudou?
                </h3>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:8px 0;">
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width:28px;vertical-align:top;padding-top:2px;">
                            <span style="color:#22c55e;font-size:14px;">✅</span>
                          </td>
                          <td>
                            <strong style="color:#f5f5f5;font-size:14px;">Design System Atualizado</strong>
                            <p style="margin:4px 0 0;color:#71717a;font-size:13px;">Interface completamente redesenhada com tema escuro refinado</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;">
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width:28px;vertical-align:top;padding-top:2px;">
                            <span style="color:#22c55e;font-size:14px;">✅</span>
                          </td>
                          <td>
                            <strong style="color:#f5f5f5;font-size:14px;">Tema Light Disponível</strong>
                            <p style="margin:4px 0 0;color:#71717a;font-size:13px;">Agora você pode alternar entre tema claro e escuro</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;">
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width:28px;vertical-align:top;padding-top:2px;">
                            <span style="color:#22c55e;font-size:14px;">✅</span>
                          </td>
                          <td>
                            <strong style="color:#f5f5f5;font-size:14px;">Performance Otimizada</strong>
                            <p style="margin:4px 0 0;color:#71717a;font-size:13px;">Carregamento 3x mais rápido e consumo de memória reduzido</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;">
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width:28px;vertical-align:top;padding-top:2px;">
                            <span style="color:#22c55e;font-size:14px;">✅</span>
                          </td>
                          <td>
                            <strong style="color:#f5f5f5;font-size:14px;">Bypass Cloudflare Atualizado</strong>
                            <p style="margin:4px 0 0;color:#71717a;font-size:13px;">Correções de compatibilidade para a versão mais recente</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;">
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width:28px;vertical-align:top;padding-top:2px;">
                            <span style="color:#22c55e;font-size:14px;">✅</span>
                          </td>
                          <td>
                            <strong style="color:#f5f5f5;font-size:14px;">Token Renovado Automaticamente</strong>
                            <p style="margin:4px 0 0;color:#71717a;font-size:13px;">Seu token foi renovado por mais 30 dias sem custo</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </div>

              <p style="margin:0 0 28px;color:#a1a1aa;font-size:15px;line-height:1.7;">
                Para aproveitar as novidades, basta <strong style="color:#f5f5f5;">atualizar a extensão</strong> 
                no seu navegador. Se ainda não instalou, acesse o painel:
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://starble.lovable.app/dashboard" 
                       style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#f97316);color:#ffffff;text-decoration:none;padding:16px 56px;border-radius:14px;font-size:16px;font-weight:700;letter-spacing:0.3px;box-shadow:0 4px 20px rgba(245,158,11,0.35);">
                      Acessar Painel →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Tip -->
              <div style="margin:32px 0 0;padding:20px;background:rgba(245,158,11,0.06);border-radius:12px;text-align:center;border:1px solid rgba(245,158,11,0.1);">
                <p style="margin:0;color:#a1a1aa;font-size:13px;">
                  💡 <strong style="color:#f5f5f5;">Dica:</strong> Se a extensão não atualizar automaticamente, 
                  desinstale e reinstale pelo painel na seção <em>"Extensões"</em>.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0f0f17;padding:24px 40px;text-align:center;border-top:1px solid rgba(255,255,255,0.05);">
              <p style="margin:0;color:#52525b;font-size:13px;">
                © 2025 Starble · Feito com 🧡 para desenvolvedores
              </p>
              <p style="margin:8px 0 0;color:#52525b;font-size:12px;">
                <a href="https://starble.lovable.app" style="color:#f59e0b;text-decoration:none;">starble.lovable.app</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    // Auth via admin secret
    const adminSecret = req.headers.get("x-admin-secret");
    if (adminSecret !== Deno.env.get("CODELOVE_ADMIN_SECRET")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const sc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get from_email
    const { data: keyData } = await sc
      .from("api_key_vault")
      .select("extra_config")
      .eq("provider", "resend")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    const fromEmail =
      (keyData?.extra_config as Record<string, string>)?.from_email ||
      "noreply@resend.dev";

    // ── Step 1: Renew ALL licenses ──
    const now = new Date();
    const validUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 days

    const { data: renewResult, error: renewErr } = await sc
      .from("licenses")
      .update({
        token_valid_until: validUntil.toISOString(),
        active: true,
        status: "active",
        messages_used_today: 0,
        last_reset_at: now.toISOString().split("T")[0],
        last_renewed_at: now.toISOString(),
      })
      .neq("id", "00000000-0000-0000-0000-000000000000"); // update all

    if (renewErr) {
      console.error("[bulk-notify] renew error:", renewErr);
    }

    // ── Step 2: Get all profiles with email ──
    const { data: profiles, error: profilesErr } = await sc
      .from("profiles")
      .select("user_id, name, email")
      .not("email", "is", null);

    if (profilesErr || !profiles) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch profiles", details: profilesErr }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // ── Step 3: Send emails ──
    const results: { email: string; ok: boolean; error?: string }[] = [];

    for (const profile of profiles) {
      if (!profile.email) continue;
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [profile.email],
            subject:
              "🚀 Nova Versão da Extensão Starble — Atualize Agora!",
            html: EMAIL_HTML(profile.name || "Dev"),
          }),
        });
        const data = await res.json();
        results.push({
          email: profile.email,
          ok: res.ok,
          error: res.ok ? undefined : data.message,
        });
      } catch (e) {
        results.push({ email: profile.email, ok: false, error: String(e) });
      }
    }

    const sent = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;

    return new Response(
      JSON.stringify({
        success: true,
        renewed: "all licenses",
        tokenValidUntil: validUntil.toISOString(),
        emailsSent: sent,
        emailsFailed: failed,
        results,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[bulk-notify]", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
