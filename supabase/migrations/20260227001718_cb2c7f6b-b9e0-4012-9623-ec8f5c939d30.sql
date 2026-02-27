
ALTER TABLE public.user_brain_projects 
ADD COLUMN IF NOT EXISTS skill_phase integer DEFAULT 0;
