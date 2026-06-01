import { OWNER_USER_ID } from "../env";
import { supabaseService } from "../supabase";
import { classifyCapture, type Classification } from "./classifyCapture";
import { embedText } from "./embed";

export interface RunCaptureInput {
  text: string;
  source: string;           // 'telegram' | 'web' | ...
  audioUrl?: string | null;
}

export interface RunCaptureResult {
  captureId: string;
  classification: Classification;
  llm_source: string;
  routed_to: string | null;
  routed_id: string | null;
}

/**
 * Single pipeline: classify → write raw_capture → route → embed → audit.
 * Used by Telegram webhook and /api/capture.
 */
export async function runCapturePipeline(input: RunCaptureInput): Promise<RunCaptureResult> {
  const sb = supabaseService();

  // 1. classify
  const { classification, llm_source } = await classifyCapture(input.text);

  // 2. insert raw capture
  const { data: capture, error: capErr } = await sb
    .from("raw_captures")
    .insert({
      user_id: OWNER_USER_ID,
      source: input.source,
      raw_text: input.text,
      audio_url: input.audioUrl ?? null,
      classification,
      llm_source,
    })
    .select("id")
    .single();
  if (capErr || !capture) throw new Error(`raw_captures insert failed: ${capErr?.message}`);
  const captureId = capture.id as string;

  // 3. route to downstream table
  let routed_to: string | null = null;
  let routed_id: string | null = null;

  if (classification.kind === "task") {
    const { data, error } = await sb
      .from("tasks")
      .insert({
        user_id: OWNER_USER_ID,
        title: classification.title || classification.summary || input.text.slice(0, 80),
        description: input.text,
        urgency: classification.urgency,
        key: !!classification.key,
        tags: classification.tags,
        entity_id: classification.entity_id,
      })
      .select("id")
      .single();
    if (!error && data) {
      routed_to = "tasks";
      routed_id = data.id;
    }
  } else if (classification.kind === "decision") {
    const { data, error } = await sb
      .from("decisions")
      .insert({
        user_id: OWNER_USER_ID,
        title: classification.title || classification.summary || input.text.slice(0, 80),
        description: input.text,
        tags: classification.tags,
        entity_id: classification.entity_id,
      })
      .select("id")
      .single();
    if (!error && data) {
      routed_to = "decisions";
      routed_id = data.id;
    }
  } else if (classification.kind === "note") {
    const { data, error } = await sb
      .from("notes")
      .insert({
        user_id: OWNER_USER_ID,
        title: classification.title || input.text.slice(0, 80),
        body: input.text,
        tags: classification.tags,
        entity_id: classification.entity_id,
      })
      .select("id")
      .single();
    if (!error && data) {
      routed_to = "notes";
      routed_id = data.id;
    }
  } else if (
    classification.kind === "habit" ||
    classification.kind === "nutrition" ||
    classification.kind === "journal" ||
    classification.kind === "finance" ||
    classification.kind === "goal"
  ) {
    // Append into today's daily_log notes under the relevant bucket.
    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await sb
      .from("daily_logs")
      .select("id, notes")
      .eq("user_id", OWNER_USER_ID)
      .eq("log_date", today)
      .maybeSingle();

    const bucket = classification.kind;
    const entry = {
      at: new Date().toISOString(),
      text: input.text,
      summary: classification.summary,
      tags: classification.tags,
      capture_id: captureId,
    };

    if (existing) {
      const notes = (existing.notes as Record<string, unknown>) ?? {};
      const list = Array.isArray(notes[bucket]) ? (notes[bucket] as unknown[]) : [];
      const nextNotes = { ...notes, [bucket]: [...list, entry] };
      const { error } = await sb
        .from("daily_logs")
        .update({ notes: nextNotes })
        .eq("id", existing.id);
      if (!error) {
        routed_to = "daily_logs";
        routed_id = existing.id;
      }
    } else {
      const { data, error } = await sb
        .from("daily_logs")
        .insert({
          user_id: OWNER_USER_ID,
          log_date: today,
          notes: { [bucket]: [entry] },
        })
        .select("id")
        .single();
      if (!error && data) {
        routed_to = "daily_logs";
        routed_id = data.id;
      }
    }
  }
  // kind === "note" → stays only in raw_captures + memory.

  // 4. patch capture with routing info
  await sb
    .from("raw_captures")
    .update({ routed_to, routed_id })
    .eq("id", captureId);

  // 5. embed → memory_chunks
  const embedding = await embedText(input.text);
  if (embedding) {
    await sb.from("memory_chunks").insert({
      user_id: OWNER_USER_ID,
      source_type: "capture",
      source_id: captureId,
      text: input.text,
      embedding: embedding as unknown as string, // pgvector accepts JSON array
    });
  }

  // 6. audit
  await sb.from("audit_log").insert({
    user_id: OWNER_USER_ID,
    action: "capture",
    resource_type: "raw_captures",
    resource_id: captureId,
    metadata: { source: input.source, kind: classification.kind, routed_to },
  });

  return { captureId, classification, llm_source, routed_to, routed_id };
}

export async function updateTaskUrgency(taskId: string, urgency: string): Promise<void> {
  const allowed = new Set(["Today", "This Week", "This Month", "Someday"]);
  if (!allowed.has(urgency)) return;
  await supabaseService()
    .from("tasks")
    .update({ urgency })
    .eq("id", taskId)
    .eq("user_id", OWNER_USER_ID);
}

export async function markTaskKey(taskId: string): Promise<void> {
  await supabaseService()
    .from("tasks")
    .update({ key: true, urgency: "Today" })
    .eq("id", taskId)
    .eq("user_id", OWNER_USER_ID);
}
