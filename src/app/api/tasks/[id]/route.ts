import { NextResponse } from "next/server";
import { OWNER_USER_ID } from "@/lib/env";
import { supabaseService } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set([
  "title", "description", "urgency", "key", "priority_score", "tags", "due_date", "entity_id", "owner", "completed_at",
]);
const SELECT = "id, title, description, urgency, key, priority_score, tags, due_date, entity_id, owner, completed_at, created_at";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "bad-request" }, { status: 400 });
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(body)) if (ALLOWED.has(key)) patch[key] = body[key];
  const { data, error } = await supabaseService()
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .eq("user_id", OWNER_USER_ID)
    .select(SELECT)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await supabaseService()
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("user_id", OWNER_USER_ID);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
