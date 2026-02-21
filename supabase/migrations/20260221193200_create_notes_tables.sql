-- Create notes table for extension sync
CREATE TABLE IF NOT EXISTS public.notes (
  id TEXT NOT NULL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT '',
  folder TEXT NOT NULL DEFAULT 'Geral',
  color TEXT NOT NULL DEFAULT '#ffffff',
  pinned BOOLEAN NOT NULL DEFAULT false,
  ts BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT,
  updated BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create note_folders table
CREATE TABLE IF NOT EXISTS public.note_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notes_user_folder ON public.notes(user_id, folder);
CREATE INDEX IF NOT EXISTS idx_notes_user_updated ON public.notes(user_id, updated DESC);
CREATE INDEX IF NOT EXISTS idx_note_folders_user ON public.note_folders(user_id);

-- Enable RLS
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_folders ENABLE ROW LEVEL SECURITY;

-- RLS policies for notes
CREATE POLICY "Users manage own notes" ON public.notes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage all notes" ON public.notes FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for note_folders
CREATE POLICY "Users manage own folders" ON public.note_folders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage all folders" ON public.note_folders FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default folder for existing users (optional seed)
-- Users will get "Geral" folder auto-created on first use via the frontend
