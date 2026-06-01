import { NextResponse } from "next/server";
import { OWNER_USER_ID } from "@/lib/env";
import { supabaseService } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = new Set(["Sent", "Replied", "Booked", "Closed"]);

export async function GET() {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("outreach_pipeline")
    .select("*")
    .eq("user_id", OWNER_USER_ID)
    .order("date_sent", { ascending: false })
    .limit(120);

  if (error) return NextResponse.json({ prospects: [], error: error.message }, { status: 500 });
  return NextResponse.json({ prospects: data ?? [] });
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.prospect_name) return NextResponse.json({ error: "prospect_name is required" }, { status: 400 });

  const sb = supabaseService();
  const row = {
    user_id: OWNER_USER_ID,
    prospect_name: String(body.prospect_name),
    script_variation: String(body.script_variation || "Script A"),
    status: STATUSES.has(body.status) ? String(body.status) : "Sent",
    date_sent: body.date_sent || new Date().toISOString().slice(0, 10),
  };

  const { data, error } = await sb.from("outreach_pipeline").insert(row).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prospect: data });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  if (!body.id || !STATUSES.has(body.status)) {
    return NextResponse.json({ error: "id and valid status are required" }, { status: 400 });
  }

  const sb = supabaseService();
  const { data, error } = await sb
    .from("outreach_pipeline")
    .update({ status: body.status })
    .eq("user_id", OWNER_USER_ID)
    .eq("id", body.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prospect: data });
}
