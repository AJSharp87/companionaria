import { useEffect, useRef, useState, useCallback } from 'react';

export interface TrackingResult {
  head: { x: number; y: number; z: number };
  eye: { l: number; r: number };
  pupil: { x: number; y: number };
  brow: { l: number; r: number };
  mouth: { x: number; y: number };
  trackingActive: boolean;
  hasCamera: boolean;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
}

const DEFAULT_VALUES = {
  head: { x: 0, y: 0, z: 0 },
  eye: { l: 1, r: 1 },
  pupil: { x: 0, y: 0 },
  brow: { l: 0, r: 0 },
  mouth: { x: 0, y: 0 },
};

export function useAriaLive2DTracking(enabled: boolean): TrackingResult {
  const [trackingActive, setTrackingActive] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);
  const valuesRef = useRef({ ...DEFAULT_VALUES });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceMeshRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const kalidoRef = useRef<any>(null);
  const stoppedRef = useRef(false);

  const stopTracking = useCallback(() => {
    stoppedRef.current = true;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (faceMeshRef.current) {
      try { faceMeshRef.current.close(); } catch {}
      faceMeshRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.remove();
      videoRef.current = null;
    }
    setTrackingActive(false);
  }, []);

  const startTracking = useCallback(async () => {
    if (trackingActive) return;
    stoppedRef.current = false;
    try {
      const [{ FaceMesh }, Kalido] = await Promise.all([
        import('@mediapipe/face_mesh'),
        import('kalidokit'),
      ]);
      kalidoRef.current = Kalido;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false,
      });
      if (stoppedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      setHasCamera(true);

      const video = document.createElement('video');
      video.style.position = 'fixed';
      video.style.top = '-9999px';
      video.style.left = '-9999px';
      video.style.width = '1px';
      video.style.height = '1px';
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.srcObject = stream;
      document.body.appendChild(video);
      videoRef.current = video;
      await video.play().catch(() => {});

      const faceMesh = new FaceMesh({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });
      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      faceMesh.onResults((results: any) => {
        const lm = results.multiFaceLandmarks?.[0];
        if (!lm) return;
        try {
          const solved = kalidoRef.current.Face.solve(lm, {
            runtime: 'mediapipe',
            video,
          });
          if (!solved) return;
          valuesRef.current = {
            head: {
              x: -(solved.head?.x ?? 0),
              y: -(solved.head?.y ?? 0),
              z: solved.head?.z ?? 0,
            },
            eye: {
              l: solved.eye?.l ?? 1,
              r: solved.eye?.r ?? 1,
            },
            pupil: {
              x: solved.pupil?.x ?? 0,
              y: solved.pupil?.y ?? 0,
            },
            brow: {
              l: solved.brow ?? 0,
              r: solved.brow ?? 0,
            },
            mouth: {
              x: solved.mouth?.x ?? 0,
              y: solved.mouth?.shape?.A ?? solved.mouth?.y ?? 0,
            },
          };
        } catch {}
      });
      faceMeshRef.current = faceMesh;

      const loop = async () => {
        if (stoppedRef.current || !videoRef.current || !faceMeshRef.current) return;
        if (videoRef.current.readyState >= 2) {
          try { await faceMeshRef.current.send({ image: videoRef.current }); } catch {}
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
      setTrackingActive(true);
    } catch (e) {
      console.warn('[AriaLive2DTracking] camera/face-mesh unavailable:', e);
      stopTracking();
    }
  }, [trackingActive, stopTracking]);

  useEffect(() => {
    if (enabled) startTracking();
    return () => stopTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return {
    ...valuesRef.current,
    trackingActive,
    hasCamera,
    startTracking,
    stopTracking,
  };
}
