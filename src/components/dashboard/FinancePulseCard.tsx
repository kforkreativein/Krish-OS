"use client";

import { useEffect, useState } from "react";
import Panel from "../Panel";

interface FinanceSnapshot {
  net_worth?: number;
  liquid_cash?: number;
  invested_assets?: number;
  runway_months?: number;
  monthly_income?: number;
  monthly_burn?: number;
  business_net?: number;
  liabilities_total?: number;
  timestamp?: string;
  daily_change?: number;
  monthly_change?: number;
  history?: number[];
}

function valueOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function fmt(n: number | undefined, currency = "INR"): string {
  const value = valueOrZero(n);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return String(value);
  }
}

function generateCurve(seed: number, points = 40): number[] {
  const arr: number[] = [];
  for (let i = 0; i < points; i++) {
    const x = i / points;
    const y = Math.sin(x * Math.PI * 2 + seed) * 0.3 + Math.sin(x * Math.PI * 6 + seed * 1.7) * 0.15 + x * 0.6;
    arr.push(y);
  }
  return arr;
}

function Sparkline({ data }: { data: number[] }) {
  const w = 320, h = 54;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const round = (n: number) => Math.round(n * 1000) / 1000;
  const points = data.map((v, i) => {
    const x = round((i / (data.length - 1)) * w);
    const y = round(h - ((v - min) / range) * (h - 6) - 3);
    return [x, y] as [number, number];
  });
  const d = points.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
  const fill = `${d} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[54px] w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="fp-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#fp-fill)" />
      <path d={d} fill="none" stroke="#22c55e" strokeWidth="1.5" />
    </svg>
  );
}

export default function FinancePulseCard() {
  const [data, setData] = useState<FinanceSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/finance/latest")
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.error || "Finance sync unavailable");
        return j;
      })
      .then((j) => {
        setError(null);
        setData(j?.snapshot ?? {});
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Finance sync unavailable");
        setData({});
      });
  }, []);

  const curve = generateCurve(7);
  const currency = "INR";
  const status = error?.includes("daily_logs") ? "DB SETUP" : error ? "ERR" : "LIVE";
  const hasSnapshot = typeof data?.net_worth === "number";
  const liquidCash = valueOrZero(data?.liquid_cash);
  const investedAssets = valueOrZero(data?.invested_assets);
  const netWorth = liquidCash + investedAssets || valueOrZero(data?.net_worth);

  return (
    <Panel
      num="07"
      name="FINANCE PULSE"
      bodyClass="finance-pulse-body p-4"
      action={
        <span className={`font-mono text-[10px] tracking-[0.18em] ${error ? "text-warn" : "text-muted"}`}>
          {status}
        </span>
      }
    >
      <div className="terminal-label">NET WORTH</div>
      <div className="mt-1 font-mono text-3xl tracking-[-0.06em] text-soft">
        {fmt(netWorth, currency)}
      </div>

      <div className="my-3 -mx-1">
        <Sparkline data={data?.history && data.history.length > 4 ? data.history : curve} />
      </div>

      {hasSnapshot ? (
        <div className="grid grid-cols-2 gap-3 pb-1">
          <DeltaBlock label="LIQUID" value={liquidCash} currency={currency} />
          <DeltaBlock label="INVESTED" value={investedAssets} currency={currency} />
        </div>
      ) : (
        <div className="rounded-[8px] border border-warn/30 bg-warn/10 p-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-warn">Sync required</div>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Run the finance snapshot endpoint after Google env vars are set. This card reads only the saved daily finance snapshot.
          </p>
        </div>
      )}
    </Panel>
  );
}

function DeltaBlock({ label, value, currency }: { label: string; value: number | undefined; currency: string }) {
  const numericValue = valueOrZero(value);
  const positive = numericValue >= 0;
  const color = positive ? "text-ok" : "text-hot";
  const sign = positive ? "+" : "";
  return (
    <div className="rounded-[8px] border border-line bg-black/30 p-3">
      <div className="terminal-label">{label}</div>
      <div className={`mt-1 font-mono text-xl tracking-[-0.04em] ${color}`}>
        {sign}{fmt(numericValue, currency)}
      </div>
    </div>
  );
}
