
-- Add monthly_cost column to tenants for unlimited monthly plan option
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS monthly_user_cost numeric DEFAULT 29.90;

-- Update existing tenants with the correct monthly cost
UPDATE public.tenants SET monthly_user_cost = 29.90 WHERE monthly_user_cost IS NULL OR monthly_user_cost = 0;

-- Comment for clarity
COMMENT ON COLUMN public.tenants.token_cost IS 'Custo por token de 24h (R$2,90 padrão)';
COMMENT ON COLUMN public.tenants.monthly_user_cost IS 'Custo mensal por usuário com mensagens ilimitadas (R$29,90 padrão)';
