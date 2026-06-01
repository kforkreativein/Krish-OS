import { geminiEmbed } from "../gemini";
import OpenAI from "openai";

export async function embedText(text: string): Promise<number[] | null> {
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });
      return response.data[0]?.embedding ?? null;
    } catch (error) {
      console.warn("[embed] openai failed", error);
    }
  }
  return geminiEmbed(text);
}
