"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Panel from "../Panel";
import { addDays, localDateKey } from "@/lib/date";

interface Block { id: string; start: string; end: string; title: string; sub?: string; tag?: string }
type CalState = Record<string, Block[]>;

const SENTINEL = "9999-01-02"; // manual_calendar lives on a sentinel record
const SEED_BLOCKS: Block[] = [
  { id: "seed-1", start: "09:00", end: "10:30", title: "Block 1 — primary work", sub: "Deep work, what to lock in", tag: "FOCUS" },
  { id: "seed-2", start: "11:00", end: "11:30", title: "Block 2 — recurring sync", sub: "Who, what to cover", tag: "SYNC" },
  { id: "seed-3", start: "14:00", end: "15:00", title: "Block 3 — output / ship", sub: "Deliverable", tag: "SHIP" },
  { id: "seed-4", start: "16:00", end: "16:30", title: "Block 4 — admin reset", sub: "Clear quick replies and loose ends", tag: "OPS" },
  { id: "seed-5", start: "18:00", end: "18:45", title: "Block 5 — workout / walk", sub: "Energy protection", tag: "ENERGY" },
];

export default function CalendarCard() {
  const [selected, setSelected] = useState<string>(localDateKey());
  const [state, setState] = useState<CalState>({});
  const [adding, setAdding] = useState(false);
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const [draft, setDraft] = useState<Block>({ id: "", start: "09:00", end: "10:00", title: "", sub: "", tag: "" });

  useEffect(() => {
    fetch(`/api/daily/get?date=${SENTINEL}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setState((j?.notes?.manual_calendar as CalState) ?? {}))
      .catch(() => {});
  }, []);

  const persist = useCallback(async (next: CalState) => {
    await fetch("/api/daily/upsert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: SENTINEL, patch: { manual_calendar: next } }),
    });
  }, []);

  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 14 }, (_, i) => {
      const d = addDays(today, i);
      return { key: localDateKey(d), date: d };
    });
  }, []);

  const blocks = (state[selected] || []).slice().sort((a, b) => a.start.localeCompare(b.start));

  function add() {
    if (!draft.title.trim()) return;
    const block: Block = { ...draft, id: crypto.randomUUID() };
    const next = { ...state, [selected]: [...(state[selected] || []), block] };
    setState(next); persist(next);
    setDraft({ id: "", start: "09:00", end: "10:00", title: "", sub: "", tag: "" });
    setAdding(false);
  }

  function remove(id: string) {
    const next = { ...state, [selected]: (state[selected] || []).filter((b) => b.id !== id) };
    setState(next); persist(next);
  }

  function updateBlock(id: string, updates: Partial<Block>) {
    const next = {
      ...state,
      [selected]: (state[selected] || []).map((b) => (b.id === id ? { ...b, ...updates } : b)),
    };
    setState(next);
    persist(next);
  }

  function editSeed(seed: Block) {
    const block = { ...seed, id: crypto.randomUUID() };
    const next = { ...state, [selected]: [...SEED_BLOCKS.map((b) => (b.id === seed.id ? block : { ...b, id: crypto.randomUUID() }))] };
    setState(next);
    persist(next);
    setEditingBlock(block.id);
  }

  return (
    <Panel
      num="04"
      name="CALENDAR"
      action={
        <button
          onClick={() => setAdding((v) => !v)}
          className="font-mono text-[10px] text-muted hover:text-teal tracking-wider"
          type="button"
        >
          {adding ? "× CANCEL" : "+ ADD"}
        </button>
      }
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="terminal-label">
          {(() => {
            const d = days.find((day) => day.key === selected)?.date || new Date();
            return d.toLocaleDateString(undefined, { month: "long", year: "numeric" }).toUpperCase();
          })()}
        </div>
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
        {days.map(({ key, date }) => {
          const active = key === selected;
          const isToday = key === localDateKey();
          const count = (state[key] || []).length;
          return (
            <button
              key={key}
              onClick={() => setSelected(key)}
              className={`flex w-[68px] flex-shrink-0 flex-col items-center rounded-[7px] border py-2 transition ${
                active ? "border-soft/45 bg-white/[0.06]" : "border-transparent hover:bg-white/[0.035]"
              }`}
              type="button"
            >
              <span className={`font-mono text-[9px] uppercase tracking-[0.14em] ${isToday ? "text-teal" : "text-muted"}`}>
                {date.toLocaleDateString(undefined, { weekday: "short" })}
              </span>
              <span className="mt-1 font-mono text-xl text-soft">{String(date.getDate()).padStart(2, "0")}</span>
              <span className={`w-1 h-1 rounded-full mt-0.5 ${count > 0 ? "bg-teal" : "bg-transparent"}`} />
            </button>
          );
        })}
      </div>

      {adding && (
        <div className="border border-line rounded p-2 my-2 grid grid-cols-12 gap-1.5 text-xs">
          <input type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} className="col-span-3 input-bar rounded px-1 py-1 font-mono" />
          <input type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} className="col-span-3 input-bar rounded px-1 py-1 font-mono" />
          <input value={draft.tag} onChange={(e) => setDraft({ ...draft, tag: e.target.value })} placeholder="TAG" className="col-span-3 input-bar rounded px-2 py-1 font-mono uppercase" />
          <button onClick={add} className="col-span-3 text-teal font-mono text-[10px] tracking-wider border border-teal/40 rounded hover:bg-teal/10" type="button">SAVE</button>
          <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Block title" className="col-span-12 input-bar rounded px-2 py-1" />
          <input value={draft.sub} onChange={(e) => setDraft({ ...draft, sub: e.target.value })} placeholder="Sub-context (optional)" className="col-span-12 input-bar rounded px-2 py-1 text-muted" />
        </div>
      )}

      <ul className="mt-2 max-h-[230px] space-y-0 overflow-y-auto pr-1">
        {blocks.length === 0 && SEED_BLOCKS.map((b) => (
          <CalendarRow key={b.id} block={b} muted onEdit={() => editSeed(b)} />
        ))}
        {blocks.map((b) => (
          <li key={b.id} className="group flex items-start gap-3 py-1.5 border-b border-line last:border-0">
            {editingBlock === b.id ? (
              <div className="flex-1 grid grid-cols-12 gap-1.5 text-xs">
                <input
                  type="time"
                  value={b.start}
                  onChange={(e) => updateBlock(b.id, { start: e.target.value })}
                  className="col-span-3 input-bar rounded px-1 py-1 font-mono"
                />
                <input
                  type="time"
                  value={b.end}
                  onChange={(e) => updateBlock(b.id, { end: e.target.value })}
                  className="col-span-3 input-bar rounded px-1 py-1 font-mono"
                />
                <input
                  value={b.tag || ""}
                  onChange={(e) => updateBlock(b.id, { tag: e.target.value })}
                  placeholder="TAG"
                  className="col-span-3 input-bar rounded px-2 py-1 font-mono uppercase"
                />
                <button
                  onClick={() => setEditingBlock(null)}
                  className="col-span-3 text-teal font-mono text-[10px] tracking-wider border border-teal/40 rounded hover:bg-teal/10"
                  type="button"
                >
                  DONE
                </button>
                <input
                  value={b.title}
                  onChange={(e) => updateBlock(b.id, { title: e.target.value })}
                  placeholder="Block title"
                  className="col-span-12 input-bar rounded px-2 py-1"
                />
                <input
                  value={b.sub || ""}
                  onChange={(e) => updateBlock(b.id, { sub: e.target.value })}
                  placeholder="Sub-context (optional)"
                  className="col-span-12 input-bar rounded px-2 py-1 text-muted"
                />
              </div>
            ) : (
              <>
                <button
                  onClick={() => setEditingBlock(b.id)}
                  className="font-mono text-xs text-teal whitespace-nowrap pt-0.5 hover:text-teal/70"
                  type="button"
                >
                  {b.start} <span className="text-dim">-</span> {b.end}
                </button>
                <button
                  onClick={() => setEditingBlock(b.id)}
                  className="flex-1 min-w-0 text-left"
                  type="button"
                >
                  <div className="text-sm text-soft truncate">{b.title}</div>
                  {b.sub && <div className="text-xs text-muted truncate">{b.sub}</div>}
                </button>
                {b.tag && (
                  <span className="text-[9px] font-mono tracking-wider text-orange border border-orange/40 px-1.5 py-0.5">
                    {b.tag.toUpperCase()}
                  </span>
                )}
                <button onClick={() => remove(b.id)} className="opacity-0 group-hover:opacity-100 text-muted hover:text-hot text-xs px-1" type="button">×</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function CalendarRow({ block, muted, onEdit }: { block: Block; muted?: boolean; onEdit?: () => void }) {
  return (
    <li className="flex items-start gap-5 border-b border-line py-3 last:border-0">
      <button
        onClick={onEdit}
        disabled={!onEdit}
        className={`w-20 whitespace-nowrap text-left font-mono text-xs ${muted ? "text-teal/80" : "text-teal"} ${onEdit ? "hover:text-teal/70" : ""}`}
        type="button"
      >
        {block.start} <span className="text-dim">—</span><br />{block.end}
      </button>
      <button
        onClick={onEdit}
        disabled={!onEdit}
        className="min-w-0 flex-1 text-left"
        type="button"
      >
        <div className={`truncate text-base ${muted ? "text-soft/90" : "text-soft"}`}>{block.title}</div>
        {block.sub && <div className="truncate text-xs text-muted">{block.sub}</div>}
      </button>
      {block.tag && (
        <span className="rounded-full border border-teal/40 px-2 py-0.5 font-mono text-[9px] tracking-[0.16em] text-teal">
          {block.tag}
        </span>
      )}
    </li>
  );
}
