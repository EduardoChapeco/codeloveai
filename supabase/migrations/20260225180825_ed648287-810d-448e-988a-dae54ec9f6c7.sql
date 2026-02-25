-- Add display_name column to plans
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS display_name text;

-- Update existing plans with display_name = name as default
UPDATE public.plans SET display_name = name WHERE display_name IS NULL;
