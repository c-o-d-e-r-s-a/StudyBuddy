import { Router, Request, Response } from "express";
import multer from "multer";
import { chunkText } from "../services/chunking";
import { embedTexts } from "../services/embeddings";
import { getVectorStore } from "../services/vectorStore";
import { randomUUID } from "crypto";

const pdfParseModule = require("pdf-parse");
const pdfParse = pdfParseModule?.default ?? pdfParseModule;

const upload = multer({ storage: multer.memoryStorage() });
export const notesRouter = Router();

notesRouter.post(
  "/upload",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      console.log(
        "File received:",
        req.file.originalname,
        "Type:",
        req.file.mimetype
      );

      const mime = req.file.mimetype;
      let text = "";

      if (mime === "application/pdf") {
        console.log("Processing PDF...");
        try {
          const parsed = await pdfParse(req.file.buffer);
          text = parsed.text || "";
          console.log("PDF parsed, text length:", text.length);
        } catch (pdfError) {
          console.error("PDF parsing error:", pdfError);
          return res.status(400).json({
            error: "Failed to parse PDF",
            details:
              pdfError instanceof Error ? pdfError.message : "Unknown error",
          });
        }
      } else if (mime === "text/plain") {
        text = req.file.buffer.toString("utf-8");
        console.log("Text file parsed, length:", text.length);
      } else {
        // Try to parse as text anyway
        console.log("Unknown mime type, trying as text");
        text = req.file.buffer.toString("utf-8");
      }

      if (!text.trim()) {
        return res.status(400).json({ error: "No extractable text from file" });
      }

      console.log("Chunking text...");
      const chunks = chunkText(text, 1400, 250);
      console.log("Created chunks:", chunks.length);

      console.log("Generating embeddings...");
      const vectors = await embedTexts(chunks, "RETRIEVAL_DOCUMENT");
      console.log("Generated embeddings:", vectors.length);

      if (vectors.length !== chunks.length) {
        console.error(
          "Vector/chunk length mismatch:",
          vectors.length,
          chunks.length
        );
        return res.status(500).json({ error: "Embedding failed" });
      }

      console.log("Storing in vector database...");
      const vectorStore = getVectorStore();
      await vectorStore.upsert(
        chunks.map((c, i) => {
          const vector = vectors[i];
          if (!vector) {
            throw new Error(`Missing vector at index ${i}`);
          }
          return {
            id: randomUUID(),
            values: vector,
            metadata: {
              text: c,
              source: req.file!.originalname,
            },
          };
        })
      );

      console.log("Upload complete!");
      res.json({ ok: true, chunksIndexed: chunks.length });
    } catch (e) {
      console.error("Upload/index error:", e);
      res.status(500).json({
        error: "Upload/index failed",
        details: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }
);