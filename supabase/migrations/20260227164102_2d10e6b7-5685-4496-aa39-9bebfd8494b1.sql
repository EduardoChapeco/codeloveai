
-- Add pipeline/kanban fields to crm_contacts
ALTER TABLE public.crm_contacts
  ADD COLUMN IF NOT EXISTS pipeline_stage text NOT NULL DEFAULT 'lead',
  ADD COLUMN IF NOT EXISTS pipeline_moved_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_interaction_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_messages_sent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_messages_received integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversion_value numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS city text;

-- Validation trigger for pipeline_stage
CREATE OR REPLACE FUNCTION public.validate_crm_pipeline_stage()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.pipeline_stage NOT IN ('lead', 'contacted', 'engaged', 'negotiation', 'customer', 'churned') THEN
    RAISE EXCEPTION 'Invalid pipeline_stage: %', NEW.pipeline_stage;
  END IF;
  IF NEW.pipeline_stage IS DISTINCT FROM OLD.pipeline_stage THEN
    NEW.pipeline_moved_at = now();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_validate_crm_pipeline
  BEFORE INSERT OR UPDATE ON public.crm_contacts
  FOR EACH ROW EXECUTE FUNCTION public.validate_crm_pipeline_stage();

-- CRM activity log for journey tracking
CREATE TABLE IF NOT EXISTS public.crm_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  contact_id uuid NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  activity_type text NOT NULL DEFAULT 'note',
  description text NOT NULL DEFAULT '',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage activities"
  ON public.crm_activities FOR ALL
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE INDEX idx_crm_activities_contact ON public.crm_activities(contact_id);
CREATE INDEX idx_crm_contacts_pipeline ON public.crm_contacts(tenant_id, pipeline_stage);
