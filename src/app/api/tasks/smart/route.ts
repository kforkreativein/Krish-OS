import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { NextResponse } from "next/server";
import { OWNER_USER_ID } from "@/lib/env";
import { supabaseService } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TaskLite = { id: string; title: string; description: string | null; urgency: string; tags: string[]; entity_id: string | null };

function parseIds(raw: string, valid: Set<string>): string[] {
  const match = raw.match(/\[[\s\S]*\]/);
  const parsed = match ? JSON.parse(match[0]) : JSON.parse(raw);
  return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string" && valid.has(id)) : [];
}

function fallback(query: string, tasks: TaskLite[]): string[] {
  const terms = query.toLowerCase().split(/\W+/).filter((term) => term.length > 2);
  return tasks
    .map((task) => ({
      id: task.id,
      score: terms.reduce((score, term) => score + (`${task.title} ${task.description || ""} ${task.tags.join(" ")} ${task.entity_id || ""}`.toLowerCase().includes(term) ? 1 : 0), 0),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map((item) => item.id);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { query?: string } | null;
  const query = body?.query?.trim();
  if (!query) return NextResponse.json({ ids: [] });

  const { data, error } = await supabaseService()
    .from("tasks")
    .select("id, title, description, urgency, tags, entity_id")
    .eq("user_id", OWNER_USER_ID)
    .is("completed_at", null)
    .limit(120);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const tasks = (data || []) as TaskLite[];
  const valid = new Set(tasks.map((task) => task.id));
  const prompt = `Query: ${query}\nTasks: ${JSON.stringify(tasks)}\nReturn only a JSON array of matching task IDs, best first.`;

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const message = await anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      });
      const text = message.content.map((part) => part.type === "text" ? part.text : "").join("");
      return NextResponse.json({ ids: parseIds(text, valid), source: "claude" });
    } catch (error) {
      console.warn("[tasks/smart] claude failed", error);
    }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.responses.create({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        input: prompt,
      });
      return NextResponse.json({ ids: parseIds(response.output_text, valid), source: "openai" });
    } catch (error) {
      console.warn("[tasks/smart] openai failed", error);
    }
  }

  return NextResponse.json({ ids: fallback(query, tasks), source: "regex" });
}
