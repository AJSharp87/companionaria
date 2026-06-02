/**
 * AriaLive2D.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Live2D animated ARIA companion with real-time face tracking + health checks,
 * debug overlay, graceful fallback, and unified state-driven color.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display';
import { useAria } from '@/contexts/AriaContext';
import { useAriaLive2DTracking } from '@/hooks/useAriaLive2DTracking';
import {
  ARIA_EMOTION_PARAMS, ARIA_STATE_PARAMS,
  lerp, getAriaStateRGB,
} from '@/lib/ariaLive2DParams';
import {
  updateLiveParamSnapshot, useLastSyncedSnapshot,
} from '@/hooks/useAriaLive2DSync';

const MODEL_URL = '/models/aria/aria.model3.json';
const DEV_MODEL_URL =
  'https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/haru/haru_greeter_t03.model3.json';

type ModelStatus = 'LOADING' | 'LOADED' | 'FAILED' | 'PREVIEW';

interface AriaLive2DProps {
  size?: number;
  className?: string;
  mode?: 'orb' | 'full';
  devMode?: boolean;
}

// ── Status badge (exported) ───────────────────────────────────────────────────
export const ModelStatusBadge: React.FC<{ status: ModelStatus; className?: string }> = ({
  status, className = '',
}) => {
  const map = {
    LOADED:  { label: 'LIVE',    color: '46,213,115' },
    PREVIEW: { label: 'PREVIEW', color: '255,200,0'  },
    FAILED:  { label: 'OFFLINE', color: '255,71,87'  },
    LOADING: { label: 'LOADING', color: '160,180,255' },
  } as const;
  const m = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] tracking-[0.22em] uppercase border ${className}`}
      style={{
        color: `rgb(${m.color})`,
        borderColor: `rgba(${m.color},0.4)`,
        background: `rgba(${m.color},0.08)`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: `rgb(${m.color})`, boxShadow: `0 0 6px rgb(${m.color})` }}
      />
      {m.label}
    </span>
  );
};

export const AriaLive2D: React.FC<AriaLive2DProps> = ({
  size = 120,
  className = '',
  mode = 'orb',
  devMode = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef    = useRef<PIXI.Application | null>(null);
  const modelRef  = useRef<Live2DModel | null>(null);
  const rafRef    = useRef<number>(0);

  const [status, setStatus] = useState<ModelStatus>('LOADING');
  const [loadError, setLoadError] = useState<string>('');
  const [fellBack, setFellBack]   = useState(false);
  const [dismissedBanner, setDismissedBanner] = useState(false);
  const [activeModelUrl, setActiveModelUrl] = useState<string>('');
  const [fps, setFps] = useState(0);

  const paramTargets = useRef({
    angleX: 0, angleY: 0, angleZ: 0,
    bodyX: 0, bodyY: 0,
    eyeLOpen: 1, eyeROpen: 1,
    eyeBallX: 0, eyeBallY: 0,
    browLY: 0, browRY: 0,
    mouthOpen: 0, mouthForm: 0,
    cheekDrag: 0,
  });

  const { orbState, emotionState, isSpeaking, isListening } = useAria();
  const orbRef = useRef(orbState);
  const emotionRef = useRef(emotionState);
  const speakRef = useRef(isSpeaking);
  const listenRef = useRef(isListening);

  useEffect(() => { orbRef.current = orbState; }, [orbState]);
  useEffect(() => { emotionRef.current = emotionState; }, [emotionState]);
  useEffect(() => { speakRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { listenRef.current = isListening; }, [isListening]);

  // Face tracking only in full mode — keeps sidebar/chat orb resource-light
  const { faceResults, trackingActive } = useAriaLive2DTracking(mode === 'full');

  const syncSnap = useLastSyncedSnapshot();

  // ── Pixi + Live2D setup ─────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    Live2DModel.registerTicker(PIXI.Ticker);

    const W = size;
    const H = mode === 'full' ? Math.round(size * 1.78) : size;

    const app = new PIXI.Application({
      view: canvas,
      width: W,
      height: H,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio, 2),
    });
    appRef.current = app;

    const cubismDetected = typeof window !== 'undefined' && !!(window as any).Live2DCubismCore;
    const primaryUrl = devMode ? DEV_MODEL_URL : MODEL_URL;

    const placeModel = (model: Live2DModel) => {
      modelRef.current = model;
      app.stage.addChild(model as unknown as PIXI.DisplayObject);
      const scale = Math.min(W / model.width, H / model.height) * (mode === 'full' ? 0.95 : 0.85);
      model.scale.set(scale);
      model.x = (W - model.width * scale) / 2;
      model.y = (H - model.height * scale) / (mode === 'full' ? 1.05 : 2);
      model.interactive = false;
    };

    const healthLog = (loadedOk: boolean, url: string, errorMsg?: string) => {
      try {
        const core: any = modelRef.current?.internalModel?.coreModel;
        const paramIds: string[] = [];
        if (core?._parameterIds) paramIds.push(...core._parameterIds);
        else if (core?.getParameterCount) {
          for (let i = 0; i < core.getParameterCount(); i++) {
            paramIds.push(core.getParameterId(i));
          }
        }
        const motionGroups = Object.keys(
          (modelRef.current?.internalModel?.motionManager as any)?.definitions || {}
        );
        // eslint-disable-next-line no-console
        console.groupCollapsed(`[AriaLive2D Health] ${loadedOk ? '✅ LOADED' : '❌ FAILED'}`);
        console.log('URL:', url);
        console.log('devMode:', devMode);
        console.log('Cubism core detected:', cubismDetected);
        console.log('Canvas:', `${W}×${H} @${Math.min(window.devicePixelRatio, 2)}x`);
        console.log('Parameter IDs:', paramIds);
        console.log('Motion groups:', motionGroups);
        if (errorMsg) console.warn('Error:', errorMsg);
        console.groupEnd();
      } catch {/* noop */}
    };

    let cancelled = false;

    const loadWithFallback = async () => {
      try {
        const model = await Live2DModel.from(primaryUrl, { autoInteract: false });
        if (cancelled) return;
        placeModel(model);
        setStatus(devMode ? 'PREVIEW' : 'LOADED');
        setActiveModelUrl(primaryUrl);
        healthLog(true, primaryUrl);
      } catch (err: any) {
        const msg = err?.message || String(err);
        console.warn('[AriaLive2D] primary model load failed:', msg);

        if (!devMode) {
          // Fall back to dev sample
          try {
            console.info(
              '[AriaLive2D Fallback] aria.model3.json failed — using dev sample model.',
              '\nReason:', msg
            );
            const model = await Live2DModel.from(DEV_MODEL_URL, { autoInteract: false });
            if (cancelled) return;
            placeModel(model);
            setStatus('PREVIEW');
            setFellBack(true);
            setActiveModelUrl(DEV_MODEL_URL);
            setLoadError(msg);
            healthLog(true, DEV_MODEL_URL, `fallback (primary failed: ${msg})`);
            return;
          } catch (err2: any) {
            console.error('[AriaLive2D Fallback] dev sample also failed:', err2);
            setLoadError(`${msg} | fallback: ${err2?.message || err2}`);
          }
        } else {
          setLoadError(msg);
        }
        setStatus('FAILED');
        healthLog(false, primaryUrl, msg);
      }
    };

    void loadWithFallback();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      app.destroy(false, { children: true });
      appRef.current = null;
      modelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, mode, devMode]);

  // ── Animation loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    let t = 0;
    let frames = 0;
    let lastFpsT = performance.now();

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      t += 0.016;
      frames++;
      const now = performance.now();
      if (now - lastFpsT >= 1000) {
        setFps(frames);
        frames = 0;
        lastFpsT = now;
      }

      const model = modelRef.current;
      if (!model) return;

      const pt = paramTargets.current;
      const state =
        orbRef.current !== 'idle' ? orbRef.current : (emotionRef.current || 'idle');
      const speak = speakRef.current;
      const listen = listenRef.current;

      if (faceResults && trackingActive) {
        const face = faceResults;
        pt.angleX = lerp(pt.angleX, (face.head?.y ?? 0) * 30,  0.12);
        pt.angleY = lerp(pt.angleY, (face.head?.x ?? 0) * 30,  0.12);
        pt.angleZ = lerp(pt.angleZ, (face.head?.z ?? 0) * -30, 0.12);
        pt.bodyX = lerp(pt.bodyX, pt.angleY * 0.12, 0.05);
        pt.bodyY = lerp(pt.bodyY, pt.angleX * 0.05, 0.05);
        pt.eyeLOpen = lerp(pt.eyeLOpen, face.eye?.l ?? 1, 0.15);
        pt.eyeROpen = lerp(pt.eyeROpen, face.eye?.r ?? 1, 0.15);
        pt.eyeBallX = lerp(pt.eyeBallX, face.pupil?.x ?? 0, 0.10);
        pt.eyeBallY = lerp(pt.eyeBallY, face.pupil?.y ?? 0, 0.10);
        pt.browLY = lerp(pt.browLY, (face.brow?.l ?? 0) * -10, 0.10);
        pt.browRY = lerp(pt.browRY, (face.brow?.r ?? 0) * -10, 0.10);
        pt.mouthOpen = lerp(pt.mouthOpen, (face.mouth?.y ?? 0) * 1.2, 0.15);
        pt.mouthForm = lerp(pt.mouthForm, (face.mouth?.x ?? 0), 0.12);
      } else {
        const idleX = Math.sin(t * 0.6)  * (state === 'thinking' ? 8  : 4);
        const idleY = Math.sin(t * 0.45) * (state === 'thinking' ? 10 : 5);
        const idleZ = Math.sin(t * 0.35) * 2;

        let targetX = idleX, targetY = idleY, targetZ = idleZ;
        if (listen || state === 'listening') {
          targetY = lerp(idleY, 12, 0.3);
          targetX = lerp(idleX, -5, 0.3);
        } else if (state === 'thinking') {
          targetX = lerp(idleX, 10, 0.3);
          targetY = lerp(idleY, -8, 0.3);
        } else if (speak) {
          targetX = idleX * 2.2;
          targetY = idleY * 1.8;
        }

        pt.angleX = lerp(pt.angleX, targetX, 0.06);
        pt.angleY = lerp(pt.angleY, targetY, 0.06);
        pt.angleZ = lerp(pt.angleZ, targetZ, 0.06);
        pt.bodyX  = lerp(pt.bodyX,  pt.angleY * 0.12, 0.04);
        pt.bodyY  = lerp(pt.bodyY,  pt.angleX * 0.05, 0.04);

        pt.eyeBallX = lerp(pt.eyeBallX, Math.sin(t * 0.4) * 0.3, 0.05);
        pt.eyeBallY = lerp(pt.eyeBallY, Math.sin(t * 0.3) * 0.2, 0.05);

        const stateParams = ARIA_STATE_PARAMS[state] || ARIA_STATE_PARAMS.idle;
        pt.browLY = lerp(pt.browLY, stateParams.browY, 0.06);
        pt.browRY = lerp(pt.browRY, stateParams.browY, 0.06);

        const blinkCycle = Math.sin(t * 0.7 + Math.sin(t * 0.25) * 2);
        const blink = blinkCycle > 0.96 ? 1 - (blinkCycle - 0.96) / 0.04 : 1;
        pt.eyeLOpen = lerp(pt.eyeLOpen, blink, 0.20);
        pt.eyeROpen = lerp(pt.eyeROpen, blink, 0.20);

        if (speak) {
          const lipOpen =
            Math.abs(Math.sin(t * 8.5)) * 0.9 + Math.abs(Math.sin(t * 6.2)) * 0.4;
          pt.mouthOpen = lerp(pt.mouthOpen, Math.min(lipOpen, 1.0), 0.20);
          pt.mouthForm = lerp(pt.mouthForm, Math.sin(t * 4) * 0.3, 0.10);
        } else {
          pt.mouthOpen = lerp(pt.mouthOpen, 0, 0.12);
          const emotParams = ARIA_EMOTION_PARAMS[state] || ARIA_EMOTION_PARAMS.neutral;
          pt.mouthForm = lerp(pt.mouthForm, emotParams.mouthForm, 0.08);
        }
      }

      const emotParams =
        ARIA_EMOTION_PARAMS[
          orbRef.current !== 'idle' ? orbRef.current : (emotionRef.current || 'neutral')
        ] || ARIA_EMOTION_PARAMS.neutral;

      const core = model.internalModel.coreModel as any;
      if (!core) return;

      const setParam = (id: string, val: number) => {
        try { core.setParameterValueById(id, val); } catch {/* noop */}
      };

      setParam('ParamAngleX',     pt.angleX);
      setParam('ParamAngleY',     pt.angleY);
      setParam('ParamAngleZ',     pt.angleZ);
      setParam('ParamBodyAngleX', pt.bodyX);
      setParam('ParamBodyAngleY', pt.bodyY);
      setParam('ParamEyeLOpen',   pt.eyeLOpen);
      setParam('ParamEyeROpen',   pt.eyeROpen);
      setParam('ParamEyeBallX',   pt.eyeBallX);
      setParam('ParamEyeBallY',   pt.eyeBallY);
      setParam('ParamBrowLY',     pt.browLY);
      setParam('ParamBrowRY',     pt.browRY);
      setParam('ParamMouthOpenY', pt.mouthOpen);
      setParam('ParamMouthForm',  pt.mouthForm);
      setParam('ParamCheek',      pt.cheekDrag);

      const breathe = Math.sin(t * (speak ? 3.5 : 1.2)) * (speak ? 0.8 : 0.4);
      setParam('ParamBreath', breathe);

      setParam('ParamHairFront', Math.sin(t * 0.8) * 3);
      setParam('ParamHairBack',  Math.sin(t * 0.6) * 4);
      setParam('ParamHairSide',  Math.sin(t * 0.7) * 3);
      setParam('ParamBraidPinkSwing',  Math.sin(t * 0.5)        * (speak ? 8 : 4));
      setParam('ParamBraidBlackSwing', Math.sin(t * 0.45 + 0.5) * (speak ? 7 : 3.5));

      setParam('ParamTere',  emotParams.tere  ?? 0);
      setParam('ParamShake', emotParams.shake ?? 0);

      // Update shared snapshot for Supabase sync (only the sidebar instance does
      // real work, but writing here is cheap and safe — Object.assign)
      if (mode === 'full') {
        updateLiveParamSnapshot({
          ParamAngleX:     pt.angleX,
          ParamAngleY:     pt.angleY,
          ParamAngleZ:     pt.angleZ,
          ParamEyeLOpen:   pt.eyeLOpen,
          ParamEyeROpen:   pt.eyeROpen,
          ParamMouthOpenY: pt.mouthOpen,
          ParamMouthForm:  pt.mouthForm,
        });
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faceResults, trackingActive]);

  // Trigger expression motion on state change
  useEffect(() => {
    const model = modelRef.current;
    if (!model) return;
    const state = orbState !== 'idle' ? orbState : (emotionState || 'neutral');
    const params = ARIA_EMOTION_PARAMS[state];
    if (params?.motionGroup) {
      try { model.motion(params.motionGroup, 0, 2); } catch {/* noop */}
    }
  }, [orbState, emotionState]);

  // ── Unified state color (single source of truth) ────────────────────────────
  const glow = getAriaStateRGB(orbState, emotionState);
  const glowPx = isSpeaking ? 44 : orbState === 'thinking' ? 28 : 18;

  // Reserve fixed dimensions to prevent layout shift while model loads
  const W = size;
  const H = mode === 'full' ? Math.round(size * 1.78) : size;

  return (
    <div
      className={`relative flex-shrink-0 ${className}`}
      style={{ width: W, height: H, minWidth: W, minHeight: H }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: W, height: H,
          borderRadius: mode === 'orb' ? '50%' : '0',
          filter: `drop-shadow(0 0 ${glowPx}px rgb(${glow})) drop-shadow(0 0 ${glowPx * 2}px rgba(${glow},0.35))`,
          transition: 'filter 0.6s ease',
        }}
      />

      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background:
          'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,229,255,0.025) 3px,rgba(0,229,255,0.025) 4px)',
        animation: 'scan-drift 5s linear infinite',
        borderRadius: mode === 'orb' ? '50%' : '0',
        mixBlendMode: 'overlay',
      }} />

      {mode === 'full' && (
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 4, pointerEvents: 'none',
          background: `linear-gradient(90deg,transparent,rgba(${glow},0.50),transparent)`,
          animation: 'beam-sweep 4s ease-in-out infinite',
        }} />
      )}

      {mode === 'full' && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '20%',
          background: 'linear-gradient(to top,hsl(var(--aria-bg,252 56% 4%)) 10%,transparent 100%)',
          pointerEvents: 'none',
        }} />
      )}

      {mode === 'full' && trackingActive && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          width: 6, height: 6, borderRadius: '50%',
          background: '#00ff88',
          boxShadow: '0 0 8px #00ff88',
          animation: 'aria-pulse 1.5s ease-in-out infinite',
        }} />
      )}

      {/* Loading state */}
      {status === 'LOADING' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 8, pointerEvents: 'none',
        }}>
          <span style={{
            fontFamily: 'Orbitron, monospace', fontSize: 11,
            color: `rgb(${glow})`, letterSpacing: 3,
            animation: 'aria-pulse 1s ease-in-out infinite',
          }}>ARIA</span>
          <span style={{
            fontSize: 9, color: `rgba(${glow},0.6)`,
            fontFamily: 'Rajdhani, sans-serif', letterSpacing: 2,
          }}>Loading model...</span>
        </div>
      )}

      {/* Fallback banner (full mode only, dismissible) */}
      {mode === 'full' && fellBack && !dismissedBanner && (
        <div style={{
          position: 'absolute', top: 8, left: 8, right: 8, zIndex: 5,
          background: 'rgba(60,40,0,0.85)',
          border: '1px solid rgba(255,200,0,0.45)',
          borderRadius: 8,
          padding: '6px 10px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          backdropFilter: 'blur(8px)',
          fontFamily: 'Rajdhani, sans-serif',
          fontSize: 11,
          color: 'rgb(255,200,0)',
          letterSpacing: 1.2,
        }}>
          <span>Using preview model — aria.model3.json not found in /public/models/aria/</span>
          <button
            onClick={() => setDismissedBanner(true)}
            style={{
              background: 'transparent', border: 'none',
              color: 'rgb(255,200,0)', cursor: 'pointer',
              fontSize: 14, lineHeight: 1, padding: '0 4px',
            }}
            aria-label="Dismiss"
          >×</button>
        </div>
      )}

      {/* Debug overlay (devMode only) */}
      {devMode && mode === 'full' && (
        <div style={{
          position: 'absolute', bottom: 8, left: 8, zIndex: 6,
          background: 'rgba(0,0,0,0.7)',
          border: `1px solid rgba(${glow},0.35)`,
          borderRadius: 6, padding: '6px 8px',
          fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
          color: `rgb(${glow})`,
          lineHeight: 1.4, letterSpacing: 0.5,
          pointerEvents: 'none', maxWidth: 240,
        }}>
          <div>MODEL: {status}{fellBack ? ' (fallback)' : ''}</div>
          <div>ORB: {orbState} · EMO: {emotionState}</div>
          <div>TRACK: {trackingActive ? 'ACTIVE' : 'INACTIVE'} · FPS: {fps}</div>
          <div>
            aX:{paramTargets.current.angleX.toFixed(1)} aY:{paramTargets.current.angleY.toFixed(1)}
            {' '}mO:{paramTargets.current.mouthOpen.toFixed(2)} eL:{paramTargets.current.eyeLOpen.toFixed(2)}
          </div>
          <div>
            SYNC: {syncSnap.status}
            {syncSnap.lastSynced ? ` · ${Math.max(0, Math.round((Date.now() - syncSnap.lastSynced) / 1000))}s ago` : ''}
          </div>
          {loadError && <div style={{ color: 'rgb(255,120,120)' }}>ERR: {loadError.slice(0, 80)}</div>}
        </div>
      )}

      <style>{`
        @keyframes scan-drift { from{background-position:0 0} to{background-position:0 40px} }
        @keyframes beam-sweep { 0%{top:0%;opacity:0} 8%{opacity:1} 92%{opacity:1} 100%{top:100%;opacity:0} }
      `}</style>
    </div>
  );
};
