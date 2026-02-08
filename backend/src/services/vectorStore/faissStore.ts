import type { VectorStore, VectorRecord, SearchResult } from "./types";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const faiss = require("faiss-node");

export function makeFaissStore(dim: number): VectorStore {
  const index = new faiss.IndexFlatIP(dim); // inner product
  const ids: string[] = [];
  const metas: { text: string; source?: string }[] = [];

  function normalize(v: number[]) {
    const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map((x) => x / n);
  }

  return {
    async upsert(records: VectorRecord[]) {
      for (const r of records) {
        ids.push(r.id);
        metas.push(r.metadata);

        const vec = normalize(r.values);
        index.add(vec);
      }
    },

    async query(queryVector: number[], topK: number): Promise<SearchResult[]> {
      // ✅ FIX: Cap topK to available records
      const actualK = Math.min(topK, ids.length);
      
      if (actualK === 0) {
        return []; // No results if empty
      }

      const q = normalize(queryVector);
      const { distances, labels } = index.search(q, actualK);

      const results: SearchResult[] = [];
      for (let i = 0; i < labels.length; i++) {
        const idx = labels[i];
        
        // Add safety checks
        if (idx < 0 || idx >= ids.length) continue;
        
        const id = ids[idx];
        const metadata = metas[idx];
        
        // Verify they exist
        if (!id || !metadata) continue;
        
        results.push({
          id,
          score: distances[i] ?? 0,
          metadata
        });
      }
      return results;
    },

    async count(): Promise<number> {
      return ids.length;
    }
  };
}