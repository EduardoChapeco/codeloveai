
-- Support tickets table
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_num SERIAL,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  category TEXT NOT NULL DEFAULT 'general',
  tenant_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ticket replies table
CREATE TABLE public.ticket_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_replies ENABLE ROW LEVEL SECURITY;

-- Validation trigger for support_tickets
CREATE OR REPLACE FUNCTION public.validate_support_ticket()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status NOT IN ('open', 'in_progress', 'resolved', 'closed') THEN
    RAISE EXCEPTION 'Invalid ticket status: %', NEW.status;
  END IF;
  IF NEW.priority NOT IN ('low', 'medium', 'high', 'urgent') THEN
    RAISE EXCEPTION 'Invalid ticket priority: %', NEW.priority;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_support_ticket_trigger
BEFORE INSERT OR UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.validate_support_ticket();

-- Updated_at trigger
CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for support_tickets
CREATE POLICY "Admins manage all tickets"
ON public.support_tickets FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Users view own tickets"
ON public.support_tickets FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users create own tickets"
ON public.support_tickets FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own tickets"
ON public.support_tickets FOR UPDATE
USING (auth.uid() = user_id);

-- RLS Policies for ticket_replies
CREATE POLICY "Admins manage all replies"
ON public.ticket_replies FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Users view replies on own tickets"
ON public.ticket_replies FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.support_tickets st
  WHERE st.id = ticket_replies.ticket_id AND st.user_id = auth.uid()
));

CREATE POLICY "Users create replies on own tickets"
ON public.ticket_replies FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.support_tickets st
    WHERE st.id = ticket_replies.ticket_id AND st.user_id = auth.uid()
  )
);

-- Enable realtime for support
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_replies;
