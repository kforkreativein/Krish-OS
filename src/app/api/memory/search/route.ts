import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase";
import { OWNER_USER_ID } from "@/lib/env";
import { embedText } from "@/lib/router/embed";
import { geminiStream, hasGemini } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Match { id: string; text: string; source_type: string | null; source_id: string | null; created_at: string; distance?: number }

async function vectorSearch(embedding: number[], limit = 20): Promise<Match[]> {
  const sb = supabaseService();
  const { data, error } = await sb.rpc("match_memory_chunks", {
    p_user_id: OWNER_USER_ID,
    p_query: embedding as unknown as string,
    p_limit: limit,
  });
  if (!error && data) return data as Match[];

  const { data: rows } = await sb
    .from("memory_chunks")
    .select("id, text, source_type, source_id, created_at, embedding")
    .eq("user_id", OWNER_USER_ID)
    .order("created_at", { ascending: false })
    .limit(500);
  if (!rows) return [];

  function parseEmbedding(e: unknown): number[] | null {
    if (Array.isArray(e)) return e as number[];
    if (typeof e === "string") { try { return JSON.parse(e); } catch { return null; } }
    return null;
  }
  function cosineDistance(a: number[], b: number[]): number {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return 1 - dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
  }
  return rows
    .map((r) => {
      const emb = parseEmbedding((r as { embedding: unknown }).embedding);
      if (!emb || emb.length !== embedding.length) return null;
      return {
        id: r.id, text: r.text, source_type: r.source_type, source_id: r.source_id, created_at: r.created_at,
        distance: cosineDistance(embedding, emb),
      };
    })
    .filter((x): x is Match & { distance: number } => !!x)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

export async function POST(req: Request) {
  let body: { query?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad-request" }, { status: 400 }); }
  const query = body.query?.trim();
  if (!query) return NextResponse.json({ error: "empty" }, { status: 400 });

  const embedding = await embedText(query);
  if (!embedding) return NextResponse.json({ error: "embedding-failed" }, { status: 500 });

  const matches = await vectorSearch(embedding, 20);

  if (!hasGemini()) {
    return NextResponse.json({ matches, answer: "(set GEMINI_API_KEY to enable synthesis)" });
  }

  const context = matches.map((m, i) => `[${i + 1}] (${m.source_type}) ${m.text}`).join("\n\n");
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`__MATCHES__${JSON.stringify(matches)}\n__ANSWER__\n`));
        for await (const delta of geminiStream({
          system: "You are a personal assistant. Answer using ONLY this context. Cite sources inline like [1], [2]. If the context is insufficient, say so.",
          user: `Context:\n${context}\n\nQuestion: ${query}`,
          maxTokens: 700,
        })) {
          controller.enqueue(encoder.encode(delta));
        }
        controller.close();
      } catch (e) {
        controller.enqueue(encoder.encode(`\n[error: ${(e as Error).message}]`));
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
