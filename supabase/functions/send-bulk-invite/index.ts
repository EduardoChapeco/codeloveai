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
<body style="margin:0;padding:0;background:#f4f4f7;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:40px 40px 30px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">
                ⚡ Starble Booster
              </h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">
                Potencialize seus projetos com IA
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:22px;font-weight:600;">
                Olá, ${name}! 👋
              </h2>
              
              <p style="margin:0 0 20px;color:#4a4a68;font-size:16px;line-height:1.6;">
                Sua conta na <strong>Starble</strong> está ativa e pronta para uso! 
                Queremos te convidar para conhecer nossa <strong>extensão para navegador</strong> — 
                uma ferramenta poderosa que vai transformar sua experiência de desenvolvimento.
              </p>

              <div style="background:#f8f5ff;border-radius:12px;padding:24px;margin:24px 0;border-left:4px solid #7c3aed;">
                <h3 style="margin:0 0 12px;color:#7c3aed;font-size:16px;font-weight:600;">
                  🚀 O que a extensão faz?
                </h3>
                <ul style="margin:0;padding:0 0 0 20px;color:#4a4a68;font-size:15px;line-height:1.8;">
                  <li><strong>Correção automática de segurança</strong> — Detecta e corrige vulnerabilidades</li>
                  <li><strong>Otimização SEO</strong> — Melhora o posicionamento dos seus projetos</li>
                  <li><strong>Fix de erros em tempo real</strong> — Identifica e resolve bugs instantaneamente</li>
                  <li><strong>Modo God (Venus)</strong> — Orquestração avançada com IA</li>
                </ul>
              </div>

              <p style="margin:0 0 24px;color:#4a4a68;font-size:16px;line-height:1.6;">
                Você tem <strong>10 mensagens gratuitas por dia</strong> para experimentar 
                todas as funcionalidades. Acesse o painel para começar:
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://starble.lovable.app/dashboard" 
                       style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#ffffff;text-decoration:none;padding:16px 48px;border-radius:12px;font-size:16px;font-weight:600;letter-spacing:0.3px;box-shadow:0 4px 16px rgba(124,58,237,0.3);">
                      Acessar Meu Painel →
                    </a>
                  </td>
                </tr>
              </table>

              <div style="margin:32px 0 0;padding:20px;background:#fefce8;border-radius:12px;text-align:center;">
                <p style="margin:0;color:#854d0e;font-size:14px;">
                  💡 <strong>Dica:</strong> Instale a extensão diretamente pelo painel 
                  na seção <em>"Extensões"</em> para começar a usar em segundos.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8f9fa;padding:24px 40px;text-align:center;border-top:1px solid #e9ecef;">
              <p style="margin:0;color:#9ca3af;font-size:13px;">
                © 2025 Starble · Feito com 💜 para desenvolvedores
              </p>
              <p style="margin:8px 0 0;color:#9ca3af;font-size:12px;">
                <a href="https://starble.lovable.app" style="color:#7c3aed;text-decoration:none;">starble.lovable.app</a>
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
    const body = await req.json().catch(() => ({}));
    // No additional auth - JWT is already disabled, function is protected by being unlisted

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }

    const sc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get from_email config
    const { data: keyData } = await sc
      .from("api_key_vault")
      .select("extra_config")
      .eq("provider", "resend")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    const fromEmail = (keyData?.extra_config as any)?.from_email || "noreply@resend.dev";

    const recipients: { email: string; name: string }[] = body.recipients || [];
    
    const results: { email: string; ok: boolean; error?: string }[] = [];

    for (const r of recipients) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [r.email],
            subject: "⚡ Sua conta Starble está ativa — Conheça a extensão!",
            html: EMAIL_HTML(r.name || "Dev"),
          }),
        });
        const data = await res.json();
        results.push({ email: r.email, ok: res.ok, error: res.ok ? undefined : data.message });
      } catch (e) {
        results.push({ email: r.email, ok: false, error: String(e) });
      }
    }

    return new Response(JSON.stringify({ sent: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, results }), {
      headers: { ...CORS, "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("[send-bulk-invite]", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" }
    });
  }
});
