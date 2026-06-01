import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase";
import { OWNER_USER_ID } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("tasks")
    .select("id, title, description, urgency, key, priority_score, tags, due_date, entity_id, completed_at, created_at")
    .eq("user_id", OWNER_USER_ID)
    .is("completed_at", null)
    .order("priority_score", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: data || [] });
}
