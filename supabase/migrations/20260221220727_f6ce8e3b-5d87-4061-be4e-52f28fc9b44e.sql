
-- Add 'lifetime' to subscription_plan enum
ALTER TYPE public.subscription_plan ADD VALUE IF NOT EXISTS 'lifetime';

-- Create token_activations table for tracking extension activations
CREATE TABLE public.token_activations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id UUID NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id),
  ip_address TEXT,
  user_agent TEXT,
  device_info JSONB,
  location TEXT,
  activated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.token_activations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins manage all activations" ON public.token_activations FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view own activations" ON public.token_activations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own activations" ON public.token_activations FOR INSERT WITH CHECK (auth.uid() = user_id);
