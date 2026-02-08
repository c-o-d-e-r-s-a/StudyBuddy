import { Router, Request, Response } from "express";
import { embedTexts } from "../services/embeddings";
import { getVectorStore } from "../services/vectorStore";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const askRouter = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

askRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { question } = req.body as { question?: string };
    if (!question) return res.status(400).json({ error: "Missing question" });

    const vectorStore = getVectorStore();
    const count = (await vectorStore.count?.()) ?? 0;
    if (count === 0) {
      return res.status(400).json({ error: "No notes indexed yet. Please upload notes first." });
    }

    const [qVec] = await embedTexts([question], "RETRIEVAL_QUERY");
    const results = await vectorStore.query(qVec, 5);

    if (!results || results.length === 0) {
      return res.status(400).json({ error: "No relevant notes found" });
    }

    const context = results
      .map((r, idx) => `Chunk ${idx + 1} (source: ${r.metadata.source ?? "notes"}):\n${r.metadata.text}`)
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

    const result = await model.generateContent(prompt);

    res.json({
      answer: result.response.text(),
      sources: results.map((r) => ({
        score: r.score,
        source: r.metadata.source ?? "unknown",
      })),
    });
  } catch (e) {
    console.error("Ask error:", e);
    res.status(500).json({
      error: "Ask failed",
      details: e instanceof Error ? e.message : "Unknown error",
    });
  }
});