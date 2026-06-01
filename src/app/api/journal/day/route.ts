import { NextResponse } from "next/server";
import { geminiGenerate, hasGemini } from "@/lib/gemini";
import { supabaseService } from "@/lib/supabase";
import { OWNER_USER_ID } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Capture { id: string; raw_text: string | null; created_at: string; classification: { kind?: string } | null }

async function summarize(captures: Capture[]): Promise<string> {
  if (!captures.length || !hasGemini()) return "";
  const transcript = captures.map((c) => `- (${c.created_at}) ${c.raw_text || ""}`).join("\n");
  try {
    return await geminiGenerate({
      system: "Summarize this day's wind-down captures into 3-6 reflective bullet points in the user's voice. Be honest, concise, no fluff.",
      user: transcript,
      maxTokens: 500,
    });
  } catch (e) {
    console.warn("[journal] summarize failed:", e);
    return "";
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "missing-date" }, { status: 400 });
  const sb = supabaseService();

  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;

  const { data, error } = await sb
    .from("raw_captures")
    .select("id, raw_text, created_at, classification")
    .eq("user_id", OWNER_USER_ID)
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const all = (data as Capture[]) || [];
  const journalish = all.filter((c) => c.classification?.kind === "journal");
  const summary = await summarize(journalish);
  return NextResponse.json({ captures: all, summary });
}
