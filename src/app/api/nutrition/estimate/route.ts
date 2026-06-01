import { NextResponse } from "next/server";
import { geminiGenerate, hasGemini } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Macros {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  label: string;
}

const SYSTEM = `You estimate macros for a meal description. Return STRICT JSON only:
{ "kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "label": string }
Round to whole numbers. label is a 1-line clean restatement of the meal. No prose, no markdown, no fences.`;

function parseJson(raw: string): Partial<Macros> | null {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed[0] ?? null;
    return parsed;
  }
  catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch { return null; }
  }
}

function clean(m: Partial<Macros> | null, fallback: string): Macros {
  return {
    kcal: Math.max(0, Math.round(Number(m?.kcal) || 0)),
    protein_g: Math.max(0, Math.round(Number(m?.protein_g) || 0)),
    carbs_g: Math.max(0, Math.round(Number(m?.carbs_g) || 0)),
    fat_g: Math.max(0, Math.round(Number(m?.fat_g) || 0)),
    label: (typeof m?.label === "string" && m.label) ? m.label.slice(0, 120) : fallback.slice(0, 120),
  };
}

export async function POST(req: Request) {
  let body: { text?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad-request" }, { status: 400 }); }
  const text = body.text?.trim();
  if (!text) return NextResponse.json({ error: "empty" }, { status: 400 });
  if (!hasGemini()) return NextResponse.json({ ok: false, error: "GEMINI_API_KEY not set" }, { status: 503 });

  try {
    const raw = await geminiGenerate({
      system: SYSTEM,
      user: `Meal: ${text}\nReturn only the JSON object.`,
      json: true,
      maxTokens: 500,
    });
    let parsed = parseJson(raw);
    if (!parsed) {
      const retry = await geminiGenerate({
        system: "Return only compact JSON with numeric kcal, protein_g, carbs_g, fat_g, and a short label. No prose.",
        user: `Estimate this food in India restaurant context if needed: ${text}`,
        json: false,
        maxTokens: 300,
      });
      parsed = parseJson(retry);
    }
    if (!parsed) throw new Error("unparseable");
    return NextResponse.json({ ok: true, macros: clean(parsed, text) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
