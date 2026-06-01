import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase";
import { OWNER_USER_ID } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "missing-date" }, { status: 400 });
  const sb = supabaseService();
  const { data, error } = await sb
    .from("daily_logs")
    .select("notes")
    .eq("user_id", OWNER_USER_ID)
    .eq("log_date", date)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notes: data?.notes ?? {} });
}
