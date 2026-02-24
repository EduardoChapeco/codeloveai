
-- Fix: Remove the restrictive default of 10 messages for new licenses
-- This allows "null" to be interpreted as unlimited by the Edge Functions

ALTER TABLE public.licenses ALTER COLUMN daily_messages DROP NOT NULL;
ALTER TABLE public.licenses ALTER COLUMN daily_messages SET DEFAULT NULL;

-- Update existing "Master" or unlimited licenses to be truly null
UPDATE public.licenses 
SET daily_messages = NULL 
WHERE plan = 'Master' OR plan = 'lifetime' OR type = 'lifetime';

RAISE NOTICE 'Daily messages limit updated to be nullable (null = unlimited).';
