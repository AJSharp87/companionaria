import { useEffect, useRef, useState } from 'react';
import { useAria } from '@/contexts/AriaContext';
import { useAriaLive2DTracking } from '@/hooks/useAriaLive2DTracking';
import {
  lerp,
  LIVE2D_PARAMS,
  ARIA_STATE_PARAMS,
  ARIA_EMOTION_PARAMS,
  getAriaGlow,
} from '@/lib/ariaLive2DParams';

interface AriaLive2DProps {
  size?: number;
  mode?: 'orb' | 'full';
  devMode?: boolean;
  modelUrl?: string;
}

const DEV_MODEL_URL =
  'https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/haru/haru_greeter_t03.model3.json';
const PROD_MODEL_URL = '/models/aria/aria.model3.json';

// Make PIXI available globally for pixi-live2d-display
let pixiReady: Promise<{ PIXI: any; Live2DModel: any }> | null = null;
async function loadPixiAndLive2D() {
  if (pixiReady) return pixiReady;
  pixiReady = (async () => {
    const PIXI = await import('pixi.js');
    (window as any).PIXI = PIXI;
    const mod = await import('pixi-live2d-display');
    return { PIXI, Live2DModel: mod.Live2DModel };
  })();
  return pixiReady;
}

export const AriaLive2D: React.FC<AriaLive2DProps> = ({
  size = 120,
  mode = 'orb',
  devMode = false,
  modelUrl,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<any>(null);
  const modelRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const blinkStateRef = useRef({ next: performance.now() + 2500, closing: false, t: 0 });
  const paramsStateRef = useRef<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  const { orbState, emotionState, isSpeaking, isListening } = useAria();
  const orbStateRef = useRef(orbState);
  const emotionStateRef = useRef(emotionState);
  const isSpeakingRef = useRef(isSpeaking);
  const isListeningRef = useRef(isListening);
  useEffect(() => { orbStateRef.current = orbState; }, [orbState]);
  useEffect(() => { emotionStateRef.current = emotionState; }, [emotionState]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);

  // Only full mode does on-device face tracking (to avoid double-using camera in orb chrome).
  const tracking = useAriaLive2DTracking(mode === 'full');

  // Setup PIXI app + load model
  useEffect(() => {
    let cancelled = false;
    const url = modelUrl || (devMode ? DEV_MODEL_URL : PROD_MODEL_URL);

    (async () => {
      try {
        const { PIXI, Live2DModel } = await loadPixiAndLive2D();
        if (cancelled || !canvasRef.current) return;

        const app = new PIXI.Application({
          view: canvasRef.current,
          width: size,
          height: size,
          backgroundAlpha: 0,
          antialias: true,
          autoStart: true,
          resolution: window.devicePixelRatio || 1,
        });
        appRef.current = app;

        const model = await Live2DModel.from(url, { autoInteract: false });
        if (cancelled) { try { model.destroy(); } catch {} return; }
        modelRef.current = model;

        // Fit model in canvas
        const fitModel = () => {
          const padding = mode === 'full' ? 0.92 : 0.8;
          const scale = Math.min(size / model.width, size / model.height) * padding;
          model.scale.set(scale);
          model.x = size / 2 - (model.width * scale) / 2;
          if (mode === 'orb') {
            // For orb mode, frame head-and-shoulders by anchoring near top
            model.y = -model.height * scale * 0.05;
          } else {
            model.y = size / 2 - (model.height * scale) / 2;
          }
        };
        fitModel();

        app.stage.addChild(model);
        setLoading(false);

        // Animation loop
        const startTs = performance.now();
        const tick = () => {
          rafRef.current = requestAnimationFrame(tick);
          const m = modelRef.current;
          if (!m) return;
          const core = m.internalModel?.coreModel;
          if (!core?.setParameterValueById) return;

          const now = performance.now();
          const tSec = (now - startTs) / 1000;

          const stateKey =
            orbStateRef.current && orbStateRef.current !== 'idle'
              ? orbStateRef.current
              : emotionStateRef.current || 'idle';
          const state = ARIA_STATE_PARAMS[stateKey] || ARIA_STATE_PARAMS.idle;
          const emo = ARIA_EMOTION_PARAMS[stateKey] || ARIA_EMOTION_PARAMS.idle;
          const speaking = isSpeakingRef.current;
          const listening = isListeningRef.current || stateKey === 'listening';

          // Idle sway + state-driven additional motion
          const swayX = Math.sin(tSec * state.headSwaySpeed) * state.headSwayX;
          const swayY = Math.cos(tSec * state.headSwaySpeed * 0.7) * state.headSwayY;
          const swayZ = Math.sin(tSec * state.headSwaySpeed * 0.4) * (state.headSwayX * 0.3);

          // Target params
          let targetAngleX = swayX + (tracking.trackingActive ? tracking.head.x * 30 : 0);
          let targetAngleY = swayY + (tracking.trackingActive ? tracking.head.y * 30 : 0);
          let targetAngleZ = swayZ + (tracking.trackingActive ? tracking.head.z * 30 : 0);

          if (stateKey === 'thinking') { targetAngleY += 6; targetAngleX -= 4; }
          if (listening) { targetAngleY -= 3; }

          // Mouth — lip sync when speaking
          let targetMouthOpen = emo.mouthOpen;
          if (speaking) {
            const lip = (Math.sin(tSec * 8 * Math.PI * 2) + 1) / 2;
            const lip2 = (Math.sin(tSec * 13 * Math.PI * 2) + 1) / 2;
            targetMouthOpen = 0.2 + lip * 0.6 + lip2 * 0.2;
          } else if (tracking.trackingActive) {
            targetMouthOpen = tracking.mouth.y;
          }
          const targetMouthForm = emo.mouthForm;

          // Eyes — blink cycle
          const blink = blinkStateRef.current;
          let eyeBase = 1;
          if (now >= blink.next && !blink.closing) {
            blink.closing = true;
            blink.t = now;
          }
          if (blink.closing) {
            const dur = 140;
            const p = (now - blink.t) / dur;
            if (p >= 1) {
              blink.closing = false;
              blink.next = now + 2500 + Math.random() * 2500;
              eyeBase = 1;
            } else {
              // 0 -> closed -> open
              eyeBase = Math.abs(p * 2 - 1);
            }
          }
          if (tracking.trackingActive) {
            eyeBase = Math.min(eyeBase, (tracking.eye.l + tracking.eye.r) / 2);
          }

          // Eye direction
          let eyeBallX = Math.sin(tSec * 0.3) * 0.3;
          let eyeBallY = Math.cos(tSec * 0.25) * 0.2;
          if (tracking.trackingActive) {
            eyeBallX = tracking.pupil.x;
            eyeBallY = tracking.pupil.y;
          }

          // Brows
          const targetBrowY = state.browY + (tracking.trackingActive ? tracking.brow.l * 0.5 : 0);
          const targetBrowAngle = state.browAngle;

          // Breath always on
          const breath = (Math.sin(tSec * 1.6) + 1) / 2;

          // Body
          const targetBodyX = targetAngleX * 0.2;
          const targetBodyY = targetAngleY * 0.1;

          // Braid swing — based on motion + speaking energy
          const braidEnergy = speaking ? 1 : (stateKey === 'excited' ? 0.8 : 0.3);
          const braidPink = Math.sin(tSec * 1.4) * 10 * braidEnergy;
          const braidBlack = Math.sin(tSec * 1.4 + 0.6) * 10 * braidEnergy;

          // Tere / cheek
          const targetTere = emo.tere;
          const targetCheek = emo.tere * 0.5;

          // Eye smile
          const eyeSmile = state.eyeSmile + emo.eyeSmile;

          // Lerp & write
          const s = paramsStateRef.current;
          const set = (id: string, target: number, factor: number) => {
            const cur = s[id] ?? 0;
            const next = lerp(cur, target, factor);
            s[id] = next;
            try { core.setParameterValueById(id, next); } catch {}
          };

          set(LIVE2D_PARAMS.angleX, targetAngleX, 0.1);
          set(LIVE2D_PARAMS.angleY, targetAngleY, 0.1);
          set(LIVE2D_PARAMS.angleZ, targetAngleZ, 0.1);
          set(LIVE2D_PARAMS.bodyAngleX, targetBodyX, 0.08);
          set(LIVE2D_PARAMS.bodyAngleY, targetBodyY, 0.08);
          set(LIVE2D_PARAMS.eyeLOpen, eyeBase, 0.5);
          set(LIVE2D_PARAMS.eyeROpen, eyeBase, 0.5);
          set(LIVE2D_PARAMS.eyeBallX, eyeBallX, 0.15);
          set(LIVE2D_PARAMS.eyeBallY, eyeBallY, 0.15);
          set(LIVE2D_PARAMS.eyeLSmile, eyeSmile, 0.1);
          set(LIVE2D_PARAMS.eyeRSmile, eyeSmile, 0.1);
          set(LIVE2D_PARAMS.browLY, targetBrowY, 0.1);
          set(LIVE2D_PARAMS.browRY, targetBrowY, 0.1);
          set(LIVE2D_PARAMS.browLAngle, targetBrowAngle, 0.1);
          set(LIVE2D_PARAMS.browRAngle, targetBrowAngle, 0.1);
          set(LIVE2D_PARAMS.mouthOpenY, targetMouthOpen, 0.3);
          set(LIVE2D_PARAMS.mouthForm, targetMouthForm, 0.1);
          set(LIVE2D_PARAMS.breath, breath, 0.15);
          set(LIVE2D_PARAMS.cheek, targetCheek, 0.05);
          set(LIVE2D_PARAMS.tere, targetTere, 0.05);
          set(LIVE2D_PARAMS.braidPink, braidPink, 0.1);
          set(LIVE2D_PARAMS.braidBlack, braidBlack, 0.1);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        console.error('[AriaLive2D] failed to load model:', e);
        setErrored(true);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      try { modelRef.current?.destroy?.(); } catch {}
      modelRef.current = null;
      try { appRef.current?.destroy?.(true, { children: true, texture: true, baseTexture: true }); } catch {}
      appRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, mode, devMode, modelUrl]);

  const glow = getAriaGlow(orbState, emotionState);
  const glowIntensity = isSpeaking ? 0.55 : isListening ? 0.4 : 0.3;
  const isOrb = mode === 'orb';

  return (
    <div
      ref={containerRef}
      className={`relative ${isOrb ? 'rounded-full overflow-hidden' : ''}`}
      style={{
        width: size,
        height: size,
        filter: `drop-shadow(0 0 ${size * 0.08}px rgba(${glow}, ${glowIntensity})) drop-shadow(0 0 ${size * 0.18}px rgba(${glow}, ${glowIntensity * 0.5}))`,
      }}
    >
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{ width: size, height: size, display: 'block' }}
      />

      {/* Holographic scan lines */}
      <div
        className="absolute inset-0 pointer-events-none mix-blend-screen opacity-30"
        style={{
          background: `repeating-linear-gradient(0deg, rgba(${glow},0.12) 0px, rgba(${glow},0.12) 1px, transparent 2px, transparent 4px)`,
          ...(isOrb ? { borderRadius: '50%' } : {}),
        }}
      />

      {/* Sweeping beam — full mode only */}
      {!isOrb && (
        <div
          className="absolute inset-x-0 pointer-events-none opacity-60"
          style={{
            height: 30,
            background: `linear-gradient(180deg, transparent, rgba(${glow},0.35), transparent)`,
            animation: 'aria-l2d-beam 5s linear infinite',
          }}
        />
      )}

      {/* Bottom fade — full mode only */}
      {!isOrb && (
        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none"
          style={{
            height: '25%',
            background: 'linear-gradient(180deg, transparent, hsl(var(--background)))',
          }}
        />
      )}

      {/* Tracking indicator */}
      {tracking.trackingActive && (
        <div
          className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
          style={{
            background: 'hsl(140 80% 55%)',
            boxShadow: '0 0 6px hsl(140 80% 55% / 0.9)',
          }}
          title="Face tracking active"
        />
      )}

      {/* Loading state */}
      {loading && !errored && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50 text-[9px] tracking-[0.2em] uppercase">
          loading
        </div>
      )}
      {errored && (
        <div className="absolute inset-0 flex items-center justify-center text-destructive/60 text-[9px] tracking-[0.2em] uppercase text-center px-2">
          model unavailable
        </div>
      )}

      <style>{`
        @keyframes aria-l2d-beam {
          0% { top: -10%; opacity: 0; }
          15% { opacity: 0.6; }
          85% { opacity: 0.6; }
          100% { top: 110%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default AriaLive2D;
