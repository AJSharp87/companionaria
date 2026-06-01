/**
 * AriaLive2D.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Live2D animated ARIA companion with real-time face tracking.
 *
 * Tech Stack:
 *   • pixi-live2d-display  — renders Live2D model via Pixi.js
 *   • KalidoKit            — converts MediaPipe landmarks → blendshapes
 *   • MediaPipe FaceMesh   — webcam face landmark detection
 *   • AriaContext          — orbState / emotionState / isSpeaking / isListening
 *
 * Usage:
 *   // Sidebar compact
 *   <AriaLive2D size={100} mode="orb" />
 *
 *   // Full panel (OrbModePanel)
 *   <AriaLive2D size={280} mode="full" />
 *
 * Model file:
 *   Drop aria.model3.json + assets into /public/models/aria/
 *   Update MODEL_URL below to match.
 *
 * Install:
 *   npm install pixi.js@6 pixi-live2d-display kalidokit @mediapipe/face_mesh
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display';
import * as Kalidokit from 'kalidokit';
import { useAria } from '@/contexts/AriaContext';
import { useAriaLive2DTracking } from '@/hooks/useAriaLive2DTracking';
import { ARIA_EMOTION_PARAMS, ARIA_STATE_PARAMS, lerp } from '@/lib/ariaLive2DParams';

// ── Model path — update this when aria.model3.json is in /public ─────────────
const MODEL_URL = '/models/aria/aria.model3.json';

// ── Fallback to Cubism sample model during development ───────────────────────
const DEV_MODEL_URL = 'https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/haru/haru_greeter_t03.model3.json';

interface AriaLive2DProps {
  size?: number;
  className?: string;
  mode?: 'orb' | 'full';
  /** Use dev/sample model instead of aria.model3.json — set true until model is ready */
  devMode?: boolean;
}

export const AriaLive2D: React.FC<AriaLive2DProps> = ({
  size = 120,
  className = '',
  mode = 'orb',
  devMode = false,
}) => {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const appRef      = useRef<PIXI.Application | null>(null);
  const modelRef    = useRef<Live2DModel | null>(null);
  const rafRef      = useRef<number>(0);

  // Smooth interpolation targets
  const paramTargets = useRef({
    angleX:    0, angleY:    0, angleZ:    0,
    bodyX:     0, bodyY:     0,
    eyeLOpen:  1, eyeROpen:  1,
    eyeBallX:  0, eyeBallY:  0,
    browLY:    0, browRY:    0,
    mouthOpen: 0, mouthForm: 0,
    cheekDrag: 0,
  });

  const { orbState, emotionState, isSpeaking, isListening } = useAria();
  const orbRef     = useRef(orbState);
  const emotionRef = useRef(emotionState);
  const speakRef   = useRef(isSpeaking);
  const listenRef  = useRef(isListening);

  useEffect(() => { orbRef.current     = orbState;     }, [orbState]);
  useEffect(() => { emotionRef.current = emotionState; }, [emotionState]);
  useEffect(() => { speakRef.current   = isSpeaking;   }, [isSpeaking]);
  useEffect(() => { listenRef.current  = isListening;  }, [isListening]);

  // ── Face tracking hook ────────────────────────────────────────────────────
  const { faceResults, trackingActive } = useAriaLive2DTracking(mode === 'full');

  // ── Pixi + Live2D setup ───────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Register Live2D plugin with Pixi
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

    // Load model
    const modelUrl = devMode ? DEV_MODEL_URL : MODEL_URL;

    Live2DModel.from(modelUrl, { autoInteract: false })
      .then(model => {
        modelRef.current = model;
        app.stage.addChild(model as unknown as PIXI.DisplayObject);

        // Scale + center model
        const scaleX = W / model.width;
        const scaleY = H / model.height;
        const scale  = Math.min(scaleX, scaleY) * (mode === 'full' ? 0.95 : 0.85);
        model.scale.set(scale);
        model.x = (W - model.width  * scale) / 2;
        model.y = (H - model.height * scale) / (mode === 'full' ? 1.05 : 2);

        // Disable built-in mouse interaction (we drive it manually)
        model.interactive = false;

        console.log('[AriaLive2D] Model loaded:', modelUrl);
        console.log('[AriaLive2D] Available parameters:', model.internalModel.coreModel);
      })
      .catch(err => {
        console.error('[AriaLive2D] Model load failed:', err);
        console.info('[AriaLive2D] Tip: set devMode={true} to use sample model during development');
      });

    return () => {
      cancelAnimationFrame(rafRef.current);
      app.destroy(false, { children: true });
      appRef.current  = null;
      modelRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, mode, devMode]);

  // ── Animation loop ────────────────────────────────────────────────────────
  useEffect(() => {
    let t = 0;

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      t += 0.016;

      const model  = modelRef.current;
      if (!model) return;

      const pt     = paramTargets.current;
      const state  = orbRef.current !== 'idle' ? orbRef.current : (emotionRef.current || 'idle');
      const speak  = speakRef.current;
      const listen = listenRef.current;

      // ── 1. Face tracking → param targets ─────────────────────────────────
      if (faceResults && trackingActive) {
        const face = faceResults;

        // Head rotation (KalidoKit already solved these)
        pt.angleX = lerp(pt.angleX, (face.head?.y ?? 0) * 30,  0.12);
        pt.angleY = lerp(pt.angleY, (face.head?.x ?? 0) * 30,  0.12);
        pt.angleZ = lerp(pt.angleZ, (face.head?.z ?? 0) * -30, 0.12);

        // Body follows head loosely
        pt.bodyX  = lerp(pt.bodyX, pt.angleY * 0.12, 0.05);
        pt.bodyY  = lerp(pt.bodyY, pt.angleX * 0.05, 0.05);

        // Eyes
        pt.eyeLOpen = lerp(pt.eyeLOpen, face.eye?.l ?? 1, 0.15);
        pt.eyeROpen = lerp(pt.eyeROpen, face.eye?.r ?? 1, 0.15);

        // Eye gaze
        pt.eyeBallX = lerp(pt.eyeBallX, face.pupil?.x ?? 0, 0.10);
        pt.eyeBallY = lerp(pt.eyeBallY, face.pupil?.y ?? 0, 0.10);

        // Brows
        pt.browLY = lerp(pt.browLY, (face.brow?.l ?? 0) * -10, 0.10);
        pt.browRY = lerp(pt.browRY, (face.brow?.r ?? 0) * -10, 0.10);

        // Mouth
        pt.mouthOpen = lerp(pt.mouthOpen, (face.mouth?.y ?? 0) * 1.2, 0.15);
        pt.mouthForm = lerp(pt.mouthForm, (face.mouth?.x ?? 0), 0.12);

      } else {
        // ── 2. AI-driven animation (no face tracking) ───────────────────────

        // Idle head sway
        const idleX = Math.sin(t * 0.6)  * (state === 'thinking' ? 8  : 4);
        const idleY = Math.sin(t * 0.45) * (state === 'thinking' ? 10 : 5);
        const idleZ = Math.sin(t * 0.35) * 2;

        let targetX = idleX, targetY = idleY, targetZ = idleZ;

        if (listen || state === 'listening') {
          // Head tilt toward camera — attentive
          targetY = lerp(idleY,  12, 0.3);
          targetX = lerp(idleX, -5,  0.3);
        } else if (state === 'thinking') {
          // Look up and away — contemplating
          targetX = lerp(idleX, 10, 0.3);
          targetY = lerp(idleY, -8, 0.3);
        } else if (speak) {
          // More expressive head movement while speaking
          targetX = idleX * 2.2;
          targetY = idleY * 1.8;
        }

        pt.angleX = lerp(pt.angleX, targetX, 0.06);
        pt.angleY = lerp(pt.angleY, targetY, 0.06);
        pt.angleZ = lerp(pt.angleZ, targetZ, 0.06);
        pt.bodyX  = lerp(pt.bodyX,  pt.angleY * 0.12, 0.04);
        pt.bodyY  = lerp(pt.bodyY,  pt.angleX * 0.05, 0.04);

        // Eye gaze — idle wander
        pt.eyeBallX = lerp(pt.eyeBallX, Math.sin(t * 0.4) * 0.3, 0.05);
        pt.eyeBallY = lerp(pt.eyeBallY, Math.sin(t * 0.3) * 0.2, 0.05);

        // Brows by state
        const stateParams = ARIA_STATE_PARAMS[state] || ARIA_STATE_PARAMS.idle;
        pt.browLY = lerp(pt.browLY, stateParams.browY, 0.06);
        pt.browRY = lerp(pt.browRY, stateParams.browY, 0.06);

        // Natural blink cycle
        const blinkCycle = Math.sin(t * 0.7 + Math.sin(t * 0.25) * 2);
        const blink = blinkCycle > 0.96 ? 1 - (blinkCycle - 0.96) / 0.04 : 1;
        pt.eyeLOpen = lerp(pt.eyeLOpen, blink, 0.20);
        pt.eyeROpen = lerp(pt.eyeROpen, blink, 0.20);

        // Mouth — lip sync simulation when speaking
        if (speak) {
          const lipOpen = Math.abs(Math.sin(t * 8.5)) * 0.9
                        + Math.abs(Math.sin(t * 6.2)) * 0.4;
          pt.mouthOpen = lerp(pt.mouthOpen, Math.min(lipOpen, 1.0), 0.20);
          pt.mouthForm = lerp(pt.mouthForm, Math.sin(t * 4) * 0.3, 0.10);
        } else {
          pt.mouthOpen = lerp(pt.mouthOpen, 0, 0.12);
          // Emotion mouth form
          const emotParams = ARIA_EMOTION_PARAMS[state] || ARIA_EMOTION_PARAMS.neutral;
          pt.mouthForm = lerp(pt.mouthForm, emotParams.mouthForm, 0.08);
        }
      }

      // ── 3. Emotion → expression motions ────────────────────────────────
      const emotParams = ARIA_EMOTION_PARAMS[
        orbRef.current !== 'idle' ? orbRef.current : (emotionRef.current || 'neutral')
      ] || ARIA_EMOTION_PARAMS.neutral;

      // Apply expression motion if model has it
      if (emotParams.motionGroup && model.internalModel.motionManager) {
        // Only trigger on state change (handled in separate effect below)
      }

      // ── 4. Write params to Live2D model ──────────────────────────────────
      const core = model.internalModel.coreModel as any;
      if (!core) return;

      const setParam = (id: string, val: number) => {
        try { core.setParameterValueById(id, val); } catch {}
      };

      // Standard Live2D Cubism 4 parameter IDs
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

      // Breathing (chest param)
      const breathe = Math.sin(t * (speak ? 3.5 : 1.2)) * (speak ? 0.8 : 0.4);
      setParam('ParamBreath', breathe);

      // Hair physics params (if model has them)
      setParam('ParamHairFront',    Math.sin(t * 0.8) * 3);
      setParam('ParamHairBack',     Math.sin(t * 0.6) * 4);
      setParam('ParamHairSide',     Math.sin(t * 0.7) * 3);
      setParam('ParamBraidPinkSwing', Math.sin(t * 0.5) * (speak ? 8 : 4));
      setParam('ParamBraidBlackSwing', Math.sin(t * 0.45 + 0.5) * (speak ? 7 : 3.5));

      // Emotion-specific params
      setParam('ParamTere',       emotParams.tere  ?? 0);  // blush
      setParam('ParamShake',      emotParams.shake ?? 0);  // excitement shake
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faceResults, trackingActive]);

  // ── Trigger expression motion on state change ─────────────────────────────
  useEffect(() => {
    const model = modelRef.current;
    if (!model) return;
    const state = orbState !== 'idle' ? orbState : (emotionState || 'neutral');
    const params = ARIA_EMOTION_PARAMS[state];
    if (params?.motionGroup) {
      try {
        model.motion(params.motionGroup, 0, 2); // group, index, priority
      } catch {}
    }
  }, [orbState, emotionState]);

  // ── Hologram glow color from state ────────────────────────────────────────
  const getGlowColor = () => {
    const state = orbState !== 'idle' ? orbState : (emotionState || 'idle');
    const colors: Record<string, string> = {
      idle:      '0,229,255',
      thinking:  '160,80,255',
      speaking:  '255,80,200',
      listening: '0,255,200',
      excited:   '255,200,0',
      happy:     '180,255,150',
      concerned: '255,100,120',
      intimate:  '255,120,200',
      calm:      '160,180,255',
      neutral:   '0,229,255',
    };
    return colors[state] || colors.idle;
  };

  const glow = getGlowColor();
  const glowPx = isSpeaking ? 44 : orbState === 'thinking' ? 28 : 18;
  const W = size;
  const H = mode === 'full' ? Math.round(size * 1.78) : size;

  return (
    <div
      className={`relative flex-shrink-0 ${className}`}
      style={{ width: W, height: H }}
    >
      {/* Live2D canvas */}
      <canvas
        ref={canvasRef}
        style={{
          width: W, height: H,
          borderRadius: mode === 'orb' ? '50%' : '0',
          filter: `drop-shadow(0 0 ${glowPx}px rgb(${glow})) drop-shadow(0 0 ${glowPx * 2}px rgba(${glow},0.35))`,
          transition: 'filter 0.6s ease',
        }}
      />

      {/* Hologram scan lines */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,229,255,0.025) 3px,rgba(0,229,255,0.025) 4px)',
        animation: 'scan-drift 5s linear infinite',
        borderRadius: mode === 'orb' ? '50%' : '0',
        mixBlendMode: 'overlay',
      }}/>

      {/* Moving scan beam */}
      {mode === 'full' && (
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 4, pointerEvents: 'none',
          background: `linear-gradient(90deg,transparent,rgba(${glow},0.50),transparent)`,
          animation: 'beam-sweep 4s ease-in-out infinite',
        }}/>
      )}

      {/* Bottom dissolve (full mode) */}
      {mode === 'full' && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '20%',
          background: 'linear-gradient(to top,hsl(var(--aria-bg,252 56% 4%)) 10%,transparent 100%)',
          pointerEvents: 'none',
        }}/>
      )}

      {/* Face tracking indicator */}
      {mode === 'full' && trackingActive && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          width: 6, height: 6, borderRadius: '50%',
          background: '#00ff88',
          boxShadow: '0 0 8px #00ff88',
          animation: 'aria-pulse 1.5s ease-in-out infinite',
        }}/>
      )}

      {/* Loading state */}
      {!modelRef.current && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 8,
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

      <style>{`
        @keyframes scan-drift { from{background-position:0 0} to{background-position:0 40px} }
        @keyframes beam-sweep { 0%{top:0%;opacity:0} 8%{opacity:1} 92%{opacity:1} 100%{top:100%;opacity:0} }
      `}</style>
    </div>
  );
};
