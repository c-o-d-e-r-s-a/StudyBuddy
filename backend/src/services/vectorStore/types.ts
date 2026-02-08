export type VectorRecord = {
  id: string;
  values: number[];
  metadata: {
    text: string;
    source?: string;
  };
};

export type SearchResult = {
  id: string;
  score: number;
  metadata: { text: string; source?: string };
};

export interface VectorStore {
  upsert(records: VectorRecord[], namespace?: string): Promise<void>;
  query(queryVector: number[], topK: number, namespace?: string): Promise<SearchResult[]>;
  count?(namespace?: string): Promise<number>;
}
