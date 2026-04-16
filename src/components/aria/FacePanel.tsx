import { useEffect, useRef, useState, useCallback } from 'react';
import { useAria } from '@/contexts/AriaContext';
import * as faceapi from 'face-api.js';

interface FaceResult {
  expression: string;
  confidence: number;
  age?: number;
}

export const FacePanel = () => {
  const { camActive, tryCamera, camStreamRef, toast, sendMsg } = useAria();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(false);
  const [faces, setFaces] = useState<FaceResult[]>([]);
  const lastDescribeRef = useRef<number>(0);

  const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

  const loadModels = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
      ]);
      setModelsLoaded(true);
      toast('🧠 Face models loaded', 'ok');
    } catch (e: any) {
      toast('Face model load failed: ' + e.message, 'err');
    }
    setLoading(false);
  }, [toast]);

  const startFace = useCallback(async () => {
    if (!camActive) await tryCamera();
    if (!modelsLoaded) await loadModels();
    setActive(true);
  }, [camActive, tryCamera, modelsLoaded, loadModels]);

  const stopFace = useCallback(() => {
    setActive(false);
    cancelAnimationFrame(animRef.current);
    setFaces([]);
  }, []);

  useEffect(() => {
    if (active && videoRef.current && camStreamRef.current) {
      videoRef.current.srcObject = camStreamRef.current;
    }
  }, [active, camStreamRef]);

  useEffect(() => {
    if (!active || !modelsLoaded) return;
    const detect = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        animRef.current = requestAnimationFrame(detect);
        return;
      }
      try {
        const detections = await faceapi
          .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions()
          .withAgeAndGender();

        const results: FaceResult[] = detections.map(d => {
          const expEntries = Object.entries(d.expressions) as [string, number][];
          const top = expEntries.sort((a, b) => b[1] - a[1])[0];
          return { expression: top[0], confidence: top[1], age: Math.round(d.age) };
        });
        setFaces(results);

        if (canvasRef.current && videoRef.current) {
          const dims = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
          faceapi.matchDimensions(canvasRef.current, dims);
          const resized = faceapi.resizeResults(detections, dims);
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, dims.width, dims.height);
            faceapi.draw.drawDetections(canvasRef.current, resized);
            faceapi.draw.drawFaceExpressions(canvasRef.current, resized);
          }
        }

        const now = Date.now();
        if (results.length > 0 && now - lastDescribeRef.current > 30000) {
          lastDescribeRef.current = now;
          const desc = results
            .map(f => `expression: ${f.expression} (${(f.confidence * 100).toFixed(0)}%)${f.age ? `, estimated age: ${f.age}` : ''}`)
            .join('; ');
          sendMsg(`[Face Detection] I can see ${results.length} face(s). ${desc}. Comment naturally on what you observe about me.`);
        }
      } catch {}
      animRef.current = requestAnimationFrame(detect);
    };
    detect();
    return () => cancelAnimationFrame(animRef.current);
  }, [active, modelsLoaded, sendMsg]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 md:px-5 py-3 border-b border-border flex items-center justify-between bg-background/85 backdrop-blur-xl flex-shrink-0">
        <h2 className="aria-serif text-base md:text-lg font-light text-aria-lav tracking-wider">Face Recognition</h2>
        <button
          onClick={active ? stopFace : startFace}
          className={`px-4 py-1.5 rounded-lg text-xs tracking-wider uppercase transition-all border ${
            loading
              ? 'border-muted-foreground/20 text-muted-foreground bg-secondary/5 cursor-wait'
              : active
              ? 'border-destructive/35 text-destructive bg-destructive/10 hover:bg-destructive/20'
              : 'border-primary/35 text-primary bg-primary/10 hover:bg-primary/20'
          }`}
          disabled={loading}
        >
          {loading ? '⏳ Loading...' : active ? '⏹ Stop' : '🔍 Activate'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-5 py-4">
        {!active ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <div className="text-5xl">🔍</div>
            <h3 className="aria-serif text-lg text-aria-lav font-light tracking-wider">Face Recognition</h3>
            <p className="text-sm text-muted-foreground/50 max-w-[320px] leading-relaxed">
              Aria will detect faces and read expressions in real-time using face-api.js. Runs entirely on your device.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="relative rounded-xl overflow-hidden border border-border bg-card/40">
              <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl" />
              <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
            </div>

            <div className="bg-card/60 border border-border rounded-xl p-4">
              <h4 className="text-xs tracking-wider uppercase text-muted-foreground mb-3">
                Detected Faces ({faces.length})
              </h4>
              {faces.length === 0 ? (
                <p className="text-sm text-muted-foreground/40 italic">Scanning for faces...</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {faces.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm text-aria-lav">
                      <span className="font-medium">{f.expression}</span>
                      <span className="text-muted-foreground/50">— {(f.confidence * 100).toFixed(0)}%</span>
                      {f.age && <span className="text-xs text-muted-foreground/30">age ~{f.age}</span>}
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
