import { NextResponse } from "next/server";
import { geminiGenerate, hasGemini } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Macros = { protein_g: number; carbs_g: number; fat_g: number };

function clean(raw: unknown): Macros {
  const obj = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return {
    protein_g: Math.max(0, Math.round(Number(obj.protein_g) || 0)),
    carbs_g: Math.max(0, Math.round(Number(obj.carbs_g) || 0)),
    fat_g: Math.max(0, Math.round(Number(obj.fat_g) || 0)),
  };
}

function parseJson(raw: string): Record<string, unknown> | null {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(cleaned); }
  catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  }
}

function proportionalFallback(kcal: number): Macros {
  return {
    protein_g: Math.round((kcal * 0.25) / 4),
    carbs_g: Math.round((kcal * 0.45) / 4),
    fat_g: Math.round((kcal * 0.30) / 9),
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { name?: string; kcal?: number } | null;
  const name = body?.name?.trim();
  const kcal = Math.max(0, Math.round(Number(body?.kcal) || 0));
  if (!name || !kcal) return NextResponse.json({ error: "missing-fields" }, { status: 400 });

  if (!hasGemini()) return NextResponse.json({ ok: true, macros: proportionalFallback(kcal), source: "fallback" });

  try {
    const raw = await geminiGenerate({
      system:
        "Redistribute macros for the same food at the requested calories. Return strict JSON only: " +
        `{ "protein_g": number, "carbs_g": number, "fat_g": number }. ` +
        "Macros should be realistic for the named food and kcal should roughly equal 4p + 4c + 9f.",
      user: `Food: ${name}\nCalories: ${kcal}`,
      json: true,
      maxTokens: 300,
    });
    return NextResponse.json({ ok: true, macros: clean(parseJson(raw)), source: "gemini" });
  } catch {
    return NextResponse.json({ ok: true, macros: proportionalFallback(kcal), source: "fallback" });
  }
}
