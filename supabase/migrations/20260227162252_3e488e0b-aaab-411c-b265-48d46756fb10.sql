
-- ══════════════════════════════════════════════════
-- CRM System: Contacts, Campaigns, Message Queue
-- ══════════════════════════════════════════════════

-- 1. CRM Contacts
CREATE TABLE public.crm_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  phone TEXT NOT NULL,
  phone_normalized TEXT NOT NULL,
  name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  source TEXT DEFAULT 'csv',
  metadata JSONB DEFAULT '{}',
  is_international BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, phone_normalized)
);

CREATE INDEX idx_crm_contacts_tenant ON public.crm_contacts(tenant_id);
CREATE INDEX idx_crm_contacts_phone ON public.crm_contacts(phone_normalized);
CREATE INDEX idx_crm_contacts_tags ON public.crm_contacts USING GIN(tags);

ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view contacts"
  ON public.crm_contacts FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can insert contacts"
  ON public.crm_contacts FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can update contacts"
  ON public.crm_contacts FOR UPDATE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can delete contacts"
  ON public.crm_contacts FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- 2. CRM Contact Lists (uploaded CSVs become lists)
CREATE TABLE public.crm_contact_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  file_name TEXT,
  total_rows INTEGER DEFAULT 0,
  duplicates_found INTEGER DEFAULT 0,
  imported_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_contact_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view lists"
  ON public.crm_contact_lists FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can manage lists"
  ON public.crm_contact_lists FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can delete lists"
  ON public.crm_contact_lists FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- 3. CRM Campaigns
CREATE TABLE public.crm_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  message_template TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT DEFAULT 'text',
  target_tags TEXT[] DEFAULT '{}',
  target_list_id UUID REFERENCES public.crm_contact_lists(id),
  schedule_at TIMESTAMPTZ,
  cron_expression TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view campaigns"
  ON public.crm_campaigns FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can manage campaigns"
  ON public.crm_campaigns FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can update campaigns"
  ON public.crm_campaigns FOR UPDATE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can delete campaigns"
  ON public.crm_campaigns FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- 4. CRM Message Queue
CREATE TABLE public.crm_message_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  media_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_queue_status ON public.crm_message_queue(status, created_at);
CREATE INDEX idx_crm_queue_campaign ON public.crm_message_queue(campaign_id);

ALTER TABLE public.crm_message_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view queue"
  ON public.crm_message_queue FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can manage queue"
  ON public.crm_message_queue FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can update queue"
  ON public.crm_message_queue FOR UPDATE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- 5. WhatsApp Session Config (per tenant)
CREATE TABLE public.crm_whatsapp_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  session_data JSONB DEFAULT '{}',
  webhook_url TEXT,
  api_provider TEXT DEFAULT 'evolution',
  api_key_encrypted TEXT,
  instance_name TEXT,
  is_connected BOOLEAN DEFAULT false,
  last_ping_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_whatsapp_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can view session"
  ON public.crm_whatsapp_sessions FOR SELECT TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can manage session"
  ON public.crm_whatsapp_sessions FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can update session"
  ON public.crm_whatsapp_sessions FOR UPDATE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- 6. Landing page media sections (per tenant)
CREATE TABLE public.tenant_landing_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL DEFAULT 'hero',
  title TEXT,
  subtitle TEXT,
  media_url TEXT,
  media_type TEXT DEFAULT 'image',
  cta_text TEXT,
  cta_link TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, section_key, display_order)
);

ALTER TABLE public.tenant_landing_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active sections"
  ON public.tenant_landing_sections FOR SELECT
  USING (is_active = true);

CREATE POLICY "Tenant admins can manage sections"
  ON public.tenant_landing_sections FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can update sections"
  ON public.tenant_landing_sections FOR UPDATE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can delete sections"
  ON public.tenant_landing_sections FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- 7. Add marketplace_commission_percent to tenants for WL marketplace earnings
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS marketplace_commission_percent NUMERIC DEFAULT 15;
-- 8. Add custom product names for WL
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS custom_ai_name TEXT DEFAULT 'Star AI';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS custom_orchestrator_name TEXT DEFAULT 'Orchestrator';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS custom_venus_name TEXT DEFAULT 'Venus';

-- Validation trigger for campaign status
CREATE OR REPLACE FUNCTION public.validate_crm_campaign_status()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid campaign status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_crm_campaign_status
  BEFORE INSERT OR UPDATE ON public.crm_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.validate_crm_campaign_status();

-- Validation trigger for message queue status
CREATE OR REPLACE FUNCTION public.validate_crm_message_status()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'sending', 'sent', 'failed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid message status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_crm_message_status
  BEFORE INSERT OR UPDATE ON public.crm_message_queue
  FOR EACH ROW EXECUTE FUNCTION public.validate_crm_message_status();

-- Validation for contact list status
CREATE OR REPLACE FUNCTION public.validate_crm_list_status()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('processing', 'completed', 'failed') THEN
    RAISE EXCEPTION 'Invalid list status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_crm_list_status
  BEFORE INSERT OR UPDATE ON public.crm_contact_lists
  FOR EACH ROW EXECUTE FUNCTION public.validate_crm_list_status();
