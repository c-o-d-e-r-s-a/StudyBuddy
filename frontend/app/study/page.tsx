"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";
import Script from "next/script";

<<<<<<< Updated upstream
import { startCvSensing, SensingEvent } from "@/src/lib/cvSensor";
=======
import { SimulatedSensingEngine } from "@/src/lib/simulatedSensing";
>>>>>>> Stashed changes
import { recordAndTranscribe } from "@/src/lib/audioProcessing";

// ============== TYPES ==============
interface Question {
  id: string;
  text: string;
  timestamp: number;
}

type StudentState = "confident" | "distracted" | "confused" | "idle";

// ============== MAIN COMPONENT ==============
export default function StudyPage() {
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);

  // === Study State ===
  const [sessionActive, setSessionActive] = useState(false);
  const [studentState, setStudentState] = useState<StudentState>("idle");
  const [distraction, setDistraction] = useState(0);

<<<<<<< Updated upstream
  // ✅ Camera state
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
=======
  // === Notes ===
  const [notesReady, setNotesReady] = useState(false);
  const [notesFile, setNotesFile] = useState<string | null>(null);
>>>>>>> Stashed changes

  // === Conversation ===
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [recentQuestions, setRecentQuestions] = useState<Question[]>([]);

<<<<<<< Updated upstream
  // ✅ Distraction metrics (SIMPLIFIED - no confusion)
  const [lastDistraction, setLastDistraction] = useState<number>(0);
  const [lastGaze, setLastGaze] = useState<"on_screen" | "away">("on_screen");
  const [processingTimeMs, setProcessingTimeMs] = useState(0);

  // ✅ Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stopCvRef = useRef<null | (() => void)>(null);
  const socketInitialized = useRef(false);
  const cameraInitStartedRef = useRef(false);

  // ✅ Audio refs
=======
  // === Audio/Recording ===
  const [isListening, setIsListening] = useState(false);
  const [listeningCountdown, setListeningCountdown] = useState(0);

  // === Internals ===
  const socketInitRef = useRef(false);
  const sensingEngineRef = useRef<SimulatedSensingEngine | null>(null);
  const sensingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const confusionTimestampRef = useRef<number | null>(null);
>>>>>>> Stashed changes
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const queueRef = useRef<ArrayBuffer[]>([]);
  const audioEndedRef = useRef(false);

<<<<<<< Updated upstream
  // ==================== CAMERA INITIALIZATION ====================
  const initializeCamera = async () => {
    if (cameraInitStartedRef.current || !cvReady) return;
    cameraInitStartedRef.current = true;

    try {
      console.log("📷 Requesting camera permission...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      if (!videoRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      videoRef.current.srcObject = stream;

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
  };
=======
  // ==================== SOCKET CONNECTION ====================
  useEffect(() => {
    if (socketInitRef.current) return;
    socketInitRef.current = true;

    try {
      const s = io("http://localhost:3001", {
        transports: ["websocket"],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      s.on("connect", () => {
        console.log("[StudyBuddy] Connected");
      });

      s.on("disconnect", () => {
        console.log("[StudyBuddy] Disconnected");
      });

      s.on("stream_chunk", (data: string) => {
        setAnswer((prev) => prev + data);
      });

      s.on("stream_end", () => {
        setIsThinking(false);
        setIsSpeaking(true);
        // Audio is now playing, speaking indicator stays until audio_end
      });

      s.on("audio_chunk", (data: ArrayBuffer) => {
        pushAudioChunk(data);
      });

      s.on("audio_end", () => {
        audioEndedRef.current = true;
        flushQueueIfPossible();
        setIsSpeaking(false);
      });

      s.on("session_summary", () => {
        try {
          router.push("/dashboard");
        } catch (err) {
          console.error("[StudyBuddy] Navigation error:", err);
        }
      });

      s.on("stream_error", (error: string) => {
        console.error("[StudyBuddy] Stream error:", error);
        setIsThinking(false);
        setAnswer("I encountered an issue. Please try again.");
      });

      setSocket(s);

      return () => {
        socketInitRef.current = false;
        s.off();
        s.close();
        cleanupAudio();
      };
    } catch (err) {
      console.error("[StudyBuddy] Socket setup failed:", err);
    }
  }, [router]);
>>>>>>> Stashed changes

  // ==================== SIMULATED SENSING ====================
  useEffect(() => {
    if (!sessionActive) {
      if (sensingIntervalRef.current) clearInterval(sensingIntervalRef.current);
      sensingEngineRef.current = null;
      setStudentState("idle");
      return;
    }

    if (!sensingEngineRef.current) {
      sensingEngineRef.current = new SimulatedSensingEngine();
    }

    sensingIntervalRef.current = setInterval(() => {
      const event = sensingEngineRef.current!.getEvent();

<<<<<<< Updated upstream
        const stop = await startCvSensing(
          videoRef.current,
          canvasRef.current,
          (e) => {
            if (!cancelled) handleSensingEvent(e);
          },
          { intervalMs: 350, targetWidth: 320, detectionIntervalMs: 500 }
        );

        if (!cancelled) stopCvRef.current = stop;
      } catch (err) {
        console.error("❌ CV start failed:", err);
        if (!cancelled) setSensingEnabled(false);
=======
      // Determine state from distraction
      let state: StudentState = "confident";
      if (event.distraction < 0.3) {
        state = "confident";
      } else if (event.distraction < 0.7) {
        state = "distracted";
      } else {
        state = "confused";
>>>>>>> Stashed changes
      }

      setDistraction(event.distraction);
      setStudentState(state);

      // Send to backend
      if (socket?.connected) {
        socket.emit("presage_event", {
          ts: event.ts,
          face_present: event.face_present,
          gaze: event.gaze,
          distraction: event.distraction,
        });
      }

      // === PROACTIVE HELP: Trigger on confusion ===
      if (state === "confused" && !confusionTimestampRef.current) {
        confusionTimestampRef.current = Date.now();
        handleConfusionDetected();
      } else if (state !== "confused") {
        confusionTimestampRef.current = null;
      }
    }, 500);

    return () => {
      if (sensingIntervalRef.current) clearInterval(sensingIntervalRef.current);
    };
  }, [sessionActive, socket]);

  // ==================== PROACTIVE CONFUSION HELP ====================
  const handleConfusionDetected = async () => {
    try {
      console.log("[StudyBuddy] Confusion detected, offering help...");

<<<<<<< Updated upstream
    console.log("🔌 Connecting to backend...");
    const s = io("http://localhost:3001", {
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
=======
      if (socket?.connected) {
        setIsThinking(true);
        initMSE();
>>>>>>> Stashed changes

        socket.emit("confusion_prompt", {
          message: "You look confused. Would you like me to explain this more clearly?",
          ts: Date.now(),
        });

        // Wait for audio to finish
        await new Promise<void>((resolve) => {
          const maxWait = setTimeout(() => resolve(), 6000);
          const checkEnd = setInterval(() => {
            if (!isSpeaking) {
              clearInterval(checkEnd);
              clearTimeout(maxWait);
              resolve();
            }
          }, 100);
        });
      }

      // Start listening for response
      setIsListening(true);
      setListeningCountdown(5);

      const transcript = await recordAndTranscribe(5000);

      if (!transcript.trim()) {
        setIsListening(false);
        setListeningCountdown(0);
        return;
      }

      // Check for dismissal
      const dismissPatterns = [
        /no\s*thanks/i,
        /i'm\s*good/i,
        /i'm\s*fine/i,
        /nothing/i,
        /never\s*mind/i,
      ];

      const shouldDismiss = dismissPatterns.some((p) => p.test(transcript));
      if (shouldDismiss) {
        console.log("[StudyBuddy] User dismissed help");
        setIsListening(false);
        setListeningCountdown(0);
        return;
      }

      // Send question
      console.log("[StudyBuddy] Sending confusion-triggered question:", transcript);
      setCurrentQuestion(transcript);
      setAnswer("");
      setIsThinking(true);
      initMSE();
      setIsListening(false);
      setListeningCountdown(0);

<<<<<<< Updated upstream
    setSocket(s);

    return () => {
      socketInitialized.current = false;
      s.off();
      s.close();
      cleanupAudio();
    };
  }, [router]);
=======
      if (socket?.connected) {
        socket.emit("ask_stream", { question: transcript });

        // Track question
        setRecentQuestions((prev) => [
          {
            id: Date.now().toString(),
            text: transcript,
            timestamp: Date.now(),
          },
          ...prev.slice(0, 4),
        ]);
      }
    } catch (err) {
      console.error("[StudyBuddy] Confusion flow error:", err);
      setIsListening(false);
      setListeningCountdown(0);
    }
  };
>>>>>>> Stashed changes

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

    try {
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
          console.error("[StudyBuddy] SourceBuffer error:", e);
        }
      });

      audio.play().catch(() => {
        // Autoplay blocked, user interaction needed
      });
    } catch (err) {
      console.error("[StudyBuddy] MSE init error:", err);
    }
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
        console.error("[StudyBuddy] appendBuffer error:", e);
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

<<<<<<< Updated upstream
  // ==================== SENSING EVENTS ====================
  // ✅ SIMPLIFIED: Only track distraction (head movement)
  function handleSensingEvent(e: SensingEvent) {
    setLastDistraction(e.distraction);
    setLastGaze(e.gaze);
    setProcessingTimeMs(e.processingTimeMs);

    // Send to backend for logging
    if (socket?.connected) {
      socket.emit("presage_event", {
        ts: e.ts,
        face_present: e.face_present,
        gaze: e.gaze,
        distraction: e.distraction,
      });
    }
  }

  // ==================== ACTIONS ====================
  const handleStartSensing = async () => {
    if (!cameraReady) {
      console.log("📷 Initializing camera...");
      await initializeCamera();
    }
    setSensingEnabled(true);
  };

  const askQuestion = () => {
    if (!question.trim()) return alert("Enter a question");
    if (!socket?.connected) return alert("Not connected");
=======
  // ==================== ACTIONS ====================
  const handleStartSession = () => {
    if (!notesReady) {
      alert("Please upload or use sample notes first");
      return;
    }
    setSessionActive(true);
  };
>>>>>>> Stashed changes

  const handleUploadNotes = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setNotesFile(text.slice(0, 500)); // Show preview
      setNotesReady(true);
      console.log("[StudyBuddy] Notes loaded");
    } catch (err) {
      console.error("[StudyBuddy] Notes upload error:", err);
      alert("Failed to load notes");
    }
  };

  const handleUseSampleNotes = () => {
    // Hardcoded sample notes for demo
    const sampleNotes = `
# Biology: Photosynthesis

Photosynthesis is the process by which plants convert light energy into chemical energy.

## Light Reactions
- Occur in thylakoid membranes
- Absorb light energy
- Produce ATP and NADPH
- Release oxygen as byproduct

## Calvin Cycle
- Occurs in stroma
- Uses ATP and NADPH from light reactions
- Produces glucose
- Also called dark reactions (though not accurate)

## Key Equations
6CO2 + 6H2O + light → C6H12O6 + 6O2

## Chlorophyll
- Pigment that absorbs light
- Located in chloroplasts
- Green color absorbs red and blue light best
    `;
    setNotesFile(sampleNotes.slice(0, 500));
    setNotesReady(true);
    console.log("[StudyBuddy] Sample notes loaded");
  };

  const handleAskQuestion = async () => {
    if (!currentQuestion.trim() || !socket?.connected || isThinking) return;

    try {
      setAnswer("");
      setIsThinking(true);
      initMSE();

      socket.emit("ask_stream", { question: currentQuestion });

      // Track question
      setRecentQuestions((prev) => [
        {
          id: Date.now().toString(),
          text: currentQuestion,
          timestamp: Date.now(),
        },
        ...prev.slice(0, 4),
      ]);

      setCurrentQuestion("");
    } catch (err) {
      console.error("[StudyBuddy] Ask error:", err);
      setIsThinking(false);
    }
  };

  const handleVoiceInput = async () => {
    if (!socket?.connected || isThinking || isListening) return;

    try {
<<<<<<< Updated upstream
      setIsRecording(true);
      console.log("🎤 Recording...");
      const text = await recordAndTranscribe(5000);

      if (text.trim()) {
        setQuestion(text);
        setAnswer("");
        setIsStreaming(true);
        initMSE();
        socket.emit("ask_stream", { question: text });
      } else {
        alert("No speech detected");
=======
      setIsListening(true);
      setListeningCountdown(5);

      const transcript = await recordAndTranscribe(5000);

      if (!transcript.trim()) {
        setIsListening(false);
        setListeningCountdown(0);
        return;
>>>>>>> Stashed changes
      }

      setCurrentQuestion(transcript);
      setIsListening(false);
      setListeningCountdown(0);

      // Auto-ask
      setAnswer("");
      setIsThinking(true);
      initMSE();
      socket.emit("ask_stream", { question: transcript });

      setRecentQuestions((prev) => [
        {
          id: Date.now().toString(),
          text: transcript,
          timestamp: Date.now(),
        },
        ...prev.slice(0, 4),
      ]);
    } catch (err) {
      console.error("[StudyBuddy] Voice input error:", err);
      setIsListening(false);
      setListeningCountdown(0);
    }
  };

  const handleEndSession = () => {
    setSessionActive(false);
    if (socket?.connected) {
      socket.emit("end_session");
    }
  };

  const handleRecentQuestion = (question: string) => {
    setCurrentQuestion(question);
  };

  // ==================== RENDER ====================

  return (
<<<<<<< Updated upstream
    <div style={{ padding: 16, maxWidth: 1200 }}>
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
=======
    <div style={styles.root}>
      {/* ===== BACKGROUND ===== */}
      <div style={styles.bgGradient} />
      <div style={styles.bgGlow1} />
      <div style={styles.bgGlow2} />
>>>>>>> Stashed changes

      {/* ===== MAIN CONTENT ===== */}
      <div style={styles.container}>
        {/* ===== HEADER ===== */}
        <header style={styles.header}>
          <h1 style={styles.title}>StudyBuddy</h1>
          <p style={styles.subtitle}>Your AI Study Companion</p>
        </header>

<<<<<<< Updated upstream
      {/* ✅ STATUS BAR */}
      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
        <div style={{ fontSize: 14 }}>
          <b>Connection:</b> {isConnected ? "✅ Connected" : "⚠️ Disconnected"}
          <span style={{ marginLeft: 20 }}>
            <b>OpenCV:</b> {cvReady ? "✅ Loaded" : "⏳ Loading"}
          </span>
          <span style={{ marginLeft: 20 }}>
            <b>Camera:</b>{" "}
            {cameraReady ? "✅ Ready" : cameraError ? "❌ Error" : "⏳ Not init"}
          </span>
        </div>
        {cameraError && (
          <div style={{ color: "red", marginTop: 8, fontSize: 12 }}>
            Error: {cameraError}
          </div>
        )}
      </div>

      {/* ✅ DISTRACTION SENSING SECTION */}
      <div
        style={{
          marginTop: 16,
          padding: 12,
          border: "1px solid #ddd",
          borderRadius: 10,
          backgroundColor: sensingEnabled ? "#f0f8f0" : "#f9f9f9",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>📹 Distraction Detection</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
              Monitors head movement to detect distraction
            </div>
            {sensingEnabled && (
              <div style={{ fontSize: 11, color: "#444", marginTop: 6, fontFamily: "monospace" }}>
                <div>
                  <b>Distraction:</b> {(lastDistraction * 100).toFixed(0)}% | <b>Gaze:</b> {lastGaze}
                </div>
                <div>
                  <b>Processing:</b> {processingTimeMs.toFixed(1)}ms
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              if (!sensingEnabled) {
                handleStartSensing();
              } else {
                setSensingEnabled(false);
              }
            }}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "none",
              backgroundColor: sensingEnabled ? "#ff6b6b" : "#4CAF50",
              color: "white",
              cursor: cvReady ? "pointer" : "not-allowed",
              opacity: cvReady ? 1 : 0.5,
              fontWeight: "bold",
            }}
            disabled={!cvReady}
          >
            {sensingEnabled ? "🔴 Stop" : "📹 Start"}
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
            fontSize: 14,
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
            cursor: isConnected && !isStreaming ? "pointer" : "not-allowed",
            opacity: isConnected && !isStreaming ? 1 : 0.5,
            fontWeight: "bold",
          }}
          disabled={!isConnected || isStreaming}
          title="Record voice question (5 seconds)"
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
            fontWeight: "bold",
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
            opacity: isConnected ? 1 : 0.5,
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
            color: answer ? "#000" : "#999",
          }}
        >
          {answer || (isConnected ? "📝 Ask a question to get started..." : "🔌 Connecting...")}
        </pre>
      </div>

      {/* ✅ HIDDEN ELEMENTS */}
      <video ref={videoRef} style={{ display: "none" }} playsInline muted />
      <canvas ref={canvasRef} style={{ display: "none" }} />
=======
        {!sessionActive ? (
          // ===== SETUP SCREEN ===== 
          <SetupScreen
            notesReady={notesReady}
            notesFile={notesFile}
            onUploadNotes={handleUploadNotes}
            onUseSampleNotes={handleUseSampleNotes}
            onStartSession={handleStartSession}
          />
        ) : (
          // ===== STUDY SCREEN =====
          <StudyScreen
            studentState={studentState}
            distraction={distraction}
            notesReady={notesReady}
            currentQuestion={currentQuestion}
            answer={answer}
            isThinking={isThinking}
            isSpeaking={isSpeaking}
            isListening={isListening}
            listeningCountdown={listeningCountdown}
            recentQuestions={recentQuestions}
            onQuestionChange={setCurrentQuestion}
            onAskQuestion={handleAskQuestion}
            onVoiceInput={handleVoiceInput}
            onRecentQuestion={handleRecentQuestion}
            onEndSession={handleEndSession}
          />
        )}
      </div>
>>>>>>> Stashed changes
    </div>
  );
}

// ============== SETUP SCREEN ==============
function SetupScreen({
  notesReady,
  notesFile,
  onUploadNotes,
  onUseSampleNotes,
  onStartSession,
}: {
  notesReady: boolean;
  notesFile: string | null;
  onUploadNotes: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUseSampleNotes: () => void;
  onStartSession: () => void;
}) {
  return (
    <div style={styles.setupScreen}>
      <div style={styles.setupCard}>
        <h2 style={styles.setupTitle}>📚 Your Study Notes</h2>
        <p style={styles.setupSubtitle}>Upload notes so StudyBuddy can help you learn</p>

        {!notesReady ? (
          <div style={styles.uploadSection}>
            <label style={styles.uploadInput}>
              <span style={styles.uploadButton}>📄 Upload .txt File</span>
              <input
                type="file"
                accept=".txt"
                onChange={onUploadNotes}
                style={{ display: "none" }}
              />
            </label>

            <div style={styles.divider}>or</div>

            <button style={styles.secondaryButton} onClick={onUseSampleNotes}>
              ✨ Use Sample Notes (Biology)
            </button>
          </div>
        ) : (
          <div style={styles.notesPreview}>
            <div style={styles.notesPreviewLabel}>✅ Notes Ready</div>
            {notesFile && (
              <div style={styles.notesPreviewText}>{notesFile}...</div>
            )}
            <button style={styles.primaryButton} onClick={onStartSession}>
              🎓 Start Study Session
            </button>
          </div>
        )}
      </div>

      <div style={styles.infoCards}>
        <div style={styles.infoCard}>
          <div style={styles.infoIcon}>🎯</div>
          <div style={styles.infoText}>
            <strong>Smart Responses</strong>
            <p>AI learns from your notes</p>
          </div>
        </div>
        <div style={styles.infoCard}>
          <div style={styles.infoIcon}>🎤</div>
          <div style={styles.infoText}>
            <strong>Voice & Text</strong>
            <p>Ask questions however you want</p>
          </div>
        </div>
        <div style={styles.infoCard}>
          <div style={styles.infoIcon}>👁️</div>
          <div style={styles.infoText}>
            <strong>AI Awareness</strong>
            <p>StudyBuddy notices when you struggle</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============== STUDY SCREEN ==============
function StudyScreen({
  studentState,
  distraction,
  notesReady,
  currentQuestion,
  answer,
  isThinking,
  isSpeaking,
  isListening,
  listeningCountdown,
  recentQuestions,
  onQuestionChange,
  onAskQuestion,
  onVoiceInput,
  onRecentQuestion,
  onEndSession,
}: {
  studentState: StudentState;
  distraction: number;
  notesReady: boolean;
  currentQuestion: string;
  answer: string;
  isThinking: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  listeningCountdown: number;
  recentQuestions: { id: string; text: string; timestamp: number }[];
  onQuestionChange: (q: string) => void;
  onAskQuestion: () => void;
  onVoiceInput: () => void;
  onRecentQuestion: (q: string) => void;
  onEndSession: () => void;
}) {
  const stateConfig = getStateConfig(studentState);

  return (
    <div style={styles.studyScreen}>
      {/* ===== LEFT COLUMN ===== */}
      <div style={styles.leftColumn}>
        {/* Student State Card */}
        <div
          style={{
            ...styles.stateCard,
            borderColor: stateConfig.borderColor,
            background: stateConfig.bgColor,
          }}
        >
          <div style={styles.stateHeader}>
            <div style={styles.stateIcon}>{stateConfig.icon}</div>
            <div>
              <div style={styles.stateLabel}>Learning State</div>
              <div
                style={{
                  ...styles.stateName,
                  color: stateConfig.textColor,
                }}
              >
                {stateConfig.label}
              </div>
            </div>
          </div>

          {/* Attention Meter */}
          <div style={styles.meterSection}>
            <div style={styles.meterLabel}>Attention Level</div>
            <div
              style={{
                ...styles.meterBar,
                background: stateConfig.meterBg,
              }}
            >
              <div
                style={{
                  ...styles.meterFill,
                  width: `${(1 - distraction) * 100}%`,
                  background: stateConfig.meterColor,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <div style={styles.meterValue}>
              {Math.round((1 - distraction) * 100)}%
            </div>
          </div>

          {/* Status Lights */}
          <div style={styles.statusLights}>
            <div
              style={{
                ...styles.statusLight,
                background: notesReady ? "#4caf50" : "#ccc",
              }}
            >
              📚 Notes loaded
            </div>
            <div
              style={{
                ...styles.statusLight,
                background: isThinking ? "#ff9800" : "#4caf50",
              }}
            >
              {isThinking ? "🤔 Thinking" : "✅ Ready"}
            </div>
          </div>
        </div>

        {/* AI Message Card */}
        <div style={styles.messageCard}>
          <div style={styles.messageLabel}>✨ AI Notice</div>
          <div style={styles.messageBubble}>{stateConfig.message}</div>
        </div>

        {/* Recent Questions */}
        {recentQuestions.length > 0 && (
          <div style={styles.recentSection}>
            <div style={styles.recentLabel}>📋 Recent Questions</div>
            <div style={styles.chipContainer}>
              {recentQuestions.map((q) => (
                <button
                  key={q.id}
                  onClick={() => onRecentQuestion(q.text)}
                  style={styles.chip}
                >
                  {q.text.slice(0, 20)}...
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ===== RIGHT COLUMN ===== */}
      <div style={styles.rightColumn}>
        {/* Question Input */}
        <div style={styles.inputCard}>
          <label style={styles.inputLabel}>❓ Ask a Question</label>
          <div style={styles.inputGroup}>
            <input
              type="text"
              value={currentQuestion}
              onChange={(e) => onQuestionChange(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && onAskQuestion()}
              placeholder="What do you want to know?"
              style={styles.input}
              disabled={isThinking || isListening}
            />
            <button
              onClick={onAskQuestion}
              disabled={!currentQuestion.trim() || isThinking || isListening}
              style={{
                ...styles.askButton,
                opacity: currentQuestion.trim() && !isThinking && !isListening ? 1 : 0.5,
              }}
            >
              📤
            </button>
          </div>

          {/* Voice & End Buttons */}
          <div style={styles.buttonRow}>
            <button
              onClick={onVoiceInput}
              disabled={isThinking || isListening}
              style={{
                ...styles.voiceButton,
                background: isListening ? "#ff9800" : "#2196f3",
              }}
            >
              {isListening ? `🎤 Listening... ${listeningCountdown}s` : "🎤 Voice Input"}
            </button>
            <button
              onClick={onEndSession}
              style={styles.endButton}
            >
              ⏹️ End Session
            </button>
          </div>
        </div>

        {/* Answer Display */}
        <div style={styles.answerCard}>
          <div style={styles.answerLabel}>
            {isThinking ? "🔄 StudyBuddy is thinking..." : isSpeaking ? "🔊 Speaking..." : "💬 Answer"}
          </div>

          <div style={styles.answerText}>
            {answer || (
              <span style={styles.placeholderText}>
                {isThinking
                  ? "Crafting a personalized explanation..."
                  : isSpeaking
                    ? "Listen to the answer..."
                    : "Ask a question to get started"}
              </span>
            )}
          </div>

          {/* Typing Animation */}
          {isThinking && (
            <div style={styles.typingAnimation}>
              <span style={styles.typingDot} />
              <span style={styles.typingDot} />
              <span style={styles.typingDot} />
            </div>
          )}

          {/* Speaking Indicator */}
          {isSpeaking && (
            <div style={styles.speakingIndicator}>
              <div style={styles.waveDot} />
              <div style={styles.waveDot} />
              <div style={styles.waveDot} />
              <div style={styles.waveDot} />
              <div style={styles.waveDot} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============== STYLES ==============
const colors = {
  confident: {
    icon: "✨",
    label: "Confident",
    borderColor: "#4caf50",
    bgColor: "#e8f5e9",
    textColor: "#2e7d32",
    meterColor: "#4caf50",
    meterBg: "rgba(76, 175, 80, 0.1)",
    message: "You're focused and engaged. Great work!",
  },
  distracted: {
    icon: "👀",
    label: "Distracted",
    borderColor: "#ff9800",
    bgColor: "#fff3e0",
    textColor: "#e65100",
    meterColor: "#ff9800",
    meterBg: "rgba(255, 152, 0, 0.1)",
    message: "I notice your attention dipped. Need clarification?",
  },
  confused: {
    icon: "🤔",
    label: "Confused",
    borderColor: "#f44336",
    bgColor: "#ffebee",
    textColor: "#c62828",
    meterColor: "#f44336",
    meterBg: "rgba(244, 67, 54, 0.1)",
    message: "You seem confused. I can help explain this better.",
  },
  idle: {
    icon: "👋",
    label: "Let's Begin",
    borderColor: "#9c9c9c",
    bgColor: "#f5f5f5",
    textColor: "#666",
    meterColor: "#ccc",
    meterBg: "#f0f0f0",
    message: "Upload your notes and start learning.",
  },
};

const getStateConfig = (state: StudentState) => colors[state];

const styles = {
  root: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    fontFamily: "'-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', sans-serif",
    color: "#333",
    position: "relative" as const,
    overflow: "hidden",
  },

  bgGradient: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    pointerEvents: "none" as const,
  },

  bgGlow1: {
    position: "fixed" as const,
    top: "-30%",
    left: "-30%",
    width: "600px",
    height: "600px",
    background: "radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)",
    borderRadius: "50%",
    pointerEvents: "none" as const,
  },

  bgGlow2: {
    position: "fixed" as const,
    bottom: "-40%",
    right: "-40%",
    width: "800px",
    height: "800px",
    background: "radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)",
    borderRadius: "50%",
    pointerEvents: "none" as const,
  },

  container: {
    maxWidth: "1400px",
    margin: "0 auto",
    padding: "30px 20px",
    position: "relative" as const,
    zIndex: 1,
  },

  header: {
    textAlign: "center" as const,
    color: "white",
    marginBottom: "40px",
  },

  title: {
    fontSize: "52px",
    fontWeight: "800",
    margin: "0 0 8px 0",
    textShadow: "0 4px 20px rgba(0,0,0,0.2)",
  },

  subtitle: {
    fontSize: "16px",
    opacity: 0.9,
    margin: 0,
    letterSpacing: "0.5px",
  },

  // === SETUP SCREEN ===
  setupScreen: {
    display: "flex" as const,
    flexDirection: "column" as const,
    gap: "30px",
    alignItems: "center",
  },

  setupCard: {
    background: "white",
    borderRadius: "20px",
    padding: "50px",
    boxShadow: "0 30px 80px rgba(0,0,0,0.2)",
    maxWidth: "500px",
    width: "100%",
  },

  setupTitle: {
    fontSize: "32px",
    fontWeight: "700",
    margin: "0 0 12px 0",
    color: "#333",
  },

  setupSubtitle: {
    fontSize: "16px",
    color: "#666",
    margin: "0 0 30px 0",
  },

  uploadSection: {
    display: "flex" as const,
    flexDirection: "column" as const,
    gap: "16px",
  },

  uploadInput: {
    cursor: "pointer" as const,
  },

  uploadButton: {
    display: "block" as const,
    padding: "16px 24px",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    borderRadius: "12px",
    fontSize: "16px",
    fontWeight: "600",
    textAlign: "center" as const,
    transition: "transform 0.2s",
  } as React.CSSProperties,

  divider: {
    textAlign: "center" as const,
    color: "#ccc",
    fontWeight: "600",
  },

  secondaryButton: {
    padding: "16px 24px",
    background: "white",
    color: "#667eea",
    border: "2px solid #667eea",
    borderRadius: "12px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s",
  } as React.CSSProperties,

  notesPreview: {
    display: "flex" as const,
    flexDirection: "column" as const,
    gap: "16px",
  },

  notesPreviewLabel: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#4caf50",
    textTransform: "uppercase" as const,
    letterSpacing: "1px",
  },

  notesPreviewText: {
    padding: "12px",
    background: "#f5f5f5",
    borderRadius: "8px",
    fontSize: "13px",
    color: "#666",
    lineHeight: "1.5",
    maxHeight: "120px",
    overflow: "hidden",
  },

  primaryButton: {
    padding: "16px 24px",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    border: "none",
    borderRadius: "12px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "transform 0.2s",
  } as React.CSSProperties,

  infoCards: {
    display: "grid" as const,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "20px",
    width: "100%",
    maxWidth: "1000px",
  },

  infoCard: {
    background: "rgba(255,255,255,0.95)",
    borderRadius: "16px",
    padding: "24px",
    textAlign: "center" as const,
    boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
  },

  infoIcon: {
    fontSize: "40px",
    marginBottom: "12px",
  },

  infoText: {
    color: "#333",
  },

  // === STUDY SCREEN ===
  studyScreen: {
    display: "grid" as const,
    gridTemplateColumns: "1fr 1fr",
    gap: "24px",
    "@media (max-width: 1024px)": {
      gridTemplateColumns: "1fr",
    },
  },

  leftColumn: {
    display: "flex" as const,
    flexDirection: "column" as const,
    gap: "20px",
  },

  rightColumn: {
    display: "flex" as const,
    flexDirection: "column" as const,
    gap: "20px",
  },

  stateCard: {
    background: "white",
    borderRadius: "16px",
    padding: "24px",
    border: "3px solid",
    boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
    transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
  } as React.CSSProperties,

  stateHeader: {
    display: "flex" as const,
    alignItems: "center",
    gap: "16px",
    marginBottom: "20px",
  },

  stateIcon: {
    fontSize: "48px",
    animation: "pulse 2s infinite",
  } as React.CSSProperties,

  stateLabel: {
    fontSize: "12px",
    opacity: 0.6,
    textTransform: "uppercase" as const,
    letterSpacing: "1px",
  },

  stateName: {
    fontSize: "24px",
    fontWeight: "700",
    margin: "4px 0 0 0",
  },

  meterSection: {
    marginBottom: "20px",
  },

  meterLabel: {
    fontSize: "12px",
    opacity: 0.6,
    marginBottom: "8px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },

  meterBar: {
    height: "8px",
    borderRadius: "4px",
    overflow: "hidden",
    marginBottom: "6px",
  } as React.CSSProperties,

  meterFill: {
    height: "100%",
    borderRadius: "4px",
  } as React.CSSProperties,

  meterValue: {
    fontSize: "12px",
    fontWeight: "600",
    opacity: 0.7,
    textAlign: "right" as const,
  },

  statusLights: {
    display: "flex" as const,
    gap: "8px",
  },

  statusLight: {
    flex: 1,
    padding: "8px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: "600",
    color: "white",
    textAlign: "center" as const,
  } as React.CSSProperties,

  messageCard: {
    background: "white",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
    minHeight: "120px",
    display: "flex" as const,
    flexDirection: "column" as const,
    justifyContent: "center",
  },

  messageLabel: {
    fontSize: "12px",
    opacity: 0.6,
    textTransform: "uppercase" as const,
    letterSpacing: "1px",
    marginBottom: "12px",
  },

  messageBubble: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#333",
    lineHeight: "1.5",
  },

  recentSection: {
    background: "white",
    borderRadius: "16px",
    padding: "20px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
  },

  recentLabel: {
    fontSize: "12px",
    opacity: 0.6,
    textTransform: "uppercase" as const,
    letterSpacing: "1px",
    marginBottom: "12px",
  },

  chipContainer: {
    display: "flex" as const,
    flexDirection: "column" as const,
    gap: "8px",
  },

  chip: {
    padding: "8px 12px",
    background: "#f5f5f5",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    fontSize: "12px",
    cursor: "pointer" as const,
    transition: "all 0.2s",
    textAlign: "left" as const,
  } as React.CSSProperties,

  inputCard: {
    background: "white",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
  },

  inputLabel: {
    fontSize: "12px",
    opacity: 0.6,
    textTransform: "uppercase" as const,
    letterSpacing: "1px",
    display: "block",
    marginBottom: "12px",
  },

  inputGroup: {
    display: "flex" as const,
    gap: "8px",
    marginBottom: "16px",
  },

  input: {
    flex: 1,
    padding: "12px 16px",
    border: "2px solid #eee",
    borderRadius: "10px",
    fontSize: "14px",
    outline: "none",
    transition: "all 0.2s",
    fontFamily: "inherit",
  } as React.CSSProperties,

  askButton: {
    padding: "12px 16px",
    background: "#667eea",
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer" as const,
    transition: "all 0.2s",
  } as React.CSSProperties,

  buttonRow: {
    display: "flex" as const,
    gap: "8px",
  },

  voiceButton: {
    flex: 1,
    padding: "12px 16px",
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer" as const,
    transition: "all 0.2s",
  } as React.CSSProperties,

  endButton: {
    flex: 1,
    padding: "12px 16px",
    background: "white",
    color: "#667eea",
    border: "2px solid #667eea",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer" as const,
    transition: "all 0.2s",
  } as React.CSSProperties,

  answerCard: {
    background: "white",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
    flex: 1,
    display: "flex" as const,
    flexDirection: "column" as const,
    minHeight: "300px",
  },

  answerLabel: {
    fontSize: "12px",
    opacity: 0.6,
    textTransform: "uppercase" as const,
    letterSpacing: "1px",
    marginBottom: "12px",
    fontWeight: "700",
  },

  answerText: {
    flex: 1,
    fontSize: "16px",
    lineHeight: "1.6",
    color: "#333",
    overflowY: "auto" as const,
    wordBreak: "break-word" as const,
    whiteSpace: "pre-wrap" as const,
  } as React.CSSProperties,

  placeholderText: {
    color: "#aaa",
    fontStyle: "italic" as const,
  },

  typingAnimation: {
    display: "flex" as const,
    gap: "4px",
    marginTop: "12px",
    alignItems: "center" as const,
  },

  typingDot: {
    width: "8px",
    height: "8px",
    background: "#667eea",
    borderRadius: "50%",
    animation: "bounce 1.4s infinite",
  } as React.CSSProperties,

  speakingIndicator: {
    display: "flex" as const,
    gap: "4px",
    marginTop: "12px",
    alignItems: "center" as const,
    height: "20px",
  },

  waveDot: {
    width: "4px",
    height: "4px",
    background: "#2196f3",
    borderRadius: "50%",
    animation: "wave 0.8s ease-in-out infinite",
  } as React.CSSProperties,
} as const;