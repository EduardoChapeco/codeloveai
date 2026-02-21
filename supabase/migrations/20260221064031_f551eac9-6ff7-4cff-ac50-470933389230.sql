-- Add theme_preset column to tenants for visual theme selection
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS theme_preset text NOT NULL DEFAULT 'apple-glass';

-- Add accent_color for more granular theming
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS accent_color text NOT NULL DEFAULT '#5E5CE6';

-- Add font_family for brand customization
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS font_family text NOT NULL DEFAULT 'system';

-- Add border_radius preset
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS border_radius text NOT NULL DEFAULT '1rem';

-- Update default tenant
UPDATE public.tenants SET theme_preset = 'apple-glass', accent_color = '#5E5CE6' WHERE id = 'a0000000-0000-0000-0000-000000000001';