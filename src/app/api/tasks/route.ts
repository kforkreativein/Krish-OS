import { NextResponse } from "next/server";
import { OWNER_USER_ID } from "@/lib/env";
import { supabaseService } from "@/lib/supabase";
import { URGENCIES, type Urgency } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SELECT = "id, title, description, urgency, key, priority_score, tags, due_date, entity_id, owner, completed_at, created_at";

function urgency(value: unknown): Urgency {
  return URGENCIES.includes(value as Urgency) ? value as Urgency : "Someday";
}

export async function GET(req: Request) {
  const status = new URL(req.url).searchParams.get("status") || "open";
  const sb = supabaseService();
  let query = sb
    .from("tasks")
    .select(SELECT)
    .eq("user_id", OWNER_USER_ID)
    .order("priority_score", { ascending: false })
    .order("created_at", { ascending: false });

  query = status === "done" ? query.not("completed_at", "is", null) : query.is("completed_at", null);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: data || [] });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body?.title) return NextResponse.json({ error: "missing-title" }, { status: 400 });

  const sb = supabaseService();
  const nextUrgency = urgency(body.urgency);
  const { data: maxRows } = await sb
    .from("tasks")
    .select("priority_score")
    .eq("user_id", OWNER_USER_ID)
    .eq("urgency", nextUrgency)
    .is("completed_at", null)
    .order("priority_score", { ascending: false })
    .limit(1);
  const maxScore = Number(maxRows?.[0]?.priority_score) || 0;

  const { data, error } = await sb
    .from("tasks")
    .insert({
      user_id: OWNER_USER_ID,
      title: String(body.title).trim(),
      description: typeof body.description === "string" ? body.description : null,
      urgency: nextUrgency,
      key: Boolean(body.key),
      priority_score: maxScore + 10,
      tags: Array.isArray(body.tags) ? body.tags.filter((tag) => typeof tag === "string").slice(0, 12) : [],
      due_date: typeof body.due_date === "string" ? body.due_date : null,
      entity_id: typeof body.entity_id === "string" ? body.entity_id : null,
      owner: typeof body.owner === "string" ? body.owner : null,
    })
    .select(SELECT)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}
