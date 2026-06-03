export type HabitPriority = "low" | "medium" | "high";

export interface HabitDef {
  key: string;
  name: string;
  category: string;
  target: number;
  priority: HabitPriority;
  daily?: boolean;
}

export type HabitCounts = Record<string, number>;

export const LS_PREFIX = "pos.habits.";
export const DEFS_KEY = "pos.habits.definitions.v2";
const LEGACY_DEFS_KEY = "pos.habits.definitions";
export const HABITS_EVENT = "pos:habits-updated";
export const ONE_PERCENT_HABIT_KEY = "one-percent";

export function loadHabitCounts(date: string): HabitCounts {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_PREFIX + date);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveHabitCounts(date: string, counts: HabitCounts) {
  try {
    localStorage.setItem(LS_PREFIX + date, JSON.stringify(counts));
  } catch {}
}

export function loadHabitDefinitions(): HabitDef[] {
  if (typeof window === "undefined") return [];
  try {
    let raw = localStorage.getItem(DEFS_KEY);
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_DEFS_KEY);
      if (legacy) {
        raw = legacy;
        localStorage.setItem(DEFS_KEY, legacy);
      }
    }
    const parsed = raw ? JSON.parse(raw) : null;
    const definitions = Array.isArray(parsed) && parsed.length
      ? parsed.map((habit: HabitDef) => ({ ...habit, daily: habit.daily ?? true }))
      : [];
    return definitions.filter((habit) => {
      const isLegacyDefaultWorkout =
        habit.name === "Workout" &&
        habit.category === "FITNESS" &&
        habit.target === 1 &&
        habit.daily === true;
      return !isLegacyDefaultWorkout;
    });
  } catch {
    return [];
  }
}

export function saveHabitDefinitions(habits: HabitDef[]) {
  try {
    localStorage.setItem(DEFS_KEY, JSON.stringify(habits));
  } catch {}
}

export function notifyHabitsUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(HABITS_EVENT));
}

/** Mirror today's 1% log as a completed habit (Health tab + home Habits card). */
export async function syncOnePercentToHabits(date: string, text: string, area: string) {
  if (typeof window === "undefined") return;
  const name = text.trim();
  if (!name) return;

  const category = area.toUpperCase() === "BUSINESS" ? "BUSINESS" : "PERSONAL";
  const habit: HabitDef = {
    key: ONE_PERCENT_HABIT_KEY,
    name,
    category,
    target: 1,
    priority: "high",
    daily: true,
  };

  const definitions = loadHabitDefinitions();
  const existingIndex = definitions.findIndex((item) => item.key === ONE_PERCENT_HABIT_KEY);
  const nextDefinitions =
    existingIndex >= 0
      ? definitions.map((item, index) => (index === existingIndex ? habit : item))
      : [habit, ...definitions];
  saveHabitDefinitions(nextDefinitions);

  const counts = { ...loadHabitCounts(date), [ONE_PERCENT_HABIT_KEY]: 1 };
  saveHabitCounts(date, counts);

  await fetch("/api/daily/upsert", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ date, patch: { habits: counts } }),
  }).catch(() => {});

  notifyHabitsUpdated();
}
