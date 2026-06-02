/**
 * useAriaLive2DSync
 * ─────────────────────────────────────────────────────────────────────────────
 * Persists ARIA's Live2D session state to Supabase per-user.
 *
 * IMPORTANT: This hook is designed to run ONCE at the app level (AriaLayout).
 * A module-level singleton guard prevents duplicate intervals/subscriptions
 * if it's accidentally mounted more than once.
 *
 * Other components that only need the lastSynced timestamp can call
 * `useLastSyncedSnapshot()` — it's a passive read and won't trigger work.
 *
 * ── Required Supabase table (already created via migration) ──────────────────
 *
 * CREATE TABLE public.aria_live2d_state (
 *   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   user_id uuid NOT NULL,
 *   orb_state text NOT NULL DEFAULT 'idle',
 *   emotion_state text NOT NULL DEFAULT 'neutral',
 *   dev_mode boolean NOT NULL DEFAULT true,
 *   model_url text NOT NULL DEFAULT '',
 *   tracking_enabled boolean NOT NULL DEFAULT false,
 *   last_param_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
 *   updated_at timestamptz NOT NULL DEFAULT now(),
 *   UNIQUE (user_id)
 * );
 *
 * GRANT SELECT, INSERT, UPDATE, DELETE ON public.aria_live2d_state TO authenticated;
 * GRANT ALL ON public.aria_live2d_state TO service_role;
 *
 * ALTER TABLE public.aria_live2d_state ENABLE ROW LEVEL SECURITY;
 *
 * CREATE POLICY "Users read own live2d state" ON public.aria_live2d_state
 *   FOR SELECT TO authenticated USING (auth.uid() = user_id);
 * CREATE POLICY "Users insert own live2d state" ON public.aria_live2d_state
 *   FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
 * CREATE POLICY "Users update own live2d state" ON public.aria_live2d_state
 *   FOR UPDATE TO authenticated USING (auth.uid() = user_id);
 * CREATE POLICY "Users delete own live2d state" ON public.aria_live2d_state
 *   FOR DELETE TO authenticated USING (auth.uid() = user_id);
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAria } from '@/contexts/AriaContext';

// ── Module-level singleton snapshot store ────────────────────────────────────
type SyncSnapshot = {
  lastSynced: number | null;
  status: 'idle' | 'loading' | 'saving' | 'ok' | 'error' | 'no-auth';
  error?: string;
  paramSnapshot: Record<string, number>;
};
const snapshot: SyncSnapshot = {
  lastSynced: null,
  status: 'idle',
  paramSnapshot: {},
};
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const getSnapshot = () => snapshot;

let activeInstance = 0;

// Live param snapshot — written into by AriaLive2D, read by sync writer
export const liveParamSnapshot: Record<string, number> = {};
export const updateLiveParamSnapshot = (params: Record<string, number>) => {
  Object.assign(liveParamSnapshot, params);
};

export const useLastSyncedSnapshot = () =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

export const useAriaLive2DSync = (opts?: {
  modelUrl?: string;
  devMode?: boolean;
  trackingEnabled?: boolean;
  intervalMs?: number;
}) => {
  const intervalMs = opts?.intervalMs ?? 30_000;
  const { orbState, emotionState } = useAria();
  const [loaded, setLoaded] = useState<null | {
    orb_state: string; emotion_state: string; tracking_enabled: boolean;
    last_param_snapshot: Record<string, number>;
  }>(null);
  const userIdRef = useRef<string | null>(null);
  const orbRef = useRef(orbState);
  const emotionRef = useRef(emotionState);
  const optsRef = useRef(opts);
  useEffect(() => { orbRef.current = orbState; }, [orbState]);
  useEffect(() => { emotionRef.current = emotionState; }, [emotionState]);
  useEffect(() => { optsRef.current = opts; });

  const writeNow = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    snapshot.status = 'saving'; notify();
    const payload = {
      user_id: uid,
      orb_state: orbRef.current || 'idle',
      emotion_state: emotionRef.current || 'neutral',
      dev_mode: optsRef.current?.devMode ?? true,
      model_url: optsRef.current?.modelUrl ?? '',
      tracking_enabled: optsRef.current?.trackingEnabled ?? false,
      last_param_snapshot: { ...liveParamSnapshot },
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from('aria_live2d_state')
      .upsert(payload, { onConflict: 'user_id' });
    if (error) {
      snapshot.status = 'error';
      snapshot.error = error.message;
      console.warn('[AriaLive2DSync] write failed:', error.message);
    } else {
      snapshot.status = 'ok';
      snapshot.lastSynced = Date.now();
      snapshot.paramSnapshot = payload.last_param_snapshot;
    }
    notify();
  }, []);

  useEffect(() => {
    activeInstance++;
    if (activeInstance > 1) {
      // Another instance is already running — be a no-op observer.
      return () => { activeInstance--; };
    }

    let cancelled = false;
    let timer: number | undefined;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let unloadHandler: (() => void) | null = null;

    (async () => {
      snapshot.status = 'loading'; notify();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        snapshot.status = 'no-auth'; notify();
        return;
      }
      if (cancelled) return;
      userIdRef.current = user.id;

      // Load last saved state
      const { data, error } = await supabase
        .from('aria_live2d_state')
        .select('orb_state, emotion_state, tracking_enabled, last_param_snapshot')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!error && data) {
        setLoaded(data as any);
        snapshot.paramSnapshot = (data.last_param_snapshot || {}) as Record<string, number>;
        Object.assign(liveParamSnapshot, snapshot.paramSnapshot);
      }
      snapshot.status = 'ok';
      snapshot.lastSynced = Date.now();
      notify();

      // Realtime
      channel = supabase
        .channel(`aria_live2d_state:${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'aria_live2d_state', filter: `user_id=eq.${user.id}` },
          (payload) => {
            const row: any = payload.new;
            if (!row) return;
            snapshot.paramSnapshot = row.last_param_snapshot || {};
            snapshot.lastSynced = Date.now();
            notify();
          }
        )
        .subscribe();

      // Periodic writer
      timer = window.setInterval(() => { void writeNow(); }, intervalMs);

      // Flush on unload
      unloadHandler = () => { void writeNow(); };
      window.addEventListener('beforeunload', unloadHandler);
    })();

    return () => {
      cancelled = true;
      activeInstance--;
      if (timer) clearInterval(timer);
      if (channel) supabase.removeChannel(channel);
      if (unloadHandler) window.removeEventListener('beforeunload', unloadHandler);
      // Best-effort flush on unmount
      void writeNow();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    loadedState: loaded,
    syncNow: writeNow,
    get lastSynced() { return snapshot.lastSynced; },
  };
};
