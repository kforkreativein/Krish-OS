"use client";

import { useCallback, useEffect, useState } from "react";
import Panel from "../Panel";
import { localDateKey } from "@/lib/date";

interface Meal {
  id: string;
  at: string;
  label: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface WorkoutEntry {
  id: string;
  name: string;
  calories: number;
  duration: string;
  type: "strength" | "cardio" | "mobility" | "sports";
}

interface WeightEntry {
  date: string;
  weight_kg: number;
}

const TARGETS = {
  kcal: Number(process.env.NEXT_PUBLIC_KCAL_TARGET || 2800),
  protein_g: Number(process.env.NEXT_PUBLIC_PROTEIN_TARGET || 180),
  carbs_g: Number(process.env.NEXT_PUBLIC_CARBS_TARGET || 300),
  fat_g: Number(process.env.NEXT_PUBLIC_FAT_TARGET || 80),
};
const CUTOFF = process.env.NEXT_PUBLIC_EATING_CUTOFF || "20:00";
const LS_PREFIX = "pos.nutrition.";
const HEALTH_PREFIX = "pos.health.";
const WORKOUT_PREFIX = "pos.workout.";
const WEIGHT_HISTORY_KEY = "pos.weight.history.v1";
type HealthTab = "weight" | "nutrition" | "sleep" | "walk" | "workout";
type HealthStats = { sleep_hours: string; steps: string; sleep_quality: string; sleep_bedtime: string; sleep_wakeup: string; weight_kg?: string };

function loadWorkouts(date: string): WorkoutEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WORKOUT_PREFIX + date);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveWorkouts(date: string, workouts: WorkoutEntry[]) {
  try {
    localStorage.setItem(WORKOUT_PREFIX + date, JSON.stringify(workouts));
  } catch {}
}

function loadHealth(date: string): HealthStats {
  if (typeof window === "undefined") return { sleep_hours: "", steps: "", sleep_quality: "good", sleep_bedtime: "", sleep_wakeup: "" };
  try {
    const raw = localStorage.getItem(HEALTH_PREFIX + date);
    return raw ? { sleep_hours: "", steps: "", sleep_quality: "good", sleep_bedtime: "", sleep_wakeup: "", ...JSON.parse(raw) } : { sleep_hours: "", steps: "", sleep_quality: "good", sleep_bedtime: "", sleep_wakeup: "" };
  } catch {
    return { sleep_hours: "", steps: "", sleep_quality: "good", sleep_bedtime: "", sleep_wakeup: "" };
  }
}

function saveHealth(date: string, stats: HealthStats) {
  try {
    localStorage.setItem(HEALTH_PREFIX + date, JSON.stringify(stats));
  } catch {}
}

function loadWeightHistory(): WeightEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WEIGHT_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed
        .map((entry) => ({ date: String(entry.date || "").slice(0, 10), weight_kg: Number(entry.weight_kg) }))
        .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry.date) && Number.isFinite(entry.weight_kg) && entry.weight_kg > 0)
        .sort((a, b) => a.date.localeCompare(b.date))
      : [];
  } catch {
    return [];
  }
}

function saveWeightHistory(entries: WeightEntry[]) {
  try {
    localStorage.setItem(WEIGHT_HISTORY_KEY, JSON.stringify(entries.slice(-365)));
  } catch {}
}

function mergeWeightEntry(history: WeightEntry[], entry: WeightEntry): WeightEntry[] {
  return [...history.filter((item) => item.date !== entry.date), entry]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-365);
}

function cleanTime(value: string): string {
  return value ? value.slice(0, 5) : "";
}

function sleepHoursFromTimes(bedtime: string, wakeup: string): number {
  const bed = cleanTime(bedtime);
  const wake = cleanTime(wakeup);
  if (!bed || !wake) return 0;
  const [bedHour, bedMinute] = bed.split(":").map(Number);
  const [wakeHour, wakeMinute] = wake.split(":").map(Number);
  if (![bedHour, bedMinute, wakeHour, wakeMinute].every(Number.isFinite)) return 0;
  const bedTotal = bedHour * 60 + bedMinute;
  let wakeTotal = wakeHour * 60 + wakeMinute;
  if (wakeTotal <= bedTotal) wakeTotal += 24 * 60;
  return Math.round(((wakeTotal - bedTotal) / 60) * 10) / 10;
}

function derivedSleepQuality(hours: number): string {
  if (hours <= 0) return "pending";
  if (hours < 5.5 || hours > 10) return "poor";
  if (hours < 7 || hours > 9.5) return "fair";
  if (hours >= 7.5 && hours <= 9) return "excellent";
  return "good";
}

function sum(meals: Meal[]) {
  return meals.reduce(
    (a, m) => ({
      kcal: a.kcal + m.kcal,
      protein_g: a.protein_g + m.protein_g,
      carbs_g: a.carbs_g + m.carbs_g,
      fat_g: a.fat_g + m.fat_g,
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
}

function cutoffCountdown(cutoff: string): string {
  const [h, m] = cutoff.split(":").map(Number);
  const now = new Date();
  const t = new Date(); t.setHours(h, m, 0, 0);
  let diff = t.getTime() - now.getTime();
  if (diff < 0) return "CUTOFF PASSED";
  const hrs = Math.floor(diff / 3_600_000); diff -= hrs * 3_600_000;
  const mins = Math.floor(diff / 60_000);
  return `${hrs}H ${mins}M TO CUTOFF`;
}

function timeStr(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

function loadLocal(date: string): Meal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_PREFIX + date);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocal(date: string, meals: Meal[]) {
  try {
    localStorage.setItem(LS_PREFIX + date, JSON.stringify(meals));
  } catch {}
}

function kcalFromMacros(meal: Pick<Meal, "protein_g" | "carbs_g" | "fat_g">): number {
  return Math.round((Number(meal.protein_g) || 0) * 4 + (Number(meal.carbs_g) || 0) * 4 + (Number(meal.fat_g) || 0) * 9);
}

export default function NutritionCard() {
  const [date, setDate] = useState<string | null>(null);
  const [tab, setTab] = useState<HealthTab>("nutrition");
  const [meals, setMeals] = useState<Meal[]>([]);
  const [health, setHealth] = useState<HealthStats>({ sleep_hours: "", steps: "", sleep_quality: "good", sleep_bedtime: "", sleep_wakeup: "" });
  const [workouts, setWorkouts] = useState<WorkoutEntry[]>([]);
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
  const [draftWeight, setDraftWeight] = useState("");
  const [draftLabel, setDraftLabel] = useState("");
  const [draftKcal, setDraftKcal] = useState("");
  const [draftWorkoutName, setDraftWorkoutName] = useState("");
  const [draftWorkoutCalories, setDraftWorkoutCalories] = useState("");
  const [draftWorkoutDuration, setDraftWorkoutDuration] = useState("");
  const [draftWorkoutType, setDraftWorkoutType] = useState<WorkoutEntry["type"]>("strength");
  const [estimatedMacros, setEstimatedMacros] = useState<Partial<Meal> | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [redistributingId, setRedistributingId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const d = localDateKey();
    setDate(d);
    setMeals(loadLocal(d));
    const h = loadHealth(d);
    setHealth(h);
    setWorkouts(loadWorkouts(d));
    const localWeights = loadWeightHistory();
    setWeightHistory(localWeights);
    const todayWeight = localWeights.find((entry) => entry.date === d)?.weight_kg;
    if (todayWeight) setDraftWeight(String(todayWeight));
    fetch(`/api/daily/get?date=${d}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const remote = ((j?.notes?.nutrition as Meal[] | undefined) ?? []).filter(Boolean);
        if (remote.length) {
          setMeals(remote);
          saveLocal(d, remote);
        }
        const remoteHealth = j?.notes?.health as (HealthStats & { weight_history_recent?: WeightEntry[] }) | undefined;
        const remoteHistory = Array.isArray(remoteHealth?.weight_history_recent) ? remoteHealth.weight_history_recent : [];
        const remoteWeight = Number(remoteHealth?.weight_kg);
        let nextWeights = localWeights;
        for (const entry of remoteHistory) {
          const weight = Number(entry.weight_kg);
          const entryDate = String(entry.date || "").slice(0, 10);
          if (/^\d{4}-\d{2}-\d{2}$/.test(entryDate) && Number.isFinite(weight) && weight > 0) {
            nextWeights = mergeWeightEntry(nextWeights, { date: entryDate, weight_kg: weight });
          }
        }
        if (Number.isFinite(remoteWeight) && remoteWeight > 0) {
          setDraftWeight(String(remoteWeight));
          nextWeights = mergeWeightEntry(nextWeights, { date: d, weight_kg: remoteWeight });
        }
        if (nextWeights.length !== localWeights.length || remoteWeight > 0) {
          setWeightHistory(nextWeights);
          saveWeightHistory(nextWeights);
        }
      })
      .catch(() => {});
    const t = setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const persist = useCallback(async (next: Meal[]) => {
    if (!date) return;
    saveLocal(date, next);
    await fetch("/api/daily/upsert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date, patch: { nutrition: next } }),
    }).catch(() => {});
  }, [date]);

  const persistHealth = useCallback(async (next: HealthStats) => {
    if (!date) return;
    setHealth(next);
    saveHealth(date, next);
    await fetch("/api/daily/upsert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date, patch: { health: next } }),
    }).catch(() => {});
  }, [date]);

  const persistWorkouts = useCallback(async (next: WorkoutEntry[]) => {
    if (!date) return;
    setWorkouts(next);
    saveWorkouts(date, next);
    await fetch("/api/daily/upsert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date, patch: { workouts: next } }),
    }).catch(() => {});
  }, [date]);

  const persistWeight = useCallback(async (value: string) => {
    if (!date) return;
    const weight = Math.round(Number(value) * 10) / 10;
    if (!Number.isFinite(weight) || weight <= 0) return;
    const nextHistory = mergeWeightEntry(weightHistory, { date, weight_kg: weight });
    const nextHealth = { ...health, weight_kg: String(weight) };
    setDraftWeight(String(weight));
    setWeightHistory(nextHistory);
    setHealth(nextHealth);
    saveWeightHistory(nextHistory);
    saveHealth(date, nextHealth);
    await fetch("/api/daily/upsert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date, patch: { health: { ...nextHealth, weight_history_recent: nextHistory.slice(-30) } } }),
    }).catch(() => {});
  }, [date, health, weightHistory]);

  function addWorkout() {
    const name = draftWorkoutName.trim();
    const calories = Number(draftWorkoutCalories);
    if (!name || !Number.isFinite(calories)) return;
    const entry: WorkoutEntry = {
      id: crypto.randomUUID(),
      name,
      calories: Math.round(calories),
      duration: draftWorkoutDuration.trim(),
      type: draftWorkoutType,
    };
    const next = [...workouts, entry];
    setWorkouts(next);
    persistWorkouts(next);
    setDraftWorkoutName("");
    setDraftWorkoutCalories("");
    setDraftWorkoutDuration("");
  }

  function removeWorkout(id: string) {
    const next = workouts.filter((w) => w.id !== id);
    setWorkouts(next);
    persistWorkouts(next);
  }

  const totalWorkoutCalories = workouts.reduce((sum, w) => sum + w.calories, 0);

  function logMeal() {
    const label = draftLabel.trim();
    const kcal = Number(draftKcal);
    if (!label || !Number.isFinite(kcal) || kcal <= 0) return;
    const meal: Meal = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      label,
      kcal: Math.round(kcal),
      protein_g: Math.round(Number(estimatedMacros?.protein_g) || 0),
      carbs_g: Math.round(Number(estimatedMacros?.carbs_g) || 0),
      fat_g: Math.round(Number(estimatedMacros?.fat_g) || 0),
    };
    const next = [...meals, meal];
    setMeals(next);
    setDraftLabel("");
    setDraftKcal("");
    setEstimatedMacros(null);
    persist(next);
  }

  async function estimateMeal() {
    const text = draftLabel.trim();
    if (!text || estimating) return;
    setEstimating(true);
    try {
      const response = await fetch("/api/nutrition/estimate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.macros) throw new Error(payload?.error || "AI estimate failed");
      setDraftKcal(String(payload.macros.kcal || ""));
      setDraftLabel(payload.macros.label || text);
      setEstimatedMacros(payload.macros);
    } catch {
      setEstimatedMacros(null);
    } finally {
      setEstimating(false);
    }
  }

  function removeMeal(id: string) {
    const next = meals.filter((m) => m.id !== id);
    setMeals(next);
    persist(next);
    if (editingMealId === id) setEditingMealId(null);
  }

  function patchMeal(id: string, patch: Partial<Meal>) {
    const next = meals.map((meal) => meal.id === id ? { ...meal, ...patch } : meal);
    setMeals(next);
    persist(next);
  }

  function patchMealMacro(id: string, field: "protein_g" | "carbs_g" | "fat_g", value: string) {
    const numeric = Math.max(0, Math.round(Number(value) || 0));
    const meal = meals.find((item) => item.id === id);
    if (!meal) return;
    const patched = { ...meal, [field]: numeric };
    patchMeal(id, { [field]: numeric, kcal: kcalFromMacros(patched) });
  }

  async function redistributeMeal(id: string, kcalValue: string) {
    const kcal = Math.max(0, Math.round(Number(kcalValue) || 0));
    const meal = meals.find((item) => item.id === id);
    if (!meal || !kcal) return;
    patchMeal(id, { kcal });
    setRedistributingId(id);
    try {
      const response = await fetch("/api/nutrition/redistribute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: meal.label, kcal }),
      });
      const payload = await response.json().catch(() => null);
      if (payload?.macros) {
        patchMeal(id, {
          kcal,
          protein_g: Math.round(Number(payload.macros.protein_g) || 0),
          carbs_g: Math.round(Number(payload.macros.carbs_g) || 0),
          fat_g: Math.round(Number(payload.macros.fat_g) || 0),
        });
      }
    } finally {
      setRedistributingId(null);
    }
  }

  const totals = sum(meals);
  void tick; // keep countdown reactive

  return (
    <Panel
      num="08"
      name="HEALTH"
      className="nutrition-card"
      bodyClass="nutrition-body p-4"
      action={<span className="font-mono text-[11px] tracking-[0.18em] text-ok">TODAY</span>}
    >
      <div className="min-h-0">
        <div className="mb-3 grid grid-cols-5 gap-1.5">
          {(["weight", "nutrition", "sleep", "walk", "workout"] as HealthTab[]).map((option) => (
            <button
              key={option}
              onClick={() => setTab(option)}
              className={`rounded-[7px] border px-2 py-1.5 font-mono text-[8px] uppercase tracking-[0.1em] ${tab === option ? "border-teal/45 bg-teal/10 text-teal" : "border-line text-muted hover:text-soft"}`}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>

        {tab === "weight" ? (
          <WeightPane
            date={date}
            draftWeight={draftWeight}
            onDraftWeight={setDraftWeight}
            history={weightHistory}
            onSave={persistWeight}
          />
        ) : tab !== "nutrition" ? (
          <HealthPane
            tab={tab}
            stats={health}
            onChange={persistHealth}
            workouts={workouts}
            totalCalories={totalWorkoutCalories}
            onAddWorkout={addWorkout}
            onRemoveWorkout={removeWorkout}
            draftName={draftWorkoutName}
            setDraftName={setDraftWorkoutName}
            draftCalories={draftWorkoutCalories}
            setDraftCalories={setDraftWorkoutCalories}
            draftDuration={draftWorkoutDuration}
            setDraftDuration={setDraftWorkoutDuration}
            draftType={draftWorkoutType}
            setDraftType={setDraftWorkoutType}
          />
        ) : (
        <>
        <div className="grid grid-cols-[0.82fr_1.18fr] items-start gap-4">
          <div className="min-w-0">
            <div className="flex items-end gap-2">
              <span className="font-mono text-5xl leading-none tracking-normal text-soft">{totals.kcal}</span>
              <span className="pb-1.5 font-mono text-xs text-muted">kcal</span>
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">of {TARGETS.kcal}</div>
            <div className={`mt-1 font-mono text-xs ${TARGETS.kcal - totals.kcal >= 0 ? "text-ok" : "text-hot"}`}>
              {TARGETS.kcal - totals.kcal >= 0 ? "-" : "+"}{Math.abs(TARGETS.kcal - totals.kcal)} deficit
            </div>
          </div>

          <div className="grid gap-2">
            <MacroBar label="PROTEIN" value={totals.protein_g} target={TARGETS.protein_g} color="#22c55e" />
            <MacroBar label="CARBS" value={totals.carbs_g} target={TARGETS.carbs_g} color="#fb923c" />
            <MacroBar label="FAT" value={totals.fat_g} target={TARGETS.fat_g} color="#ef4444" />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-[1fr_38px_78px_38px] gap-2">
          <input
            value={draftLabel}
            onChange={(e) => {
              setDraftLabel(e.target.value);
              setEstimatedMacros(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && logMeal()}
            placeholder="Meal / food"
            className="input-bar min-w-0 px-3 py-2 text-sm placeholder:text-dim"
          />
          <button
            onClick={estimateMeal}
            disabled={!draftLabel.trim() || estimating}
            className="glass-button grid place-items-center font-mono text-[10px] tracking-[0.12em] text-ok hover:border-ok/50 disabled:opacity-30"
            type="button"
            title="Estimate calories with AI"
          >
            {estimating ? "..." : "AI"}
          </button>
          <input
            value={draftKcal}
            onChange={(e) => {
              setDraftKcal(e.target.value.replace(/[^\d.]/g, ""));
              setEstimatedMacros(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && logMeal()}
            placeholder="kcal"
            inputMode="decimal"
            className="input-bar min-w-0 px-3 py-2 font-mono text-sm placeholder:text-dim"
          />
          <button
            onClick={logMeal}
            disabled={!draftLabel.trim() || !Number(draftKcal)}
            className="glass-button grid place-items-center font-mono text-xl text-soft hover:text-teal disabled:opacity-30"
            type="button"
          >
            +
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-[7px] border border-line bg-white/[0.025] px-3 py-2 font-mono text-[9px] tracking-[0.14em]">
          <span className="text-muted">CUTOFF · {CUTOFF}</span>
          <span className="text-ok">
          {cutoffCountdown(CUTOFF)}
          </span>
        </div>

        <div className="mt-3 border-t border-line pt-3">
          <div className="terminal-label mb-2">TODAY · {meals.length} MEALS</div>
          <ul className="max-h-24 space-y-1 overflow-y-auto pr-1">
            {meals.length === 0 && <li className="text-xs text-muted">No meals logged.</li>}
            {meals.map((m) => (
              <li key={m.id} className="rounded-[7px] border border-line bg-black/25 px-2 py-1.5 text-xs">
                <div className="group grid grid-cols-[44px_1fr_54px_18px] items-center gap-2">
                  <span className="font-mono text-muted">{timeStr(m.at)}</span>
                  <button onClick={() => setEditingMealId(editingMealId === m.id ? null : m.id)} className="truncate text-left text-soft hover:text-teal" type="button">
                    {m.label}
                  </button>
                  <button onClick={() => setEditingMealId(editingMealId === m.id ? null : m.id)} className="text-right font-mono text-ok" type="button">
                    {m.kcal}
                  </button>
                  <button
                    onClick={() => removeMeal(m.id)}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      removeMeal(m.id);
                    }}
                    className="text-muted hover:text-hot"
                    type="button"
                  >
                    ×
                  </button>
                </div>
                {editingMealId === m.id && (
                  <div className="mt-2 grid grid-cols-12 gap-1.5 border-t border-line pt-2">
                    <input
                      value={m.label}
                      onChange={(event) => patchMeal(m.id, { label: event.target.value })}
                      className="input-bar col-span-12 px-2 py-1.5 text-xs"
                    />
                    <MacroInput label="KCAL" value={m.kcal} className="col-span-3" onBlurValue={(value) => redistributeMeal(m.id, value)} />
                    <MacroInput label="P" value={m.protein_g} className="col-span-3" onBlurValue={(value) => patchMealMacro(m.id, "protein_g", value)} />
                    <MacroInput label="C" value={m.carbs_g} className="col-span-3" onBlurValue={(value) => patchMealMacro(m.id, "carbs_g", value)} />
                    <MacroInput label="F" value={m.fat_g} className="col-span-3" onBlurValue={(value) => patchMealMacro(m.id, "fat_g", value)} />
                    <div className="col-span-12 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                      {redistributingId === m.id ? "Redistributing macros..." : "Edit macros to recalc kcal. Edit kcal to redistribute macros."}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
        </>
        )}
      </div>
    </Panel>
  );
}

function MacroInput({ label, value, className, onBlurValue }: { label: string; value: number; className?: string; onBlurValue: (value: string) => void }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <label className={className}>
      <div className="mb-1 font-mono text-[8px] uppercase tracking-[0.12em] text-muted">{label}</div>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value.replace(/[^\d.]/g, ""))}
        onBlur={() => onBlurValue(draft)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className="input-bar w-full px-2 py-1.5 font-mono text-xs"
        inputMode="decimal"
      />
    </label>
  );
}

function WeightPane({
  date,
  draftWeight,
  onDraftWeight,
  history,
  onSave,
}: {
  date: string | null;
  draftWeight: string;
  onDraftWeight: (value: string) => void;
  history: WeightEntry[];
  onSave: (value: string) => void;
}) {
  const latest = history.at(-1);
  const previous = history.length > 1 ? history.at(-2) : null;
  const first = history[0];
  const delta = latest && previous ? Math.round((latest.weight_kg - previous.weight_kg) * 10) / 10 : 0;
  const totalDelta = latest && first ? Math.round((latest.weight_kg - first.weight_kg) * 10) / 10 : 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_78px] gap-2">
        <input
          value={draftWeight}
          onChange={(event) => onDraftWeight(event.target.value.replace(/[^\d.]/g, ""))}
          onBlur={() => onSave(draftWeight)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="input-bar px-3 py-2 font-mono text-lg text-soft"
          placeholder="Weight kg"
          inputMode="decimal"
        />
        <button
          type="button"
          onClick={() => onSave(draftWeight)}
          disabled={!Number(draftWeight)}
          className="glass-button font-mono text-[10px] uppercase tracking-[0.16em] text-teal disabled:opacity-30"
        >
          Log
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <WeightStat label="latest" value={latest ? `${latest.weight_kg} kg` : "--"} />
        <WeightStat label="daily" value={latest && previous ? `${delta >= 0 ? "+" : ""}${delta} kg` : "--"} tone={delta <= 0 ? "ok" : "warn" } />
        <WeightStat label="total" value={latest && first ? `${totalDelta >= 0 ? "+" : ""}${totalDelta} kg` : "--"} tone={totalDelta <= 0 ? "ok" : "warn" } />
      </div>

      <div className="rounded-[8px] border border-line bg-black/25 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="terminal-label">WEIGHT TREND</div>
          <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">{history.length} days</div>
        </div>
        <WeightChart history={history} />
      </div>

      <div className="max-h-24 space-y-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
        {history.slice().reverse().map((entry) => (
          <div key={entry.date} className={`grid grid-cols-[1fr_auto] rounded-[7px] border border-line bg-black/25 px-2 py-1.5 font-mono text-xs ${entry.date === date ? "text-teal" : "text-soft"}`}>
            <span>{entry.date}</span>
            <span>{entry.weight_kg} kg</span>
          </div>
        ))}
        {history.length === 0 && <div className="text-xs text-muted">No weight logs yet.</div>}
      </div>
    </div>
  );
}

function WeightStat({ label, value, tone = "soft" }: { label: string; value: string; tone?: "soft" | "ok" | "warn" }) {
  const toneClass = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-soft";
  return (
    <div className="rounded-[8px] border border-line bg-black/25 p-2">
      <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className={`mt-1 font-mono text-sm ${toneClass}`}>{value}</div>
    </div>
  );
}

function WeightChart({ history }: { history: WeightEntry[] }) {
  if (history.length < 2) {
    return (
      <div className="grid h-24 place-items-center rounded-[7px] border border-dashed border-line/60 text-center text-xs text-muted">
        Log at least 2 days to draw the graph.
      </div>
    );
  }

  const data = history.slice(-30);
  const values = data.map((entry) => entry.weight_kg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 280;
  const h = 88;
  const points = data.map((entry, index) => {
    const x = data.length === 1 ? 0 : (index / (data.length - 1)) * w;
    const y = h - ((entry.weight_kg - min) / range) * (h - 18) - 9;
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10] as [number, number];
  });
  const d = points.map((point, index) => `${index === 0 ? "M" : "L"}${point[0]},${point[1]}`).join(" ");
  const fill = `${d} L${w},${h} L0,${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="weight-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#weight-fill)" />
      <path d={d} fill="none" stroke="#22c55e" strokeWidth="2" />
      {points.map(([x, y], index) => (
        <circle key={`${x}-${y}-${index}`} cx={x} cy={y} r="2.3" fill="#ededed" opacity={index === points.length - 1 ? 1 : 0.45} />
      ))}
    </svg>
  );
}

function HealthPane({ tab, stats, onChange, workouts, totalCalories, onAddWorkout, onRemoveWorkout, draftName, setDraftName, draftCalories, setDraftCalories, draftDuration, setDraftDuration, draftType, setDraftType }: {
  tab: HealthTab;
  stats: HealthStats;
  onChange: (next: HealthStats) => void;
  workouts: WorkoutEntry[];
  totalCalories: number;
  onAddWorkout: () => void;
  onRemoveWorkout: (id: string) => void;
  draftName: string;
  setDraftName: (v: string) => void;
  draftCalories: string;
  setDraftCalories: (v: string) => void;
  draftDuration: string;
  setDraftDuration: (v: string) => void;
  draftType: WorkoutEntry["type"];
  setDraftType: (v: WorkoutEntry["type"]) => void;
}) {
  if (tab === "sleep") {
    const timedHours = sleepHoursFromTimes(stats.sleep_bedtime, stats.sleep_wakeup);
    const hours = timedHours || Number(stats.sleep_hours) || 0;
    const quality = derivedSleepQuality(hours);
    const targetHours = 8;
    const pct = Math.min(100, Math.round((hours / targetHours) * 100));
    const qualityLabels: Record<string, string> = { pending: "Pending", poor: "Poor", fair: "Fair", good: "Good", excellent: "Excellent" };
    const qualityColors: Record<string, string> = { pending: "#878787", poor: "#ef4444", fair: "#f59e0b", good: "#22c55e", excellent: "#22c55e" };
    const hasData = hours > 0 || stats.sleep_bedtime || stats.sleep_wakeup;
    const updateBedtime = (value: string) => {
      const bedtime = cleanTime(value);
      const wakeup = cleanTime((document.querySelector('[data-sleep-wakeup]') as HTMLInputElement | null)?.value || stats.sleep_wakeup);
      const nextHours = sleepHoursFromTimes(bedtime, wakeup);
      onChange({ ...stats, sleep_bedtime: bedtime, sleep_hours: nextHours ? String(nextHours) : stats.sleep_hours, sleep_quality: derivedSleepQuality(nextHours) });
    };
    const updateWakeup = (value: string) => {
      const wakeup = cleanTime(value);
      const bedtime = cleanTime((document.querySelector('[data-sleep-bedtime]') as HTMLInputElement | null)?.value || stats.sleep_bedtime);
      const nextHours = sleepHoursFromTimes(bedtime, wakeup);
      onChange({ ...stats, sleep_wakeup: wakeup, sleep_hours: nextHours ? String(nextHours) : stats.sleep_hours, sleep_quality: derivedSleepQuality(nextHours) });
    };

    return (
      <div className="space-y-3">
        {/* Hours Input - Always visible */}
        <div className="rounded-[8px] border border-line bg-black/25 p-3">
          <div className="terminal-label mb-2">SLEEP DURATION</div>
          <input
            value={stats.sleep_hours}
            onChange={(e) => onChange({ ...stats, sleep_hours: e.target.value.replace(/[^\d.]/g, "") })}
            className="input-bar w-full px-3 py-2 font-mono text-2xl text-center"
            placeholder="7.5"
            inputMode="decimal"
          />
          <div className="mt-2 text-center font-mono text-[10px] text-muted">hours of rest</div>
        </div>

        {hasData ? (
          <>
            {/* Sleep Score Ring - Only show after data entered */}
            <div className="rounded-[12px] border border-line bg-gradient-to-br from-black/40 to-black/20 p-4">
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20">
                  <svg viewBox="0 0 60 60" className="h-full w-full -rotate-90">
                    <circle cx="30" cy="30" r="26" stroke="#1a1a1a" strokeWidth="6" fill="none" />
                    <circle cx="30" cy="30" r="26" stroke={qualityColors[quality] || "#22c55e"} strokeWidth="6" fill="none"
                      strokeDasharray={`${2 * Math.PI * 26 * (pct / 100)} ${2 * Math.PI * 26}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-mono text-lg text-soft">{hours > 0 ? hours.toFixed(1) : "-"}</span>
                    <span className="font-mono text-[8px] text-muted">HRS</span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-lg italic text-soft">{qualityLabels[quality]} Sleep</span>
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-muted">Target: {targetHours} hours</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: qualityColors[quality] || "#22c55e" }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Sleep Details Grid */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-[8px] border border-line bg-black/25 p-2">
                <div className="terminal-label mb-1 text-[8px]">BEDTIME</div>
                <input
                  type="time"
                  step={60}
                  value={cleanTime(stats.sleep_bedtime)}
                  onChange={(e) => updateBedtime(e.target.value)}
                  onInput={(e) => updateBedtime(e.currentTarget.value)}
                  data-sleep-bedtime
                  className="input-bar w-full px-2 py-1.5 font-mono text-xs text-center"
                />
              </div>
              <div className="rounded-[8px] border border-line bg-black/25 p-2">
                <div className="terminal-label mb-1 text-[8px]">WAKE UP</div>
                <input
                  type="time"
                  step={60}
                  value={cleanTime(stats.sleep_wakeup)}
                  onChange={(e) => updateWakeup(e.target.value)}
                  onInput={(e) => updateWakeup(e.currentTarget.value)}
                  data-sleep-wakeup
                  className="input-bar w-full px-2 py-1.5 font-mono text-xs text-center"
                />
              </div>
              <div className="rounded-[8px] border border-line bg-black/25 p-2">
                <div className="terminal-label mb-1 text-[8px]">QUALITY</div>
                <div className="input-bar w-full px-1 py-1.5 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-soft">
                  {qualityLabels[quality]}
                </div>
              </div>
            </div>

            {/* Sleep Insight - Only show if hours entered */}
            {hours > 0 && (
              <div className="rounded-[8px] border border-teal/20 bg-teal/5 p-3">
                <div className="flex items-start gap-2">
                  <span className="text-lg">💡</span>
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-teal">Insight</div>
                    <div className="mt-0.5 text-xs text-soft">
                      {hours >= 7.5 && hours <= 9 ? "Optimal sleep range achieved. Great recovery!" :
                       hours < 6 ? "Sleep debt detected. Prioritize rest tonight." :
                       hours > 9 ? "Long sleep. Check if you feel groggy." :
                       "Aim for 7.5-9 hours for peak performance."}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-[8px] border border-dashed border-line/50 bg-black/15 p-4 text-center">
            <div className="text-2xl mb-2">🌙</div>
            <div className="text-sm text-muted">Enter sleep hours to see your sleep score</div>
          </div>
        )}
      </div>
    );
  }

  if (tab === "walk") {
    const steps = Number(stats.steps) || 0;
    const pct = Math.min(100, Math.round((steps / 10000) * 100));
    const km = (steps * 0.000762).toFixed(1);
    const calories = Math.round(steps * 0.04);

    return (
      <div className="space-y-3">
        {/* Steps Ring */}
        <div className="rounded-[12px] border border-line bg-gradient-to-br from-black/40 to-black/20 p-4">
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20">
              <svg viewBox="0 0 60 60" className="h-full w-full -rotate-90">
                <circle cx="30" cy="30" r="26" stroke="#1a1a1a" strokeWidth="6" fill="none" />
                <circle cx="30" cy="30" r="26" stroke="#22c55e" strokeWidth="6" fill="none"
                  strokeDasharray={`${2 * Math.PI * 26 * (pct / 100)} ${2 * Math.PI * 26}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-sm text-soft">{pct}%</span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-mono text-3xl text-soft">{steps.toLocaleString()}</div>
              <div className="font-mono text-[10px] text-muted">/ 10,000 steps</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-teal/70" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-[8px] border border-line bg-black/25 p-2 text-center">
            <div className="font-mono text-lg text-soft">{km}</div>
            <div className="font-mono text-[8px] text-muted uppercase">KM</div>
          </div>
          <div className="rounded-[8px] border border-line bg-black/25 p-2 text-center">
            <div className="font-mono text-lg text-soft">{calories}</div>
            <div className="font-mono text-[8px] text-muted uppercase">KCAL</div>
          </div>
          <div className="rounded-[8px] border border-line bg-black/25 p-2 text-center">
            <div className="font-mono text-lg text-soft">{Math.round(steps / 1000 * 12)}</div>
            <div className="font-mono text-[8px] text-muted uppercase">MIN</div>
          </div>
        </div>

        {/* Steps Input */}
        <div className="rounded-[8px] border border-line bg-black/25 p-3">
          <div className="terminal-label mb-2">LOG STEPS</div>
          <input
            value={stats.steps}
            onChange={(e) => onChange({ ...stats, steps: e.target.value.replace(/[^\d]/g, "") })}
            className="input-bar w-full px-3 py-2 font-mono text-xl text-center"
            placeholder="0"
            inputMode="numeric"
          />
        </div>
      </div>
    );
  }

  // Workout Tab
  const typeColors: Record<string, string> = { strength: "#ef4444", cardio: "#f59e0b", mobility: "#22c55e", sports: "#3b82f6" };
  const typeIcons: Record<string, string> = { strength: "💪", cardio: "🏃", mobility: "🧘", sports: "⚽" };

  return (
    <div className="space-y-3">
      {/* Calories Burned Summary */}
      <div className="rounded-[12px] border border-line bg-gradient-to-br from-black/40 to-black/20 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Total Burned</div>
            <div className="font-mono text-3xl text-soft">{totalCalories.toLocaleString()}</div>
            <div className="font-mono text-[10px] text-muted">kcal today</div>
          </div>
          <div className="flex gap-1">
            {workouts.length > 0 ? (
              workouts.slice(0, 4).map((w) => (
                <span key={w.id} className="flex h-8 w-8 items-center justify-center rounded-full text-lg" style={{ backgroundColor: `${typeColors[w.type]}20` }}>
                  {typeIcons[w.type]}
                </span>
              ))
            ) : (
              <span className="text-2xl">🔥</span>
            )}
          </div>
        </div>
      </div>

      {/* Add Workout Form */}
      <div className="rounded-[8px] border border-line bg-black/25 p-3">
        <div className="terminal-label mb-2">ADD WORKOUT</div>
        <div className="space-y-2">
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Workout name (e.g., Morning Run)"
            className="input-bar w-full px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              value={draftCalories}
              onChange={(e) => setDraftCalories(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="Kcal"
              inputMode="numeric"
              className="input-bar px-3 py-2 font-mono text-sm text-center"
            />
            <input
              value={draftDuration}
              onChange={(e) => setDraftDuration(e.target.value)}
              placeholder="Duration (e.g., 30min)"
              className="input-bar px-3 py-2 font-mono text-xs text-center"
            />
            <select
              value={draftType}
              onChange={(e) => setDraftType(e.target.value as WorkoutEntry["type"])}
              className="input-bar px-2 py-2 font-mono text-[10px]"
            >
              <option value="strength">💪 Strength</option>
              <option value="cardio">🏃 Cardio</option>
              <option value="mobility">🧘 Mobility</option>
              <option value="sports">⚽ Sports</option>
            </select>
          </div>
          <button
            onClick={onAddWorkout}
            disabled={!draftName.trim() || !Number(draftCalories)}
            className="w-full rounded-[7px] border border-teal/35 bg-teal/10 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-soft hover:text-teal disabled:opacity-30"
            type="button"
          >
            Log Workout
          </button>
        </div>
      </div>

      {/* Workout List */}
      {workouts.length > 0 && (
        <div className="space-y-2">
          <div className="terminal-label">TODAY&apos;S SESSIONS ({workouts.length})</div>
          <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
            {workouts.map((w) => (
              <div
                key={w.id}
                className="flex items-center gap-2 rounded-[7px] border border-line bg-black/25 px-3 py-2"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full text-sm" style={{ backgroundColor: `${typeColors[w.type]}20` }}>
                  {typeIcons[w.type]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-soft">{w.name}</div>
                  {w.duration && <div className="font-mono text-[9px] text-muted">{w.duration}</div>}
                </div>
                <div className="font-mono text-xs text-ok">{w.calories} kcal</div>
                <button
                  onClick={() => onRemoveWorkout(w.id)}
                  className="text-muted hover:text-hot"
                  type="button"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = Math.min(100, Math.round((value / target) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between font-mono text-[10px] tracking-[0.16em]">
        <span className="text-muted">{label}</span>
        <span className="text-soft">{value}<span className="text-dim">/</span>{target}g</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded bg-white/[0.06]">
        <div className="h-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
