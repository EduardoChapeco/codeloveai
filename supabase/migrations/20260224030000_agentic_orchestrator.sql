-- ═══════════════════════════════════════════════════════════
-- Agentic Orchestrator Tables
-- Supports autonomous project creation via Lovable Brain
-- ═══════════════════════════════════════════════════════════

-- Table: orchestrator_projects
CREATE TABLE IF NOT EXISTS orchestrator_projects (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lovable_project_id    TEXT,
  workspace_id          TEXT,
  status                TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','planning','executing','auditing','completed','failed','paused')),
  client_prompt         TEXT NOT NULL,
  prd_json              JSONB,
  current_task_index    INT NOT NULL DEFAULT 0,
  total_tasks           INT NOT NULL DEFAULT 0,
  last_error            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: orchestrator_tasks
CREATE TABLE IF NOT EXISTS orchestrator_tasks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID NOT NULL REFERENCES orchestrator_projects(id) ON DELETE CASCADE,
  task_index            INT NOT NULL,
  title                 TEXT NOT NULL,
  intent                TEXT NOT NULL DEFAULT 'security_fix_v2'
    CHECK (intent IN ('security_fix_v2','seo_fix','error_fix','tool_approve','chat')),
  prompt                TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','completed','failed','skipped')),
  lovable_message_id    TEXT,
  ai_response           TEXT,
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  retry_count           INT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, task_index)
);

-- Table: orchestrator_logs
CREATE TABLE IF NOT EXISTS orchestrator_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES orchestrator_projects(id) ON DELETE CASCADE,
  task_id     UUID REFERENCES orchestrator_tasks(id) ON DELETE SET NULL,
  level       TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info','warn','error','debug')),
  message     TEXT NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orchestrator_projects_user    ON orchestrator_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_orchestrator_projects_status  ON orchestrator_projects(status);
CREATE INDEX IF NOT EXISTS idx_orchestrator_tasks_project    ON orchestrator_tasks(project_id, task_index);
CREATE INDEX IF NOT EXISTS idx_orchestrator_tasks_status     ON orchestrator_tasks(status);
CREATE INDEX IF NOT EXISTS idx_orchestrator_logs_project     ON orchestrator_logs(project_id, created_at DESC);

-- RLS
ALTER TABLE orchestrator_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE orchestrator_tasks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE orchestrator_logs     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own orchestrator projects"
  ON orchestrator_projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own orchestrator projects"
  ON orchestrator_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own orchestrator projects"
  ON orchestrator_projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users see own tasks"
  ON orchestrator_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orchestrator_projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users see own logs"
  ON orchestrator_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orchestrator_projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_orchestrator_project_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orchestrator_projects_updated_at ON orchestrator_projects;
CREATE TRIGGER trg_orchestrator_projects_updated_at
  BEFORE UPDATE ON orchestrator_projects
  FOR EACH ROW EXECUTE FUNCTION update_orchestrator_project_updated_at();
