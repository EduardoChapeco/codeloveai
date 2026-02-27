
-- Community Test Sessions (users share projects for live testing/feedback)
CREATE TABLE public.community_test_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id),
  title TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  preview_url TEXT NOT NULL,
  project_name TEXT DEFAULT '',
  cover_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  feedbacks_count INTEGER NOT NULL DEFAULT 0,
  reactions_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

ALTER TABLE public.community_test_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active sessions"
  ON public.community_test_sessions FOR SELECT TO authenticated
  USING (status = 'active' OR user_id = auth.uid());

CREATE POLICY "Users can create own sessions"
  ON public.community_test_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own sessions"
  ON public.community_test_sessions FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own sessions"
  ON public.community_test_sessions FOR DELETE
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- Validate status
CREATE OR REPLACE FUNCTION public.validate_test_session_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('active', 'closed', 'archived') THEN
    RAISE EXCEPTION 'Invalid test session status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_test_session_status_trigger
  BEFORE INSERT OR UPDATE ON public.community_test_sessions
  FOR EACH ROW EXECUTE FUNCTION public.validate_test_session_status();

CREATE TRIGGER update_test_sessions_updated_at
  BEFORE UPDATE ON public.community_test_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Community Test Feedback Messages (live chat per session)
CREATE TABLE public.community_test_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.community_test_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  reaction_type TEXT, -- null = text message, otherwise emoji/gift reaction
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.community_test_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view feedback"
  ON public.community_test_feedback FOR SELECT TO authenticated
  USING (NOT is_deleted);

CREATE POLICY "Users can post feedback"
  ON public.community_test_feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own feedback"
  ON public.community_test_feedback FOR DELETE
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- Index for fast queries
CREATE INDEX idx_test_feedback_session ON public.community_test_feedback(session_id, created_at);
CREATE INDEX idx_test_sessions_status ON public.community_test_sessions(status, created_at DESC);

-- Enable realtime for live chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_test_feedback;
