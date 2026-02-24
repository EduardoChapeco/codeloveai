-- ═══════════════════════════════════════════════════════════════════════════
-- Support Ticket System + Help Articles
-- Multi-tenant aware: Starble admin sees all, WL owners see their tenants
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Help Articles ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.help_articles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT        NOT NULL UNIQUE,
  title       TEXT        NOT NULL,
  summary     TEXT        NOT NULL,
  content     TEXT        NOT NULL,   -- Markdown
  category    TEXT        NOT NULL
    CHECK (category IN ('getting_started','extension','brain_lab','orchestrator','white_label','plans','security','faq')),
  tags        TEXT[]      DEFAULT '{}',
  is_public   BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order  INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "help_articles_public_read"
  ON public.help_articles FOR SELECT
  USING (is_public = true OR public.is_admin());

CREATE POLICY "help_articles_admin_write"
  ON public.help_articles FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Seed initial knowledge base articles
INSERT INTO public.help_articles (slug, title, summary, content, category, sort_order) VALUES
(
  'primeiros-passos',
  'Primeiros Passos com o Starble',
  'Como instalar a extensão, conectar sua conta e começar a usar.',
  E'## Bem-vindo ao Starble\n\nO Starble é uma plataforma de automação e inteligência para criadores de projetos digitais. Para começar:\n\n### 1. Instale a Extensão\nAcesse `/install` e siga as instruções para instalar a extensão no Chrome. A extensão é essencial para a comunicação com as ferramentas de criação de projetos.\n\n### 2. Crie sua Conta\nAcesse `/register` e crie sua conta gratuitamente. Você receberá **10 mensagens gratuitas** para experimentar.\n\n### 3. Faça Login na Extensão\nApós instalar, clique no ícone da extensão e faça login com as mesmas credenciais da plataforma.\n\n### 4. Explore o Dashboard\nSeu painel central em `/dashboard` mostra suas estatísticas de uso, status da extensão e acesso rápido a todas as ferramentas.\n\n> **Dica**: Configure o Supabase externo para seus projetos — evite depender apenas do armazenamento em nuvem de terceiros.',
  'getting_started',
  1
),
(
  'extensao-chrome',
  'Usando a Extensão Chrome',
  'Funcionalidades, atalhos e configurações da extensão.',
  E'## Extensão Chrome — Guia Completo\n\nA extensão Starble é o coração da sua experiência. Ela monitora e enriquece seu fluxo de trabalho.\n\n### Funcionalidades Principais\n- **Assistência em tempo real**: sugestões contextuais enquanto você trabalha\n- **Captura de contexto**: salva informações importantes automaticamente\n- **Atalhos rápidos**: acesse ferramentas sem sair do fluxo\n\n### Configurações Importantes\n1. Acesse as configurações da extensão\n2. Verifique que seu HWID está registrado\n3. Mantenha a extensão atualizada\n\n### Troubleshooting\n- Se a extensão não conectar, verifique sua conexão e faça logout/login\n- Problemas persistentes? Abra um ticket em `/suporte`',
  'extension',
  2
),
(
  'planos-limites',
  'Planos e Limites de Uso',
  'Entenda os limites de cada plano e como fazer upgrade.',
  E'## Planos Starble\n\n### Plano Gratuito\n- **10 mensagens** para começar\n- Acesso básico ao dashboard\n- Extensão Chrome incluída\n\n### Planos Pagos\nConsulte `/precos` para ver todos os planos disponíveis com informações atualizadas de limites e preços.\n\n### Como o Limite é Calculado\nCada interação com as ferramentas de IA conta como uma mensagem. O limite é reiniciado diariamente à meia-noite (UTC-3).\n\n> **Recomendação**: Para uso intensivo, considere armazenar seus projetos no GitHub e usar Supabase externo para reduzir chamadas desnecessárias.',
  'plans',
  3
),
(
  'seguranca-boas-praticas',
  'Segurança e Boas Práticas',
  'Como manter seus projetos seguros ao usar o Starble.',
  E'## Segurança ao Usar o Starble\n\n### Proteça suas Credenciais\n- **Nunca compartilhe** sua senha ou tokens de acesso\n- Use senhas únicas e fortes\n- Ative 2FA em todas as contas integradas\n\n### Seus Projetos\nTrabalhar com integrações envolve responsabilidades. Recomendamos:\n\n1. **Backup no GitHub**: Sempre conecte seu projeto a um repositório Git. Nunca deixe seu código apenas em plataformas de terceiros.\n2. **Supabase Externo**: Use seu próprio projeto Supabase para dados críticos. Não dependa apenas do banco de dados da plataforma de criação.\n3. **Backup Regular do Banco**: O Supabase oferece exports — use-os semanalmente.\n\n### Riscos de Integrações Não-Oficiais\nO Starble usa integrações que podem estar sujeitas a mudanças de terceiros. Ao usar a plataforma, você aceita que:\n- Mudanças em APIs de terceiros podem afetar funcionalidades\n- Recomendamos não depender de ferramentas beta para projetos críticos em produção\n- Sempre tenha um plano de contingência\n\n### LGPD e Privacidade\nConsulte nossos Termos de Uso em `/termos` para entender como tratamos seus dados.',
  'security',
  4
),
(
  'white-label-guia',
  'White Label — Guia para Operadores',
  'Como configurar e gerenciar sua plataforma White Label.',
  E'## Starble White Label\n\n### O que é?\nO programa White Label permite que você ofereça a plataforma Starble com sua própria marca para seus clientes.\n\n### Configuração Inicial\n1. Acesse `/whitelabel/onboarding`\n2. Configure nome, logo e cores da sua marca\n3. Defina o domínio personalizado\n4. Configure as comissões para seus afiliados\n\n### Gestão de Usuários\nComo operador White Label, você pode:\n- Gerenciar usuários do seu tenant\n- Definir limites de plano\n- Visualizar tickets de suporte de seus usuários\n- Acessar relatórios financeiros\n\n### Suporte Hierárquico\n- Seus usuários → Você (admin WL)\n- Você → Starble (suporte plataforma)\n\n> **Importante**: Problemas de plataforma (infraestrutura, bugs) devem ser reportados ao Starble via `/suporte`. Problemas de uso dos seus usuários são de sua responsabilidade.',
  'white_label',
  5
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  content = EXCLUDED.content,
  updated_at = NOW();

-- ── Support Tickets ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_num  SERIAL,   -- Auto-incrementing human-readable number
  tenant_id   UUID        REFERENCES public.tenants(id) ON DELETE SET NULL,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  category    TEXT        NOT NULL DEFAULT 'general'
    CHECK (category IN ('general','bug','billing','whitlabel','orchestrator','extension','security','feature_request')),
  status      TEXT        NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','resolved','closed')),
  priority    TEXT        NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','urgent')),
  assigned_to UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_user    ON public.support_tickets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant  ON public.support_tickets(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_status  ON public.support_tickets(status, created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Users see their own tickets
CREATE POLICY "tickets_user_select"
  ON public.support_tickets FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR (
      tenant_id IN (
        SELECT tenant_id FROM public.tenant_users
        WHERE user_id = auth.uid() AND role IN ('tenant_owner','tenant_admin')
      )
    )
  );

CREATE POLICY "tickets_user_insert"
  ON public.support_tickets FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "tickets_admin_update"
  ON public.support_tickets FOR UPDATE
  USING (public.is_admin() OR user_id = auth.uid());

-- ── Ticket Replies ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ticket_replies (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    UUID        NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body         TEXT        NOT NULL,
  is_internal  BOOLEAN     NOT NULL DEFAULT FALSE,  -- Internal note (admin only)
  is_admin_reply BOOLEAN   NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_replies_ticket
  ON public.ticket_replies(ticket_id, created_at);

ALTER TABLE public.ticket_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "replies_see_if_ticket_visible"
  ON public.ticket_replies FOR SELECT
  USING (
    (NOT is_internal OR public.is_admin())
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND (
          t.user_id = auth.uid()
          OR public.is_admin()
          OR t.tenant_id IN (
            SELECT tenant_id FROM public.tenant_users
            WHERE user_id = auth.uid() AND role IN ('tenant_owner','tenant_admin')
          )
        )
    )
  );

CREATE POLICY "replies_insert_if_owner_or_admin"
  ON public.ticket_replies FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.support_tickets t
        WHERE t.id = ticket_id AND t.user_id = auth.uid()
      )
      OR public.is_admin()
    )
  );

-- ── Update ticket timestamp on reply ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_ticket_on_reply()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.support_tickets
  SET updated_at = NOW(),
      status = CASE WHEN status = 'resolved' THEN 'open' ELSE status END
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_reply ON public.ticket_replies;
CREATE TRIGGER trg_ticket_reply
  AFTER INSERT ON public.ticket_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_ticket_on_reply();

-- ── Waitlist for Lab Features ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lab_waitlist (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT        NOT NULL,
  feature    TEXT        NOT NULL CHECK (feature IN ('brain','starcrawl','voice','orchestrator')),
  name       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(email, feature)
);

ALTER TABLE public.lab_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "waitlist_insert_anon"
  ON public.lab_waitlist FOR INSERT
  WITH CHECK (true);

CREATE POLICY "waitlist_admin_read"
  ON public.lab_waitlist FOR SELECT
  USING (public.is_admin());
