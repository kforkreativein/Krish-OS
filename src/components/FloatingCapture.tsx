"use client";

import { useState } from "react";

export default function FloatingCapture() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<null | "sending" | "ok" | "err">(null);
  const [toast, setToast] = useState<string | null>(null);

  async function submit() {
    if (!text.trim()) return;
    setStatus("sending");
    try {
      const r = await fetch("/api/capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "failed");
      setStatus("ok");
      setToast(`CAPTURED // ${(j.classification?.kind ?? "note").toUpperCase()}`);
      setText("");
      setTimeout(() => setToast(null), 2000);
      setTimeout(() => setStatus(null), 600);
    } catch (e) {
      setStatus("err");
      setToast((e as Error).message);
      setTimeout(() => setToast(null), 3000);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
    if (e.key === "Escape") setOpen(false);
  }

  return (
    <>
      {toast && (
        <div className="fixed bottom-20 right-6 z-50 card px-3 py-2 text-[10px] font-mono tracking-wider text-soft">
          {toast}
        </div>
      )}
      <div className="fixed bottom-6 right-6 z-50">
        {open ? (
          <div className="card w-80 shadow-2xl">
            <header className="px-3 py-2 border-b border-line flex items-center justify-between">
              <span className="card-head">99 <span className="text-dim">//</span> <span className="text-soft">CAPTURE</span></span>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-soft text-sm" type="button">×</button>
            </header>
            <div className="p-3">
              <textarea
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKey}
                rows={3}
                placeholder="task · habit · meal · note…"
                className="w-full input-bar rounded p-2 text-sm resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[9px] font-mono text-dim tracking-wider">⌘↵ TO SEND</span>
                <button
                  onClick={submit}
                  disabled={status === "sending" || !text.trim()}
                  className="text-[10px] tracking-wider font-mono text-teal border border-teal/40 hover:bg-teal/10 disabled:opacity-30 px-3 py-1"
                  type="button"
                >
                  {status === "sending" ? "…" : "SEND"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="card w-12 h-12 grid place-items-center text-soft hover:text-teal hover:border-teal/40 font-mono text-xl"
            aria-label="capture"
            type="button"
          >
            +
          </button>
        )}
      </div>
    </>
  );
}
