
-- Add max_projects column to plans table
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_projects integer DEFAULT NULL;

-- Add theme customization columns to tenants table
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS theme_preset text DEFAULT 'default';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS font_family text DEFAULT 'system';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS border_radius integer DEFAULT 12;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS extension_mode text DEFAULT 'security_fix_v2';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS custom_mode_prompt text DEFAULT NULL;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS trial_minutes integer DEFAULT 30;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS modules jsonb DEFAULT '{"chat":false,"deploy":true,"preview":true,"notes":true,"split":false,"automation":false,"whitelabel":false,"affiliates":true,"community":true}'::jsonb;
