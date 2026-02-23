-- Create increment_daily_usage function for atomic upsert
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
