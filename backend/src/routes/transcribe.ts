import express, { Request, Response } from "express";
import multer from "multer";
import { GoogleGenerativeAI } from "@google/generative-ai";

const upload = multer({ storage: multer.memoryStorage() });

export function attachTranscribeRoute(app: express.Application) {
  app.post("/transcribe", upload.single("audio"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file" });
      }

      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      // Convert audio buffer to base64
      const base64Audio = req.file.buffer.toString("base64");

      const result = await model.generateContent([
        {
          inlineData: {
            data: base64Audio,
            mimeType: "audio/webm"
          }
        },
        {
          text: "Transcribe this audio to text. Return ONLY the transcribed text, nothing else."
        }
      ]);

      const text = result.response.text();

      res.json({ text: text.trim() });
    } catch (error: any) {
      console.error("❌ Transcription error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}