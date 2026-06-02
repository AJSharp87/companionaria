CREATE TABLE public.aria_live2d_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  orb_state text NOT NULL DEFAULT 'idle',
  emotion_state text NOT NULL DEFAULT 'neutral',
  dev_mode boolean NOT NULL DEFAULT true,
  model_url text NOT NULL DEFAULT '',
  tracking_enabled boolean NOT NULL DEFAULT false,
  last_param_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aria_live2d_state TO authenticated;
GRANT ALL ON public.aria_live2d_state TO service_role;

ALTER TABLE public.aria_live2d_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own live2d state"
  ON public.aria_live2d_state FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own live2d state"
  ON public.aria_live2d_state FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own live2d state"
  ON public.aria_live2d_state FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users delete own live2d state"
  ON public.aria_live2d_state FOR DELETE
  TO authenticated USING (auth.uid() = user_id);