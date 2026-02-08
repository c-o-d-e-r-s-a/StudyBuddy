import { Socket } from "socket.io";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { startElevenLabsStream } from "../services/elevenlabsWs";
import { vectorStore } from "../services/vectorStore";
import { embedText } from "../services/embeddings";

export function attachSocketHandlers(socket: Socket, io: any) {
  const userSessions: Map<string, any> = new Map();

  socket.on("ask_stream", async (data: { question: string }) => {
    try {
      const { question } = data;
      if (!question) {
        socket.emit("stream_error", "No question provided");
        return;
      }

      console.log(`📤 Question from ${socket.id}: ${question}`);

      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

      // Embed & retrieve
      const qVec = await embedText(question);
      const results = await vectorStore.query(qVec, 5);
      const context = results
        .map((r, i) => `[${i + 1}] ${r.metadata.text}`)
        .join("\n\n");

      // Generate answer
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const systemPrompt = `You are StudyBuddy. Answer concisely using context if available.`;
      const prompt = `Context:\n${context}\n\nQ: ${question}\n\nA:`;

      let fullAnswer = "";

      // Stream text to client
      const { stream } = await model.generateContentStream({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        systemInstruction: systemPrompt
      });

      for await (const chunk of stream) {
        const text = chunk.text();
        fullAnswer += text;
        socket.emit("stream_chunk", text);
      }

      socket.emit("stream_end");

      // Stream audio
      startElevenLabsStream({
        text: fullAnswer,
        onAudioChunk: (chunk) => socket.emit("audio_chunk", chunk),
        onFinal: () => socket.emit("audio_end"),
        onError: (err) => socket.emit("stream_error", err),
        voiceId: "9IzcwKmvwJcw58h3KnlH" // Rachel
      });

      // Update session
      if (!userSessions.has(socket.id)) {
        userSessions.set(socket.id, { questions: [], startTime: Date.now() });
      }
      userSessions.get(socket.id).questions.push({ ts: Date.now(), q: question });
    } catch (err: any) {
      console.error("❌ Stream error:", err);
      socket.emit("stream_error", err.message);
    }
  });

  // ✅ NEW: Handle confusion detection
  socket.on("user_confused", async () => {
    try {
      console.log(`🤔 User ${socket.id} is confused, generating clarification...`);

      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const clarificationPrompt = `You are a helpful tutor. Generate a brief, encouraging clarification (max 2 sentences) 
that explains the most recent concept again with a simple example. Be empathetic and supportive.`;

      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: clarificationPrompt }
            ]
          }
        ]
      });

      const clarification = result.response.text();

      // Convert clarification to audio
      startElevenLabsStream({
        text: clarification,
        onAudioChunk: (chunk) => socket.emit("audio_chunk", chunk),
        onFinal: () => socket.emit("audio_end"),
        onError: (err) => socket.emit("stream_error", err),
        voiceId: "9IzcwKmvwJcw58h3KnlH",
        modelId: "eleven_turbo_v2_5"
      });

      console.log("✅ Clarification sent:", clarification);
    } catch (err: any) {
      console.error("❌ Clarification error:", err);
    }
  });

  socket.on("presage_event", (e) => {
    // Log sensing events (optional)
    // console.log(`📊 Presage: gaze=${e.gaze}, confusion=${e.confusion}`);
  });

  socket.on("end_session", () => {
    const session = userSessions.get(socket.id);
    if (session) {
      const summary = {
        startedAt: session.startTime,
        endedAt: Date.now(),
        totalMs: Date.now() - session.startTime,
        focusedMs: Math.floor((Date.now() - session.startTime) * 0.8),
        lookAwayCount: 0,
        confusionTriggers: 0,
        questionsCount: session.questions.length,
        questions: session.questions
      };

      socket.emit("session_summary", summary);
      userSessions.delete(socket.id);
    }
  });

  socket.on("disconnect", () => {
    console.log(`🔌 User ${socket.id} disconnected`);
    userSessions.delete(socket.id);
  });
}