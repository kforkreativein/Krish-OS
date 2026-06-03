export type Goal = { id: string; text: string; done: boolean };

export const LS_KEY_WEEKLY = "pos.goals.weekly";
export const LS_KEY_MONTHLY = "pos.goals.monthly";
export const LS_KEY_WEEKLY_LIST = "pos.goals.weekly.list.v1";
export const LS_KEY_MONTHLY_LIST = "pos.goals.monthly.list.v1";

export function readGoals(listKey: string, legacyKey: string): Goal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(listKey);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) {
      return parsed.filter((goal) => typeof goal?.text === "string" && goal.text.trim());
    }
    const legacy = localStorage.getItem(legacyKey)?.trim();
    return legacy ? [{ id: crypto.randomUUID(), text: legacy, done: false }] : [];
  } catch {
    return [];
  }
}

export function saveGoalsList(key: string, goals: Goal[]) {
  try {
    localStorage.setItem(key, JSON.stringify(goals));
  } catch {}
}

export async function syncGoalsToServer(weekly: Goal[], monthly: Goal[]) {
  const date = new Date().toISOString().slice(0, 10);
  await fetch("/api/daily/upsert", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ date, patch: { goals: { weekly, monthly } } }),
  }).catch(() => {});
}

export async function loadGoalsFromServer(): Promise<{ weekly: Goal[]; monthly: Goal[] } | null> {
  const date = new Date().toISOString().slice(0, 10);
  const response = await fetch(`/api/daily/get?date=${date}`, { cache: "no-store" }).catch(() => null);
  if (!response?.ok) return null;
  const payload = await response.json().catch(() => null);
  const goals = payload?.notes?.goals as { weekly?: Goal[]; monthly?: Goal[] } | undefined;
  if (!goals) return null;
  const weekly = Array.isArray(goals.weekly) ? goals.weekly : [];
  const monthly = Array.isArray(goals.monthly) ? goals.monthly : [];
  if (!weekly.length && !monthly.length) return null;
  return { weekly, monthly };
}
