"use client";

import { URGENCIES, type Task } from "@/lib/types";

const urgencyColor: Record<string, string> = {
  Today: "text-hot",
  "This Week": "text-orange",
  "This Month": "text-teal",
  Someday: "text-muted",
};

export default function ListView({ tasks, onOpen }: { tasks: Task[]; onOpen: (t: Task) => void }) {
  const sorted = [...tasks].sort((a, b) => URGENCIES.indexOf(a.urgency) - URGENCIES.indexOf(b.urgency));
  return (
    <div className="card divide-y divide-line">
      {sorted.map((t) => (
        <button
          key={t.id}
          onClick={() => onOpen(t)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-elev"
          type="button"
        >
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.key ? "bg-hot" : "bg-dim"}`} />
          <span className="flex-1 text-sm truncate text-soft">{t.title}</span>
          <span className={`text-[10px] uppercase tracking-wider font-mono ${urgencyColor[t.urgency]}`}>
            {t.urgency}
          </span>
        </button>
      ))}
      {sorted.length === 0 && <div className="px-4 py-6 text-sm text-muted text-center">No open tasks.</div>}
    </div>
  );
}
