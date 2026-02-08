import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";

import { testGemini } from "./services/gemini";
import { testTTS } from "./services/elevenlabs";
import { notesRouter } from "./routes/notes";
import { askRouter } from "./routes/ask";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { embedTexts } from "./services/embeddings";
import { getVectorStore } from "./services/vectorStore";
import { startElevenLabsStream } from "./services/elevenlabsWs";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());




const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  maxHttpBufferSize: 1e8
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// =======================
// ROUTES
// =======================
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/test-gemini", async (_req, res) => {
  try {
    const text = await testGemini();
    res.json({ text });
  } catch (err) {
    console.error("Gemini error:", err);
    res.status(500).json({ error: "Gemini failed" });
  }
});

app.get("/test-tts", async (_req, res) => {
  try {
    const audio = await testTTS();
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(audio);
  } catch (error: any) {
    console.error("TTS error:", error);
    res.status(error.response?.status || 500).json({
      error: "Failed to generate audio",
      message: error.message
    });
  }
});

app.use("/notes", notesRouter);
app.use("/ask", askRouter);

// =======================
// STEP 6: SESSION STORE + METRICS (in-memory, per socket.id)
// =======================
type PresageEvent = {
  ts: number;
  face_present: boolean;
  gaze: "on_screen" | "away";
  confusion: number;
};

type SessionState = {
  startedAt: number;

  lastEventTs?: number | undefined;
  focusedMs: number;

  awayStartedAt?: number | undefined;
  lookAwayCount: number;

  confusionTriggers: number;
  confusionEvents: { ts: number; confusion: number }[];

  questions: { ts: number; q: string }[];

  lastQuestion?: string | undefined;
  lastAnswerSoFar?: string | undefined;
};

const sessions = new Map<string, SessionState>();

function getSession(socketId: string): SessionState {
  let s = sessions.get(socketId);
  if (!s) {
    s = {
      startedAt: Date.now(),
      focusedMs: 0,
      lookAwayCount: 0,
      confusionTriggers: 0,
      confusionEvents: [],
      questions: [],
      lastAnswerSoFar: ""
    };
    sessions.set(socketId, s);
  }
  return s;
}

function removeSession(socketId: string) {
  sessions.delete(socketId);
}

function recordPresageEvent(s: SessionState, e: PresageEvent) {
  if (s.lastEventTs != null) {
    const dt = Math.max(0, e.ts - s.lastEventTs);

    // focused time
    if (e.face_present && e.gaze === "on_screen") {
      s.focusedMs += dt;
    }

    // look-away counting: count if away lasts > 1500ms and then returns on_screen
    if (e.gaze === "away") {
      if (s.awayStartedAt == null) s.awayStartedAt = e.ts;
    } else {
      if (s.awayStartedAt != null) {
        const awayDur = e.ts - s.awayStartedAt;
        if (awayDur >= 1500) s.lookAwayCount += 1;
        s.awayStartedAt = undefined;
      }
    }
  }

  s.lastEventTs = e.ts;

  // store timeline for charts (bounded)
  s.confusionEvents.push({ ts: e.ts, confusion: e.confusion });
  if (s.confusionEvents.length > 3500) {
    s.confusionEvents.splice(0, s.confusionEvents.length - 3500);
  }
}

function sessionSummary(s: SessionState) {
  const now = Date.now();
  const totalMs = Math.max(0, now - s.startedAt);

  return {
    startedAt: s.startedAt,
    endedAt: now,
    totalMs,
    focusedMs: s.focusedMs,
    lookAwayCount: s.lookAwayCount,
    confusionTriggers: s.confusionTriggers,
    questionsCount: s.questions.length,
    questions: s.questions.slice(-10),
    confusionEvents: s.confusionEvents
  };
}

// =======================
// SOCKET.IO (single connection handler)
// =======================
io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);
  const s = getSession(socket.id);

  // ---- Step 6: Presage metrics ingestion ----
  socket.on("presage_event", (e: PresageEvent) => {
    if (
      !e ||
      typeof e.ts !== "number" ||
      typeof e.face_present !== "boolean" ||
      (e.gaze !== "on_screen" && e.gaze !== "away") ||
      typeof e.confusion !== "number"
    ) {
      return;
    }
    recordPresageEvent(s, e);
  });

  // ---- Step 6: Confusion trigger (client debounced) ----
  socket.on("user_confused", ({ ts }: { ts: number }) => {
    s.confusionTriggers += 1;
    socket.emit("confusion_ack", { ts: typeof ts === "number" ? ts : Date.now() });
  });

  // ---- Step 6: End session -> return summary ----
  socket.on("end_session", () => {
    socket.emit("session_summary", sessionSummary(s));
  });

  // ---- Optional: keep your test stream ----
  socket.on("test_stream", () => {
    let i = 0;
    const interval = setInterval(() => {
      socket.emit("stream_chunk", `Chunk ${i}`);
      i++;
      if (i > 5) {
        clearInterval(interval);
        socket.emit("stream_end");
      }
    }, 500);
  });

  // =======================
  // Main pipeline: ask_stream (Gemini + ElevenLabs streaming)
  // =======================
  socket.on("ask_stream", async ({ question }: { question: string }) => {
    let ttsStream: ReturnType<typeof startElevenLabsStream> | null = null;

    try {
      if (typeof question !== "string" || !question.trim()) {
        socket.emit("stream_error", "Please enter a question.");
        return;
      }

      // Step 6: track question at top
      const ts = Date.now();
      s.questions.push({ ts, q: question.trim() });
      s.lastQuestion = question.trim();
      s.lastAnswerSoFar = "";

      console.log(`📥 Received question from ${socket.id}:`, question);

      const vectorStore = getVectorStore();
      const count = (await vectorStore.count?.()) ?? 0;

      if (count === 0) {
        socket.emit("stream_error", "No notes indexed yet. Please upload notes first.");
        return;
      }

      const [qVec] = await embedTexts([question], "RETRIEVAL_QUERY");
      const topK = Math.min(5, count);
      const results = await vectorStore.query(qVec, topK);

      const context = results
        .map((r, i) => `Chunk ${i + 1} (source: ${r.metadata.source ?? "notes"}):\n${r.metadata.text}`)
        .join("\n\n---\n\n");

      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = `
You are StudyBuddy. Answer using ONLY the context if possible.
If the context is insufficient, say so briefly, then provide a helpful explanation.

Context:
${context}

User question:
${question}

Answer:
`.trim();

      ttsStream = startElevenLabsStream({
        onAudioChunk: (audioData) => {
          socket.emit("audio_chunk", audioData);
        },
        onFinal: () => {
          socket.emit("audio_end");
        },
        onError: (error) => {
          console.error("❌ TTS error:", error);
          socket.emit("stream_error", "Audio generation failed");
        }
      });

      if (!ttsStream) {
        socket.emit("stream_error", "Failed to start TTS stream");
        return;
      }

      const stream = await model.generateContentStream(prompt);

      let textBuffer = "";
      const BUFFER_SIZE = 50;

      for await (const chunk of stream.stream) {
        const textChunk = chunk.text();
        if (!textChunk) continue;

        socket.emit("stream_chunk", textChunk);

        // Step 6: keep lastAnswerSoFar updated
        s.lastAnswerSoFar = (s.lastAnswerSoFar ?? "") + textChunk;

        textBuffer += textChunk;

        const shouldFlush =
          textBuffer.length >= BUFFER_SIZE || /[.!?;,]\s*$/.test(textBuffer);

        if (shouldFlush && textBuffer.trim()) {
          ttsStream.sendTextChunk(textBuffer);
          textBuffer = "";
        }
      }

      if (textBuffer.trim()) {
        ttsStream.sendTextChunk(textBuffer);
      }

      socket.emit("stream_end");
      ttsStream.end();
    } catch (e) {
      console.error("❌ Stream error:", e);
      socket.emit("stream_error", "Streaming failed");
      if (ttsStream) ttsStream.close();
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
    removeSession(socket.id);
  });
});

// =======================
// START SERVER
// =======================
server.listen(3001, () => {
  console.log("Backend running on http://localhost:3001");
});

app.use((req, _res, next) => {
  console.log("HTTP", req.method, req.url, "from", req.socket.remoteAddress);
  next();
});