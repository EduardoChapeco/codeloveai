-- Add brain_id to orchestrator_projects to link orchestrations to specific Brain instances
ALTER TABLE public.orchestrator_projects
ADD COLUMN IF NOT EXISTS brain_id UUID REFERENCES public.user_brain_projects(id) ON DELETE SET NULL;

-- Add brain_skill_profile to store the skills used for this orchestration
ALTER TABLE public.orchestrator_projects
ADD COLUMN IF NOT EXISTS brain_skill_profile TEXT[] DEFAULT '{}';

-- Add brain_mode to orchestrator tasks (which brain skill handles this task)
ALTER TABLE public.orchestrator_tasks
ADD COLUMN IF NOT EXISTS brain_skill TEXT DEFAULT 'general';

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_orchestrator_projects_brain_id ON public.orchestrator_projects(brain_id);
