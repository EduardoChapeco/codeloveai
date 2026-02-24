-- Phase 9 supplement: seed starcrawl skill and orchestration_messages FK fix

-- Seed starcrawl agent skill
INSERT INTO agent_skills (id, name, description, prompt_template, intent, is_active)
VALUES (
  'a1000000-0000-0000-0000-000000000010',
  'starcrawl',
  'Scrape a website URL and generate a Lovable-ready implementation prompt',
  'Use the StarCrawl tool to scrape {url} and generate a complete implementation prompt. Focus on: design, structure, colors, and content hierarchy. Build a modern, responsive version with React and Tailwind CSS.',
  'chat',
  true
)
ON CONFLICT (id) DO UPDATE SET
  description   = EXCLUDED.description,
  prompt_template = EXCLUDED.prompt_template,
  updated_at    = now();

-- Add project_id FK to orchestration_messages (if not already set)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orchestration_messages' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE orchestration_messages ADD COLUMN project_id uuid REFERENCES orchestrator_projects(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Index for fast relay polling by project
CREATE INDEX IF NOT EXISTS orchestration_messages_project_id_created_at_idx
  ON orchestration_messages (project_id, created_at DESC);

-- Allow service role full access to orchestration_messages
ALTER TABLE orchestration_messages DISABLE ROW LEVEL SECURITY;
