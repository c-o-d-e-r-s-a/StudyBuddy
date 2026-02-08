import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import multer from "multer";

import { testGemini } from "./services/gemini";
import { testTTS } from "./services/elevenlabs";
import { notesRouter } from "./routes/notes";
import { askRouter } from "./routes/ask";
import { registerSocketHandlers } from "./socket";

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
const upload = multer({ storage: multer.memoryStorage() });

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

// =======================
// TRANSCRIPTION ENDPOINT
// =======================
app.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file uploaded" });
    }

    console.log("🎤 Transcribing audio:", req.file.originalname, "Size:", req.file.size, "bytes");

    const audioBuffer = req.file.buffer;

    // Use Gemini API to transcribe audio
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Convert buffer to base64
    const base64Audio = audioBuffer.toString("base64");

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Audio,
          mimeType: "audio/webm"
        }
      },
      "Transcribe this audio. Return ONLY the transcribed text, nothing else."
    ]);

    const text = result.response.text();
    console.log("✅ Transcription complete:", text.slice(0, 60) + "...");

    res.json({ text });
  } catch (err) {
    console.error("❌ Transcription error:", err);
    res.status(500).json({
      error: "Transcription failed",
      details: err instanceof Error ? err.message : String(err)
    });
  }
});

app.use("/notes", notesRouter);
app.use("/ask", askRouter);

// =======================
// SOCKET.IO - Main ask_stream handler
// =======================
io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);

  socket.on("ask_stream", async ({ question }: { question: string }) => {
    let ttsStream: ReturnType<typeof startElevenLabsStream> | null = null;

    try {
      if (typeof question !== "string" || !question.trim()) {
        socket.emit("stream_error", "Please enter a question.");
        return;
      }

      console.log(`📥 Received question from ${socket.id}:`, question);

      // Get vector store and check if notes exist
      const vectorStore = getVectorStore();
      const count = (await vectorStore.count?.()) ?? 0;

      if (count === 0) {
        socket.emit("stream_error", "No notes indexed yet. Please upload notes first.");
        return;
      }

      // Retrieve relevant notes
      const [qVec] = await embedTexts([question], "RETRIEVAL_QUERY");
      const topK = Math.min(5, count);
      const results = await vectorStore.query(qVec, topK);

      const context = results
        .map((r, i) => `Chunk ${i + 1} (source: ${r.metadata.source ?? "notes"}):\n${r.metadata.text}`)
        .join("\n\n---\n\n");

      // Get Gemini model
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

      // Start TTS stream
      ttsStream = startElevenLabsStream({
        onAudioChunk: (audioData) => {
          console.log(`🔊 Sending audio chunk: ${audioData.length} bytes`);
          socket.emit("audio_chunk", audioData);
        },
        onFinal: () => {
          console.log("🎵 Audio streaming complete");
          socket.emit("audio_end");
        },
        onError: (error) => {
          console.error("❌ TTS error:", error);
          socket.emit("stream_error", "Audio generation failed: " + error);
        }
      });

      if (!ttsStream) {
        socket.emit("stream_error", "Failed to initialize audio stream");
        return;
      }

      // Stream text from Gemini and send to TTS
      const stream = await model.generateContentStream(prompt);

      let textBuffer = "";
      const BUFFER_SIZE = 30;

      for await (const chunk of stream.stream) {
        const textChunk = chunk.text();
        if (!textChunk) continue;

        // Emit text to frontend
        socket.emit("stream_chunk", textChunk);

        // Accumulate text for TTS
        textBuffer += textChunk;

        // Send to TTS when we have complete sentences or enough buffered text
        const shouldFlush =
          textBuffer.length >= BUFFER_SIZE ||
          /[.!?;:\n]\s*$/.test(textBuffer);

        if (shouldFlush && textBuffer.trim()) {
          console.log(`📤 Sending to TTS: "${textBuffer.slice(0, 50)}..."`);
          ttsStream.sendTextChunk(textBuffer);
          textBuffer = "";
        }
      }

      // Flush remaining text
      if (textBuffer.trim()) {
        console.log(`📤 Flushing final text: "${textBuffer}"`);
        ttsStream.sendTextChunk(textBuffer);
      }

      // End streaming
      socket.emit("stream_end");
      ttsStream.end();
    } catch (e) {
      console.error("❌ Stream error:", e);
      socket.emit(
        "stream_error",
        `Streaming failed: ${e instanceof Error ? e.message : String(e)}`
      );
      if (ttsStream) ttsStream.close();
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

// Register Presage handlers
registerSocketHandlers(io);

// =======================
// START SERVER
// =======================
server.listen(3001, () => {
  console.log("🚀 Backend running on http://localhost:3001");
});

app.use((req, _res, next) => {
  console.log("HTTP", req.method, req.url, "from", req.socket.remoteAddress);
  next();
});