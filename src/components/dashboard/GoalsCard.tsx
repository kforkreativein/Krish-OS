"use client";

import { useCallback, useEffect, useState } from "react";
import Panel from "../Panel";
import {
  type Goal,
  LS_KEY_MONTHLY,
  LS_KEY_MONTHLY_LIST,
  LS_KEY_WEEKLY,
  LS_KEY_WEEKLY_LIST,
  loadGoalsFromServer,
  readGoals,
  saveGoalsList,
  syncGoalsToServer,
} from "@/lib/goals-storage";

export default function GoalsCard() {
  const [weekly, setWeekly] = useState<Goal[]>([]);
  const [monthly, setMonthly] = useState<Goal[]>([]);
  const [weeklyDraft, setWeeklyDraft] = useState("");
  const [monthlyDraft, setMonthlyDraft] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const nextWeekly = readGoals(LS_KEY_WEEKLY_LIST, LS_KEY_WEEKLY);
    const nextMonthly = readGoals(LS_KEY_MONTHLY_LIST, LS_KEY_MONTHLY);
    setWeekly(nextWeekly);
    setMonthly(nextMonthly);
    setHydrated(true);
    void loadGoalsFromServer().then((remote) => {
      if (!remote) return;
      if (remote.weekly.length) {
        setWeekly(remote.weekly);
        saveGoalsList(LS_KEY_WEEKLY_LIST, remote.weekly);
      }
      if (remote.monthly.length) {
        setMonthly(remote.monthly);
        saveGoalsList(LS_KEY_MONTHLY_LIST, remote.monthly);
      }
    });
  }, []);

  const persistGoals = useCallback((nextWeekly: Goal[], nextMonthly: Goal[]) => {
    saveGoalsList(LS_KEY_WEEKLY_LIST, nextWeekly);
    saveGoalsList(LS_KEY_MONTHLY_LIST, nextMonthly);
    if (hydrated) void syncGoalsToServer(nextWeekly, nextMonthly);
  }, [hydrated]);

  const updateWeekly = useCallback((next: Goal[]) => {
    setWeekly(next);
    setMonthly((currentMonthly) => {
      persistGoals(next, currentMonthly);
      return currentMonthly;
    });
  }, [persistGoals]);

  const updateMonthly = useCallback((next: Goal[]) => {
    setMonthly(next);
    setWeekly((currentWeekly) => {
      persistGoals(currentWeekly, next);
      return currentWeekly;
    });
  }, [persistGoals]);

  return (
    <Panel num="09" name="GOALS" className="goals-card" bodyClass="goals-body p-4">
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
      <div className="terminal-label mb-1 flex flex-shrink-0 items-center justify-between">
        <span>{label}</span>
        <span className="text-dim">{goals.filter((goal) => goal.done).length}/{goals.length}</span>
      </div>
      <div className="mb-2 flex flex-shrink-0 gap-2">
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
        {goals.length === 0 && (
          <div className="rounded-[7px] border border-dashed border-line px-2 py-3 text-center text-[11px] text-muted">
            No goals yet.
          </div>
        )}
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
