"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const TABS = [
  { href: "/", label: "HOME" },
  { href: "/crm", label: "CRM" },
  { href: "/brain", label: "BRAIN" },
  { href: "/finance", label: "FINANCE" },
  { href: "/health", label: "HEALTH" },
  { href: "/review", label: "REVIEW" },
];

type MarketQuote = {
  symbol: string;
  label: string;
  value: number;
  change: number;
  changePercent: number;
  currency: "INR" | "POINTS";
};

const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "NIFTY", label: "NIFTY 50", value: 23547.75, change: -359.4, changePercent: -1.5, currency: "POINTS" },
  { symbol: "SENSEX", label: "SENSEX", value: 74775.74, change: -1092.06, changePercent: -1.44, currency: "POINTS" },
  { symbol: "BTC", label: "BITCOIN", value: 6997113, change: 0, changePercent: 0, currency: "INR" },
  { symbol: "GOLD", label: "GOLD 10G", value: 140279, change: 0, changePercent: 0, currency: "INR" },
];

function formatQuote(value: number, currency: MarketQuote["currency"]) {
  const formatted = new Intl.NumberFormat("en-IN", { maximumFractionDigits: currency === "INR" ? 0 : 2 }).format(value);
  return currency === "INR" ? `₹${formatted}` : formatted;
}

export default function TopRail() {
  const pathname = usePathname();
  const [now, setNow] = useState<Date | null>(null);
  const [quotes, setQuotes] = useState<MarketQuote[]>(FALLBACK_QUOTES);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    async function loadMarkets() {
      const payload = await fetch("/api/markets/live", { cache: "no-store" }).then((response) => response.json()).catch(() => null);
      if (alive && payload?.quotes?.length) setQuotes(payload.quotes);
    }
    loadMarkets();
    const t = setInterval(loadMarkets, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const timeStr = now
    ? now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
    : "--:--:--";
  const dateStr = now
    ? now.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" }).toUpperCase()
    : "";

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-bg/90 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1980px] items-center gap-4 px-5">
        <Link href="/" className="group flex shrink-0 items-center gap-2 font-mono text-[12px] tracking-[0.18em] text-soft hover:text-ok">
          <span className="h-1.5 w-1.5 rounded-full bg-ok shadow-[0_0_16px_rgba(34,197,94,0.65)]" />
          <span>KRISH OS</span>
        </Link>

        <nav className="flex min-w-0 flex-1 items-center overflow-x-auto rounded-[8px] border border-line bg-black/55 p-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]">
          {TABS.map((t) => {
            const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`shrink-0 rounded-[6px] px-4 py-2 font-mono text-[11px] tracking-[0.18em] transition ${
                  active
                    ? "border border-line bg-white/[0.055] text-soft shadow-[0_0_18px_rgba(255,255,255,0.05)]"
                    : "text-muted hover:text-soft"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden shrink-0 items-center gap-4 font-mono text-[10px] tracking-[0.12em] lg:flex">
          {quotes.map((quote) => (
            <div key={quote.symbol} className="flex items-center gap-1.5">
              <span className="text-muted">{quote.symbol}</span>
              <span className="text-soft">{formatQuote(quote.value, quote.currency)}</span>
              <span className={quote.changePercent >= 0 ? "text-ok" : "text-hot"}>
                {quote.changePercent >= 0 ? "▲" : "▼"}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-3 border-l border-line pl-4">
            <span className="text-muted">{dateStr}</span>
            <span className="text-soft">{timeStr.slice(0, 5)}</span>
            <span className="rounded-md border border-line bg-white/[0.04] px-2 py-1 text-[10px] text-soft">KC</span>
          </div>
        </div>
      </div>
    </header>
  );
}
