import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase";
import { OWNER_USER_ID } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Patch shape: { habits?, nutrition?, goals?, finance?, ... } merged into notes.
export async function POST(req: Request) {
  let body: { date?: string; patch?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }
  const { date, patch } = body;
  if (!date || !patch || typeof patch !== "object") {
    return NextResponse.json({ error: "missing-fields" }, { status: 400 });
  }
  const sb = supabaseService();
  const { data: existing } = await sb
    .from("daily_logs")
    .select("id, notes")
    .eq("user_id", OWNER_USER_ID)
    .eq("log_date", date)
    .maybeSingle();

  const mergedNotes = { ...((existing?.notes as Record<string, unknown>) ?? {}), ...patch };

  if (existing) {
    const { error } = await sb.from("daily_logs").update({ notes: mergedNotes }).eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await sb
      .from("daily_logs")
      .insert({ user_id: OWNER_USER_ID, log_date: date, notes: mergedNotes });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
