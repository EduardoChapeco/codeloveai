
-- Chat persistence for Cirius editor
CREATE TABLE public.cirius_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.cirius_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cirius_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own project chats"
  ON public.cirius_chat_messages FOR ALL
  USING (user_id = auth.uid());

CREATE INDEX idx_cirius_chat_project ON public.cirius_chat_messages(project_id, created_at);
