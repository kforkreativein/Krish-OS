import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase";
import { OWNER_USER_ID } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { title?: string; urgency?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad-request" }, { status: 400 }); }
  if (!body.title) return NextResponse.json({ error: "missing-title" }, { status: 400 });
  const sb = supabaseService();
  const { data, error } = await sb
    .from("tasks")
    .insert({
      user_id: OWNER_USER_ID,
      title: body.title,
      urgency: body.urgency || "Someday",
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data?.id });
}
