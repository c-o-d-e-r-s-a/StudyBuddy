"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";
import Script from "next/script";

// ✅ OpenCV sensing module
import { startCvSensing, SensingEvent } from "@/src/lib/cvSensor";
import { recordAndTranscribe } from "@/src/lib/audioProcessing";

export default function StudyPage() {
  const [answer, setAnswer] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [question, setQuestion] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const router = useRouter();

  // ✅ OpenCV state
  const [cvReady, setCvReady] = useState(false);
  const [sensingEnabled, setSensingEnabled] = useState(false);

  // ✅ Camera initialization state
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // ✅ Audio recording state
  const [isRecording, setIsRecording] = useState(false);

  // ✅ Refs - CRITICAL FIX: Use refs instead of state for frequent updates
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stopCvRef = useRef<null | (() => void)>(null);
  const socketInitialized = useRef(false);
  const confusedStartRef = useRef<number | null>(null);
  const lastTriggerTimesRef = useRef<number[]>([]);
  const cameraInitStartedRef = useRef(false);

  // ✅ Audio streaming refs
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const queueRef = useRef<ArrayBuffer[]>([]);
  const audioEndedRef = useRef(false);

  // ✅ CRITICAL FIX: Use refs for sensing data to PREVENT re-renders
  const lastConfusionRef = useRef<number>(0);
  const lastGazeRef = useRef<"on_screen" | "away">("on_screen");

  // ✅ State only for UI display (update less frequently)
  const [displayConfusion, setDisplayConfusion] = useState<number>(0);
  const [displayGaze, setDisplayGaze] = useState<"on_screen" | "away">("on_screen");
  const [updateCounter, setUpdateCounter] = useState(0); // Force UI update every N frames

  // ==================== CAMERA INITIALIZATION ====================
  useEffect(() => {
    if (cameraInitStartedRef.current || !cvReady) return;
    cameraInitStartedRef.current = true;

    (async () => {
      try {
        console.log("📷 Requesting camera permission...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false
        });

        if (!videoRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        videoRef.current.srcObject = stream;
        
        // Wait for metadata
        await new Promise<void>((resolve) => {
          const onLoadedMetadata = () => {
            videoRef.current?.removeEventListener("loadedmetadata", onLoadedMetadata);
            resolve();
          };
          videoRef.current?.addEventListener("loadedmetadata", onLoadedMetadata);
          videoRef.current?.play().catch(() => {});
        });

        console.log("✅ Camera ready");
        setCameraReady(true);
        setCameraError(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("❌ Camera error:", msg);
        setCameraError(msg);
        setCameraReady(false);
      }
    })();

    return () => {};
  }, [cvReady]);

  // ==================== SENSING EVENTS - CRITICAL FIX ====================
  // ✅ CRITICAL: Use useCallback to memoize, prevent re-creation on every render
  const handleSensingEvent = useCallback((e: SensingEvent) => {
    // ✅ CRITICAL FIX: Store in refs to AVOID state updates every frame
    lastConfusionRef.current = e.confusion;
    lastGazeRef.current = e.gaze;

    // ✅ Only emit socket event, don't update state
    if (socket?.connected) {
      socket.emit("presage_event", e);
    }

    // ✅ Auto-clarification on sustained confusion
    if (e.confusion > 0.6) {
      if (!confusedStartRef.current) confusedStartRef.current = e.ts;
      
      if (e.ts - (confusedStartRef.current ?? 0) > 3000) {
        const windowMs = 5 * 60 * 1000;
        lastTriggerTimesRef.current = lastTriggerTimesRef.current.filter(
          (t) => e.ts - t < windowMs
        );

        if (lastTriggerTimesRef.current.length < 2 && socket?.connected) {
          console.log("🤔 Detected confusion, requesting clarification...");
          socket.emit("user_confused", { ts: e.ts });
          lastTriggerTimesRef.current.push(e.ts);
          confusedStartRef.current = null;
        }
      }
    } else {
      confusedStartRef.current = null;
    }
  }, [socket]);

  // ✅ CRITICAL FIX: Throttle UI updates (only update display every 1 second)
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayConfusion(lastConfusionRef.current);
      setDisplayGaze(lastGazeRef.current);
    }, 1000); // Update UI every 1 second instead of every frame
    
    return () => clearInterval(interval);
  }, []);

  // ==================== SENSING TOGGLE ====================
  useEffect(() => {
    if (!sensingEnabled || !cameraReady) {
      stopCvRef.current?.();
      stopCvRef.current = null;
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        if (!videoRef.current || !canvasRef.current) return;

        const stop = await startCvSensing(
          videoRef.current,
          canvasRef.current,
          handleSensingEvent,  // ✅ Uses memoized callback
          { intervalMs: 2000, targetWidth: 120 } // ✅ OPTIMIZED: Changed from (350, 320) to (2000, 120)
        );

        if (!cancelled) stopCvRef.current = stop;
      } catch (err) {
        console.error("❌ CV start failed:", err);
        if (!cancelled) setSensingEnabled(false);
      }
    })();

    return () => {
      cancelled = true;
      stopCvRef.current?.();
      stopCvRef.current = null;
    };
  }, [sensingEnabled, cameraReady, handleSensingEvent]);

  // ==================== SOCKET CONNECTION ====================
  useEffect(() => {
    if (socketInitialized.current) return;
    socketInitialized.current = true;

    console.log("🔌 Connecting to backend...");
    const s = io("http://localhost:3001", {
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    s.on("connect", () => {
      console.log("✅ Socket connected");
      setIsConnected(true);
    });

    s.on("disconnect", () => {
      console.log("⚠️ Socket disconnected");
      setIsConnected(false);
      setIsStreaming(false);
      cleanupAudio();
    });

    s.on("stream_chunk", (data: string) => {
      setAnswer((prev) => prev + data);
    });

    s.on("stream_end", () => {
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
      localStorage.setItem("studybuddy_session_summary", JSON.stringify(summary));
      router.push("/dashboard");
    });

    s.on("stream_error", (error: string) => {
      console.error("❌ Error:", error);
      setAnswer("Error: " + error);
      setIsStreaming(false);
      cleanupAudio();
    });

    s.on("presage_event", (e) => {
      // Silently handle - don't log on every event
    });

    setSocket(s);

    return () => {
      socketInitialized.current = false;
      s.off();
      s.close();
      cleanupAudio();
    };
  }, [router]);

  // ==================== AUDIO STREAMING ====================
  const cleanupAudio = () => {
    try {
      audioElRef.current?.pause();
      if (audioElRef.current) audioElRef.current.src = "";
    } catch {}
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    mediaSourceRef.current = null;
    sourceBufferRef.current = null;
    objectUrlRef.current = null;
    queueRef.current = [];
    audioEndedRef.current = false;
  };

  const initMSE = () => {
    cleanupAudio();

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
        console.error("❌ SourceBuffer error:", e);
      }
    });

    audio.play().catch(() => {});
  };

  const pushAudioChunk = (chunk: ArrayBuffer) => {
    const sb = sourceBufferRef.current;
    if (!sb) {
      queueRef.current.push(chunk);
      return;
    }
    if (sb.updating) {
      queueRef.current.push(chunk);
    } else {
      try {
        sb.appendBuffer(chunk);
      } catch (e) {
        console.error("❌ appendBuffer error:", e);
        queueRef.current.push(chunk);
      }
    }
  };

  const flushQueueIfPossible = () => {
    const sb = sourceBufferRef.current;
    if (!sb || sb.updating) return;

    if (queueRef.current.length > 0) {
      const next = queueRef.current.shift();
      if (next) sb.appendBuffer(next);
      return;
    }

    if (audioEndedRef.current) {
      try {
        if (mediaSourceRef.current?.readyState === "open") {
          mediaSourceRef.current.endOfStream();
        }
      } catch {}
    }
  };

  // ==================== ACTIONS ====================
  const askQuestion = () => {
    if (!question.trim()) return alert("Enter a question");
    if (!socket?.connected) return alert("Not connected");

    console.log("📤 Asking:", question);
    setAnswer("");
    setIsStreaming(true);
    initMSE();
    socket.emit("ask_stream", { question });
  };

  const handleVoiceInput = async () => {
    if (!socket?.connected) return alert("Not connected");
    if (isRecording) return;

    try {
      setIsRecording(true);
      console.log("🎤 Recording...");
      const text = await recordAndTranscribe(5000);
      
      if (text.trim()) {
        setQuestion(text);
        setAnswer("");
        setIsStreaming(true);
        initMSE();
        socket.emit("ask_stream", { question: text });
      }
    } catch (err) {
      console.error("❌ Recording error:", err);
      alert("Voice input failed: " + String(err));
    } finally {
      setIsRecording(false);
    }
  };

  const endSession = () => {
    if (socket?.connected) {
      socket.emit("end_session");
    }
  };

  return (
    <div style={{ padding: 16, maxWidth: 1000 }}>
      <Script
        src="https://docs.opencv.org/4.x/opencv.js"
        strategy="afterInteractive"
        onLoad={() => {
          console.log("✅ OpenCV.js loaded");
          setCvReady(true);
        }}
        onError={() => {
          console.error("❌ OpenCV.js failed");
          setCvReady(false);
        }}
      />

      <h1 style={{ fontSize: 32, fontWeight: 800 }}>StudyBuddy</h1>

      {/* ✅ STATUS BAR */}
      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
        <div style={{ fontSize: 14 }}>
          <b>Connection:</b> {isConnected ? "✅ Connected" : "⚠️ Disconnected"}
          <span style={{ marginLeft: 20 }}>
            <b>OpenCV:</b> {cvReady ? "✅ Loaded" : "⏳ Loading"}
          </span>
          <span style={{ marginLeft: 20 }}>
            <b>Camera:</b> {cameraReady ? "✅ Ready" : cameraError ? "❌ Error" : "⏳ Init"}
          </span>
        </div>
        {cameraError && <div style={{ color: "red", marginTop: 8, fontSize: 12 }}>Error: {cameraError}</div>}
      </div>

      {/* ✅ SENSING SECTION */}
      <div
        style={{
          marginTop: 16,
          padding: 12,
          border: "1px solid #ddd",
          borderRadius: 10,
          backgroundColor: sensingEnabled ? "#f0f8f0" : "#f9f9f9"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>🎥 Attention Sensing</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
              Camera monitors attention & auto-clarifies if confusion detected
            </div>
            {sensingEnabled && (
              <div style={{ fontSize: 11, color: "#444", marginTop: 6 }}>
                <b>Live:</b> gaze={displayGaze} | confusion={displayConfusion.toFixed(2)}
              </div>
            )}
          </div>
          <button
            onClick={() => setSensingEnabled(!sensingEnabled)}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "none",
              backgroundColor: sensingEnabled ? "#ff6b6b" : "#4CAF50",
              color: "white",
              cursor: cameraReady ? "pointer" : "not-allowed",
              opacity: cameraReady ? 1 : 0.5,
              fontWeight: "bold"
            }}
            disabled={!cameraReady}
          >
            {sensingEnabled ? "🔴 Stop" : "🎥 Start"}
          </button>
        </div>
      </div>

      {/* ✅ QUESTION INPUT */}
      <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && !isStreaming && askQuestion()}
          placeholder="Ask a question or use voice button..."
          style={{
            flex: 1,
            minWidth: 200,
            padding: 12,
            borderRadius: 8,
            border: "1px solid #ccc",
            fontSize: 14
          }}
          disabled={!isConnected || isStreaming}
        />

        <button
          onClick={handleVoiceInput}
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            border: "none",
            backgroundColor: isRecording ? "#ff9800" : "#2196F3",
            color: "white",
            cursor: isConnected ? "pointer" : "not-allowed",
            opacity: isConnected ? 1 : 0.5,
            fontWeight: "bold"
          }}
          disabled={!isConnected}
          title="Record voice question"
        >
          {isRecording ? "🎤 Recording..." : "🎤 Voice"}
        </button>

        <button
          onClick={askQuestion}
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            border: "none",
            backgroundColor: "#4CAF50",
            color: "white",
            cursor: isConnected && !isStreaming && question.trim() ? "pointer" : "not-allowed",
            opacity: isConnected && !isStreaming && question.trim() ? 1 : 0.5,
            fontWeight: "bold"
          }}
          disabled={!isConnected || isStreaming || !question.trim()}
        >
          {isStreaming ? "⏳ Asking..." : "📤 Ask"}
        </button>

        <button
          onClick={endSession}
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            border: "1px solid #333",
            backgroundColor: "transparent",
            cursor: isConnected ? "pointer" : "not-allowed",
            opacity: isConnected ? 1 : 0.5
          }}
          disabled={!isConnected}
        >
          End Session
        </button>
      </div>

      {/* ✅ ANSWER DISPLAY */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Answer</div>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            padding: 14,
            border: "1px solid #ddd",
            borderRadius: 10,
            minHeight: 200,
            backgroundColor: "#f9f9f9",
            fontSize: 14,
            lineHeight: 1.6,
            color: answer ? "#000" : "#999"
          }}
        >
          {answer || (isConnected ? "Upload notes via curl, then ask..." : "Connecting...")}
        </pre>
      </div>

      {/* ✅ HIDDEN ELEMENTS */}
      <video ref={videoRef} style={{ display: "none" }} playsInline muted />
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}