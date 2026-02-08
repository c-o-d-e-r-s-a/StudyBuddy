export type SensingEvent = {
  ts: number;
  face_present: boolean;
  gaze: "on_screen" | "away";
  confusion: number; // 0..1
};

type StartOptions = {
  cascadeUrl?: string;        // default: /models/haarcascade_frontalface_default.xml
  intervalMs?: number;        // default: 2000ms (CRITICAL: Must be high to prevent lag)
  targetWidth?: number;       // default: 120 (CRITICAL: Must be small to prevent CPU overload)
  stopCameraOnStop?: boolean; // 
};

declare global {
  interface Window {
    cv: any;
  }
}

function clamp01(x: number) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

async function waitForOpenCV(): Promise<any> {
  const cv = window.cv;
  if (!cv) throw new Error("OpenCV not found on window. Did opencv.js load?");
  if (cv.Mat) return cv;

  await new Promise<void>((resolve, reject) => {
    const start = Date.now();
    const t = setInterval(() => {
      if (window.cv && window.cv.Mat) {
        clearInterval(t);
        resolve();
      } else if (Date.now() - start > 15000) {
        clearInterval(t);
        reject(new Error("Timed out waiting for OpenCV to initialize"));
      }
    }, 50);
  });

  return window.cv;
}

async function loadCascade(cv: any, cascadeUrl: string) {
  const res = await fetch(cascadeUrl);
  if (!res.ok) throw new Error(`Failed to fetch cascade: ${res.status}`);
  const data = new Uint8Array(await res.arrayBuffer());

  // Use a simple filename (OpenCV.js CascadeClassifier.load expects this style reliably)
  const filename = "haarcascade.xml";

  try {
    cv.FS_unlink("/" + filename);
  } catch {}

  cv.FS_createDataFile("/", filename, data, true, false, false);

  const classifier = new cv.CascadeClassifier();
  const ok = classifier.load(filename);
  if (!ok) throw new Error("CascadeClassifier.load() failed");

  return classifier;
}

// ✅ NEW: Pre-initialize camera async (non-blocking)
async function initializeCameraAsync(
  videoEl: HTMLVideoElement,
  options: { width?: number; height?: number } = {}
): Promise<void> {
  if (videoEl.srcObject) return; // Already initialized

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: options.width ?? 640 },
      height: { ideal: options.height ?? 480 }
    },
    audio: false
  });

  videoEl.srcObject = stream;

  // Wait for video metadata to be loaded
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Video metadata timeout")), 5000);
    videoEl.onloadedmetadata = () => {
      clearTimeout(timeout);
      videoEl.play().then(resolve).catch(reject);
    };
  });
}

// ✅ Export helper for React component
export async function initCameraForSensing(videoEl: HTMLVideoElement): Promise<void> {
  return initializeCameraAsync(videoEl);
}

// ✅ OPTIMIZED: startCvSensing with aggressive performance tuning
export async function startCvSensing(
  videoEl: HTMLVideoElement,
  canvasEl: HTMLCanvasElement,
  onEvent: (e: SensingEvent) => void,
  opts: StartOptions = {}
) {
  const cascadeUrl = opts.cascadeUrl ?? "/models/haarcascade_frontalface_default.xml";
  // ✅ CRITICAL FIX: Increased from 350ms to 2000ms to prevent lag/crashes
  const intervalMs = opts.intervalMs ?? 2000;
  // ✅ CRITICAL FIX: Reduced from 320px to 120px for much faster processing
  const targetWidth = opts.targetWidth ?? 120;
  const stopCameraOnStop = opts.stopCameraOnStop ?? true;

  const cv = await waitForOpenCV();
  const classifier = await loadCascade(cv, cascadeUrl);

  let lastRect: { x: number; y: number; w: number; h: number } | null = null;
  let lastFaceSeenTs = Date.now();
  let jitterScore = 0;

  let stopped = false;
  let timer: any = null;
  let processing = false;

  // ✅ Ensure camera is pre-initialized
  if (!videoEl.srcObject) {
    throw new Error("Video element must have a stream before calling startCvSensing. Call initCameraForSensing first.");
  }

  const processFrame = () => {
    // ✅ CRITICAL: Skip if already processing - prevents queue buildup
    if (stopped || processing) {
      return;
    }
    processing = true;

    try {
      const vw = videoEl.videoWidth;
      const vh = videoEl.videoHeight;
      if (!vw || !vh) return;

      // ✅ Ultra downscale for detection speed
      const scale = targetWidth / vw;
      const w = Math.max(1, Math.floor(vw * scale));
      const h = Math.max(1, Math.floor(vh * scale));

      canvasEl.width = w;
      canvasEl.height = h;

      const ctx = canvasEl.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(videoEl, 0, 0, w, h);

      const src = cv.imread(canvasEl);
      const gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

      const faces = new cv.RectVector();
      const msize = new cv.Size(0, 0);

      // ✅ AGGRESSIVE: More conservative detection for speed (1.3 scaleFactor, 8 minNeighbors)
      classifier.detectMultiScale(gray, faces, 1.3, 8, 0, msize, msize);

      const ts = Date.now();

      const face_present = faces.size() > 0;
      let gaze: "on_screen" | "away" = "away";
      let confusion = 0;

      if (face_present) {
        lastFaceSeenTs = ts;
        gaze = "on_screen";

        // Pick largest face
        let bestIdx = 0;
        let bestArea = 0;
        for (let i = 0; i < faces.size(); i++) {
          const r = faces.get(i);
          const area = r.width * r.height;
          if (area > bestArea) {
            bestArea = area;
            bestIdx = i;
          }
        }

        const r = faces.get(bestIdx);
        const rect = { x: r.x, y: r.y, w: r.width, h: r.height };

        // Jitter proxy
        if (lastRect) {
          const dx = Math.abs(rect.x - lastRect.x);
          const dy = Math.abs(rect.y - lastRect.y);
          const dw = Math.abs(rect.w - lastRect.w);
          const dh = Math.abs(rect.h - lastRect.h);

          const norm = Math.max(1, rect.w + rect.h);
          const jump = (dx + dy + dw + dh) / norm;
          jitterScore = jitterScore * 0.85 + jump * 0.6;
        } else {
          jitterScore = jitterScore * 0.85;
        }

        lastRect = rect;
        confusion = clamp01(jitterScore);
      } else {
        const awayMs = ts - lastFaceSeenTs;
        gaze = awayMs > 900 ? "away" : "on_screen";

        const ramp = (awayMs - 1500) / 3000;
        confusion = clamp01(ramp * 0.8);

        jitterScore = jitterScore * 0.85;
        lastRect = null;
      }

      onEvent({ ts, face_present, gaze, confusion });

      // Cleanup
      src.delete();
      gray.delete();
      faces.delete();
      msize.delete();
    } catch (err) {
      console.error("❌ CV processFrame error:", err);
    } finally {
      processing = false;
    }
  };

  timer = setInterval(processFrame, intervalMs);

  return () => {
    stopped = true;
    if (timer) clearInterval(timer);

    if (stopCameraOnStop) {
      const stream = videoEl.srcObject as MediaStream | null;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      videoEl.srcObject = null;
    }

    try {
      classifier.delete?.();
    } catch {}
  };
}