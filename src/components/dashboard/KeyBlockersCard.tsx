"use client";

import { useEffect, useMemo, useState } from "react";
import Panel from "../Panel";
import { type Task, type Urgency } from "@/lib/types";

const TABS: Urgency[] = ["Today", "This Week", "This Month"];
const LS_KEY = "pos.local.tasks";
const LS_COMPLETED_KEY = "pos.local.tasks.completed";

interface CompletedTask extends Task {
  completed_at: string;
}

export default function KeyBlockersCard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completed, setCompleted] = useState<CompletedTask[]>([]);
  const [tab, setTab] = useState<Urgency>("Today");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskKey, setNewTaskKey] = useState(false);

  // Load local tasks and completed from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          const local = JSON.parse(raw) as Task[];
          setTasks((current) => {
            const localIds = new Set(local.map((t) => t.id));
            const filtered = current.filter((t) => !localIds.has(t.id));
            return [...local, ...filtered];
          });
        }
        const rawCompleted = localStorage.getItem(LS_COMPLETED_KEY);
        if (rawCompleted) {
          const parsed = JSON.parse(rawCompleted) as CompletedTask[];
          setCompleted(parsed);
        }
      } catch {}
    }
  }, []);

  // Auto-refresh completed tasks based on period
  useEffect(() => {
    function shouldClearCompleted(completedAt: string, urgency: Urgency): boolean {
      const completedDate = new Date(completedAt);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const completedDay = new Date(completedDate.getFullYear(), completedDate.getMonth(), completedDate.getDate());

      if (urgency === "Today") {
        // Clear if completed before today
        return completedDay < today;
      } else if (urgency === "This Week") {
        // Get week start (Monday)
        const getWeekStart = (d: Date) => {
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
          return new Date(d.setDate(diff));
        };
        const thisWeekStart = getWeekStart(new Date(now));
        const completedWeekStart = getWeekStart(new Date(completedDate));
        return completedWeekStart < thisWeekStart;
      } else if (urgency === "This Month") {
        // Clear if completed in previous month
        return completedDate.getMonth() !== now.getMonth() || completedDate.getFullYear() !== now.getFullYear();
      }
      return false;
    }

    // Filter out old completed tasks
    const validCompleted = completed.filter((c) => !shouldClearCompleted(c.completed_at, c.urgency));
    if (validCompleted.length !== completed.length) {
      setCompleted(validCompleted);
      localStorage.setItem(LS_COMPLETED_KEY, JSON.stringify(validCompleted));
    }

    // Check every minute for period changes
    const interval = setInterval(() => {
      const now = new Date();
      const valid = completed.filter((c) => !shouldClearCompleted(c.completed_at, c.urgency));
      if (valid.length !== completed.length) {
        setCompleted(valid);
        localStorage.setItem(LS_COMPLETED_KEY, JSON.stringify(valid));
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [completed]);

  useEffect(() => {
    let alive = true;
    fetch("/api/tasks?status=open")
      .then((response) => response.json())
      .then((payload) => {
        if (!alive) return;
        const remote = (payload.tasks || []) as Task[];
        // Merge with local tasks, preferring local for same IDs
        const localIds = new Set(tasks.filter((t) => t.id.startsWith("local-")).map((t) => t.id));
        const filteredRemote = remote.filter((t) => !localIds.has(t.id));
        setTasks((current) => {
          const locals = current.filter((t) => t.id.startsWith("local-"));
          return [...locals, ...filteredRemote];
        });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const visible = useMemo(
    () => tasks.filter((task) => task.urgency === tab).sort((a, b) => b.priority_score - a.priority_score),
    [tab, tasks],
  );

  const visibleCompleted = useMemo(
    () => completed.filter((task) => task.urgency === tab).sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()),
    [tab, completed],
  );

  function saveLocalTasks(next: Task[]) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next.filter((t) => t.id.startsWith("local-"))));
    } catch {}
  }

  function saveCompletedTasks(next: CompletedTask[]) {
    setCompleted(next);
    try {
      localStorage.setItem(LS_COMPLETED_KEY, JSON.stringify(next));
    } catch {}
  }

  function addTask() {
    const title = newTaskTitle.trim();
    if (!title) return;
    const task: Task = {
      id: `local-${Date.now()}`,
      title,
      description: null,
      urgency: tab,
      key: newTaskKey,
      priority_score: newTaskKey ? 100 : 50,
      tags: [],
      due_date: null,
      entity_id: null,
      owner: null,
      completed_at: null,
      created_at: new Date().toISOString(),
    };
    const next = [task, ...tasks];
    setTasks(next);
    saveLocalTasks(next);
    setNewTaskTitle("");
    setNewTaskKey(false);
  }

  function removeTask(task: Task) {
    const next = tasks.filter((item) => item.id !== task.id);
    setTasks(next);
    saveLocalTasks(next);
    // Also remove from completed if present
    const filteredCompleted = completed.filter((c) => c.id !== task.id);
    if (filteredCompleted.length !== completed.length) {
      saveCompletedTasks(filteredCompleted);
    }
    // If it's a server task, also mark as completed on server
    if (!task.id.startsWith("local-")) {
      fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ completed_at: new Date().toISOString() }),
      }).catch(() => {});
    }
  }

  async function complete(task: Task) {
    const now = new Date().toISOString();
    const completedTask: CompletedTask = { ...task, completed_at: now };

    // Remove from active tasks
    const nextTasks = tasks.filter((item) => item.id !== task.id);
    setTasks(nextTasks);
    saveLocalTasks(nextTasks);

    // Add to completed tasks for current tab
    saveCompletedTasks([completedTask, ...completed]);

    if (!task.id.startsWith("local-")) {
      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ completed_at: now }),
      }).catch(() => {});
    }
  }

  function uncomplete(task: CompletedTask) {
    // Remove from completed
    const nextCompleted = completed.filter((c) => c.id !== task.id);
    saveCompletedTasks(nextCompleted);

    // Add back to active tasks
    const { completed_at, ...rest } = task;
    const nextTasks = [rest as Task, ...tasks];
    setTasks(nextTasks);
    saveLocalTasks(nextTasks);
  }

  return (
    <Panel num="06" name="TASKS" className="key-blockers-card" bodyClass="key-blockers-body p-4" action={<span className="font-mono text-[11px] tracking-[0.18em] text-soft">★ {visible.filter((task) => task.key).length}</span>}>
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="grid grid-cols-3 gap-1.5">
          {TABS.map((option) => (
            <button
              key={option}
              onClick={() => setTab(option)}
              className={`rounded-[7px] border px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.1em] ${tab === option ? "border-teal/45 bg-teal/10 text-teal" : "border-line text-muted hover:text-soft"}`}
              type="button"
            >
              {option.replace("This ", "")}
            </button>
          ))}
        </div>

        {/* Add Task Form */}
        <div className="rounded-[8px] border border-line bg-black/25 p-2.5">
          <div className="flex gap-2">
            <input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              placeholder={`Add ${tab.toLowerCase()} task...`}
              className="input-bar min-w-0 flex-1 px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-1.5 rounded-[7px] border border-line bg-black/35 px-2 font-mono text-[9px] text-muted cursor-pointer hover:text-soft">
              <input
                type="checkbox"
                checked={newTaskKey}
                onChange={(e) => setNewTaskKey(e.target.checked)}
                className="h-3 w-3 accent-amber-500"
              />
              ★
            </label>
            <button
              onClick={addTask}
              disabled={!newTaskTitle.trim()}
              className="glass-button grid h-9 w-9 place-items-center font-mono text-lg text-soft hover:text-teal disabled:opacity-30"
              type="button"
            >
              +
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1 space-y-2">
          {/* Active Tasks */}
          <ul className="divide-y divide-line">
            {visible.length === 0 && visibleCompleted.length === 0 && (
              <li className="py-5 text-xs text-muted">No {tab.toLowerCase()} tasks yet.</li>
            )}
            {visible.map((task) => (
              <li key={task.id} className="flex items-center gap-3 py-2.5 group">
                <button onClick={() => complete(task)} className="h-5 w-5 rounded border border-line bg-black/30 hover:border-teal/60" aria-label={`Complete ${task.title}`} type="button" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-soft">{task.title}</div>
                  <div className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                    {task.entity_id || task.tags?.[0] || "task"} {task.key ? "· KEY" : ""} {task.id.startsWith("local-") ? "· LOCAL" : ""}
                  </div>
                </div>
                {task.key && <span className="font-mono text-xs text-warn">★</span>}
                <button
                  onClick={() => removeTask(task)}
                  className="opacity-0 group-hover:opacity-100 text-muted hover:text-hot text-xs px-1"
                  type="button"
                  aria-label={`Remove ${task.title}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          {/* Completed Tasks */}
          {visibleCompleted.length > 0 && (
            <div className="space-y-1">
              <div className="terminal-label flex items-center justify-between">
                <span className="text-dim">COMPLETED ({visibleCompleted.length})</span>
                <button
                  onClick={() => {
                    const remaining = completed.filter((c) => c.urgency !== tab || !visibleCompleted.find((v) => v.id === c.id));
                    saveCompletedTasks(remaining);
                  }}
                  className="text-[9px] text-muted hover:text-hot"
                  type="button"
                >
                  Clear
                </button>
              </div>
              <ul className="divide-y divide-line/50">
                {visibleCompleted.slice(0, 3).map((task) => (
                  <li key={task.id} className="flex items-center gap-3 py-2 group opacity-60">
                    <button
                      onClick={() => uncomplete(task)}
                      className="h-5 w-5 rounded border border-teal bg-teal flex items-center justify-center"
                      aria-label={`Uncomplete ${task.title}`}
                      type="button"
                    >
                      <svg className="h-3 w-3 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-muted line-through">{task.title}</div>
                      <div className="mt-1 truncate font-mono text-[9px] uppercase tracking-[0.14em] text-dim">
                        {task.entity_id || task.tags?.[0] || "task"} {task.key ? "· KEY" : ""} · Done
                      </div>
                    </div>
                    <button
                      onClick={() => removeTask(task)}
                      className="opacity-0 group-hover:opacity-100 text-muted hover:text-hot text-xs px-1"
                      type="button"
                    >
                      ×
                    </button>
                  </li>
                ))}
                {visibleCompleted.length > 3 && (
                  <li className="py-1 text-xs text-dim text-center">+{visibleCompleted.length - 3} more completed</li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
