-- Add brain_type column to orchestrator_tasks for specialized brain assignment
ALTER TABLE public.orchestrator_tasks 
ADD COLUMN IF NOT EXISTS brain_type text DEFAULT 'code';

-- Add depends_on column for parallel dependency tracking
ALTER TABLE public.orchestrator_tasks 
ADD COLUMN IF NOT EXISTS depends_on integer[] DEFAULT '{}';

-- Add index for fast brain_type lookups
CREATE INDEX IF NOT EXISTS idx_orchestrator_tasks_brain_type ON public.orchestrator_tasks(brain_type);
