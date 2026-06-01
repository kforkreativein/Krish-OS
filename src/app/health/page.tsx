"use client";

import { useState } from "react";
import Shell from "@/components/Shell";
import GoalsCard from "@/components/dashboard/GoalsCard";
import HabitsCard from "@/components/dashboard/HabitsCard";
import NutritionCard from "@/components/dashboard/NutritionCard";
import Panel from "@/components/Panel";

const metrics = [
  ["SLEEP", "7h 42m", "quality high"],
  ["HRV", "68", "trending up"],
  ["STRAIN", "12.4", "moderate"],
  ["STEPS", "8,430", "on pace"],
];

export default function HealthPage() {
  const [note, setNote] = useState("Sleep quality high, HRV trending up, strain moderate.");

  return (
    <Shell>
      <div className="grid gap-4 xl:grid-cols-[1fr_470px]">
        <div className="space-y-4">
          <Panel num="01" name="HEALTH SIGNALS">
            <div className="grid gap-3 md:grid-cols-4">
              {metrics.map(([label, value, sub]) => (
                <div key={label} className="rounded-[8px] border border-line bg-black/30 p-5">
                  <div className="terminal-label">{label}</div>
                  <div className="mt-4 font-mono text-4xl tracking-[-0.06em] text-soft">{value}</div>
                  <div className="mt-2 text-sm text-ok">{sub}</div>
                </div>
              ))}
            </div>
          </Panel>
          <HabitsCard />
          <Panel num="10" name="HEALTH PATTERN">
            <textarea value={note} onChange={(event) => setNote(event.target.value)} className="input-bar h-36 w-full resize-none p-4 text-base text-soft" />
          </Panel>
        </div>
        <div className="space-y-4">
          <GoalsCard />
          <NutritionCard />
        </div>
      </div>
    </Shell>
  );
}
