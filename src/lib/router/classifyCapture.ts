import { geminiGenerate, hasGemini } from "../gemini";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export type Urgency = "Today" | "This Week" | "This Month" | "Someday";
export type CaptureKind =
  | "task"
  | "decision"
  | "habit"
  | "nutrition"
  | "journal"
  | "finance"
  | "goal"
  | "note";

export interface Classification {
  kind: CaptureKind;
  urgency: Urgency;
  entity_id: string | null;
  tags: string[];
  summary: string;
  title?: string;
  key?: boolean;
}

const SYSTEM = `You are the classifier for a personal OS. Given a raw capture (text from a voice note or web form), return STRICT JSON with this shape:

{
  "kind": "task" | "decision" | "habit" | "nutrition" | "journal" | "finance" | "goal" | "note",
  "urgency": "Today" | "This Week" | "This Month" | "Someday",
  "entity_id": null,
  "tags": string[],
  "summary": string,
  "title": string,
  "key": boolean
}

Rules:
- "task" = an actionable todo. "decision" = a choice/commitment already made. "habit" = a daily habit toggle. "nutrition" = food/macros. "journal" = a wind-down reflection. "finance" = money/net-worth. "goal" = weekly/monthly intent. "note" = anything else.
- "key" = true only if the user explicitly flags it as a key blocker or critical.
- "entity_id" is always null (we don't resolve entities here).
- "title" should be <= 80 chars.
- "summary" should be <= 200 chars.
- Return JSON only, no prose, no markdown fences.`;

function parseJson(raw: string): Partial<Classification> | null {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch { return null; }
  }
}

function normalize(text: string, partial: Partial<Classification> | null): Classification {
  const allowedKinds: CaptureKind[] = ["task", "decision", "habit", "nutrition", "journal", "finance", "goal", "note"];
  const allowedUrg: Urgency[] = ["Today", "This Week", "This Month", "Someday"];
  const kind = (partial?.kind && allowedKinds.includes(partial.kind)) ? partial.kind : "note";
  const urgency = (partial?.urgency && allowedUrg.includes(partial.urgency)) ? partial.urgency : "Someday";
  const tags = Array.isArray(partial?.tags) ? partial!.tags!.filter((t) => typeof t === "string").slice(0, 10) : [];
  const summary = typeof partial?.summary === "string" ? partial!.summary!.slice(0, 280) : text.slice(0, 180);
  const title = typeof partial?.title === "string" && partial.title.length > 0 ? partial.title.slice(0, 80) : text.slice(0, 80);
  return { kind, urgency, entity_id: null, tags, summary, title, key: !!partial?.key };
}

function regexFallback(text: string): Classification {
  const lower = text.toLowerCase();
  let kind: CaptureKind = "note";
  if (/\b(buy|email|call|fix|build|ship|book|schedule|todo|need to|remember to)\b/.test(lower)) kind = "task";
  else if (/\b(decided|decision|choose|chosen|we will|i will go with)\b/.test(lower)) kind = "decision";
  else if (/\b(ate|breakfast|lunch|dinner|snack|protein|calories|kcal)\b/.test(lower)) kind = "nutrition";
  else if (/\b(gym|workout|supplement|stretched|run|ran)\b/.test(lower)) kind = "habit";
  else if (/\b(net worth|spent|bought|invested|saved|finance|hysa)\b/.test(lower)) kind = "finance";
  else if (/\b(goal|aim|this week|this month)\b/.test(lower)) kind = "goal";
  else if (/\b(feeling|today was|reflecting|wind ?down)\b/.test(lower)) kind = "journal";
  let urgency: Urgency = "Someday";
  if (/\b(today|now|urgent|asap)\b/.test(lower)) urgency = "Today";
  else if (/\bthis week\b/.test(lower)) urgency = "This Week";
  else if (/\bthis month\b/.test(lower)) urgency = "This Month";
  return {
    kind, urgency, entity_id: null, tags: [],
    summary: text.slice(0, 180), title: text.slice(0, 80),
    key: /\bkey\b/.test(lower),
  };
}

export interface ClassifyResult {
  classification: Classification;
  llm_source: "claude" | "openai" | "gemini" | "regex";
}

export async function classifyCapture(text: string): Promise<ClassifyResult> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const message = await anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest",
        max_tokens: 500,
        messages: [{ role: "user", content: `${SYSTEM}\n\nCapture:\n${text}` }],
      });
      const raw = message.content.map((part) => part.type === "text" ? part.text : "").join("");
      const parsed = parseJson(raw);
      if (parsed) return { classification: normalize(text, parsed), llm_source: "claude" };
    } catch (e) {
      console.warn("[classify] claude failed:", e);
    }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.responses.create({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        input: `${SYSTEM}\n\nCapture:\n${text}`,
      });
      const parsed = parseJson(response.output_text);
      if (parsed) return { classification: normalize(text, parsed), llm_source: "openai" };
    } catch (e) {
      console.warn("[classify] openai failed:", e);
    }
  }

  if (hasGemini()) {
    try {
      const raw = await geminiGenerate({ system: SYSTEM, user: text, json: true, maxTokens: 400 });
      const parsed = parseJson(raw);
      if (parsed) return { classification: normalize(text, parsed), llm_source: "gemini" };
    } catch (e) {
      console.warn("[classify] gemini failed:", e);
    }
  }
  return { classification: regexFallback(text), llm_source: "regex" };
}
