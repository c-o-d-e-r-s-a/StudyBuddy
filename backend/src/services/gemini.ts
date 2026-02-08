import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function testGemini() {
  // Use one of these models - they're the most current and stable:
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  // Or for more powerful: gemini-2.5-pro
  // Or for latest: gemini-flash-latest

  const result = await model.generateContent("Say hello");
  return result.response.text();
}