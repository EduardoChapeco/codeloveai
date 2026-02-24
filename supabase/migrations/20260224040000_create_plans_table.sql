-- ═══════════════════════════════════════════════════════════
-- Plans table — schema aligned with Checkout.tsx expectations
-- R$4,90/dia pricing
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS plans (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'subscription',
  price           INTEGER NOT NULL DEFAULT 0,       -- centavos (490 = R$4,90)
  billing_cycle   TEXT NOT NULL DEFAULT 'daily',    -- 'daily', 'weekly', 'monthly', 'once'
  description     TEXT,
  features        JSONB,
  highlight_label TEXT,                             -- 'Popular', 'Melhor custo', etc.
  daily_limit     INTEGER NOT NULL DEFAULT 10,      -- -1 = ilimitado
  display_order   INTEGER DEFAULT 0,
  is_public       BOOLEAN DEFAULT true,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed plans with correct R$4,90/dia pricing
INSERT INTO plans (id, name, type, price, billing_cycle, description, features, highlight_label, daily_limit, display_order, is_public, is_active)
VALUES
  (
    'free_trial',
    'Grátis',
    'trial',
    0,
    'once',
    'Comece agora sem cartão de crédito.',
    '["10 mensagens/dia","1 projeto","Sem cartão de crédito","Suporte comunidade"]'::jsonb,
    NULL,
    10,
    0,
    true,
    true
  ),
  (
    'daily',
    'Diário',
    'subscription',
    490,
    'daily',
    'Mensagens ilimitadas por 24 horas. Ative quando precisar.',
    '["Mensagens ilimitadas por 24h","Projetos ilimitados","Ativação imediata","Sem mensalidade fixa"]'::jsonb,
    'Popular',
    -1,
    1,
    true,
    true
  ),
  (
    'monthly',
    'Mensal',
    'subscription',
    9700,
    'monthly',
    'O melhor custo-benefício para quem usa todos os dias.',
    '["Mensagens ilimitadas","Projetos ilimitados","Renovação automática","Suporte prioritário"]'::jsonb,
    'Melhor custo',
    -1,
    2,
    true,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  price         = EXCLUDED.price,
  billing_cycle = EXCLUDED.billing_cycle,
  description   = EXCLUDED.description,
  features      = EXCLUDED.features,
  highlight_label = EXCLUDED.highlight_label,
  daily_limit   = EXCLUDED.daily_limit,
  is_public     = EXCLUDED.is_public,
  is_active     = EXCLUDED.is_active;

-- RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Plans are public" ON plans;
CREATE POLICY "Plans are public"
  ON plans FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only admins can modify plans" ON plans;
CREATE POLICY "Only admins can modify plans"
  ON plans FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
