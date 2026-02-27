
-- Add is_promotional flag to plans table
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS is_promotional boolean NOT NULL DEFAULT false;

-- Create the "Free Master" plan (30 days, unlimited, promotional)
INSERT INTO public.plans (name, type, price, billing_cycle, description, features, highlight_label, daily_message_limit, display_order, is_public, is_active, is_promotional)
VALUES (
  'Free Master',
  'messages',
  0,
  'monthly',
  '30 dias grátis com acesso total — Speed, Editor, Orquestrador e mais.',
  '["Mensagens ilimitadas", "Extensão Speed incluída", "Editor completo", "Orquestrador de projetos", "Comunidade CodeLovers", "Válido por 30 dias"]',
  '🚀 Lançamento',
  NULL,
  -1,
  true,
  true,
  true
);

-- Link Speed extension to Free Master plan
INSERT INTO public.plan_extensions (plan_id, extension_id)
SELECT p.id, ec.id
FROM public.plans p, public.extension_catalog ec
WHERE p.name = 'Free Master' AND ec.slug = 'speed'
ON CONFLICT DO NOTHING;
