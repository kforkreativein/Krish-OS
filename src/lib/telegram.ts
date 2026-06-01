const TG_API = "https://api.telegram.org";

function botToken(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN not set");
  return t;
}

export async function getFileUrl(fileId: string): Promise<string> {
  const r = await fetch(`${TG_API}/bot${botToken()}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const j = await r.json();
  if (!j.ok) throw new Error(`telegram getFile failed: ${JSON.stringify(j)}`);
  return `${TG_API}/file/bot${botToken()}/${j.result.file_path}`;
}

export async function downloadFile(fileId: string): Promise<ArrayBuffer> {
  const url = await getFileUrl(fileId);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`telegram file download failed: ${r.status}`);
  return await r.arrayBuffer();
}

export async function sendMessage(chatId: number | string, text: string, replyMarkup?: unknown): Promise<void> {
  await fetch(`${TG_API}/bot${botToken()}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", reply_markup: replyMarkup }),
  });
}

export async function answerCallbackQuery(callbackQueryId: string, text: string): Promise<void> {
  await fetch(`${TG_API}/bot${botToken()}/answerCallbackQuery`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}
