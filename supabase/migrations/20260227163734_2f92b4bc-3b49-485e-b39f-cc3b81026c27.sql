-- Add last_connected_at column to crm_whatsapp_sessions if not exists
ALTER TABLE public.crm_whatsapp_sessions 
ADD COLUMN IF NOT EXISTS last_connected_at timestamptz;
