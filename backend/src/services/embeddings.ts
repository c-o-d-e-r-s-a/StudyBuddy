import axios from "axios";

const GEMINI_EMBED_MODEL = "models/gemini-embedding-001";

type EmbedTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

export async function embedTexts(texts: string[], taskType: EmbedTaskType) {
  const key = process.env.GEMINI_API_KEY!;
  const url = `https://generativelanguage.googleapis.com/v1beta/${GEMINI_EMBED_MODEL}:batchEmbedContents?key=${key}`;

  const body = {
    requests: texts.map((t) => ({
      model: GEMINI_EMBED_MODEL,
      content: { parts: [{ text: t }] },
      taskType
    }))
  };

  const resp = await axios.post(url, body, {
    headers: { "Content-Type": "application/json" }
  });

  // response: { embeddings: [{ values: number[] }, ...] }
  const embeddings = resp.data.embeddings.map((e: any) => e.values as number[]);
  return embeddings;
}
