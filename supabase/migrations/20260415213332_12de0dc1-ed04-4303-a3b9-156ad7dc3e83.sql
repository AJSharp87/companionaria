
-- aria_config: key-value config store
CREATE TABLE public.aria_config (
  id TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.aria_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on aria_config" ON public.aria_config FOR SELECT USING (true);
CREATE POLICY "Allow public insert on aria_config" ON public.aria_config FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on aria_config" ON public.aria_config FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on aria_config" ON public.aria_config FOR DELETE USING (true);

-- aria_memory: key-value memory store
CREATE TABLE public.aria_memory (
  id TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.aria_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on aria_memory" ON public.aria_memory FOR SELECT USING (true);
CREATE POLICY "Allow public insert on aria_memory" ON public.aria_memory FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on aria_memory" ON public.aria_memory FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on aria_memory" ON public.aria_memory FOR DELETE USING (true);

-- aria_messages: chat log
CREATE TABLE public.aria_messages (
  id BIGSERIAL PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'user',
  content TEXT NOT NULL DEFAULT '',
  msg_type TEXT NOT NULL DEFAULT 'normal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.aria_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on aria_messages" ON public.aria_messages FOR SELECT USING (true);
CREATE POLICY "Allow public insert on aria_messages" ON public.aria_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on aria_messages" ON public.aria_messages FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on aria_messages" ON public.aria_messages FOR DELETE USING (true);

-- visual_observations: lens/camera detection log
CREATE TABLE public.visual_observations (
  id BIGSERIAL PRIMARY KEY,
  object_label TEXT NOT NULL DEFAULT '',
  confidence_score REAL NOT NULL DEFAULT 0,
  device_type TEXT NOT NULL DEFAULT 'desktop',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.visual_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on visual_observations" ON public.visual_observations FOR SELECT USING (true);
CREATE POLICY "Allow public insert on visual_observations" ON public.visual_observations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on visual_observations" ON public.visual_observations FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on visual_observations" ON public.visual_observations FOR DELETE USING (true);

-- passive_recall_logs: web URL ingestion
CREATE TABLE public.passive_recall_logs (
  id BIGSERIAL PRIMARY KEY,
  url TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  device_type TEXT NOT NULL DEFAULT 'desktop',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.passive_recall_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on passive_recall_logs" ON public.passive_recall_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert on passive_recall_logs" ON public.passive_recall_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on passive_recall_logs" ON public.passive_recall_logs FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on passive_recall_logs" ON public.passive_recall_logs FOR DELETE USING (true);

-- aria-files storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('aria-files', 'aria-files', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Allow public read on aria-files" ON storage.objects FOR SELECT USING (bucket_id = 'aria-files');
CREATE POLICY "Allow public insert on aria-files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'aria-files');
CREATE POLICY "Allow public update on aria-files" ON storage.objects FOR UPDATE USING (bucket_id = 'aria-files');
CREATE POLICY "Allow public delete on aria-files" ON storage.objects FOR DELETE USING (bucket_id = 'aria-files');
