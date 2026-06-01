import OpenAI from "openai";
import { geminiTranscribe } from "./gemini";

export async function transcribeOgg(audio: ArrayBuffer, _filename = "voice.ogg"): Promise<string> {
  if (process.env.OPENAI_API_KEY) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const file = new File([audio], _filename, { type: "audio/ogg" });
    const result = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });
    return result.text;
  }
  return geminiTranscribe(audio, "audio/ogg");
}
