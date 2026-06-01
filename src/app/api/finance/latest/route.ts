import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase";
import { OWNER_USER_ID } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only: pull the most recent daily_logs.notes.finance snapshot. Never triggers AI.
export async function GET() {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("daily_logs")
    .select("log_date, notes")
    .eq("user_id", OWNER_USER_ID)
    .not("notes->finance", "is", null)
    .order("log_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const snapshot = (data?.notes as { finance?: unknown } | null)?.finance ?? {};
  return NextResponse.json({ snapshot, as_of: data?.log_date ?? null });
}
