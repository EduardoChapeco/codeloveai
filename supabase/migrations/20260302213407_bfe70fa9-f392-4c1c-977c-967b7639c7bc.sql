-- Add missing metadata column to orchestrator_tasks for tracking initial_msg_id and output_marker
ALTER TABLE public.orchestrator_tasks ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT null;