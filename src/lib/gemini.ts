// Single Gemini client + thin helpers used everywhere we used to call Anthropic / OpenAI.
// Models:
//   - text/JSON/multimodal: gemini-2.5-flash       (overridable via GEMINI_MODEL)
//   - embeddings:           gemini-embedding-001   (forced to 1536 dims to match pgvector)
import { GoogleGenAI } from "@google/genai";

const TEXT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";

let _client: GoogleGenAI | null = null;
export function gemini(): GoogleGenAI {
  if (_client) return _client;
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  _client = new GoogleGenAI({ apiKey: key });
  return _client;
}

export function hasGemini(): boolean {
  return !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}

/** Generate text with optional JSON-mode. Returns the model's text output. */
export async function geminiGenerate(opts: {
  system?: string;
  user: string;
  json?: boolean;
  maxTokens?: number;
}): Promise<string> {
  const ai = gemini();
  const resp = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: [{ role: "user", parts: [{ text: opts.user }] }],
    config: {
      systemInstruction: opts.system,
      responseMimeType: opts.json ? "application/json" : undefined,
      maxOutputTokens: opts.maxTokens,
    },
  });
  return resp.text ?? "";
}

/** Stream text deltas via async generator. */
export async function* geminiStream(opts: {
  system?: string;
  user: string;
  maxTokens?: number;
}): AsyncGenerator<string> {
  const ai = gemini();
  const stream = await ai.models.generateContentStream({
    model: TEXT_MODEL,
    contents: [{ role: "user", parts: [{ text: opts.user }] }],
    config: {
      systemInstruction: opts.system,
      maxOutputTokens: opts.maxTokens,
    },
  });
  for await (const chunk of stream) {
    const t = chunk.text;
    if (t) yield t;
  }
}

/** Transcribe audio (e.g. Telegram OGG voice notes) using Gemini's multimodal input. */
export async function geminiTranscribe(audio: ArrayBuffer, mimeType = "audio/ogg"): Promise<string> {
  const ai = gemini();
  const b64 = arrayBufferToBase64(audio);
  const resp = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: b64 } },
          { text: "Transcribe the spoken audio verbatim. Output only the transcript, no preface, no formatting." },
        ],
      },
    ],
  });
  return (resp.text ?? "").trim();
}

/** Embed text. Forces 1536 dims so it slots into the existing pgvector column. */
export async function geminiEmbed(text: string): Promise<number[] | null> {
  if (!hasGemini()) return null;
  try {
    const ai = gemini();
    const resp = await ai.models.embedContent({
      model: EMBED_MODEL,
      contents: text,
      config: { outputDimensionality: 1536 },
    });
    const v = resp.embeddings?.[0]?.values;
    return v ?? null;
  } catch (e) {
    console.warn("[gemini.embed] failed:", e);
    return null;
  }
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  if (typeof Buffer !== "undefined") return Buffer.from(buf).toString("base64");
  return btoa(bin);
}
