ALTER TABLE public.user_brain_projects ADD COLUMN IF NOT EXISTS brain_skill text NOT NULL DEFAULT 'general';
