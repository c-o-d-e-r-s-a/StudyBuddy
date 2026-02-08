"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";
import Script from "next/script";

// ✅ OpenCV sensing module
import { startCvSensing, SensingEvent } from "@/src/lib/cvSensor";

export default function StudyPage() {
  const [answer, setAnswer] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [question, setQuestion] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const router = useRouter();

  // ✅ Track OpenCV.js load status
  const [cvReady, setCvReady] = useState(false);

  // Step 5: sensing toggle
  const [sensingEnabled, setSensingEnabled] = useState(false);

  // Step 5: debounce refs
  const confusedStartRef = useRef<number | null>(null);
  const lastTriggerTimesRef = useRef<number[]>([]);

  // Step 5: debug display
  const [lastConfusion, setLastConfusion] = useState<number>(0);
  const [lastGaze, setLastGaze] = useState<"on_screen" | "away">("on_screen");

  // ✅ OpenCV hidden elements + stop function
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stopCvRef = useRef<null | (() => void)>(null);

  // ✅ Prevent multiple socket connections
  const socketInitialized = useRef(false);

  // ---------------- Step 4: MSE audio (realtime) ----------------
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const queueRef = useRef<ArrayBuffer[]>([]);
  const audioEndedRef = useRef(false);

  const cleanupAudio = () => {
    try {
      const audio = audioElRef.current;
      if (audio) {
        audio.pause();
        audio.src = "";
      }
    } catch {}
    audioElRef.current = null;

    try {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    } catch {}
    objectUrlRef.current = null;

    mediaSourceRef.current = null;
    sourceBufferRef.current = null;
    queueRef.current = [];
    audioEndedRef.current = false;
  };

  const endMSE = () => {
    const ms = mediaSourceRef.current;
    const sb = sourceBufferRef.current;
    if (!ms) return;

    const finalize = () => {
      try {
        if (ms.readyState === "open") ms.endOfStream();
      } catch {}
    };

    if (sb && sb.updating) sb.addEventListener("updateend", finalize, { once: true });
    else finalize();
  };

  const flushQueueIfPossible = () => {
    const sb = sourceBufferRef.current;
    if (!sb || sb.updating) return;

    const q = queueRef.current;
    if (q.length > 0) {
      const next = q.shift();
      if (next) sb.appendBuffer(next);
      return;
    }

    if (audioEndedRef.current) {
      endMSE();
    }
  };

  const initMSE = () => {
    cleanupAudio();
    audioEndedRef.current = false;

    const audio = new Audio();
    audioElRef.current = audio;

    const ms = new MediaSource();
    mediaSourceRef.current = ms;

    const url = URL.createObjectURL(ms);
    objectUrlRef.current = url;
    audio.src = url;

    ms.addEventListener("sourceopen", () => {
      try {
        const sb = ms.addSourceBuffer("audio/mpeg");
        sourceBufferRef.current = sb;
        sb.addEventListener("updateend", flushQueueIfPossible);
        flushQueueIfPossible();
      } catch (e) {
        console.error("❌ addSourceBuffer failed (is audio MP3?):", e);
      }
    });

    audio.play().catch((err) => {
      console.warn("⚠️ audio.play blocked or failed:", err);
    });
  };

  const pushAudioChunk = (buf: ArrayBuffer) => {
    const sb = sourceBufferRef.current;
    const ms = mediaSourceRef.current;

    if (!sb || !ms) {
      queueRef.current.push(buf);
      return;
    }

    if (sb.updating || queueRef.current.length > 0) {
      queueRef.current.push(buf);
      return;
    }

    try {
      sb.appendBuffer(buf);
    } catch {
      queueRef.current.push(buf);
    }
  };

  // ---------------- Step 5: debounce helpers ----------------
  function canTriggerNow(ts: number) {
    const windowMs = 5 * 60 * 1000;
    lastTriggerTimesRef.current = lastTriggerTimesRef.current.filter((t) => ts - t < windowMs);
    return lastTriggerTimesRef.current.length < 2;
  }

  function handlePresageEvent(e: SensingEvent) {
    setLastConfusion(e.confusion);
    setLastGaze(e.gaze);

    if (socket && socket.connected) {
      socket.emit("presage_event", e);
    }

    const threshold = 0.6;
    const sustainMs = 3000;

    if (!e.face_present) {
      confusedStartRef.current = null;
      return;
    }

    if (e.confusion > threshold) {
      if (confusedStartRef.current === null) confusedStartRef.current = e.ts;

      if (e.ts - (confusedStartRef.current ?? e.ts) >= sustainMs) {
        if (canTriggerNow(e.ts) && socket && socket.connected) {
          lastTriggerTimesRef.current.push(e.ts);
          confusedStartRef.current = null;
          socket.emit("user_confused", { ts: e.ts });
        }
      }
    } else {
      confusedStartRef.current = null;
    }
  }

  // ---------------- Socket setup (FIXED - prevent infinite loop) ----------------
  useEffect(() => {
    // ✅ CRITICAL FIX: Prevent multiple socket connections
    if (socketInitialized.current) {
      console.log("Socket already initialized, skipping");
      return;
    }

    socketInitialized.current = true;
    console.log("🔌 Initializing socket connection...");

    const s = io("http://localhost:3001", {
      transports: ["websocket"],
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      timeout: 10000
    });

    s.on("connect", () => {
      console.log("✅ Connected to backend");
      setIsConnected(true);
    });

    s.on("disconnect", () => {
      console.log("⚠️ Disconnected from backend");
      setIsConnected(false);
      setIsStreaming(false);
      cleanupAudio();
    });

    s.on("connect_error", (error) => {
      console.error("❌ Connection error:", error.message);
    });

    s.on("stream_chunk", (data: string) => {
      console.log("📦 Received chunk");
      setAnswer((prev) => prev + data);
    });

    s.on("stream_end", () => {
      console.log("🏁 Stream ended");
      setIsStreaming(false);
    });

    s.on("audio_chunk", (data: ArrayBuffer) => {
      pushAudioChunk(data);
    });

    s.on("audio_end", () => {
      audioEndedRef.current = true;
      flushQueueIfPossible();
    });

    s.on("session_summary", (summary) => {
      console.log("📊 Session summary received:", summary);

      try {
        localStorage.setItem("studybuddy_session_summary", JSON.stringify(summary));
      } catch (e) {
        console.warn("Could not write session summary to localStorage:", e);
      }

      router.push("/dashboard");
    });

    s.on("stream_error", (error: string) => {
      console.error("❌ Stream error:", error);
      setAnswer("Error: " + error);
      setIsStreaming(false);
      cleanupAudio();
    });

    setSocket(s);

    return () => {
      console.log("🧹 Cleaning up socket");
      socketInitialized.current = false;
      s.off();
      s.close();
      cleanupAudio();
    };
  }, [router]); // ✅ Only router in deps

  // ---------------- OpenCV sensing start/stop (FIXED - prevent restart loop) ----------------
  useEffect(() => {
  if (!sensingEnabled) {
    stopCvRef.current?.();
    stopCvRef.current = null;
    return;
  }

  if (!cvReady) return;

  let cancelled = false;
  let timeoutId: any;

  timeoutId = setTimeout(() => {
    if (cancelled) return;
    if (!videoRef.current || !canvasRef.current) return;

    startCvSensing(
      videoRef.current,
      canvasRef.current,
      (e) => {
        if (cancelled) return;
        handlePresageEvent(e);
      },
      { intervalMs: 350, targetWidth: 320 }
    )
      .then((stop) => {
        stopCvRef.current = stop;
      })
      .catch((err) => {
        console.error("❌ CV start failed:", err);
      });
  }, 500);

  return () => {
    cancelled = true;
    clearTimeout(timeoutId);
    stopCvRef.current?.();
    stopCvRef.current = null;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [sensingEnabled, cvReady]);

  // ---------------- Actions ----------------
  const askQuestion = () => {
    if (!question.trim()) {
      alert("Please enter a question");
      return;
    }

    if (!socket || !socket.connected) {
      alert("Not connected to server");
      return;
    }

    console.log("📤 Sending question:", question);
    setAnswer("");
    setIsStreaming(true);

    // Start MSE before audio arrives
    initMSE();

    socket.emit("ask_stream", { question });

    // Add timeout
    const timeout = setTimeout(() => {
      if (isStreaming) {
        console.error("⏱️ Request timeout");
        setAnswer("Request timed out. Please try again.");
        setIsStreaming(false);
      }
    }, 30000);

    socket.once("stream_end", () => clearTimeout(timeout));
  };

  const endSession = () => {
    if (!socket || !socket.connected) return;
    socket.emit("end_session");
  };

  return (
    <div style={{ padding: 16, maxWidth: 900 }}>
      {/* ✅ OpenCV.js CDN loader */}
      <Script
        src="https://docs.opencv.org/4.x/opencv.js"
        strategy="afterInteractive"
        onLoad={() => {
          console.log("✅ OpenCV.js loaded");
          setCvReady(true);
        }}
        onError={() => {
          console.error("❌ Failed to load OpenCV.js");
          setCvReady(false);
        }}
      />

      <h1 style={{ fontSize: 28, fontWeight: 800 }}>StudyBuddy</h1>

      <div style={{ marginTop: 12 }}>
        <b>Status:</b> {isConnected ? "✅ Connected" : "⚠️ Disconnected"}
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 12,
          border: "1px solid #ddd",
          borderRadius: 10,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center"
        }}
      >
        <div>
          <div style={{ fontWeight: 700 }}>Attention & confusion sensing (OpenCV)</div>
          <div style={{ fontSize: 12, color: "#555" }}>
            Opt-in only. Uses your webcam locally to generate small numeric signals.
          </div>
          <div style={{ fontSize: 12, color: "#777", marginTop: 4 }}>
            OpenCV loaded: {cvReady ? "✅ Yes" : "⏳ Loading..."}
          </div>
        </div>

        <button
          onClick={() => setSensingEnabled((v) => !v)}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #333",
            cursor: isConnected && cvReady ? "pointer" : "not-allowed",
            opacity: isConnected && cvReady ? 1 : 0.5
          }}
          disabled={!isConnected || !cvReady}
          title={!cvReady ? "OpenCV is still loading..." : ""}
        >
          {sensingEnabled ? "Disable" : "Enable"}
        </button>
      </div>

      {sensingEnabled && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#444" }}>
          <b>Live signals:</b> gaze={lastGaze}, confusion={lastConfusion.toFixed(2)} (threshold 0.60)
        </div>
      )}

      <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !isStreaming && askQuestion()}
          placeholder="Ask a question..."
          style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
          disabled={!isConnected || isStreaming}
        />

        <button
          onClick={endSession}
          style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #333" }}
          disabled={!isConnected}
        >
          End Session
        </button>

        <button
          onClick={askQuestion}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #333",
            cursor: isConnected && !isStreaming && question.trim() ? "pointer" : "not-allowed",
            opacity: isConnected && !isStreaming && question.trim() ? 1 : 0.5
          }}
          disabled={!isConnected || isStreaming || !question.trim()}
        >
          {isStreaming ? "Asking..." : "Ask"}
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Answer</div>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            padding: 12,
            border: "1px solid #ddd",
            borderRadius: 10,
            minHeight: 140,
            backgroundColor: "#f9f9f9"
          }}
        >
          {answer || (isConnected ? "Upload notes via curl, then ask a question..." : "Connecting to server...")}
        </pre>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
        Confusion trigger rule: confusion &gt; 0.60 for 3 seconds, max 2 triggers per 5 minutes.
      </div>

      {/* ✅ Hidden elements required for CV sensing */}
      <video ref={videoRef} style={{ display: "none" }} playsInline muted />
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}