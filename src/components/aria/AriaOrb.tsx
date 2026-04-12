import { useRef, useEffect } from 'react';
import { useAria } from '@/contexts/AriaContext';

interface AriaOrbProps {
  size?: number;
  className?: string;
}

export const AriaOrb: React.FC<AriaOrbProps> = ({ size = 120, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { orbState } = useAria();
  const orbStateRef = useRef(orbState);
  useEffect(() => { orbStateRef.current = orbState; }, [orbState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const S = size * 2;
    canvas.width = S;
    canvas.height = S;
    let t = 0;
    let animId: number;

    const PALETTES: Record<string, any> = {
      idle: { c0: '255,255,255', c1: '200,220,255', c2: '140,170,255', ga: 0.18, noise: 0.35 },
      thinking: { c0: '180,200,255', c1: '120,150,255', c2: '80,100,220', ga: 0.30, noise: 0.55 },
      speaking: { c0: '255,255,255', c1: '220,240,255', c2: '160,200,255', ga: 0.40, noise: 0.70 },
      listening: { c0: '160,240,255', c1: '100,210,240', c2: '60,180,220', ga: 0.28, noise: 0.50 },
    };

    const PARTICLES = Array.from({ length: 18 }, () => ({
      angle: Math.random() * Math.PI * 2,
      radius: 0.55 + Math.random() * 0.38,
      speed: (Math.random() - 0.5) * 0.008,
      size: Math.random() * 3 + 1,
      alpha: Math.random() * 0.5 + 0.2,
      phase: Math.random() * Math.PI * 2,
    }));

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    let currentPal = { ...PALETTES.idle };
    let targetPal = { ...PALETTES.idle };
    let palT = 1;
    let lastState = 'idle';

    function draw() {
      t += 0.016;
      const state = orbStateRef.current;
      if (state !== lastState) {
        currentPal = { ...targetPal };
        targetPal = { ...(PALETTES[state] || PALETTES.idle) };
        palT = 0;
        lastState = state;
      }
      if (palT < 1) palT = Math.min(1, palT + 0.035);

      const pal = {
        ga: lerp(currentPal.ga, targetPal.ga, palT),
        noise: lerp(currentPal.noise, targetPal.noise, palT),
      };
      const col = palT > 0.5 ? targetPal : currentPal;

      ctx.clearRect(0, 0, S, S);
      const cx = S / 2, cy = S / 2, R = S * 0.42;
      const breathe = 1 + Math.sin(t * 1.1) * 0.028;
      const pulseMod = state === 'speaking'
        ? 1 + Math.sin(t * 8) * 0.06 + Math.sin(t * 13) * 0.03
        : state === 'thinking' ? 1 + Math.sin(t * 4) * 0.04
        : 1 + Math.sin(t * 1.4) * 0.015;
      const r = R * breathe * pulseMod;

      // Outer glow
      const halo = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r * 2.2);
      halo.addColorStop(0, `rgba(${col.c1},${pal.ga * 0.6})`);
      halo.addColorStop(0.5, `rgba(${col.c2},${pal.ga * 0.25})`);
      halo.addColorStop(1, `rgba(${col.c2},0)`);
      ctx.beginPath(); ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2); ctx.fillStyle = halo; ctx.fill();

      // Secondary glow
      const glow2 = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 1.35);
      glow2.addColorStop(0, `rgba(${col.c0},${pal.ga * 0.45})`);
      glow2.addColorStop(1, `rgba(${col.c1},0)`);
      ctx.beginPath(); ctx.arc(cx, cy, r * 1.35, 0, Math.PI * 2); ctx.fillStyle = glow2; ctx.fill();

      // Main sphere
      const sx = cx - r * 0.28, sy = cy - r * 0.30;
      const body = ctx.createRadialGradient(sx, sy, r * 0.05, cx, cy, r);
      body.addColorStop(0, `rgba(${col.c0},0.98)`);
      body.addColorStop(0.25, `rgba(${col.c0},0.88)`);
      body.addColorStop(0.55, `rgba(${col.c1},0.72)`);
      body.addColorStop(0.80, `rgba(${col.c2},0.55)`);
      body.addColorStop(1, `rgba(${col.c2},0.20)`);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = body; ctx.fill();

      // Specular highlight
      const hx = cx - r * 0.32, hy = cy - r * 0.34;
      const spec = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 0.38);
      spec.addColorStop(0, `rgba(255,255,255,0.92)`);
      spec.addColorStop(0.35, `rgba(255,255,255,0.35)`);
      spec.addColorStop(1, `rgba(255,255,255,0)`);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = spec; ctx.fill();

      // Surface particles
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.97, 0, Math.PI * 2); ctx.clip();
      PARTICLES.forEach(p => {
        p.angle += p.speed * (state === 'speaking' ? 2.5 : state === 'thinking' ? 1.8 : 1);
        const pr = r * p.radius;
        const px = cx + Math.cos(p.angle) * pr;
        const py = cy + Math.sin(p.angle) * pr * 0.55;
        const flickr = 0.5 + 0.5 * Math.sin(t * 3 + p.phase);
        const a = p.alpha * pal.noise * flickr;
        ctx.beginPath(); ctx.arc(px, py, p.size * (0.6 + flickr * 0.4), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${col.c0},${a})`; ctx.fill();
      });
      ctx.restore();

      // Edge rim
      const rim = ctx.createRadialGradient(cx, cy, r * 0.65, cx, cy, r);
      rim.addColorStop(0, `rgba(0,0,10,0)`);
      rim.addColorStop(1, `rgba(0,0,20,0.55)`);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = rim; ctx.fill();

      // Data ring
      if (state === 'thinking' || state === 'speaking') {
        const ringR = r * 1.18;
        const segments = 32;
        const ringAlpha = state === 'thinking' ? 0.25 + 0.15 * Math.sin(t * 2) : 0.35 + 0.2 * Math.sin(t * 5);
        for (let i = 0; i < segments; i++) {
          const a1 = (i / segments) * Math.PI * 2 + t * (state === 'thinking' ? 0.4 : 0.9);
          const a2 = ((i + 0.6) / segments) * Math.PI * 2 + t * (state === 'thinking' ? 0.4 : 0.9);
          const bright = (Math.sin(i * 0.8 + t * 3) + 1) * 0.5;
          ctx.beginPath(); ctx.arc(cx, cy, ringR, a1, a2);
          ctx.strokeStyle = `rgba(${col.c0},${ringAlpha * bright})`;
          ctx.lineWidth = state === 'speaking' ? 2.5 : 1.5;
          ctx.stroke();
        }
      }

      animId = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animId);
  }, [size]);

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <div className="absolute rounded-full border border-foreground/[0.06] animate-[aria-spin-slow_22s_linear_infinite_reverse]"
        style={{ inset: -size * 0.15 }}>
        <div className="absolute top-1/2 -left-[3px] w-[5px] h-[5px] rounded-full bg-foreground/50 -translate-y-1/2"
          style={{ boxShadow: '0 0 8px 2px rgba(255,255,255,0.4)' }} />
      </div>
      <div className="absolute rounded-full border border-foreground/[0.08] animate-[aria-spin-slow_14s_linear_infinite]"
        style={{ inset: -size * 0.08 }}>
        <div className="absolute bottom-1/2 -right-[2px] w-[3px] h-[3px] rounded-full translate-y-1/2"
          style={{ background: 'rgba(180,200,255,0.7)', boxShadow: '0 0 6px 2px rgba(160,200,255,0.5)' }} />
      </div>
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-full block relative z-[2]"
        style={{ width: size, height: size }}
      />
      <div className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 rounded-[50%] pointer-events-none"
        style={{ width: size * 0.58, height: 12, background: 'radial-gradient(ellipse, rgba(255,255,255,0.12) 0%, transparent 70%)', filter: 'blur(4px)' }} />
    </div>
  );
};
