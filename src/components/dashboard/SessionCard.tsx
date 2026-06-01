"use client";

import { useEffect, useState } from "react";
import Panel from "../Panel";
import { localDateKey } from "@/lib/date";

function greeting(now: Date | null): string {
  if (!now) return "Initializing";
  const h = now.getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Late hours";
}

interface CapturedItem {
  id: string;
  text: string;
  capturedAt: string;
  done: boolean;
}

const LS_KEY = "pos.session.captures";
const INTENTION_KEY = "pos.session.daily_intention";

type DailyIntention = { date: string; text: string };

export default function SessionCard() {
  const name = process.env.NEXT_PUBLIC_OWNER_NAME || "Operator";
  const [now, setNow] = useState<Date | null>(null);
  const [text, setText] = useState("");
  const [savedIntention, setSavedIntention] = useState<DailyIntention | null>(null);
  const [status, setStatus] = useState<null | "sending" | "ok" | "err">(null);
  const [captures, setCaptures] = useState<CapturedItem[]>([]);

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Load captures from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const today = localDateKey();
      const intentionRaw = localStorage.getItem(INTENTION_KEY);
      const intention = intentionRaw ? JSON.parse(intentionRaw) as DailyIntention : null;
      if (intention?.date === today && intention.text.trim()) {
        setSavedIntention(intention);
      } else {
        localStorage.removeItem(INTENTION_KEY);
      }

      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CapturedItem[];
        setCaptures(parsed);
      }
    } catch {}
  }, []);

  // Save captures to localStorage
  function saveCaptures(next: CapturedItem[]) {
    setCaptures(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {}
  }

  function toggleDone(id: string) {
    const next = captures.map((c) => (c.id === id ? { ...c, done: !c.done } : c));
    saveCaptures(next);
  }

  function removeCapture(id: string) {
    const next = captures.filter((c) => c.id !== id);
    saveCaptures(next);
  }

  function saveIntention(value: string) {
    const intention = { date: localDateKey(), text: value.trim() };
    setSavedIntention(intention);
    try {
      localStorage.setItem(INTENTION_KEY, JSON.stringify(intention));
    } catch {}
  }

  function resetIntention() {
    setSavedIntention(null);
    setText("");
    try {
      localStorage.removeItem(INTENTION_KEY);
    } catch {}
  }

  async function capture() {
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

      saveIntention(text);

      setStatus("ok");
      setText("");
      setTimeout(() => setStatus(null), 1500);
    } catch {
      setStatus("err");
      setTimeout(() => setStatus(null), 2500);
    }
  }

  // Clear completed items older than today at midnight
  useEffect(() => {
    const checkMidnight = () => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        resetIntention();
        const active = captures.filter((c) => !c.done);
        if (active.length !== captures.length) {
          saveCaptures(active);
        }
      }
    };
    const interval = setInterval(checkMidnight, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [captures]);

  return (
    <Panel
      num="02"
      name="SESSION"
      className="session-card"
      bodyClass="session-body p-3"
      action={<div className="hidden text-right font-mono text-[11px] tracking-[0.18em] text-muted md:block">IST · UTC+5:30</div>}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl leading-tight text-soft 2xl:text-2xl">
            {greeting(now)}, <span className="italic">{name.split(" ")[0] || name}.</span>
          </h2>
          <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
            {now ? now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : "Loading session"}
          </div>
        </div>
        <div className="hidden text-right md:block">
          <div className="font-mono text-2xl tracking-[-0.04em] text-soft 2xl:text-3xl">
            {now ? now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--"}
          </div>
          <div className="terminal-label mt-0.5">LOCAL TIME</div>
        </div>
      </div>
      {savedIntention ? (
        <div className="mt-2 rounded-[8px] border border-ok/25 bg-ok/[0.045] px-3 py-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-ok">Today I will</div>
              <div className="mt-0.5 truncate text-sm text-soft">{savedIntention.text}</div>
            </div>
            <button
              onClick={resetIntention}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted hover:text-hot"
              type="button"
            >
              Reset
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 grid grid-cols-[auto_1fr_auto] items-stretch gap-2 rounded-[8px] border border-line bg-black/55 p-1">
          <span className="flex items-center whitespace-nowrap pl-2 font-mono text-[9px] uppercase tracking-[0.15em] text-muted">
            Today I will
          </span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && capture()}
            placeholder="Set today's one thing..."
            className="min-h-8 min-w-0 bg-transparent px-1 text-sm outline-none placeholder:text-dim"
          />
          <button
            onClick={capture}
            disabled={!text.trim() || status === "sending"}
            className="rounded-[7px] border border-teal/35 bg-teal/10 px-3 font-mono text-[9px] uppercase tracking-[0.16em] text-soft hover:text-teal disabled:opacity-30"
            type="button"
          >
            {status === "sending" ? "..." : status === "ok" ? "OK" : status === "err" ? "ERR" : "Capture"}
          </button>
        </div>
      )}

      {/* Captured items list */}
      {captures.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="terminal-label flex items-center justify-between">
            <span>CAPTURED ({captures.filter(c => !c.done).length}/{captures.length})</span>
            {captures.some(c => c.done) && (
              <button
                onClick={() => saveCaptures(captures.filter(c => !c.done))}
                className="text-[9px] text-muted hover:text-hot"
                type="button"
              >
                Clear completed
              </button>
            )}
          </div>
          <ul className="max-h-32 space-y-1 overflow-y-auto pr-1">
            {captures.map((item) => (
              <li
                key={item.id}
                className={`group flex items-center gap-2 rounded-[7px] border px-3 py-2 transition ${
                  item.done
                    ? "border-line/50 bg-black/20 opacity-60"
                    : "border-line bg-black/35"
                }`}
              >
                <button
                  onClick={() => toggleDone(item.id)}
                  className={`h-4 w-4 flex-shrink-0 rounded-[4px] border transition ${
                    item.done
                      ? "border-teal bg-teal"
                      : "border-line bg-black/30 hover:border-teal/50"
                  }`}
                  type="button"
                  aria-label={item.done ? "Mark undone" : "Mark done"}
                >
                  {item.done && (
                    <svg className="h-full w-full p-0.5 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
                <span className={`min-w-0 flex-1 truncate text-sm ${item.done ? "text-muted line-through" : "text-soft"}`}>
                  {item.text}
                </span>
                <button
                  onClick={() => removeCapture(item.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted hover:text-hot text-xs px-1"
                  type="button"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
