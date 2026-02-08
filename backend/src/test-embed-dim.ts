import dotenv from "dotenv";
import { embedTexts } from "./services/embeddings";

dotenv.config();

async function testEmbedDim() {
  const [embedding] = await embedTexts(["test"], "RETRIEVAL_DOCUMENT");
  console.log("Embedding dimension:", embedding.length);
}

testEmbedDim();