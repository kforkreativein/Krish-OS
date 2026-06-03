"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import DiagnosticsView from "@/components/agency/DiagnosticsView";
import OutreachBoard from "@/components/agency/OutreachBoard";
import KanbanView from "@/components/crm/KanbanView";
import TaskDrawer from "@/components/crm/TaskDrawer";
import Panel from "@/components/Panel";
import { type Task, type Urgency, URGENCIES } from "@/lib/types";

type View = "studio" | "outreach" | "campaign";

const VIEW_KEY = "pos.agency.view.v1";

export default function AgencyPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [view, setView] = useState<View>("studio");
  const [loading, setLoading] = useState(true);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftUrgency, setDraftUrgency] = useState<Urgency>("Today");

  useEffect(() => {
    const saved = window.localStorage.getItem(VIEW_KEY);
    if (saved === "studio" || saved === "outreach" || saved === "campaign") setView(saved);
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

  async function moveTask(id: string, urgency: Urgency, priority_score: number) {
    const previous = tasks;
    setTasks(tasks.map((task) => task.id === id ? { ...task, urgency, priority_score } : task));
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

  return (
    <Shell>
      <div className="flex min-h-[calc(100dvh-104px)] flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="card-head text-soft">AGENCY <span className="text-dim">//</span> K FOR KREATIVE</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Client video diagnostics, DM outreach pipeline, and campaign task boards in one command center.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-[8px] border border-line bg-black/45 p-1">
            {([
              { key: "studio" as const, label: "Studio" },
              { key: "outreach" as const, label: "Outreach" },
              { key: "campaign" as const, label: "Campaign" },
            ]).map((option) => (
              <button
                key={option.key}
                onClick={() => setView(option.key)}
                className={`rounded-[6px] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] transition ${
                  view === option.key ? "border border-line bg-white/[0.055] text-soft" : "text-muted hover:text-soft"
                }`}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            {view === "campaign" && (loading ? "SYNCING TASKS" : `${tasks.length} OPEN TASKS`)}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-6">
          {view === "studio" && <DiagnosticsView />}
          {view === "outreach" && <OutreachBoard />}
          {view === "campaign" && (
            <div className="space-y-4">
              <Panel num="00" name="CAMPAIGN COMMAND" bodyClass="p-3">
                <form onSubmit={createTask} className="grid gap-2 sm:grid-cols-[1fr_150px_92px]">
                  <input
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    className="input-bar px-3 py-2 text-sm"
                    placeholder="New campaign task..."
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
                <div className="mt-3 grid grid-cols-4 gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                  {URGENCIES.map((urgency) => (
                    <div key={urgency} className="rounded-[7px] border border-line bg-black/35 px-3 py-2 text-center">
                      <div className={urgency === "Today" ? "text-hot" : urgency === "This Week" ? "text-warn" : "text-soft"}>{stats[urgency]}</div>
                      <div>{urgency}</div>
                    </div>
                  ))}
                </div>
              </Panel>
              <KanbanView tasks={tasks} onMove={moveTask} onOpen={setSelectedTask} />
            </div>
          )}
        </div>
      </div>

      <TaskDrawer task={selectedTask} onClose={() => setSelectedTask(null)} onSaved={saveTask} />
    </Shell>
  );
}
