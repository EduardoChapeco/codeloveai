-- ═══════════════════════════════════════════════════════════════
-- API Key Orchestrator + Relay Messages
-- Multi-key management with usage tracking & smart rotation
-- ═══════════════════════════════════════════════════════════════

-- ── Table: api_keys ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          TEXT        NOT NULL
    CHECK (provider IN ('openrouter','gemini','firecrawl','elevenlabs')),
  label             TEXT        NOT NULL,
  key_encrypted     TEXT        NOT NULL,
  extra_config      JSONB       DEFAULT '{}'::jsonb,  -- voice_id, model, etc.
  -- Limits (NULL = unlimited)
  daily_limit       INT,
  monthly_limit     INT,
  -- Usage counters (reset daily/monthly)
  requests_today    INT         NOT NULL DEFAULT 0,
  requests_month    INT         NOT NULL DEFAULT 0,
  tokens_today      INT         NOT NULL DEFAULT 0,
  tokens_month      INT         NOT NULL DEFAULT 0,
  -- Status
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  last_used_at      TIMESTAMPTZ,
  last_reset_date   DATE        NOT NULL DEFAULT CURRENT_DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_provider ON api_keys(provider, is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_usage    ON api_keys(provider, requests_today)
  WHERE is_active = TRUE;

-- RLS: only accessible via service role (admin Edge Functions)
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
-- No public policies — service role bypasses RLS

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_api_keys_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_api_keys_updated_at ON api_keys;
CREATE TRIGGER trg_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION update_api_keys_updated_at();

-- ── Reset functions ───────────────────────────────────────────
-- Reset daily counters for keys whose last_reset_date < today
CREATE OR REPLACE FUNCTION reset_api_key_daily_counters()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE api_keys
  SET requests_today = 0,
      tokens_today   = 0,
      last_reset_date = CURRENT_DATE
  WHERE last_reset_date < CURRENT_DATE;
END;
$$;

-- Reset monthly counters on the 1st of each month
CREATE OR REPLACE FUNCTION reset_api_key_monthly_counters()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE api_keys
  SET requests_month = 0,
      tokens_month   = 0
  WHERE EXTRACT(DAY FROM CURRENT_DATE) = 1
    AND DATE_TRUNC('month', last_reset_date) < DATE_TRUNC('month', CURRENT_DATE);
END;
$$;

-- ── Table: orchestration_messages (WS relay bridge) ───────────
-- Stores AI responses relayed from the extension's WebSocket hook
CREATE TABLE IF NOT EXISTS orchestration_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID        REFERENCES orchestrator_projects(id) ON DELETE CASCADE,
  source      TEXT        NOT NULL DEFAULT 'relay'
    CHECK (source IN ('relay','polling','manual','system')),
  role        TEXT        NOT NULL DEFAULT 'assistant'
    CHECK (role IN ('assistant','user','system')),
  content     TEXT        NOT NULL,
  task_id     UUID        REFERENCES orchestrator_tasks(id) ON DELETE SET NULL,
  metadata    JSONB       DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orch_messages_project
  ON orchestration_messages(project_id, created_at DESC);

ALTER TABLE orchestration_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own orchestration messages"
  ON orchestration_messages FOR SELECT
  USING (
    project_id IS NULL OR
    EXISTS (
      SELECT 1 FROM orchestrator_projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );
