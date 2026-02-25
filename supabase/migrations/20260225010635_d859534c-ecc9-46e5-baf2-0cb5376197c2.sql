
-- Automation rules table
CREATE TABLE public.automation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  action_type TEXT NOT NULL DEFAULT 'send_message',
  project_id TEXT NOT NULL,
  message_template TEXT NOT NULL DEFAULT '',
  cron_expression TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  run_count INTEGER NOT NULL DEFAULT 0,
  user_id UUID NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Automation run logs
CREATE TABLE public.automation_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  result TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

-- RLS for automation_rules
CREATE POLICY "Admins manage all automation rules"
  ON public.automation_rules FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Users manage own automation rules"
  ON public.automation_rules FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS for automation_runs
CREATE POLICY "Admins manage all automation runs"
  ON public.automation_runs FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Users view own automation runs"
  ON public.automation_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own automation runs"
  ON public.automation_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_automation_rules_updated_at
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_automation_rule()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.trigger_type NOT IN ('manual', 'schedule', 'webhook') THEN
    RAISE EXCEPTION 'Invalid trigger_type: %', NEW.trigger_type;
  END IF;
  IF NEW.action_type NOT IN ('send_message', 'publish', 'security_fix', 'seo_fix') THEN
    RAISE EXCEPTION 'Invalid action_type: %', NEW.action_type;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_automation_rule_trigger
  BEFORE INSERT OR UPDATE ON public.automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_automation_rule();
