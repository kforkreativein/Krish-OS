import { NextResponse } from "next/server";
import { OWNER_USER_ID } from "@/lib/env";
import { supabaseService } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["IDEATION", "SCRIPTING", "IN_PRODUCTION", "READY_TO_POST"] as const;
type ContentStatus = typeof STATUSES[number];

const SELECT = "id, client_name, hook_title, status, created_at";

function status(value: unknown): ContentStatus {
  return STATUSES.includes(value as ContentStatus) ? value as ContentStatus : "IDEATION";
}

export async function GET() {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("content_pipeline")
    .select(SELECT)
    .eq("user_id", OWNER_USER_ID)
    .order("created_at", { ascending: false })
    .limit(160);

  if (error) return NextResponse.json({ items: [], error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const hookTitle = typeof body?.hook_title === "string" ? body.hook_title.trim() : "";
  if (!hookTitle) return NextResponse.json({ error: "hook_title is required" }, { status: 400 });

  const sb = supabaseService();
  const { data, error } = await sb
    .from("content_pipeline")
    .insert({
      user_id: OWNER_USER_ID,
      client_name: typeof body?.client_name === "string" && body.client_name.trim() ? body.client_name.trim() : "Devi",
      hook_title: hookTitle,
      status: status(body?.status),
    })
    .select(SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body?.id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const patch: Record<string, string> = {};
  if (body.status) patch.status = status(body.status);
  if (typeof body.client_name === "string" && body.client_name.trim()) patch.client_name = body.client_name.trim();
  if (typeof body.hook_title === "string" && body.hook_title.trim()) patch.hook_title = body.hook_title.trim();
  if (!Object.keys(patch).length) return NextResponse.json({ error: "no changes supplied" }, { status: 400 });

  const sb = supabaseService();
  const { data, error } = await sb
    .from("content_pipeline")
    .update(patch)
    .eq("user_id", OWNER_USER_ID)
    .eq("id", String(body.id))
    .select(SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const sb = supabaseService();
  const { error } = await sb
    .from("content_pipeline")
    .delete()
    .eq("user_id", OWNER_USER_ID)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
