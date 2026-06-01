"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import Panel from "@/components/Panel";
import CategoryView from "@/components/crm/CategoryView";
import KanbanView from "@/components/crm/KanbanView";
import TaskDrawer from "@/components/crm/TaskDrawer";
import { type Task, type Urgency, URGENCIES } from "@/lib/types";

type View = "smart" | "kanban" | "category";

const VIEW_KEY = "pos.crm.view.v2";

export default function CRMPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [view, setView] = useState<View>("kanban");
  const [query, setQuery] = useState("");
  const [smartIds, setSmartIds] = useState<string[] | null>(null);
  const [smartSource, setSmartSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftUrgency, setDraftUrgency] = useState<Urgency>("Today");

  useEffect(() => {
    const saved = window.localStorage.getItem(VIEW_KEY);
    if (saved === "smart" || saved === "kanban" || saved === "category") setView(saved);
    void loadTasks();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  async function loadTasks() {
    setLoading(true);
    try {
      const response = await fetch(`/api/tasks?status=open&t=${Date.now()}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (response.ok) setTasks(payload?.tasks || []);
    } finally {
      setLoading(false);
    }
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draftTitle.trim();
    if (!title) return;
    setDraftTitle("");
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, urgency: draftUrgency, key: draftUrgency === "Today" }),
    });
    const payload = await response.json().catch(() => null);
    if (payload?.task) setTasks((current) => [payload.task, ...current]);
  }

  async function runSmartSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const q = query.trim();
    if (!q) {
      setSmartIds(null);
      setSmartSource(null);
      return;
    }
    setSearching(true);
    try {
      const response = await fetch("/api/tasks/smart", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const payload = await response.json().catch(() => null);
      setSmartIds(Array.isArray(payload?.ids) ? payload.ids : []);
      setSmartSource(payload?.source || "local");
    } finally {
      setSearching(false);
    }
  }

  async function moveTask(id: string, urgency: Urgency, priority_score: number) {
    const previous = tasks;
    const optimistic = tasks.map((task) => task.id === id ? { ...task, urgency, priority_score } : task);
    setTasks(optimistic);
    const response = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ urgency, priority_score }),
    });
    const payload = await response.json().catch(() => null);
    if (payload?.task) setTasks((current) => current.map((task) => task.id === id ? payload.task : task));
    if (!response.ok) setTasks(previous);
  }

  function saveTask(task: Task) {
    setTasks((current) => current.map((item) => item.id === task.id ? task : item).filter((item) => !item.completed_at));
    setSelectedTask((current) => current?.id === task.id ? task : current);
  }

  const stats = useMemo(() => {
    return Object.fromEntries(URGENCIES.map((urgency) => [urgency, tasks.filter((task) => task.urgency === urgency).length])) as Record<Urgency, number>;
  }, [tasks]);

  const smartTasks = useMemo(() => {
    if (!smartIds) return tasks.slice(0, 16);
    const order = new Map(smartIds.map((id, index) => [id, index]));
    return tasks
      .filter((task) => order.has(task.id))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }, [smartIds, tasks]);

  return (
    <Shell>
      <div className="flex min-h-[calc(100dvh-104px)] flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="card-head text-soft">CRM <span className="text-dim">//</span> TASK COMMAND</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Prioritize active work by urgency, key status, and AI-assisted intent.
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            {URGENCIES.map((urgency) => (
              <div key={urgency} className="rounded-[7px] border border-line bg-black/35 px-3 py-2 text-center">
                <div className={urgency === "Today" ? "text-hot" : urgency === "This Week" ? "text-warn" : "text-soft"}>{stats[urgency]}</div>
                <div>{urgency}</div>
              </div>
            ))}
          </div>
        </div>

        <Panel num="00" name="COMMAND BAR" bodyClass="p-3">
          <div className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
            <form onSubmit={createTask} className="grid gap-2 sm:grid-cols-[1fr_150px_92px]">
              <input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                className="input-bar px-3 py-2 text-sm"
                placeholder="New task..."
              />
              <select
                value={draftUrgency}
                onChange={(event) => setDraftUrgency(event.target.value as Urgency)}
                className="input-bar px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em]"
              >
                {URGENCIES.map((urgency) => <option key={urgency} value={urgency}>{urgency}</option>)}
              </select>
              <button className="glass-button px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-soft" type="submit">
                Add
              </button>
            </form>

            <form onSubmit={runSmartSearch} className="grid gap-2 sm:grid-cols-[1fr_98px]">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="input-bar px-3 py-2 text-sm"
                placeholder="Smart search: what should I do this morning?"
              />
              <button className="glass-button px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-teal" type="submit">
                {searching ? "..." : "Smart"}
              </button>
            </form>
          </div>
        </Panel>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-[8px] border border-line bg-black/45 p-1">
            {(["smart", "kanban", "category"] as View[]).map((option) => (
              <button
                key={option}
                onClick={() => setView(option)}
                className={`rounded-[6px] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] transition ${
                  view === option ? "border border-line bg-white/[0.055] text-soft" : "text-muted hover:text-soft"
                }`}
                type="button"
              >
                {option}
              </button>
            ))}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            {loading ? "SYNCING" : `${tasks.length} OPEN TASKS`}
          </div>
        </div>

        <div className="min-h-0 flex-1">
          {view === "smart" && (
            <SmartView
              tasks={smartTasks}
              source={smartSource}
              searched={Boolean(smartIds)}
              onOpen={setSelectedTask}
            />
          )}
          {view === "kanban" && <KanbanView tasks={tasks} onMove={moveTask} onOpen={setSelectedTask} />}
          {view === "category" && <CategoryView tasks={tasks} onOpen={setSelectedTask} />}
        </div>
      </div>

      <TaskDrawer task={selectedTask} onClose={() => setSelectedTask(null)} onSaved={saveTask} />
    </Shell>
  );
}

function SmartView({
  tasks,
  source,
  searched,
  onOpen,
}: {
  tasks: Task[];
  source: string | null;
  searched: boolean;
  onOpen: (task: Task) => void;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
      <Panel
        num="S"
        name={searched ? "SMART RESULTS" : "SMART QUEUE"}
        action={<span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{source || "priority"}</span>}
        bodyClass="p-3"
        className="lg:col-span-2 xl:col-span-3"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {tasks.map((task) => (
            <button
              key={task.id}
              onClick={() => onOpen(task)}
              className="min-h-[118px] rounded-[8px] border border-line bg-white/[0.035] p-4 text-left transition hover:border-teal/45"
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="line-clamp-2 text-base text-soft">{task.title}</div>
                  {task.description && <div className="mt-2 line-clamp-2 text-xs text-muted">{task.description}</div>}
                </div>
                <span className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] ${task.key ? "border-hot/40 text-hot" : "border-ok/35 text-ok"}`}>
                  {task.key ? "HOT" : "WARM"}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                <span>{task.urgency}</span>
                <span>{task.tags[0] || task.entity_id || "Task"}</span>
              </div>
            </button>
          ))}
          {tasks.length === 0 && (
            <div className="rounded-[8px] border border-dashed border-line p-8 text-center text-sm text-muted">
              No matching tasks.
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
