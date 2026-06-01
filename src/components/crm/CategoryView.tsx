"use client";

import { type Task } from "@/lib/types";
import Panel from "../Panel";

export default function CategoryView({ tasks, onOpen }: { tasks: Task[]; onOpen: (t: Task) => void }) {
  const groups = new Map<string, Task[]>();
  for (const t of tasks) {
    const key = t.entity_id || "untagged";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  const entries = Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {entries.map(([tag, list]) => (
        <Panel key={tag} name={tag.toUpperCase()} action={<span className="font-mono text-[10px] text-muted">{list.length}</span>}>
          <div className="space-y-1.5">
            {list.map((t) => (
              <button
                key={t.id}
                onClick={() => onOpen(t)}
                className="w-full text-left text-sm text-soft hover:text-teal truncate"
                type="button"
              >
                · {t.title}
              </button>
            ))}
          </div>
        </Panel>
      ))}
      {entries.length === 0 && <div className="text-sm text-muted">No tasks.</div>}
    </div>
  );
}
