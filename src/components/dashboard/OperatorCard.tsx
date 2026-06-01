"use client";

import { useEffect, useState } from "react";
import Panel from "../Panel";

export default function OperatorCard() {
  const name = process.env.NEXT_PUBLIC_OWNER_NAME || "Krish";
  const role = process.env.NEXT_PUBLIC_OWNER_ROLE || "Founder";
  const city = process.env.NEXT_PUBLIC_OWNER_LOCATION || "Vadodara";
  const focus = process.env.NEXT_PUBLIC_OWNER_FOCUS || "Scaling Krish Computer";
  const [streak, setStreak] = useState(Math.max(1, Number(process.env.NEXT_PUBLIC_OWNER_STREAK || 1)));

  useEffect(() => {
    fetch("/api/dashboard/streak", { method: "POST" })
      .then((response) => response.json())
      .then((payload) => {
        if (typeof payload.streak === "number") setStreak(Math.max(1, payload.streak));
      })
      .catch(() => setStreak((current) => Math.max(1, current)));
  }, []);

  return (
    <Panel
      num="01"
      name="OPERATOR"
      bodyClass="operator-body p-4"
      action={<span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-ok"><span className="h-2 w-2 rounded-full bg-ok" />ONLINE</span>}
    >
      <div className="flex gap-4">
        <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-[12px] border border-line bg-[#171717] shadow-[inset_0_0_28px_rgba(255,255,255,0.035)]">
          <img
            src="/krish.jpeg"
            alt={name}
            className="h-full w-full object-cover object-center"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-lg font-serif italic text-soft/90">
            {name}
          </div>
          <div className="mt-1 space-y-0.5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            <div>{role}</div>
            <div>{city}</div>
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-6 border-t border-line pt-3 pb-1">
        <div>
          <div className="terminal-label mb-1">FOCUS</div>
          <div className="font-serif text-sm italic leading-tight text-soft">{focus}</div>
        </div>
        <div>
          <div className="terminal-label mb-1">STREAK</div>
          <div className="font-mono text-xl leading-tight text-ok">{streak}<span className="ml-2 text-xs text-muted">DAYS</span></div>
        </div>
      </div>
    </Panel>
  );
}
