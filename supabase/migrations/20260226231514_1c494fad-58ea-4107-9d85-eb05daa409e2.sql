-- Add support for multiple skills per brain and a display name
ALTER TABLE public.user_brain_projects
  ADD COLUMN IF NOT EXISTS brain_skills text[] NOT NULL DEFAULT ARRAY['general']::text[],
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Star AI';

-- Migrate existing brain_skill values into the new array column
UPDATE public.user_brain_projects
SET brain_skills = ARRAY[brain_skill]::text[]
WHERE brain_skills = ARRAY['general']::text[] AND brain_skill != 'general';