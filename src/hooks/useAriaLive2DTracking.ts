/**
 * useAriaLive2DTracking.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * React hook: MediaPipe FaceMesh → KalidoKit → solved face params
 *
 * Returns solved blendshape + rotation data every frame.
 * AriaLive2D.tsx reads these and applies them to the Live2D model.
 *
 * Only activates when enabled=true (full mode, not compact orb).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as Kalidokit from 'kalidokit';

export interface AriaFaceResults {
  head:   { x: number; y: number; z: number };
  eye:    { l: number; r: number };
  pupil:  { x: number; y: number };
  brow:   { l: number; r: number };
  mouth:  { x: number; y: number };
  cheek:  number;
}

interface UseAriaLive2DTrackingReturn {
  faceResults:    AriaFaceResults | null;
  trackingActive: boolean;
  startTracking:  () => Promise<void>;
  stopTracking:   () => void;
  hasCamera:      boolean;
}

export function useAriaLive2DTracking(enabled: boolean): UseAriaLive2DTrackingReturn {
  const [faceResults,    setFaceResults]    = useState<AriaFaceResults | null>(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [hasCamera,      setHasCamera]      = useState(false);

  const videoRef     = useRef<HTMLVideoElement | null>(null);
  const faceMeshRef  = useRef<any>(null);
  const rafRef       = useRef<number>(0);
  const streamRef    = useRef<MediaStream | null>(null);
  const mountedRef   = useRef(true);

  // ── Load MediaPipe FaceMesh ───────────────────────────────────────────────
  const loadFaceMesh = useCallback(async () => {
    if (faceMeshRef.current) return faceMeshRef.current;

    // Dynamically import to avoid SSR issues
    const { FaceMesh } = await import('@mediapipe/face_mesh');

    const faceMesh = new FaceMesh({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${file}`,
    });

    faceMesh.setOptions({
      maxNumFaces:          1,
      refineLandmarks:      true,   // enables iris tracking
      minDetectionConfidence: 0.6,
      minTrackingConfidence:  0.6,
    });

    faceMesh.onResults((results: any) => {
      if (!mountedRef.current) return;
      if (!results.multiFaceLandmarks?.length) {
        setFaceResults(null);
        return;
      }

      const landmarks = results.multiFaceLandmarks[0];
      const width  = videoRef.current?.videoWidth  ?? 640;
      const height = videoRef.current?.videoHeight ?? 480;

      // ── KalidoKit solve ─────────────────────────────────────────────────
      try {
        // Head rotation
        const headSolve = Kalidokit.Face.solve(landmarks, {
          runtime:  'mediapipe',
          video:    videoRef.current!,
          imageSize: { width, height },
          smoothBlink: true,
          blinkSettings: [0.25, 0.75],
        });

        if (!headSolve) return;

        // Eye openness (KalidoKit Eye solver)
        const eyeSolve = Kalidokit.Face.solve(landmarks, {
          runtime: 'mediapipe',
          video: videoRef.current!,
          imageSize: { width, height },
        });

        // Mouth
        const mouthSolve = Kalidokit.Face.solve(landmarks, {
          runtime: 'mediapipe',
          video: videoRef.current!,
          imageSize: { width, height },
        });

        setFaceResults({
          head: {
            x: headSolve.head?.x ?? 0,
            y: headSolve.head?.y ?? 0,
            z: headSolve.head?.z ?? 0,
          },
          eye: {
            l: headSolve.eye?.l ?? 1,
            r: headSolve.eye?.r ?? 1,
          },
          pupil: {
            x: headSolve.pupil?.x ?? 0,
            y: headSolve.pupil?.y ?? 0,
          },
          brow: {
            l: (headSolve as any).brow?.l ?? 0,
            r: (headSolve as any).brow?.r ?? 0,
          },
          mouth: {
            x: headSolve.mouth?.x ?? 0,
            y: headSolve.mouth?.y ?? 0,
          },
          cheek: 0,
        });
      } catch (e) {
        console.warn('[AriaTracking] KalidoKit solve error:', e);
      }
    });

    await faceMesh.initialize();
    faceMeshRef.current = faceMesh;
    return faceMesh;
  }, []);

  // ── Start tracking ────────────────────────────────────────────────────────
  const startTracking = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });

      streamRef.current = stream;
      setHasCamera(true);

      // Create hidden video element
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay  = true;
      video.playsInline = true;
      video.muted     = true;
      video.style.display = 'none';
      document.body.appendChild(video);
      videoRef.current = video;

      await video.play();
      const faceMesh = await loadFaceMesh();
      setTrackingActive(true);

      // Detection loop
      const detect = async () => {
        if (!mountedRef.current || !trackingActive) return;
        if (video.readyState >= 2) {
          try {
            await faceMesh.send({ image: video });
          } catch {}
        }
        rafRef.current = requestAnimationFrame(detect);
      };

      rafRef.current = requestAnimationFrame(detect);
      console.log('[AriaTracking] Face tracking started');

    } catch (err) {
      console.warn('[AriaTracking] Camera access denied or unavailable:', err);
      setHasCamera(false);
    }
  }, [loadFaceMesh, trackingActive]);

  // ── Stop tracking ─────────────────────────────────────────────────────────
  const stopTracking = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.remove();
      videoRef.current = null;
    }
    setTrackingActive(false);
    setFaceResults(null);
    console.log('[AriaTracking] Face tracking stopped');
  }, []);

  // ── Auto-start when enabled ───────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    if (enabled) {
      // Check camera availability first
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const hasCam = devices.some(d => d.kind === 'videoinput');
        setHasCamera(hasCam);
        if (hasCam) startTracking();
      }).catch(() => setHasCamera(false));
    }

    return () => {
      mountedRef.current = false;
      stopTracking();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { faceResults, trackingActive, startTracking, stopTracking, hasCamera };
}
