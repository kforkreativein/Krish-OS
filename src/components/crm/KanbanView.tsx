"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { URGENCIES, type Task, type Urgency } from "@/lib/types";

export default function KanbanView({
  tasks, onMove, onOpen,
}: {
  tasks: Task[];
  onMove: (id: string, urgency: Urgency, priority_score: number) => void;
  onOpen: (t: Task) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => setMounted(true), []);

  const activeTask = activeId ? tasks.find((task) => task.id === activeId) : null;

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    if (!e.over) return;
    const id = String(e.active.id);
    const urgency = e.over.id as Urgency;
    if (!URGENCIES.includes(urgency)) return;
    const dest = tasks.filter((task) => task.urgency === urgency);
    const maxScore = dest.reduce((max, task) => Math.max(max, task.priority_score), 0);
    onMove(id, urgency, maxScore + 10);
  }

  const numbers = ["A", "B", "C", "D"];

  if (!mounted) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {URGENCIES.map((u, i) => (
          <StaticColumn key={u} num={numbers[i]} urgency={u} tasks={tasks.filter((t) => t.urgency === u)} onOpen={onOpen} />
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(event) => setActiveId(String(event.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {URGENCIES.map((u, i) => (
          <Column key={u} num={numbers[i]} urgency={u} tasks={tasks.filter((t) => t.urgency === u)} onOpen={onOpen} />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <div className="min-h-[132px] rounded-[8px] border border-teal/45 bg-white/[0.06] p-4 shadow-lg">
            <TaskCardInner task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function StaticColumn({ urgency, tasks, onOpen }: { num: string; urgency: Urgency; tasks: Task[]; onOpen: (t: Task) => void }) {
  return (
    <div className="min-h-[360px]">
      <header className="flex items-center justify-between border-b border-line pb-3">
        <span className="card-head"><span className={urgency === "Today" ? "text-hot" : urgency === "This Week" ? "text-warn" : "text-muted"}>●</span> <span className="text-soft">{urgency.toUpperCase()}</span></span>
        <span className="font-mono text-[10px] text-muted">{tasks.length}</span>
      </header>
      <div className="space-y-3 pt-4">
        {tasks.length === 0 ? (
          <div className="rounded-[8px] border border-dashed border-line p-6 text-center text-xs text-muted">No tasks</div>
        ) : (
          tasks.map((task) => (
            <button
              key={task.id}
              onClick={() => onOpen(task)}
              className="min-h-[132px] w-full rounded-[8px] border border-line bg-white/[0.035] p-4 text-left hover:border-dim"
              type="button"
            >
              <TaskCardInner task={task} />
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function Column({ num, urgency, tasks, onOpen }: { num: string; urgency: Urgency; tasks: Task[]; onOpen: (t: Task) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: urgency });
  return (
    <div ref={setNodeRef} className={`min-h-[360px] rounded-[8px] ${isOver ? "border border-teal/50 bg-teal/[0.03]" : ""}`}>
      <header className="flex items-center justify-between border-b border-line pb-3">
        <span className="card-head"><span className={urgency === "Today" ? "text-hot" : urgency === "This Week" ? "text-warn" : "text-muted"}>●</span> <span className="text-soft">{urgency.toUpperCase()}</span></span>
        <span className="font-mono text-[10px] text-muted">{tasks.length}</span>
      </header>
      <div className="space-y-3 pt-4">
        {tasks.length === 0 ? (
          <div className="rounded-[8px] border border-dashed border-line p-6 text-center text-xs text-muted">Drop tasks here</div>
        ) : (
          tasks.map((t) => <Card key={t.id} task={t} onOpen={onOpen} />)
        )}
      </div>
    </div>
  );
}

function Card({ task, onOpen }: { task: Task; onOpen: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task)}
      className={`min-h-[132px] rounded-[8px] border border-line bg-white/[0.035] p-4 cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-40" : "hover:border-dim"
      }`}
    >
      <TaskCardInner task={task} />
    </div>
  );
}

function TaskCardInner({ task }: { task: Task }) {
  return (
    <div className="flex items-start gap-2">
      <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-[7px] border border-line bg-white/[0.04] font-mono text-xs text-soft">
        {task.priority_score ? `P${Math.max(1, Math.floor(task.priority_score / 10))}` : "P1"}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-base text-soft">{task.title}</div>
        {task.tags.length > 0 && (
          <div className="mt-1 truncate font-mono text-[10px] tracking-[0.16em] text-muted">
            {task.tags.map((t) => t.toUpperCase()).join(" · ")}
          </div>
        )}
        <div className="mt-5 flex items-center justify-between">
          <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-[0.16em] ${task.key ? "border-hot/40 text-hot" : "border-ok/35 text-ok"}`}>
            {task.key ? "HOT" : "WARM"}
          </span>
          <span className="font-mono text-[10px] text-muted">{task.tags[0] || task.entity_id || "Task"}</span>
        </div>
      </div>
    </div>
  );
}
