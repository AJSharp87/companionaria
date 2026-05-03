
-- aria_config: drop old policies, add auth-only
DROP POLICY IF EXISTS "Allow public read on aria_config" ON public.aria_config;
DROP POLICY IF EXISTS "Allow public insert on aria_config" ON public.aria_config;
DROP POLICY IF EXISTS "Allow public update on aria_config" ON public.aria_config;
DROP POLICY IF EXISTS "Allow public delete on aria_config" ON public.aria_config;

CREATE POLICY "Authenticated read on aria_config" ON public.aria_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert on aria_config" ON public.aria_config FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update on aria_config" ON public.aria_config FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete on aria_config" ON public.aria_config FOR DELETE TO authenticated USING (true);

-- aria_memory: drop old policies, add auth-only
DROP POLICY IF EXISTS "Allow public read on aria_memory" ON public.aria_memory;
DROP POLICY IF EXISTS "Allow public insert on aria_memory" ON public.aria_memory;
DROP POLICY IF EXISTS "Allow public update on aria_memory" ON public.aria_memory;
DROP POLICY IF EXISTS "Allow public delete on aria_memory" ON public.aria_memory;

CREATE POLICY "Authenticated read on aria_memory" ON public.aria_memory FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert on aria_memory" ON public.aria_memory FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update on aria_memory" ON public.aria_memory FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete on aria_memory" ON public.aria_memory FOR DELETE TO authenticated USING (true);

-- aria_messages: drop old policies, add auth-only
DROP POLICY IF EXISTS "Allow public read on aria_messages" ON public.aria_messages;
DROP POLICY IF EXISTS "Allow public insert on aria_messages" ON public.aria_messages;
DROP POLICY IF EXISTS "Allow public update on aria_messages" ON public.aria_messages;
DROP POLICY IF EXISTS "Allow public delete on aria_messages" ON public.aria_messages;

CREATE POLICY "Authenticated read on aria_messages" ON public.aria_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert on aria_messages" ON public.aria_messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update on aria_messages" ON public.aria_messages FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete on aria_messages" ON public.aria_messages FOR DELETE TO authenticated USING (true);

-- passive_recall_logs: drop old policies, add auth-only
DROP POLICY IF EXISTS "Allow public read on passive_recall_logs" ON public.passive_recall_logs;
DROP POLICY IF EXISTS "Allow public insert on passive_recall_logs" ON public.passive_recall_logs;
DROP POLICY IF EXISTS "Allow public update on passive_recall_logs" ON public.passive_recall_logs;
DROP POLICY IF EXISTS "Allow public delete on passive_recall_logs" ON public.passive_recall_logs;

CREATE POLICY "Authenticated read on passive_recall_logs" ON public.passive_recall_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert on passive_recall_logs" ON public.passive_recall_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update on passive_recall_logs" ON public.passive_recall_logs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete on passive_recall_logs" ON public.passive_recall_logs FOR DELETE TO authenticated USING (true);

-- visual_observations: drop old policies, add auth-only
DROP POLICY IF EXISTS "Allow public read on visual_observations" ON public.visual_observations;
DROP POLICY IF EXISTS "Allow public insert on visual_observations" ON public.visual_observations;
DROP POLICY IF EXISTS "Allow public update on visual_observations" ON public.visual_observations;
DROP POLICY IF EXISTS "Allow public delete on visual_observations" ON public.visual_observations;

CREATE POLICY "Authenticated read on visual_observations" ON public.visual_observations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert on visual_observations" ON public.visual_observations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update on visual_observations" ON public.visual_observations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete on visual_observations" ON public.visual_observations FOR DELETE TO authenticated USING (true);
