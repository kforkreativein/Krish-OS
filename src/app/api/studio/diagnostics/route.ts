import { NextResponse } from "next/server";
import { OWNER_USER_ID } from "@/lib/env";
import { supabaseService } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VARIABLE_KEYS = new Set(["Format", "Idea", "Hook", "Script", "Visuals"]);

export async function GET() {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("script_diagnostics")
    .select("*")
    .eq("user_id", OWNER_USER_ID)
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) return NextResponse.json({ diagnostics: [], error: error.message }, { status: 500 });
  return NextResponse.json({ diagnostics: data ?? [] });
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.video_title || !VARIABLE_KEYS.has(body.twisted_variable)) {
    return NextResponse.json({ error: "video_title and one twisted_variable are required" }, { status: 400 });
  }

  const sb = supabaseService();
  const row = {
    user_id: OWNER_USER_ID,
    client_name: String(body.client_name || "Devi"),
    video_title: String(body.video_title),
    format_constant: String(body.format_constant || ""),
    idea_constant: String(body.idea_constant || ""),
    hook_constant: String(body.hook_constant || ""),
    script_constant: String(body.script_constant || ""),
    visual_constant: String(body.visual_constant || ""),
    twisted_variable: String(body.twisted_variable),
    views: Number(body.views) || 0,
    engagement_status: String(body.engagement_status || "Testing"),
  };

  const { data, error } = await sb.from("script_diagnostics").insert(row).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ diagnostic: data });
}
