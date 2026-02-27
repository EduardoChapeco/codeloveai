
-- Create brain_outputs table for storing brain responses
CREATE TABLE public.brain_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  conversation_id UUID REFERENCES public.loveai_conversations(id) ON DELETE SET NULL,
  skill TEXT NOT NULL DEFAULT 'general',
  request TEXT NOT NULL,
  response TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'done',
  brain_project_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_brain_outputs_user_id ON public.brain_outputs(user_id);
CREATE INDEX idx_brain_outputs_skill ON public.brain_outputs(skill);
CREATE INDEX idx_brain_outputs_created_at ON public.brain_outputs(created_at DESC);

-- Enable RLS
ALTER TABLE public.brain_outputs ENABLE ROW LEVEL SECURITY;

-- Users can read their own outputs
CREATE POLICY "Users can read own brain outputs"
  ON public.brain_outputs FOR SELECT
  USING (auth.uid() = user_id);

-- Service role inserts (from edge functions)
CREATE POLICY "Service can insert brain outputs"
  ON public.brain_outputs FOR INSERT
  WITH CHECK (true);

-- Users can delete their own
CREATE POLICY "Users can delete own brain outputs"
  ON public.brain_outputs FOR DELETE
  USING (auth.uid() = user_id);
