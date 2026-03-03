
-- Add phase column to orchestrator_tasks for Brain Chain pipeline
ALTER TABLE public.orchestrator_tasks 
ADD COLUMN IF NOT EXISTS phase text DEFAULT 'code_generation';

-- Add sub_tasks JSON for dynamic task expansion
ALTER TABLE public.orchestrator_tasks 
ADD COLUMN IF NOT EXISTS sub_tasks jsonb DEFAULT NULL;

-- Add phase tracking to orchestrator_projects
ALTER TABLE public.orchestrator_projects 
ADD COLUMN IF NOT EXISTS pipeline_phase text DEFAULT 'standard';

-- Comment for clarity
COMMENT ON COLUMN public.orchestrator_tasks.phase IS 'prd_expansion or code_generation';
COMMENT ON COLUMN public.orchestrator_tasks.sub_tasks IS 'Dynamic sub-tasks generated from PRD expansion';
COMMENT ON COLUMN public.orchestrator_projects.pipeline_phase IS 'standard, prd_expansion, code_generation, or refinement';
