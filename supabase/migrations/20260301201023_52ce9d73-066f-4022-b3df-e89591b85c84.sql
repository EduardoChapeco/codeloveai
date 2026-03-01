
-- WhatsApp instances table for per-user Evolution API instances
CREATE TABLE IF NOT EXISTS public.whatsapp_instances (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  instance_name text UNIQUE NOT NULL,
  status text DEFAULT 'disconnected',
  qr_code text,
  phone_number text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- Tenant admins can manage instances
CREATE POLICY "tenant_admins_manage_instances" ON public.whatsapp_instances
FOR ALL USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Members can view their own instance
CREATE POLICY "users_view_own_instance" ON public.whatsapp_instances
FOR SELECT USING (auth.uid() = user_id);

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_wa_instance_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('disconnected', 'connecting', 'connected', 'failed') THEN
    RAISE EXCEPTION 'Invalid instance status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_wa_instance_status
BEFORE INSERT OR UPDATE ON public.whatsapp_instances
FOR EACH ROW EXECUTE FUNCTION public.validate_wa_instance_status();

-- Updated_at trigger
CREATE TRIGGER update_wa_instances_updated_at
BEFORE UPDATE ON public.whatsapp_instances
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
