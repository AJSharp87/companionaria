import { useEffect, useRef, useState, useCallback } from 'react';
import { useAria } from '@/contexts/AriaContext';

interface Detection {
  label: string;
  score: number;
  bbox: [number, number, number, number];
}

interface LensModePanelProps { hideHeader?: boolean; }

export const LensModePanel = ({ hideHeader = false }: LensModePanelProps) => {
  const { camActive, tryCamera, stopCamera, camStreamRef, logVisualObservation, toast, lensActive, setLensActive, snapAndAsk } = useAria();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<any>(null);
  const animRef = useRef<number>(0);
  const loggedRef = useRef<Set<string>>(new Set());
  const lastVisionDescRef = useRef<number>(0);
  const lastObjectsRef = useRef<string>('');
  const [detections, setDetections] = useState<Detection[]>([]);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  // [AriaVision] observability state
  const [lastFrameAt, setLastFrameAt] = useState<number | null>(null);
  const [lastAutodescAt, setLastAutodescAt] = useState<number | null>(null);
  const [pipelineState, setPipelineState] = useState<'idle' | 'capturing' | 'processing'>('idle');
  const autodescPendingRef = useRef(false);
  const captureCountRef = useRef(0);

  // Load COCO-SSD model
  const loadModel = useCallback(async () => {
    if (modelRef.current) { setModelReady(true); return; }
    setModelLoading(true);
    try {
      const cocoSsd = await import('@tensorflow-models/coco-ssd');
      await import('@tensorflow/tfjs');
      modelRef.current = await cocoSsd.load();
      setModelReady(true);
      toast('🧠 Object recognition model loaded', 'ok');
    } catch (e: any) {
      toast('Failed to load model: ' + e.message, 'err');
      console.error('coco-ssd load error:', e);
    }
    setModelLoading(false);
  }, [toast]);

  // Start lens mode
  const startLens = useCallback(async () => {
    if (!camActive) await tryCamera();
    setLensActive(true);
    await loadModel();
  }, [camActive, tryCamera, setLensActive, loadModel]);

  const stopLens = useCallback(() => {
    setLensActive(false);
    cancelAnimationFrame(animRef.current);
    setDetections([]);
    loggedRef.current.clear();
  }, [setLensActive]);

  // Attach camera stream to video element
  useEffect(() => {
    if (lensActive && videoRef.current && camStreamRef.current) {
      videoRef.current.srcObject = camStreamRef.current;
    }
  }, [lensActive, camStreamRef, camActive]);

  // Detection loop
  useEffect(() => {
    if (!lensActive || !modelReady || !modelRef.current) return;

    const detect = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2 || !modelRef.current) {
        animRef.current = requestAnimationFrame(detect);
        return;
      }

      try {
        setPipelineState('capturing');
        const vidW = videoRef.current.videoWidth;
        const vidH = videoRef.current.videoHeight;
        captureCountRef.current++;
        // Throttle [AriaVision] log so it doesn't spam — log every ~30th frame
        if (captureCountRef.current % 30 === 0) {
          console.log(`[AriaVision] captureFrame fired t=${Date.now()} dim=${vidW}×${vidH} sent=yes`);
        }
        setLastFrameAt(Date.now());
        const predictions = await modelRef.current.detect(videoRef.current);
        const highConf: Detection[] = predictions
          .filter((p: any) => p.score > 0.5)
          .map((p: any) => ({ label: p.class, score: p.score, bbox: p.bbox as [number, number, number, number] }));

        setDetections(highConf);

        // Log objects with >70% confidence to Supabase
        for (const d of highConf) {
          if (d.score > 0.7) {
            const key = d.label;
            if (!loggedRef.current.has(key)) {
              loggedRef.current.add(key);
              logVisualObservation(d.label, d.score);
            }
          }
        }

        // Draw bounding boxes
        if (canvasRef.current && videoRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            for (const d of highConf) {
              const [x, y, w, h] = d.bbox;
              ctx.strokeStyle = d.score > 0.7 ? '#c084fc' : '#a5f3fc';
              ctx.lineWidth = 2;
              ctx.strokeRect(x, y, w, h);
              ctx.fillStyle = 'rgba(0,0,0,0.6)';
              ctx.fillRect(x, y - 18, ctx.measureText(`${d.label} ${(d.score * 100).toFixed(0)}%`).width + 8, 18);
              ctx.fillStyle = d.score > 0.7 ? '#c084fc' : '#a5f3fc';
              ctx.font = '12px Rajdhani, sans-serif';
              ctx.fillText(`${d.label} ${(d.score * 100).toFixed(0)}%`, x + 4, y - 4);
            }
          }
        }
        setPipelineState('idle');
      } catch (e) {
        console.warn('Detection error:', e);
        setPipelineState('idle');
      }

      animRef.current = requestAnimationFrame(detect);
    };

    detect();
    return () => cancelAnimationFrame(animRef.current);
  }, [lensActive, modelReady, logVisualObservation]);

  // Periodic Claude Vision enhancement — sends scene to Claude for rich descriptions
  useEffect(() => {
    if (!lensActive || !modelReady) return;
    const interval = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      const currentObjects = detections.map(d => d.label).join(', ');
      if (!currentObjects) return;
      if (currentObjects === lastObjectsRef.current) return;
      lastObjectsRef.current = currentObjects;
      const canvas = document.createElement('canvas');
      const vid = videoRef.current;
      const sc = Math.min(512 / vid.videoWidth, 512 / vid.videoHeight, 1);
      canvas.width = Math.round(vid.videoWidth * sc);
      canvas.height = Math.round(vid.videoHeight * sc);
      canvas.getContext('2d')!.drawImage(vid, 0, 0, canvas.width, canvas.height);
      const b64 = canvas.toDataURL('image/jpeg', 0.75).split(',')[1];
      if (!b64 || b64.length < 500) return;
      const width = vid.videoWidth;
      const withPositions = detections.map(d => {
        const cx = d.bbox[0] + d.bbox[2] / 2;
        const zone = cx < width / 3 ? 'left' : cx > (width * 2) / 3 ? 'right' : 'center';
        return `${d.label} (${zone}, ${(d.score * 100).toFixed(0)}% confidence)`;
      }).join(', ');
      await snapAndAsk(`[Lens Mode Active] COCO-SSD detected: ${withPositions}. Now look at the actual image and give a rich, specific description. Identify: any people and what they're doing/wearing/expressing, any animals and their breed/species if possible, all notable objects and their context, spatial relationships, lighting and mood. Be specific — not generic. 2-3 sentences max.`);
    }, 45000);
    return () => clearInterval(interval);
  }, [lensActive, modelReady, detections, snapAndAsk]);

  // Clear logged set periodically so repeated objects get re-logged
  useEffect(() => {
    if (!lensActive) return;
    const interval = setInterval(() => loggedRef.current.clear(), 30000);
    return () => clearInterval(interval);
  }, [lensActive]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {!hideHeader && (
      <div className="px-4 md:px-5 py-3 border-b border-border flex items-center justify-between bg-background/85 backdrop-blur-xl flex-shrink-0">
        <h2 className="aria-serif text-base md:text-lg font-light text-aria-lav tracking-wider">Lens Mode</h2>
        <button
          onClick={lensActive ? stopLens : startLens}
          className={`px-4 py-1.5 rounded-lg border text-xs tracking-wider uppercase transition-all ${
            lensActive
              ? 'bg-accent/15 border-accent/50 text-accent'
              : 'bg-secondary/10 border-secondary/30 text-secondary'
          }`}
        >
          {modelLoading ? '⏳ Loading...' : lensActive ? '⏹ Stop' : '👁 Activate'}
        </button>
      </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0 px-4 md:px-5 py-4">
        {!lensActive ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-20 h-20 rounded-full bg-accent/10 border border-accent/25 flex items-center justify-center text-3xl">👁</div>
            <p className="aria-serif text-aria-lav text-lg font-light">Lens Mode</p>
            <p className="text-muted-foreground/40 text-sm max-w-[300px]">
              Activate to let Aria see and identify objects in real-time using your camera.
              Uses TensorFlow.js — runs entirely on your device. Zero API costs.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative rounded-xl overflow-hidden border border-secondary/20 bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-auto max-h-[50vh] object-contain"
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ objectFit: 'contain' }}
              />
            </div>

            <div className="space-y-2">
              <h3 className="text-[9px] tracking-[0.22em] uppercase text-secondary">
                Detected Objects ({detections.length})
              </h3>
              {detections.length === 0 ? (
                <p className="text-muted-foreground/30 text-sm italic aria-serif">Scanning...</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {detections.map((d, i) => (
                    <div
                      key={`${d.label}-${i}`}
                      className={`px-3 py-1.5 rounded-full border text-xs aria-sans ${
                        d.score > 0.7
                          ? 'bg-secondary/15 border-secondary/35 text-secondary'
                          : 'bg-accent/10 border-accent/25 text-accent'
                      }`}
                    >
                      {d.label} — {(d.score * 100).toFixed(0)}%
                      {d.score > 0.7 && <span className="ml-1 text-[8px]">✓ logged</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
