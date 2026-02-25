
-- Orchestrator Projects
CREATE TABLE public.orchestrator_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_prompt TEXT NOT NULL DEFAULT '',
  workspace_id TEXT,
  lovable_project_id TEXT,
  status TEXT NOT NULL DEFAULT 'planning',
  current_task_index INT NOT NULL DEFAULT 0,
  total_tasks INT NOT NULL DEFAULT 0,
  quality_score INT,
  ghost_created BOOLEAN NOT NULL DEFAULT false,
  audit_required BOOLEAN NOT NULL DEFAULT false,
  prd_json JSONB,
  source_fingerprint TEXT,
  current_phase INT DEFAULT 0,
  next_tick_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orchestrator_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own orchestrator projects"
  ON public.orchestrator_projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own orchestrator projects"
  ON public.orchestrator_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own orchestrator projects"
  ON public.orchestrator_projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access orchestrator_projects"
  ON public.orchestrator_projects FOR ALL
  USING (auth.role() = 'service_role');

-- Orchestrator Tasks
CREATE TABLE public.orchestrator_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.orchestrator_projects(id) ON DELETE CASCADE,
  task_index INT NOT NULL DEFAULT 0,
  title TEXT NOT NULL DEFAULT '',
  intent TEXT NOT NULL DEFAULT 'chat',
  prompt TEXT NOT NULL DEFAULT '',
  prompt_text TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  stop_condition TEXT,
  required_audit_before BOOLEAN NOT NULL DEFAULT false,
  retry_count INT NOT NULL DEFAULT 0,
  lovable_message_id TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orchestrator_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tasks of their projects"
  ON public.orchestrator_tasks FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.orchestrator_projects WHERE id = project_id AND user_id = auth.uid()));

CREATE POLICY "Service role full access orchestrator_tasks"
  ON public.orchestrator_tasks FOR ALL
  USING (auth.role() = 'service_role');

-- Orchestrator Logs
CREATE TABLE public.orchestrator_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.orchestrator_projects(id) ON DELETE CASCADE,
  task_id UUID,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL DEFAULT '',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orchestrator_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view logs of their projects"
  ON public.orchestrator_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.orchestrator_projects WHERE id = project_id AND user_id = auth.uid()));

CREATE POLICY "Service role full access orchestrator_logs"
  ON public.orchestrator_logs FOR ALL
  USING (auth.role() = 'service_role');

-- Enable realtime for logs (live feed)
ALTER PUBLICATION supabase_realtime ADD TABLE public.orchestrator_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orchestrator_projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orchestrator_tasks;

-- Orchestration Messages (relay from extension WS bridge)
CREATE TABLE public.orchestration_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.orchestrator_projects(id) ON DELETE CASCADE,
  source TEXT DEFAULT 'relay',
  role TEXT DEFAULT 'assistant',
  content TEXT NOT NULL DEFAULT '',
  task_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orchestration_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages of their projects"
  ON public.orchestration_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.orchestrator_projects WHERE id = project_id AND user_id = auth.uid()));

CREATE POLICY "Service role full access orchestration_messages"
  ON public.orchestration_messages FOR ALL
  USING (auth.role() = 'service_role');

-- Code Snapshots (audit checkpoints)
CREATE TABLE public.code_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  task_id UUID,
  phase INT DEFAULT 0,
  files_json JSONB,
  file_count INT DEFAULT 0,
  fingerprint TEXT,
  security_issues JSONB,
  seo_score INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.code_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access code_snapshots"
  ON public.code_snapshots FOR ALL
  USING (auth.role() = 'service_role');

-- Indexes
CREATE INDEX idx_orchestrator_projects_user ON public.orchestrator_projects(user_id);
CREATE INDEX idx_orchestrator_projects_status ON public.orchestrator_projects(status);
CREATE INDEX idx_orchestrator_tasks_project ON public.orchestrator_tasks(project_id, task_index);
CREATE INDEX idx_orchestrator_logs_project ON public.orchestrator_logs(project_id, created_at);
CREATE INDEX idx_orchestration_messages_project ON public.orchestration_messages(project_id, created_at);
