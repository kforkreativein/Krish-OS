"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Panel from "../Panel";
import { localDateKey } from "@/lib/date";

type HabitPriority = "low" | "medium" | "high";
interface HabitDef { key: string; name: string; category: string; target: number; priority: HabitPriority; daily?: boolean }
type Counts = Record<string, number>;

const DEFAULT_HABITS: HabitDef[] = [];

const LS_PREFIX = "pos.habits.";
const DEFS_KEY = "pos.habits.definitions.v2";
const HABITS_EVENT = "pos:habits-updated";
const CONFETTI_PIECES = Array.from({ length: 72 }, (_, index) => ({
  id: index,
  left: `${(index * 37) % 100}%`,
  delay: `${(index % 12) * 0.055}s`,
  duration: `${2.2 + (index % 7) * 0.16}s`,
  color: ["#22c55e", "#16a34a", "#f59e0b", "#ef4444", "#ededed"][index % 5],
  rotate: `${(index * 47) % 360}deg`,
}));

function loadLocal(date: string): Counts {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_PREFIX + date);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocal(date: string, c: Counts) {
  try {
    localStorage.setItem(LS_PREFIX + date, JSON.stringify(c));
  } catch {}
}

function loadDefinitions(): HabitDef[] {
  if (typeof window === "undefined") return DEFAULT_HABITS;
  try {
    const raw = localStorage.getItem(DEFS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const definitions = Array.isArray(parsed) && parsed.length
      ? parsed.map((habit) => ({ ...habit, daily: habit.daily ?? true }))
      : DEFAULT_HABITS;
    return definitions.filter((habit) => {
      const isLegacyDefaultWorkout =
        habit.name === "Workout" &&
        habit.category === "FITNESS" &&
        habit.target === 1 &&
        habit.daily === true;
      return !isLegacyDefaultWorkout;
    });
  } catch {
    return DEFAULT_HABITS;
  }
}

function saveDefinitions(habits: HabitDef[]) {
  try {
    localStorage.setItem(DEFS_KEY, JSON.stringify(habits));
  } catch {}
}

function makeKey(name: string) {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "habit"}-${Date.now().toString(36)}`;
}

function Ring({ pct, value }: { pct: number; value: number }) {
  const r = 24, c = 2 * Math.PI * r;
  const dash = c * Math.min(1, Math.max(0, pct));
  return (
    <svg viewBox="0 0 60 60" className="h-14 w-14">
      <circle cx="30" cy="30" r={r} stroke="#1a1a1a" strokeWidth="4" fill="none" />
      <circle
        cx="30"
        cy="30"
        r={r}
        stroke="#22c55e"
        strokeWidth="4"
        fill="none"
        strokeDasharray={`${dash} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 30 30)"
      />
      <text x="30" y="35" textAnchor="middle" fontFamily="monospace" fontSize="13" fill="#ededed">
        {value}
      </text>
    </svg>
  );
}

function launchConfetti() {
  const overlay = document.createElement("div");
  overlay.className = "confetti-overlay";
  const colors = ["#22c55e", "#16a34a", "#f59e0b", "#ef4444", "#ededed"];

  Array.from({ length: 72 }, (_, index) => {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${(index * 37) % 100}%`;
    piece.style.animationDelay = `${(index % 12) * 0.055}s`;
    piece.style.animationDuration = `${2.2 + (index % 7) * 0.16}s`;
    piece.style.backgroundColor = colors[index % colors.length];
    piece.style.transform = `rotate(${(index * 47) % 360}deg)`;
    overlay.appendChild(piece);
    return piece;
  });

  document.body.appendChild(overlay);
  window.setTimeout(() => overlay.remove(), 3200);
}

export default function HabitsCard() {
  const [date, setDate] = useState<string | null>(null);
  const [counts, setCounts] = useState<Counts>({});
  const [habits, setHabits] = useState<HabitDef[]>(DEFAULT_HABITS);
  const [draftName, setDraftName] = useState("");
  const [draftCategory, setDraftCategory] = useState("PERSONAL");
  const [draftPriority, setDraftPriority] = useState<HabitPriority>("medium");
  const [draftDaily, setDraftDaily] = useState(true);
  const [celebrateRun, setCelebrateRun] = useState(0);
  const loadedRef = useRef(false);
  const userActionRef = useRef(false);
  const completedRef = useRef(0);

  const loadDay = useCallback((d: string, definitions: HabitDef[] = loadDefinitions()): void => {
    const localCounts = loadLocal(d);
    setDate(d);
    setHabits(definitions);
    setCounts(localCounts);
    completedRef.current = definitions.filter((h) => (localCounts[h.key] || 0) >= h.target).length;
    loadedRef.current = true;
    fetch(`/api/daily/get?date=${d}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const remote = j?.notes?.habits as Counts | undefined;
        if (remote && Object.keys(remote).length) {
          setCounts(remote);
          saveLocal(d, remote);
          completedRef.current = definitions.filter((h) => (remote[h.key] || 0) >= h.target).length;
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadDay(localDateKey());
  }, [loadDay]);

  useEffect(() => {
    const handleHabitsUpdated = () => loadDay(localDateKey(), loadDefinitions());
    window.addEventListener(HABITS_EVENT, handleHabitsUpdated);
    return () => window.removeEventListener(HABITS_EVENT, handleHabitsUpdated);
  }, [loadDay]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const nextDate = localDateKey();
      if (date && nextDate !== date) loadDay(nextDate, habits);
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [date, habits, loadDay]);

  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setDate(now.getDate() + 1);
    midnight.setHours(0, 0, 1, 0);
    const timeout = window.setTimeout(() => loadDay(localDateKey(), habits), midnight.getTime() - now.getTime());
    return () => window.clearTimeout(timeout);
  }, [habits, loadDay]);

  useEffect(() => {
    saveDefinitions(habits);
  }, [habits]);

  useEffect(() => {
    if (!loadedRef.current) return;
    const completed = habits.filter((h) => (counts[h.key] || 0) >= h.target).length;
    if (userActionRef.current && completed > completedRef.current) {
      launchConfetti();
    }
    userActionRef.current = false;
    completedRef.current = completed;
  }, [counts, habits]);

  const sync = useCallback(async (next: Counts) => {
    if (!date) return;
    saveLocal(date, next);
    await fetch("/api/daily/upsert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date, patch: { habits: next } }),
    }).catch(() => {});
  }, [date]);

  function bump(def: HabitDef) {
    userActionRef.current = true;
    setCounts((current) => {
      const cur = current[def.key] || 0;
      const wasDone = cur >= def.target;
      const nextVal = wasDone ? 0 : cur + 1;
      const next = { ...current, [def.key]: nextVal };

      window.setTimeout(() => {
        sync(next);
      }, 0);

      return next;
    });
  }

  function completeHabit(def: HabitDef, done: boolean) {
    if (!done) {
      const run = Date.now();
      setCelebrateRun(run);
      window.setTimeout(() => setCelebrateRun((current) => (current === run ? 0 : current)), 3200);
      launchConfetti();
    }
    bump(def);
  }

  function addHabit() {
    const name = draftName.trim();
    if (!name) return;
    setHabits((current) => [
      ...current,
      {
        key: makeKey(name),
        name,
        category: draftCategory.trim().toUpperCase() || "PERSONAL",
        target: 1,
        priority: draftPriority,
        daily: draftDaily,
      },
    ]);
    setDraftName("");
    setDraftDaily(true);
  }

  const completedHabits = habits.filter((h) => (counts[h.key] || 0) >= h.target).length;
  const totalTarget = habits.length;
  const pct = completedHabits / (totalTarget || 1);

  return (
    <Panel
      num="03"
      name="HABITS"
      className="habits-card"
      bodyClass="habits-body p-4"
      action={<span className="font-mono text-[11px] tracking-[0.16em] text-muted">{completedHabits}/{totalTarget} HABITS · {Math.round(pct * 100)}%</span>}
    >
      {celebrateRun > 0 && (
        <div key={celebrateRun} className="confetti-overlay">
          {CONFETTI_PIECES.map((piece) => (
            <span
              key={piece.id}
              className="confetti-piece"
              style={{
                left: piece.left,
                animationDelay: piece.delay,
                animationDuration: piece.duration,
                backgroundColor: piece.color,
                transform: `rotate(${piece.rotate})`,
              }}
            />
          ))}
        </div>
      )}
      <div className="flex items-center gap-4">
        <Ring pct={pct} value={completedHabits} />
        <div className="min-w-0">
          <div className="terminal-label">DAILY SCORE</div>
          <div className="mt-1 truncate text-sm text-soft">
            {completedHabits ? `${completedHabits}/${habits.length} habits complete.` : "Start with one high-leverage habit."}
          </div>
        </div>
        <div className="ml-auto hidden h-6 items-end gap-1 md:flex">
          {Array.from({ length: 14 }, (_, index) => (
            <span key={index} className={`h-5 w-2 rounded-sm ${index / 14 < pct ? "bg-teal/70" : "bg-white/[0.045]"}`} />
          ))}
        </div>
      </div>

      <div className="mt-3 grid min-h-0 grid-cols-3 gap-2 overflow-y-auto pr-1">
        {habits.map((habit) => {
          const value = counts[habit.key] || 0;
          const done = value >= habit.target;
          return (
            <div
              key={habit.key}
              className={`min-h-[74px] rounded-[8px] border p-2.5 transition ${
                done ? "border-teal/55 bg-teal/10 shadow-[0_0_24px_rgba(34,197,94,0.08)]" : "border-line bg-black/35"
              }`}
            >
              <div className="flex h-full items-start gap-2">
                <button
                  onClick={() => completeHabit(habit, done)}
                  className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded-[4px] border transition ${
                    done ? "border-teal bg-teal" : "border-line bg-black/30 hover:border-teal/50"
                  }`}
                  aria-label={`Toggle ${habit.name}`}
                  type="button"
                />
                <button onClick={() => completeHabit(habit, done)} className="min-w-0 flex-1 text-left" type="button">
                  <div className="truncate text-[13px] leading-tight text-soft">{habit.name}</div>
                  <div className="mt-1 truncate font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                    {habit.category}{habit.daily ? " · DAILY" : ""}
                  </div>
                  <div className="mt-2 h-1 rounded-full bg-white/[0.05]">
                    <div className="h-full rounded-full bg-teal/70" style={{ width: `${Math.min(100, (value / habit.target) * 100)}%` }} />
                  </div>
                </button>
                <span className={`w-7 text-right font-mono text-[11px] leading-tight ${done ? "text-teal" : "text-soft"}`}>
                  {value}<span className="text-dim">/</span>{habit.target}
                </span>
              </div>
            </div>
          );
        })}

        <div className="col-span-3 rounded-[8px] border border-line bg-black/25 p-2.5">
          <div className="grid grid-cols-[1fr_130px_82px_82px] gap-2">
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && addHabit()}
              placeholder="Add a habit"
              className="input-bar min-w-0 px-3 py-2 text-sm"
            />
            <select
              value={draftCategory}
              onChange={(event) => setDraftCategory(event.target.value)}
              className="input-bar min-w-0 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em]"
              aria-label="Habit area"
            >
              <option value="PERSONAL">Personal</option>
              <option value="BUSINESS">Business</option>
            </select>
            <select
              value={draftPriority}
              onChange={(event) => setDraftPriority(event.target.value as HabitPriority)}
              className="input-bar px-2 py-2 font-mono text-[10px] uppercase tracking-[0.12em]"
            >
              <option value="low">Low</option>
              <option value="medium">Med</option>
              <option value="high">High</option>
            </select>
            <label className="flex min-w-0 items-center justify-center gap-2 rounded-[7px] border border-line bg-black/35 px-2 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
              <input
                checked={draftDaily}
                onChange={(event) => setDraftDaily(event.target.checked)}
                type="checkbox"
                className="h-3.5 w-3.5 accent-emerald-500"
              />
              Daily
            </label>
          </div>
          <button
            onClick={addHabit}
            disabled={!draftName.trim()}
            className="mt-2 w-full rounded-[7px] border border-teal/35 bg-teal/10 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-soft hover:text-teal disabled:opacity-35"
            type="button"
          >
            Add Habit
          </button>
        </div>
      </div>
    </Panel>
  );
}
