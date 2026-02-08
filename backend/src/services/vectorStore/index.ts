import type { VectorStore } from "./types";
import { makeFaissStore } from "./faissStore";

let vectorStoreInstance: VectorStore | null = null;

export function getVectorStore(): VectorStore {
  if (vectorStoreInstance) return vectorStoreInstance;

  const storeType = process.env.VECTOR_STORE || "faiss";
  const embedDim = Number(process.env.EMBED_DIM) || 3072;

  if (storeType === "faiss") {
    vectorStoreInstance = makeFaissStore(embedDim);
  } else {
    throw new Error(`Unknown VECTOR_STORE: ${storeType}`);
  }

  return vectorStoreInstance;
}

// Re-export types
export type { VectorStore, VectorRecord, SearchResult } from "./types";