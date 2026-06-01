import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase";
import { OWNER_USER_ID } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set([
  "title", "description", "urgency", "key", "priority_score", "tags", "due_date", "completed_at",
]);

export async function POST(req: Request) {
  let body: { id?: string; patch?: Record<string, unknown> };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad-request" }, { status: 400 }); }
  if (!body.id || !body.patch) return NextResponse.json({ error: "missing-fields" }, { status: 400 });
  const patch: Record<string, unknown> = {};
  for (const k of Object.keys(body.patch)) if (ALLOWED.has(k)) patch[k] = body.patch[k];
  const sb = supabaseService();
  const { error } = await sb.from("tasks").update(patch).eq("id", body.id).eq("user_id", OWNER_USER_ID);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
