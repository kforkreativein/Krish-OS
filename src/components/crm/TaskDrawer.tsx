"use client";

import { useEffect, useState } from "react";
import { URGENCIES, type Task } from "@/lib/types";

export default function TaskDrawer({
  task, onClose, onSaved,
}: {
  task: Task | null;
  onClose: () => void;
  onSaved: (t: Task) => void;
}) {
  const [draft, setDraft] = useState<Task | null>(task);
  useEffect(() => setDraft(task), [task]);
  if (!draft) return null;

  async function save(patch: Partial<Task>) {
    if (!draft) return;
    const next = { ...draft, ...patch };
    setDraft(next);
    const response = await fetch(`/api/tasks/${draft.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    const payload = await response.json().catch(() => null);
    onSaved(payload?.task || next);
  }

  async function complete() {
    await save({ completed_at: new Date().toISOString() });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 bg-bg/80 backdrop-blur-sm" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 h-full w-full max-w-md bg-card border-l border-line p-5 overflow-y-auto"
      >
        <header className="flex items-start justify-between mb-4">
          <span className="card-head"><span className="text-muted">XX</span> <span className="text-dim">//</span> <span className="text-soft">TASK</span></span>
          <button onClick={onClose} className="text-muted hover:text-soft text-lg" type="button">×</button>
        </header>

        <input
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          onBlur={() => save({ title: draft.title })}
          className="w-full bg-transparent border-b border-line pb-2 text-lg text-soft outline-none focus:border-teal/60"
        />

        <Field label="DESCRIPTION">
          <textarea
            value={draft.description || ""}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            onBlur={() => save({ description: draft.description })}
            rows={4}
            className="w-full input-bar rounded p-2 text-sm resize-none"
          />
        </Field>

        <Field label="URGENCY">
          <div className="flex gap-1 flex-wrap">
            {URGENCIES.map((u) => (
              <button
                key={u}
                onClick={() => save({ urgency: u })}
                className={`text-[10px] font-mono tracking-wider px-2.5 py-1 border ${
                  draft.urgency === u ? "border-teal/60 text-teal bg-teal/10" : "border-line text-muted hover:text-soft"
                }`}
                type="button"
              >
                {u.toUpperCase()}
              </button>
            ))}
          </div>
        </Field>

        <Field label="TAGS">
          <input
            value={draft.tags.join(", ")}
            onChange={(e) => setDraft({ ...draft, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            onBlur={() => save({ tags: draft.tags })}
            className="w-full input-bar rounded px-2 py-1.5 text-sm"
          />
        </Field>

        <Field label="ENTITY">
          <input
            value={draft.entity_id || ""}
            onChange={(e) => setDraft({ ...draft, entity_id: e.target.value || null })}
            onBlur={() => save({ entity_id: draft.entity_id })}
            className="w-full input-bar rounded px-2 py-1.5 text-sm"
            placeholder="client / project / area"
          />
        </Field>

        <Field label="OWNER">
          <input
            value={draft.owner || ""}
            onChange={(e) => setDraft({ ...draft, owner: e.target.value || null })}
            onBlur={() => save({ owner: draft.owner })}
            className="w-full input-bar rounded px-2 py-1.5 text-sm"
            placeholder="owner"
          />
        </Field>

        <Field label="KEY BLOCKER">
          <label className="flex items-center gap-2 text-sm cursor-pointer text-soft">
            <input type="checkbox" checked={draft.key} onChange={(e) => save({ key: e.target.checked })} className="accent-teal" />
            <span>Mark as a key blocker</span>
          </label>
        </Field>

        <button
          onClick={complete}
          className="w-full mt-6 text-[10px] tracking-wider font-mono text-teal border border-teal/40 hover:bg-teal/10 py-2"
          type="button"
        >
          ✓ COMPLETE
        </button>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="card-head mb-1.5"><span className="text-muted">{label}</span></div>
      {children}
    </div>
  );
}
