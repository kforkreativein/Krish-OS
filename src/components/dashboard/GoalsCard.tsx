"use client";

import { useEffect, useState } from "react";
import Panel from "../Panel";

const LS_KEY_WEEKLY = "pos.goals.weekly";
const LS_KEY_MONTHLY = "pos.goals.monthly";
const LS_KEY_WEEKLY_LIST = "pos.goals.weekly.list.v1";
const LS_KEY_MONTHLY_LIST = "pos.goals.monthly.list.v1";

type Goal = { id: string; text: string; done: boolean };

function readGoals(listKey: string, legacyKey: string): Goal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(listKey);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) return parsed.filter((goal) => typeof goal?.text === "string" && goal.text.trim());
    const legacy = localStorage.getItem(legacyKey)?.trim();
    return legacy ? [{ id: crypto.randomUUID(), text: legacy, done: false }] : [];
  } catch {
    return [];
  }
}

function saveGoals(key: string, goals: Goal[]) {
  try {
    localStorage.setItem(key, JSON.stringify(goals));
  } catch {}
}

export default function GoalsCard() {
  const [weekly, setWeekly] = useState<Goal[]>([]);
  const [monthly, setMonthly] = useState<Goal[]>([]);
  const [weeklyDraft, setWeeklyDraft] = useState("");
  const [monthlyDraft, setMonthlyDraft] = useState("");

  useEffect(() => {
    const nextWeekly = readGoals(LS_KEY_WEEKLY_LIST, LS_KEY_WEEKLY);
    const nextMonthly = readGoals(LS_KEY_MONTHLY_LIST, LS_KEY_MONTHLY);
    setWeekly(nextWeekly);
    setMonthly(nextMonthly);
    saveGoals(LS_KEY_WEEKLY_LIST, nextWeekly);
    saveGoals(LS_KEY_MONTHLY_LIST, nextMonthly);
  }, []);

  function updateWeekly(next: Goal[]) {
    setWeekly(next);
    saveGoals(LS_KEY_WEEKLY_LIST, next);
  }

  function updateMonthly(next: Goal[]) {
    setMonthly(next);
    saveGoals(LS_KEY_MONTHLY_LIST, next);
  }

  return (
    <Panel num="09" name="GOALS" bodyClass="goals-body p-4">
      <div className="grid h-full min-h-0 gap-3 sm:grid-cols-2">
        <GoalList
          label="THIS WEEK"
          placeholder="Weekly goal"
          draft={weeklyDraft}
          onDraft={setWeeklyDraft}
          goals={weekly}
          onGoals={updateWeekly}
        />
        <GoalList
          label="THIS MONTH"
          placeholder="Monthly goal"
          draft={monthlyDraft}
          onDraft={setMonthlyDraft}
          goals={monthly}
          onGoals={updateMonthly}
        />
      </div>
    </Panel>
  );
}

function GoalList({
  label,
  placeholder,
  draft,
  onDraft,
  goals,
  onGoals,
}: {
  label: string;
  placeholder: string;
  draft: string;
  onDraft: (value: string) => void;
  goals: Goal[];
  onGoals: (goals: Goal[]) => void;
}) {
  function addGoal() {
    const text = draft.trim();
    if (!text) return;
    onGoals([...goals, { id: crypto.randomUUID(), text, done: false }]);
    onDraft("");
  }

  function updateGoal(id: string, patch: Partial<Goal>) {
    onGoals(goals.map((goal) => (goal.id === id ? { ...goal, ...patch } : goal)));
  }

  function removeGoal(id: string) {
    onGoals(goals.filter((goal) => goal.id !== id));
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="terminal-label mb-1 flex items-center justify-between">
        <span>{label}</span>
        <span className="text-dim">{goals.filter((goal) => goal.done).length}/{goals.length}</span>
      </div>
      <div className="mb-2 flex gap-2">
        <input
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && addGoal()}
          placeholder={placeholder}
          className="input-bar h-8 min-w-0 flex-1 px-2.5 text-xs placeholder:text-muted/70"
        />
        <button
          onClick={addGoal}
          disabled={!draft.trim()}
          className="glass-button grid h-8 w-8 flex-shrink-0 place-items-center font-mono text-lg text-soft hover:text-teal disabled:opacity-30"
          type="button"
        >
          +
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
        {goals.map((goal) => (
          <div key={goal.id} className="group grid grid-cols-[18px_1fr_16px] items-center gap-1.5 rounded-[7px] border border-line bg-black/25 px-2 py-1.5">
            <input
              checked={goal.done}
              onChange={(event) => updateGoal(goal.id, { done: event.target.checked })}
              type="checkbox"
              className="h-3.5 w-3.5 accent-emerald-500"
              aria-label={`Complete ${goal.text}`}
            />
            <input
              value={goal.text}
              onChange={(event) => updateGoal(goal.id, { text: event.target.value })}
              className={`min-w-0 bg-transparent text-xs text-soft outline-none ${goal.done ? "line-through opacity-60" : ""}`}
            />
            <button
              onClick={() => removeGoal(goal.id)}
              className="text-xs text-muted opacity-0 hover:text-hot group-hover:opacity-100"
              type="button"
              aria-label={`Delete ${goal.text}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
