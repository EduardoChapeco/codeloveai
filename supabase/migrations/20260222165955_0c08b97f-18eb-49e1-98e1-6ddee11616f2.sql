
-- Brain Projects per user
CREATE TABLE public.user_brain_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  lovable_project_id TEXT NOT NULL UNIQUE,
  lovable_workspace_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id UUID REFERENCES public.tenants(id)
);

ALTER TABLE public.user_brain_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own brain project" ON public.user_brain_projects
FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all brain projects" ON public.user_brain_projects
FOR ALL TO authenticated USING (is_admin(auth.uid()));

-- LoveAI Conversations
CREATE TABLE public.loveai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  target_project_id TEXT,
  brain_message_id TEXT,
  brain_type TEXT NOT NULL DEFAULT 'general',
  user_message TEXT NOT NULL,
  ai_response TEXT,
  response_applied BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id UUID REFERENCES public.tenants(id)
);

ALTER TABLE public.loveai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own loveai convos" ON public.loveai_conversations
FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all loveai convos" ON public.loveai_conversations
FOR ALL TO authenticated USING (is_admin(auth.uid()));

-- Source snapshots for diff polling
CREATE TABLE public.project_source_snapshots (
  project_id TEXT PRIMARY KEY,
  snapshot_hash TEXT,
  last_checked TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.project_source_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for snapshots" ON public.project_source_snapshots
FOR ALL TO authenticated USING (is_admin(auth.uid()));
