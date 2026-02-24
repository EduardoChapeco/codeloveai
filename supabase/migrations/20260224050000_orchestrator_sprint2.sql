-- ═══════════════════════════════════════════════════════════
-- Orchestrator Sprint 2
-- Ghost Create • Source Audit • Stop Conditions • Agent Skills
-- ═══════════════════════════════════════════════════════════

-- Extend orchestrator_projects with sprint-2 columns
ALTER TABLE orchestrator_projects
  ADD COLUMN IF NOT EXISTS ghost_created         BOOLEAN         DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS source_fingerprint    TEXT,
  ADD COLUMN IF NOT EXISTS quality_score         INT,
  ADD COLUMN IF NOT EXISTS next_tick_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_phase         INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS audit_required        BOOLEAN DEFAULT FALSE;

-- Extend orchestrator_tasks with sprint-2 columns
ALTER TABLE orchestrator_tasks
  ADD COLUMN IF NOT EXISTS stop_condition        TEXT,
  ADD COLUMN IF NOT EXISTS chat_only             BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dispatched_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS required_audit_before BOOLEAN DEFAULT FALSE;

-- Also extend task intent to cover new types
ALTER TABLE orchestrator_tasks
  DROP CONSTRAINT IF EXISTS orchestrator_tasks_intent_check;

ALTER TABLE orchestrator_tasks
  ADD CONSTRAINT orchestrator_tasks_intent_check
    CHECK (intent IN (
      'security_fix_v2','seo_fix','error_fix','tool_approve','chat',
      'ghost_create','audit','setup','feature','db_migration','ux_improvement'
    ));

-- Table: code_snapshots — captures project source at each audit checkpoint
CREATE TABLE IF NOT EXISTS code_snapshots (
  id               UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID      NOT NULL REFERENCES orchestrator_projects(id) ON DELETE CASCADE,
  task_id          UUID      REFERENCES orchestrator_tasks(id) ON DELETE SET NULL,
  phase            INT,
  files_json       JSONB,
  file_count       INT,
  fingerprint      TEXT,
  security_issues  JSONB,
  seo_score        INT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_code_snapshots_project
  ON code_snapshots(project_id, created_at DESC);

ALTER TABLE code_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own snapshots"
  ON code_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orchestrator_projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

-- Table: agent_skills — reusable prompt templates for the orchestrator
CREATE TABLE IF NOT EXISTS agent_skills (
  id               UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT      UNIQUE NOT NULL,
  intent           TEXT,
  chat_only        BOOLEAN   DEFAULT FALSE,
  prompt_template  TEXT      NOT NULL,
  success_rate     FLOAT     DEFAULT 0,
  avg_tokens_used  INT,
  usage_count      INT       DEFAULT 0,
  tags             TEXT[],
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- NOTE: agent_skills is admin-managed — no RLS needed for service role, only admins write
ALTER TABLE agent_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read agent skills"
  ON agent_skills FOR SELECT
  USING (TRUE);

-- Additional index for orchestrator queries
CREATE INDEX IF NOT EXISTS idx_orchestrator_projects_tick
  ON orchestrator_projects(next_tick_at, status)
  WHERE status = 'executing';
