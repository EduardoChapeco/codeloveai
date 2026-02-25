
-- Email templates table
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  subject text NOT NULL DEFAULT '',
  html_body text NOT NULL DEFAULT '',
  description text DEFAULT '',
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all templates" ON public.email_templates FOR ALL
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Tenant admins manage own templates" ON public.email_templates FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id)) WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

-- Email logs table
CREATE TABLE public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_slug text,
  to_email text NOT NULL,
  to_name text,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  resend_id text,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  tenant_id uuid REFERENCES public.tenants(id),
  sent_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all email logs" ON public.email_logs FOR ALL
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Tenant admins view own logs" ON public.email_logs FOR SELECT
  USING (is_tenant_admin(auth.uid(), tenant_id));

-- Trigger for updated_at on templates
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default templates
INSERT INTO public.email_templates (name, slug, subject, html_body, description, variables) VALUES
(
  'Boas-vindas',
  'welcome',
  'Bem-vindo ao {{app_name}}! 🎉',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #6366f1;">Bem-vindo, {{name}}!</h1>
    <p>Sua conta no <strong>{{app_name}}</strong> foi criada com sucesso.</p>
    <p>Comece a explorar todas as funcionalidades disponíveis para você.</p>
    <a href="{{login_url}}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">Acessar Plataforma</a>
    <p style="color: #888; font-size: 12px; margin-top: 24px;">Se você não criou esta conta, ignore este email.</p>
  </div>',
  'Email de boas-vindas para novos usuários',
  '["name", "app_name", "login_url"]'::jsonb
),
(
  'Licença Ativada',
  'license-activated',
  'Sua licença {{plan}} foi ativada! 🚀',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #10b981;">Licença Ativada!</h1>
    <p>Olá, <strong>{{name}}</strong>!</p>
    <p>Sua licença <strong>{{plan}}</strong> está ativa até <strong>{{expires_at}}</strong>.</p>
    <p>Detalhes:</p>
    <ul>
      <li>Plano: {{plan}}</li>
      <li>Mensagens diárias: {{daily_messages}}</li>
      <li>Validade: {{expires_at}}</li>
    </ul>
    <a href="{{dashboard_url}}" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">Ver Dashboard</a>
  </div>',
  'Confirmação de ativação de licença',
  '["name", "plan", "expires_at", "daily_messages", "dashboard_url"]'::jsonb
),
(
  'Recuperação de Senha',
  'password-reset',
  'Recuperação de senha — {{app_name}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #f59e0b;">Recuperação de Senha</h1>
    <p>Olá, <strong>{{name}}</strong>!</p>
    <p>Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo:</p>
    <a href="{{reset_url}}" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">Redefinir Senha</a>
    <p style="color: #888; font-size: 12px; margin-top: 24px;">Este link expira em 1 hora. Se você não solicitou, ignore este email.</p>
  </div>',
  'Email de recuperação de senha',
  '["name", "app_name", "reset_url"]'::jsonb
),
(
  'Notificação Admin',
  'admin-notification',
  '[Admin] {{title}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #ef4444;">{{title}}</h1>
    <p>{{message}}</p>
    <p style="color: #888; font-size: 12px; margin-top: 24px;">Notificação automática do sistema.</p>
  </div>',
  'Notificação para administradores',
  '["title", "message"]'::jsonb
);
