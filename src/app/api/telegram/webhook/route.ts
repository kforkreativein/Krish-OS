import { NextResponse } from "next/server";
import { answerCallbackQuery, downloadFile, sendMessage } from "@/lib/telegram";
import { transcribeOgg } from "@/lib/transcribe";
import { markTaskKey, runCapturePipeline, updateTaskUrgency } from "@/lib/router/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TgVoice { file_id: string; mime_type?: string; duration?: number }
interface TgMessage {
  message_id: number;
  from?: { id: number };
  chat: { id: number };
  text?: string;
  voice?: TgVoice;
  audio?: TgVoice;
}
interface TgCallbackQuery {
  id: string;
  from?: { id: number };
  message?: { chat: { id: number } };
  data?: string;
}
interface TgUpdate { update_id: number; message?: TgMessage; callback_query?: TgCallbackQuery }

function urgencyKeyboard(taskId: string | null) {
  if (!taskId) return undefined;
  return {
    inline_keyboard: [[
      ["Today", "Today"],
      ["This Week", "This Week"],
    ], [
      ["This Month", "This Month"],
      ["Someday", "Someday"],
      ["Key", "KEY"],
    ]].map((row) => row.map(([label, value]) => ({ text: label, callback_data: `urgency:${taskId}:${value}` }))),
  };
}

export async function POST(req: Request) {
  // 1. Verify secret header
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const gotSecret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!expectedSecret || gotSecret !== expectedSecret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const msg = update.message;
  if (update.callback_query) {
    const allowedUser = process.env.TELEGRAM_USER_ID;
    if (!allowedUser || String(update.callback_query.from?.id) !== String(allowedUser)) return NextResponse.json({ ok: true });
    const [, taskId, value] = (update.callback_query.data || "").split(":");
    if (taskId && value) {
      if (value === "KEY") await markTaskKey(taskId);
      else await updateTaskUrgency(taskId, value);
      await answerCallbackQuery(update.callback_query.id, value === "KEY" ? "Marked as key/today." : `Moved to ${value}.`);
    }
    return NextResponse.json({ ok: true });
  }

  if (!msg) return NextResponse.json({ ok: true });

  // 2. Verify sender
  const allowedUser = process.env.TELEGRAM_USER_ID;
  if (!allowedUser || String(msg.from?.id) !== String(allowedUser)) {
    // Don't 403 (Telegram retries); just no-op.
    return NextResponse.json({ ok: true, ignored: "wrong-user" });
  }

  try {
    let text = msg.text?.trim() || "";
    let audioUrl: string | null = null;

    // 3. Voice → Whisper
    const voice = msg.voice || msg.audio;
    if (voice) {
      const buf = await downloadFile(voice.file_id);
      text = (await transcribeOgg(buf)).trim();
      audioUrl = `tg://${voice.file_id}`;
    }

    if (!text) {
      await sendMessage(msg.chat.id, "_Empty capture — nothing to do._");
      return NextResponse.json({ ok: true });
    }

    // 4. Pipeline: classify → write → route → embed → audit
    const result = await runCapturePipeline({ text, source: "telegram", audioUrl });

    // 5. Reply
    const c = result.classification;
    const reply =
      `✓ ${c.kind.toUpperCase()}` +
      (result.routed_to ? ` → \`${result.routed_to}\`` : "") +
      `\n*${c.title}*` +
      (c.kind === "task" ? `\n_urgency:_ ${c.urgency}` : "") +
      (c.tags.length ? `\n_tags:_ ${c.tags.join(", ")}` : "");
    await sendMessage(msg.chat.id, reply, urgencyKeyboard(result.routed_to === "tasks" ? result.routed_id : null));

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[telegram/webhook] error:", e);
    try {
      await sendMessage(msg.chat.id, `⚠️ capture failed: ${(e as Error).message}`);
    } catch {}
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
