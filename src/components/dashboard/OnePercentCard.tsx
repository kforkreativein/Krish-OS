"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Panel from "../Panel";
import { addDays, localDateKey } from "@/lib/date";
import { syncOnePercentToHabits } from "@/lib/habits-storage";

interface ImprovementLog {
  date: string;
  text: string;
  area: string;
}

const LS_KEY = "pos.one-percent.logs";
const AREAS = ["Personal", "Business"];

function loadLogs(): ImprovementLog[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLogs(logs: ImprovementLog[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(logs));
  } catch {}
}

export default function OnePercentCard() {
  const today = localDateKey();
  const [logs, setLogs] = useState<ImprovementLog[]>([]);
  const [area, setArea] = useState(AREAS[0]);
  const [text, setText] = useState("");

  useEffect(() => {
    const local = loadLogs();
    setLogs(local);
    const current = local.find((item) => item.date === today);
    if (current) {
      setArea(AREAS.includes(current.area) ? current.area : AREAS[0]);
      setText(current.text);
    }
  }, [today]);

  const streak = useMemo(() => {
    let count = 0;
    for (let i = 0; i < 30; i += 1) {
      const key = localDateKey(addDays(new Date(), -i));
      if (logs.some((item) => item.date === key && item.text.trim())) count += 1;
      else break;
    }
    return count;
  }, [logs]);

  const persist = useCallback(async (nextText: string, nextArea: string) => {
    const next = [
      { date: today, text: nextText, area: nextArea },
      ...logs.filter((item) => item.date !== today),
    ].filter((item) => item.text.trim()).slice(0, 14);
    setLogs(next);
    saveLogs(next);
    await Promise.all([
      fetch("/api/daily/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date: today, patch: { one_percent: next[0] } }),
      }).catch(() => {}),
      syncOnePercentToHabits(today, nextText, nextArea),
    ]);
  }, [logs, today]);

  return (
    <Panel
      num="05"
      name="1% BETTER"
      className="one-percent-card"
      bodyClass="one-percent-body p-4"
      action={<span className="font-mono text-[11px] tracking-[0.16em] text-ok">{streak}D STREAK</span>}
    >
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
        <div className="min-h-0">
          <div className="terminal-label mb-1.5">AREA</div>
          <div className="grid grid-cols-2 gap-1.5">
            {AREAS.map((option) => (
              <button
                key={option}
                onClick={() => {
                  setArea(option);
                  if (text.trim()) persist(text, option);
                }}
                className={`min-h-8 rounded-[7px] border px-3 py-1.5 text-center font-mono text-[9px] uppercase leading-snug tracking-[0.12em] ${
                  area === option ? "border-teal/45 bg-teal/10 text-teal" : "border-line bg-black/25 text-muted hover:text-soft"
                }`}
                type="button"
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        <div className="min-w-0">
          <div className="terminal-label mb-1.5">TODAY'S 1% MOVE</div>
          <div className="grid grid-cols-[1fr_54px] gap-2">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="What is the one small improvement that compounds today?"
              className="input-bar min-h-[58px] resize-none px-3 py-2 text-sm text-soft"
            />
            <button
              onClick={() => persist(text, area)}
              disabled={!text.trim()}
              className="glass-button w-14 font-mono text-[9px] tracking-[0.12em] text-soft hover:text-teal disabled:opacity-35"
              type="button"
            >
              LOG
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-[8px] border border-line bg-black/25">
          <div className="sticky top-0 grid grid-cols-[78px_78px_1fr] gap-2 border-b border-line bg-black/85 px-3 py-2 font-mono text-[8px] uppercase tracking-[0.14em] text-muted">
            <span>Date</span>
            <span>Area</span>
            <span>History</span>
          </div>
          <div className="divide-y divide-line">
            {(logs.length ? logs : [{ date: "—", area: "System", text: "No 1% logs yet. Start today." }]).slice(0, 12).map((item) => (
              <div key={`${item.date}-${item.text}`} className="grid grid-cols-[78px_78px_1fr] gap-2 px-3 py-2 text-[10px]">
                <span className="font-mono text-muted">{item.date || "—"}</span>
                <span className="font-mono uppercase leading-snug tracking-[0.08em] text-teal">{item.area}</span>
                <span className="leading-snug text-soft">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}
