
-- Create notes table
CREATE TABLE public.notes (
  id TEXT NOT NULL PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT '',
  folder TEXT NOT NULL DEFAULT 'Geral',
  color TEXT NOT NULL DEFAULT '#ffffff',
  pinned BOOLEAN NOT NULL DEFAULT false,
  ts BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT,
  updated BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notes" ON public.notes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage all notes" ON public.notes FOR ALL USING (is_admin(auth.uid()));

-- Create note_folders table
CREATE TABLE public.note_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.note_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own folders" ON public.note_folders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage all folders" ON public.note_folders FOR ALL USING (is_admin(auth.uid()));

-- Enable realtime for notes
ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
