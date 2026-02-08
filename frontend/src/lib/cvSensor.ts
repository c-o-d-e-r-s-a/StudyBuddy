/**
 * cvSensor.ts - Simplified OpenCV.js distraction detection
 *
 * SIMPLIFIED FOR HACKATHON:
 * - Distraction = excessive head movement (jitter/tilt)
 * - No emotion detection (Haar cascades can't detect emotions)
 * - Focus on detecting when user is moving head too much
 * - Light-weight, runs on main thread with safeguards
 */

declare const cv: any; // OpenCV.js global

export interface SensingEvent {
  ts: number;
  face_present: boolean;
  gaze: "on_screen" | "away";
  distraction: number; // 0-1, higher = more distracted (head moving)
  processingTimeMs: number;
  debug: {
    headMovement: number;
    faceDim: number;
  };
}

interface CvConfig {
  intervalMs?: number;
  targetWidth?: number;
  detectionIntervalMs?: number;
}

interface DetectionState {
  lastFaceRect: { x: number; y: number; w: number; h: number } | null;
  lastGazeDir: "on_screen" | "away" | null;
  movementHistory: number[]; // Track head movement over time
  lastDetectionTime: number;
  frameCount: number;
}

/**
 * Start CV sensing loop for distraction detection
 */
export async function startCvSensing(
  videoEl: HTMLVideoElement,
  canvasEl: HTMLCanvasElement,
  onEvent: (event: SensingEvent) => void,
  config: CvConfig = {}
): Promise<() => void> {
  // Validate OpenCV is loaded
  if (typeof cv === "undefined") {
    throw new Error("OpenCV.js not loaded.");
  }

  const {
    intervalMs = 350,
    targetWidth = 240,
    detectionIntervalMs = 500,
  } = config;

  // Load face cascade
  let faceCascade: any;
  try {
    // OpenCV.js built-in cascade (synchronous)
    // If this fails, we'll use a simple fallback
    faceCascade = null; // Will use detectMultiScale directly
  } catch (e) {
    console.warn("⚠️ Could not load face cascade");
  }

  const state: DetectionState = {
    lastFaceRect: null,
    lastGazeDir: null,
    movementHistory: [],
    lastDetectionTime: 0,
    frameCount: 0,
  };

  let isProcessing = false;
  let shouldStop = false;
  const timingWindow: number[] = [];
  const maxTimingHistory = 10;

  const stop = () => {
    shouldStop = true;
    console.log("🛑 CV sensing stopped");
  };

  // Main loop
  const loop = () => {
    if (shouldStop) return;

    requestAnimationFrame(loop);

    // Throttle
    const now = performance.now();
    if (now - state.lastDetectionTime < intervalMs) {
      return;
    }

    // Prevent overlap
    if (isProcessing) {
      console.warn("⚠️ Previous frame still processing");
      return;
    }

    isProcessing = true;
    const processingStart = performance.now();

    try {
      const event = processFrame(videoEl, canvasEl, state, {
        targetWidth,
        detectionIntervalMs,
      });

      if (event) {
        const processingTimeMs = performance.now() - processingStart;
        event.processingTimeMs = processingTimeMs;

        timingWindow.push(processingTimeMs);
        if (timingWindow.length > maxTimingHistory) {
          timingWindow.shift();
        }

        const avgProcessingTime =
          timingWindow.reduce((a, b) => a + b, 0) / timingWindow.length;
        if (avgProcessingTime > intervalMs * 0.8) {
          console.error(
            `⚠️ CV too slow (${avgProcessingTime.toFixed(0)}ms). Stopping.`
          );
          stop();
          return;
        }

        onEvent(event);
      }
    } catch (err) {
      console.error("❌ CV error:", err);
      stop();
    } finally {
      isProcessing = false;
    }
  };

  requestAnimationFrame(loop);

  return stop;
}

/**
 * Process frame for distraction detection
 * Distraction = head movement (jitter/tilt changes rapidly)
 */
function processFrame(
  videoEl: HTMLVideoElement,
  canvasEl: HTMLCanvasElement,
  state: DetectionState,
  config: {
    targetWidth: number;
    detectionIntervalMs: number;
  }
): SensingEvent | null {
  const ts = Date.now();

  try {
    // Read frame
    const cap = new cv.VideoCapture(videoEl);
    const frame = new cv.Mat(videoEl.videoHeight, videoEl.videoWidth, cv.CV_8UC4);
    cap.read(frame);

    // Downscale
    const ratio = frame.cols / config.targetWidth;
    const scaledWidth = config.targetWidth;
    const scaledHeight = Math.floor(frame.rows / ratio);
    const scaled = new cv.Mat();
    cv.resize(frame, scaled, new cv.Size(scaledWidth, scaledHeight));

    // Convert to grayscale
    const gray = new cv.Mat();
    cv.cvtColor(scaled, gray, cv.COLOR_RGBA2GRAY);

    // ===== FACE DETECTION =====
    let faceRect: { x: number; y: number; w: number; h: number } | null = null;
    const now = performance.now();

    if (now - state.lastDetectionTime >= config.detectionIntervalMs) {
      state.lastDetectionTime = now;

      const faces = new cv.RectVector();
      cv.detectMultiScale(
        gray,
        faces,
        1.1, // scaleFactor
        4, // minNeighbors (higher = stricter)
        0,
        new cv.Size(30, 30)
      );

      if (faces.size() > 0) {
        const rect = faces.get(0);
        faceRect = {
          x: Math.round(rect.x * ratio),
          y: Math.round(rect.y * ratio),
          w: Math.round(rect.width * ratio),
          h: Math.round(rect.height * ratio),
        };
      }
      faces.delete();
    }

    // ===== DISTRACTION DETECTION: HEAD MOVEMENT =====
    let headMovement = 0;
    if (faceRect && state.lastFaceRect) {
      // Calculate movement from last frame
      const dx = faceRect.x - state.lastFaceRect.x;
      const dy = faceRect.y - state.lastFaceRect.y;
      headMovement = Math.sqrt(dx * dx + dy * dy);
    }

    // Track movement history (keep last 20 frames)
    state.movementHistory.push(headMovement);
    if (state.movementHistory.length > 20) {
      state.movementHistory.shift();
    }

    // Calculate distraction score
    // High movement = high distraction
    const avgMovement =
      state.movementHistory.reduce((a, b) => a + b, 0) /
      state.movementHistory.length;
    const movementVariance =
      state.movementHistory.length > 1
        ? Math.sqrt(
            state.movementHistory.reduce(
              (sum, m) => sum + Math.pow(m - avgMovement, 2),
              0
            ) / state.movementHistory.length
          )
        : 0;

    // Distraction = high average movement or high variance (jittery)
    // Normalize: >20px average or >15px variance = distracted
    const movementScore = Math.min(1, avgMovement / 20);
    const varianceScore = Math.min(1, movementVariance / 15);
    let distractionScore = (movementScore + varianceScore) / 2;

    // If no face detected, high distraction
    const facePresent = faceRect !== null || state.lastFaceRect !== null;
    if (!facePresent) {
      distractionScore = 0.8; // Face not visible = distracted
    }

    // ===== GAZE DETECTION =====
    let gaze: "on_screen" | "away" = "on_screen";
    const currentFaceRect = faceRect || state.lastFaceRect;
    if (currentFaceRect) {
      const faceCenterX = currentFaceRect.x + currentFaceRect.w / 2;
      const frameWidthScaled = scaledWidth;
      const centerThreshold = frameWidthScaled * 0.3;

      if (Math.abs(faceCenterX - frameWidthScaled / 2) > centerThreshold) {
        gaze = "away";
      }
    }

    // Update refs
    state.lastFaceRect = currentFaceRect;
    state.lastGazeDir = gaze;
    state.frameCount++;

    // Cleanup
    frame.delete();
    scaled.delete();
    gray.delete();

    return {
      ts,
      face_present: facePresent,
      gaze,
      distraction: distractionScore,
      processingTimeMs: 0, // Set by caller
      debug: {
        headMovement: avgMovement,
        faceDim: currentFaceRect?.w ?? 0,
      },
    };
  } catch (err) {
    console.error("❌ Frame processing error:", err);
    return null;
  }
}