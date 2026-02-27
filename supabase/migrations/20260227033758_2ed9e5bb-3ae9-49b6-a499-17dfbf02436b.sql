
-- Table to store shared support brain configuration (admin-managed)
CREATE TABLE public.support_brain_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_project_id text NOT NULL,
  admin_user_id uuid NOT NULL,
  knowledge_version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_brain_config ENABLE ROW LEVEL SECURITY;

-- Only admins can manage support brain config
CREATE POLICY "Admins can manage support brain config"
  ON public.support_brain_config FOR ALL
  TO authenticated
  USING (public.is_admin());

-- Authenticated users can read active config (needed by edge function via service role anyway)
CREATE POLICY "Authenticated can read active config"
  ON public.support_brain_config FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Table to store assistant conversation history per user
CREATE TABLE public.assistant_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message text NOT NULL,
  response text,
  status text NOT NULL DEFAULT 'completed',
  model_used text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assistant conversations"
  ON public.assistant_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assistant conversations"
  ON public.assistant_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all assistant conversations"
  ON public.assistant_conversations FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Index for fast lookups
CREATE INDEX idx_assistant_conversations_user ON public.assistant_conversations(user_id, created_at DESC);
