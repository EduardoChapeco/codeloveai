-- Migration: Starble infrastructure
-- Creates daily_usage table, increment_daily_usage function,
-- and adds missing columns to licenses table

-- 1. Create daily_usage table if not exists
CREATE TABLE IF NOT EXISTS daily_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id uuid REFERENCES licenses(id) ON DELETE CASCADE,
  date date DEFAULT CURRENT_DATE,
  messages_used int DEFAULT 0,
  UNIQUE(license_id, date)
);

-- 2. Add missing columns to licenses table
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS hwid text;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS plan_type text DEFAULT 'messages' CHECK (plan_type IN ('messages','hourly'));
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS daily_messages int DEFAULT 10;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS hourly_limit int DEFAULT null;

-- 3. Atomic upsert function for daily usage
CREATE OR REPLACE FUNCTION increment_daily_usage(p_license_id uuid, p_date date)
RETURNS int AS $$
DECLARE
  v_used int;
BEGIN
  INSERT INTO daily_usage (license_id, date, messages_used)
  VALUES (p_license_id, p_date, 1)
  ON CONFLICT (license_id, date)
  DO UPDATE SET messages_used = daily_usage.messages_used + 1;

  SELECT messages_used INTO v_used
  FROM daily_usage
  WHERE license_id = p_license_id AND date = p_date;

  RETURN v_used;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
