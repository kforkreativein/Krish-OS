"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
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
import Panel from "@/components/Panel";

type Prospect = {
  id: string;
  prospect_name: string;
  script_variation: string;
  status: "Sent" | "Replied" | "Booked" | "Closed";
  date_sent: string;
};

const STATUSES: Prospect["status"][] = ["Sent", "Replied", "Booked", "Closed"];
const SCRIPTS = ["Script A", "Script B", "Script C", "Script D"];

export default function OutreachBoard() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [script, setScript] = useState(SCRIPTS[0]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/studio/outreach", { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      setProspects(payload?.prospects || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const replyRates = useMemo(() => {
    const stats = new Map<string, { sent: number; replied: number }>();
    for (const prospect of prospects) {
      const key = prospect.script_variation || "Unknown";
      const current = stats.get(key) || { sent: 0, replied: 0 };
      current.sent += 1;
      if (prospect.status === "Replied" || prospect.status === "Booked" || prospect.status === "Closed") {
        current.replied += 1;
      }
      stats.set(key, current);
    }
    return [...stats.entries()].map(([variation, data]) => ({
      variation,
      rate: data.sent ? Math.round((data.replied / data.sent) * 100) : 0,
      sent: data.sent,
    }));
  }, [prospects]);

  async function addProspect(event: FormEvent) {
    event.preventDefault();
    const prospect_name = name.trim();
    if (!prospect_name) return;
    const response = await fetch("/api/studio/outreach", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prospect_name, script_variation: script, status: "Sent" }),
    });
    const payload = await response.json().catch(() => null);
    if (payload?.prospect) {
      setProspects((current) => [payload.prospect, ...current]);
      setName("");
    }
  }

  async function moveProspect(id: string, status: Prospect["status"]) {
    const previous = prospects;
    setProspects((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));
    const response = await fetch("/api/studio/outreach", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!response.ok) setProspects(previous);
    else {
      const payload = await response.json().catch(() => null);
      if (payload?.prospect) {
        setProspects((current) => current.map((item) => (item.id === id ? payload.prospect : item)));
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (!event.over) return;
    const id = String(event.active.id);
    const status = event.over.id as Prospect["status"];
    if (!STATUSES.includes(status)) return;
    const prospect = prospects.find((item) => item.id === id);
    if (!prospect || prospect.status === status) return;
    void moveProspect(id, status);
  }

  const activeProspect = activeId ? prospects.find((item) => item.id === activeId) : null;

  return (
    <div className="space-y-4">
      <Panel num="04" name="OUTREACH ANALYTICS" bodyClass="p-4">
        <div className="flex flex-wrap gap-3">
          {replyRates.length === 0 && <span className="text-sm text-muted">Add prospects to see reply rates by script.</span>}
          {replyRates.map((item) => (
            <div key={item.variation} className="rounded-[8px] border border-line bg-black/30 px-4 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{item.variation}</div>
              <div className="mt-1 font-mono text-2xl text-teal">{item.rate}%</div>
              <div className="mt-1 text-[11px] text-muted">{item.sent} sent</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel num="05" name="OUTREACH CENTER" bodyClass="p-4">
        <form onSubmit={addProspect} className="mb-4 grid gap-2 sm:grid-cols-[1fr_160px_100px]">
          <input value={name} onChange={(e) => setName(e.target.value)} className="input-bar px-3 py-2 text-sm" placeholder="Prospect name" />
          <select value={script} onChange={(e) => setScript(e.target.value)} className="input-bar px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em]">
            {SCRIPTS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <button type="submit" className="glass-button font-mono text-[10px] uppercase tracking-[0.16em] text-soft hover:text-teal">
            Add Lead
          </button>
        </form>

        {loading ? (
          <div className="text-sm text-muted">Loading pipeline…</div>
        ) : (
          <DndContext
            sensors={sensors}
            onDragStart={(event) => setActiveId(String(event.active.id))}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {STATUSES.map((status) => (
                <Column
                  key={status}
                  status={status}
                  prospects={prospects.filter((item) => item.status === status)}
                />
              ))}
            </div>
            <DragOverlay>
              {activeProspect ? <ProspectCard prospect={activeProspect} dragging /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </Panel>
    </div>
  );
}

function Column({ status, prospects }: { status: Prospect["status"]; prospects: Prospect[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={`min-h-[280px] rounded-[8px] ${isOver ? "border border-teal/45 bg-teal/[0.03]" : ""}`}>
      <header className="mb-3 flex items-center justify-between border-b border-line pb-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-soft">{status}</span>
        <span className="font-mono text-[10px] text-muted">{prospects.length}</span>
      </header>
      <div className="space-y-2">
        {prospects.length === 0 ? (
          <div className="rounded-[8px] border border-dashed border-line p-4 text-center text-xs text-muted">Drop leads here</div>
        ) : (
          prospects.map((prospect) => <DraggableProspect key={prospect.id} prospect={prospect} />)
        )}
      </div>
    </div>
  );
}

function DraggableProspect({ prospect }: { prospect: Prospect }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: prospect.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={isDragging ? "opacity-40" : ""}>
      <ProspectCard prospect={prospect} />
    </div>
  );
}

function ProspectCard({ prospect, dragging }: { prospect: Prospect; dragging?: boolean }) {
  return (
    <div className={`rounded-[8px] border border-line bg-white/[0.035] p-3 ${dragging ? "border-teal/45 shadow-lg" : ""}`}>
      <div className="text-sm text-soft">{prospect.prospect_name}</div>
      <div className="mt-2 inline-flex rounded-full border border-teal/35 bg-teal/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-teal">
        {prospect.script_variation}
      </div>
      <div className="mt-2 font-mono text-[10px] text-muted">{prospect.date_sent}</div>
    </div>
  );
}
