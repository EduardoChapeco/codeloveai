
-- Phase 3: Create supabase_migration_jobs table
CREATE TABLE public.supabase_migration_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id TEXT NOT NULL,
  source_supabase_url TEXT,
  dest_supabase_url TEXT,
  dest_service_role_key_encrypted TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  tables_migrated JSONB DEFAULT '[]'::jsonb,
  error_log TEXT,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_active BOOLEAN NOT NULL DEFAULT false,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supabase_migration_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users manage own migration jobs"
  ON public.supabase_migration_jobs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all migration jobs"
  ON public.supabase_migration_jobs
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_migration_jobs_updated_at
  BEFORE UPDATE ON public.supabase_migration_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
