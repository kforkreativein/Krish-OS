"use client";

import { useState } from "react";
import Shell from "@/components/Shell";
import Panel from "@/components/Panel";

const fields = [
  ["WINS THIS WEEK", "Shipped classifier v2, closed intro loop, hit 47d training streak."],
  ["WHAT SLIPPED", "Essay drafted but not shipped. Finance automation delayed."],
  ["OPEN LOOPS", "Atlas reference check. v2.7 hand-off doc."],
  ["PEOPLE TO FOLLOW UP WITH", "[P4], Elena, [P6]"],
  ["CONTENT SHIPPED", "Nothing public. 1 essay in draft."],
  ["HEALTH PATTERN", "Sleep quality high, HRV trending up, strain moderate."],
];

export default function ReviewPage() {
  const [saved, setSaved] = useState(false);

  return (
    <Shell>
      <div className="mb-5 card-head text-soft">REVIEW</div>
      <Panel
        name="WEEKLY REVIEW · W17"
        bodyClass="p-6"
        action={
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] tracking-[0.18em] text-muted">{saved ? "AUTO-SAVED" : "DRAFT"}</span>
            <button onClick={() => setSaved(true)} className="glass-button px-4 py-2 font-mono text-[11px] tracking-[0.16em] text-soft hover:text-teal" type="button">
              ✓ SEAL WEEK
            </button>
          </div>
        }
      >
        <div className="font-serif text-4xl italic text-soft">
          Mon [DATE] <span className="font-sans text-muted">→</span> Sun [DATE]
        </div>
      </Panel>

      <Panel className="mt-4" bodyClass="p-6">
        <div className="grid gap-4 lg:grid-cols-2">
          {fields.map(([label, value]) => (
            <label key={label} className="block">
              <div className="terminal-label mb-2">{label}</div>
              <textarea
                defaultValue={value}
                rows={3}
                className="input-bar w-full resize-none px-4 py-3 text-base text-soft"
              />
            </label>
          ))}
        </div>
      </Panel>

      <Panel num="NEXT WEEK" name="TOP 3" className="mt-14" bodyClass="p-6">
        <textarea
          defaultValue="1) Ship essay   2) Close term sheet review   3) Finance snapshot live"
          rows={4}
          className="input-bar w-full resize-none px-4 py-4 text-lg text-soft"
        />
      </Panel>
    </Shell>
  );
}
