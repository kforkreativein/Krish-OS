import { NextResponse } from "next/server";
import { runCapturePipeline } from "@/lib/router/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }
  const text = body.text?.trim();
  if (!text) return NextResponse.json({ error: "empty" }, { status: 400 });

  try {
    const result = await runCapturePipeline({ text, source: "web" });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[/api/capture] error:", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
