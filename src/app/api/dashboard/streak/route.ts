import { NextResponse } from "next/server";
import { addDays, localDateKey } from "@/lib/date";
import { OWNER_USER_ID } from "@/lib/env";
import { supabaseService } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasVisit(notes: unknown): boolean {
  return Boolean((notes as { dashboard_used?: unknown } | null)?.dashboard_used);
}

export async function POST() {
  const sb = supabaseService();
  const today = localDateKey();
  const { data: existing, error: existingError } = await sb
    .from("daily_logs")
    .select("id, notes")
    .eq("user_id", OWNER_USER_ID)
    .eq("log_date", today)
    .maybeSingle();

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  const notes = {
    ...((existing?.notes as Record<string, unknown>) ?? {}),
    dashboard_used: true,
    dashboard_last_seen_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await sb.from("daily_logs").update({ notes }).eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await sb.from("daily_logs").insert({ user_id: OWNER_USER_ID, log_date: today, notes });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const since = localDateKey(addDays(new Date(), -45));
  const { data, error } = await sb
    .from("daily_logs")
    .select("log_date, notes")
    .eq("user_id", OWNER_USER_ID)
    .gte("log_date", since)
    .order("log_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const visited = new Set((data ?? []).filter((row) => hasVisit(row.notes)).map((row) => row.log_date));
  let streak = 0;
  for (let i = 0; i < 45; i += 1) {
    if (!visited.has(localDateKey(addDays(new Date(), -i)))) break;
    streak += 1;
  }

  return NextResponse.json({ streak, today });
}
