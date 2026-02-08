// FILE: frontend/src/lib/presage.ts

export type PresageEvent = {
  ts: number;
  face_present: boolean;
  gaze: "on_screen" | "away";
  confusion: number; // 0.0 - 1.0
};

type StartOptions = {
  apiKey?: string;
  maxHz?: number; // default ~5Hz (200ms)
};

/**
 * Step 8: Real Presage feed.
 * This replaces the simulated setInterval version.
 * The rest of your app does NOT change.
 */
export function startPresage(
  onEvent: (e: PresageEvent) => void,
  options: StartOptions = {}
) {
  const apiKey =
    options.apiKey || process.env.NEXT_PUBLIC_PRESAGE_API_KEY;

  const maxHz = options.maxHz ?? 5;
  const minIntervalMs = Math.max(1000 / maxHz, 100);

  let stopped = false;
  let lastEmit = 0;

  let unsubscribe: (() => void) | null = null;
  let stopSdk: (() => void) | null = null;

  const emit = (partial: Omit<PresageEvent, "ts">, ts?: number) => {
    if (stopped) return;
    const now = ts ?? Date.now();
    if (now - lastEmit < minIntervalMs) return;
    lastEmit = now;

    onEvent({
      ts: now,
      ...partial
    });
  };

  const clamp01 = (x: number) => {
    if (!Number.isFinite(x)) return 0;
    if (x < 0) return 0;
    if (x > 1) return 1;
    return x;
  };

  (async () => {
    try {
      // Ensure camera permission (many SDKs require this)
      await navigator.mediaDevices.getUserMedia({ video: true });

      if (!apiKey) {
        throw new Error("Missing Presage API key");
      }

      // ==================================================
      // 🔴 PRESAGE SDK INTEGRATION GOES HERE 🔴
      //
      // Replace this block with the real Presage init code.
      // Example pattern (pseudo-code):
      //
      // const client = await Presage.init({
      //   apiKey,
      //   video: true
      // });
      //
      // unsubscribe = client.onSignals((sig) => {
      //   emit({
      //     face_present: sig.faceDetected,
      //     gaze: sig.gazeOnScreen ? "on_screen" : "away",
      //     confusion: clamp01(sig.confusionScore)
      //   }, sig.timestamp);
      // });
      //
      // stopSdk = () => client.stop();
      //
      // ==================================================

      throw new Error(
        "Presage SDK not wired yet. Paste the Presage init snippet and I will complete this."
      );
    } catch (err) {
      console.error("Presage failed to start:", err);

      // Graceful fallback so the rest of the app stays stable
      emit({
        face_present: false,
        gaze: "away",
        confusion: 0
      });
    }
  })();

  // Cleanup function
  return () => {
    stopped = true;
    try {
      (unsubscribe as any)?.();
    } catch {}
    try {
      (stopSdk as any)?.();
    } catch {}
  };
}
