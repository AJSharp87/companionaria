-- Restore Data-API GRANTs that PostgREST requires.
-- Anonymous role intentionally gets nothing on these tables.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aria_config           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aria_memory           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aria_messages         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aria_live2d_state     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.passive_recall_logs   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visual_observations   TO authenticated;

GRANT ALL ON public.aria_config         TO service_role;
GRANT ALL ON public.aria_memory         TO service_role;
GRANT ALL ON public.aria_messages       TO service_role;
GRANT ALL ON public.aria_live2d_state   TO service_role;
GRANT ALL ON public.passive_recall_logs TO service_role;
GRANT ALL ON public.visual_observations TO service_role;

GRANT USAGE, SELECT ON SEQUENCE public.aria_messages_id_seq         TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.passive_recall_logs_id_seq   TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.visual_observations_id_seq   TO authenticated;