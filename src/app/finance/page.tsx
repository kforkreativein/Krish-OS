"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import Panel from "@/components/Panel";

type PortfolioHolding = {
  ticker: string;
  raw_ticker?: string;
  exchange?: string;
  google_symbol?: string;
  buy_price: number;
  quantity: number;
  is_mutual_fund?: boolean;
};

type FinanceSnapshot = {
  net_worth?: number;
  liquid_cash?: number;
  invested_assets?: number;
  runway_months?: number;
  monthly_income?: number;
  monthly_burn?: number;
  business_net?: number;
  business_income?: number;
  personal_income?: number;
  business_expense?: number;
  personal_expense?: number;
  liabilities_total?: number;
  portfolio_holdings?: PortfolioHolding[];
  timestamp?: string;
};

type LivePrice = Record<string, { price: number | null; changePercent: number | null; source?: string }>;

export default function FinancePage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<FinanceSnapshot>({});
  const [asOf, setAsOf] = useState<string | null>(null);
  const [prices, setPrices] = useState<LivePrice>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [assetView, setAssetView] = useState<"liquid" | "invested">("liquid");

  useEffect(() => {
    let alive = true;
    fetch("/api/finance/latest")
      .then((response) => response.json())
      .then((payload) => {
        if (!alive) return;
        setSnapshot(payload.snapshot || {});
        setAsOf(payload.as_of || null);
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const holdings = useMemo(
    () => (snapshot.portfolio_holdings ?? []).filter((holding) => {
      const exchange = String(holding.exchange || "").toUpperCase();
      const isTrackedAsset = ["NSE", "NYSE", "NASDAQ"].includes(exchange) || Boolean(holding.is_mutual_fund);
      return isTrackedAsset && holding.ticker && numberValue(holding.quantity) > 0;
    }),
    [snapshot.portfolio_holdings],
  );

  useEffect(() => {
    const tickers = holdings.map((holding) => ({
      ticker: quoteTicker(holding),
      raw_ticker: holding.raw_ticker,
      exchange: holding.exchange,
      is_mutual_fund: Boolean(holding.is_mutual_fund),
    }));
    if (!tickers.length) return;
    let alive = true;
    fetch("/api/finance/live-prices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tickers }),
    })
      .then((response) => response.json())
      .then((payload) => { if (alive) setPrices(payload || {}); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [holdings]);

  const metrics = {
    liquidCash: numberValue(snapshot.liquid_cash),
    investedAssets: numberValue(snapshot.invested_assets),
    runwayMonths: numberValue(snapshot.runway_months),
    monthlyIncome: numberValue(snapshot.monthly_income),
    monthlyBurn: numberValue(snapshot.monthly_burn),
    businessNet: numberValue(snapshot.business_net),
    businessIncome: numberValue(snapshot.business_income),
    personalIncome: numberValue(snapshot.personal_income),
    businessExpense: numberValue(snapshot.business_expense),
    personalExpense: numberValue(snapshot.personal_expense),
    liabilities: numberValue(snapshot.liabilities_total),
  };
  const netWorth = metrics.liquidCash + metrics.investedAssets || numberValue(snapshot.net_worth);

  async function syncSheet() {
    setIsSyncing(true);
    try {
      setPrices({});
      const response = await fetch("/api/finance/snapshot", { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (payload?.finance) {
        setSnapshot(payload.finance);
        setAsOf(payload.date || null);
      }
      router.refresh();
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <Shell>
      <div className="flex h-[calc(100dvh-104px)] min-h-0 flex-col overflow-hidden">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="card-head text-soft">FINANCE <span className="text-dim">//</span> LIVE MATRIX</div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              {snapshot.timestamp || asOf || "Awaiting snapshot"}
            </div>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            <button
              type="button"
              onClick={syncSheet}
              disabled={isSyncing}
              className="border border-line bg-black px-3 py-2 text-soft transition hover:border-dim hover:bg-white/[0.03] disabled:cursor-wait disabled:text-muted"
            >
              [ {isSyncing ? "SYNCING" : "↻ SYNC SHEET"} ]
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-[0_0_35%] grid-cols-4 gap-3 pb-3">
          <MetricCard title="NET WORTH" value={formatCurrency(netWorth)} lines={["liquid + invested", "DASHBOARD C23 + F30"]} chart />
          <MetricCard title="RUNWAY" value={formatMonths(metrics.runwayMonths)} suffix="mo" lines={["@ current burn", `${formatCurrency(metrics.liquidCash)} liquid`]} />
          <MetricCard title="INCOME / MO" value={formatCurrency(metrics.monthlyIncome)} lines={["DASHBOARD F7", `${formatCurrency(metrics.businessNet)} business net`]} />
          <MetricCard title="BURN / MO" value={formatCurrency(metrics.monthlyBurn)} lines={["DASHBOARD I7", "active month"]} />
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[30%_1fr] gap-3">
          <div className="grid min-h-0 grid-rows-[1.08fr_0.92fr] gap-3">
            <AssetCard num="05" title="CASHFLOW MATRIX" bodyClass="flex h-full min-h-0 flex-col overflow-y-auto p-4">
              <CashflowMatrix metrics={metrics} />
            </AssetCard>
            <AssetTabsCard
              active={assetView}
              onActive={setAssetView}
              liquidCash={metrics.liquidCash}
              investedAssets={metrics.investedAssets}
            />
          </div>
          <PortfolioMatrix holdings={holdings} prices={prices} />
        </div>
      </div>
    </Shell>
  );
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function nullableNumberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatCurrency(value: number): string {
  return formatCurrencyFor(value, "INR");
}

function formatCurrencyFor(value: number, currency: "INR" | "USD"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function holdingCurrency(holding: PortfolioHolding): "INR" | "USD" {
  const exchange = String(holding.exchange || "").toUpperCase();
  return exchange === "NYSE" || exchange === "NASDAQ" ? "USD" : "INR";
}

function quoteTicker(holding: PortfolioHolding): string {
  if (holding.google_symbol) return holding.google_symbol;
  const raw = `${holding.raw_ticker || ""} ${holding.ticker || ""}`.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  if (raw.includes("jioblackrock") && raw.includes("flexi")) return "JIOB_FLEX_CAP_123XBSR:MUTF_IN";
  if (raw.includes("nippon") && raw.includes("large")) return "NIPP_INDI_LARG_M0P6CR:MUTF_IN";
  if (raw.includes("hdfc") && raw.includes("small")) return "HDFC_SMAL_CAP_3AM37B:MUTF_IN";
  if (raw.includes("motilal") && raw.includes("mid")) return "MOTI_OSWA_MIDC_1E5B8T2:MUTF_IN";
  if (raw.includes("kotak") && raw.includes("gold")) return "KOTA_GOLD_DIR_1XXKHDT:MUTF_IN";
  if (holding.ticker?.toUpperCase().startsWith("MUTF_IN:")) return `${holding.ticker.split(":")[1]}:MUTF_IN`;
  return holding.ticker;
}

function formatPlain(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);
}

function formatMonths(value: number): string {
  if (!value) return "0.0";
  if (value >= 999) return "999";
  return value.toFixed(1);
}

function MetricCard({ title, value, suffix, lines, chart }: {
  title: string;
  value: string;
  suffix?: string;
  lines: string[];
  chart?: boolean;
}) {
  return (
    <Panel name={title} bodyClass="flex h-full min-h-0 flex-col p-4">
      <div className="break-words font-mono text-3xl tracking-normal text-soft 2xl:text-4xl">
        {value}<span className="ml-1 text-sm text-muted">{suffix}</span>
      </div>
      <div className="mt-2 space-y-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
        {lines.map((line, index) => <div key={line} className={index === 0 ? "text-ok" : ""}>{line}</div>)}
      </div>
      {chart && <Chart className="mt-auto h-12" />}
    </Panel>
  );
}

function AssetCard({ num, title, value, lines, tone = "ok", bodyClass, children }: {
  num: string;
  title: string;
  value?: string;
  lines?: string[];
  tone?: "ok" | "danger";
  bodyClass?: string;
  children?: ReactNode;
}) {
  return (
    <Panel num={num} name={title} bodyClass={bodyClass ?? "flex h-full min-h-0 flex-col overflow-y-auto p-4"}>
      {children ?? (
        <>
          <div className="break-words font-mono text-4xl tracking-normal text-soft">{value}</div>
          <Chart tone={tone} className="my-auto h-14" />
          <div className="space-y-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
            {(lines ?? []).map((line, index) => <div key={line} className={index === 0 ? "text-soft/75" : ""}>{line}</div>)}
          </div>
        </>
      )}
    </Panel>
  );
}

function AssetTabsCard({ active, onActive, liquidCash, investedAssets }: {
  active: "liquid" | "invested";
  onActive: (value: "liquid" | "invested") => void;
  liquidCash: number;
  investedAssets: number;
}) {
  const selected = active === "liquid"
    ? {
        title: "LIQUID CASH",
        value: liquidCash,
        lines: ["Bank accounts total", "DASHBOARD C23"],
      }
    : {
        title: "INVESTED ASSET",
        value: investedAssets,
        lines: ["Portfolio + long-term assets", "DASHBOARD F30"],
      };

  return (
    <Panel num="A1" name="ASSET BASE" bodyClass="flex h-full min-h-0 flex-col overflow-y-auto p-4">
      <div className="mb-4 grid grid-cols-2 gap-2">
        {[
          { key: "liquid" as const, label: "LIQUID CASH" },
          { key: "invested" as const, label: "INVESTED ASSET" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => onActive(tab.key)}
            className={`border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] transition ${
              active === tab.key
                ? "border-ok/45 bg-ok/10 text-ok"
                : "border-line bg-black/35 text-muted hover:border-dim hover:text-soft"
            }`}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="terminal-label">{selected.title}</div>
      <div className="mt-2 break-words font-mono text-4xl tracking-normal text-soft">{formatCurrency(selected.value)}</div>
      <Chart className="my-auto h-14" />
      <div className="space-y-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
        {selected.lines.map((line, index) => <div key={line} className={index === 0 ? "text-soft/75" : ""}>{line}</div>)}
      </div>
    </Panel>
  );
}

function CashflowMatrix({ metrics }: { metrics: {
  businessIncome: number;
  personalIncome: number;
  businessExpense: number;
  personalExpense: number;
} }) {
  const cells = [
    { label: "BUSINESS INCOME", value: metrics.businessIncome, tone: "text-ok", sub: "DASHBOARD R7" },
    { label: "PERSONAL INCOME", value: metrics.personalIncome, tone: "text-ok", sub: "DASHBOARD V7" },
    { label: "BUSINESS EXPENSE", value: metrics.businessExpense, tone: "text-hot", sub: "DASHBOARD R22" },
    { label: "PERSONAL EXPENSE", value: metrics.personalExpense, tone: "text-hot", sub: "DASHBOARD V22" },
  ];
  return (
    <div className="grid min-h-0 grid-cols-2 gap-x-4 gap-y-4">
      {cells.map((cell) => (
        <div key={cell.label} className="flex min-h-0 flex-col border-t border-line/80 pt-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{cell.label}</div>
          <div className={`mt-2 break-words font-mono text-xl leading-tight tracking-normal xl:text-2xl ${cell.tone}`}>{formatCurrency(cell.value)}</div>
          <div className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.13em] text-dim">{cell.sub}</div>
        </div>
      ))}
    </div>
  );
}

type PortfolioRow = {
  holding: PortfolioHolding;
  quoteKey: string;
  currency: "INR" | "USD";
  quantity: number;
  cost: number;
  value: number;
  pnl: number;
  displayPrice: number;
  fallbackStatic: boolean;
  changePercent: number | null;
  quoteSource?: string;
};

function portfolioRows(holdings: PortfolioHolding[], prices: LivePrice): PortfolioRow[] {
  return holdings.map((holding) => {
    const quoteKey = quoteTicker(holding);
    const quote = prices[quoteKey] || prices[holding.ticker];
    const livePrice = nullableNumberValue(quote?.price);
    const changePercent = nullableNumberValue(quote?.changePercent);
    const fallbackStatic = livePrice == null;
    const quantity = numberValue(holding.quantity);
    const buyPrice = numberValue(holding.buy_price);
    const displayPrice = fallbackStatic ? buyPrice : livePrice;
    const cost = buyPrice * quantity;
    const value = displayPrice * quantity;
    const pnl = fallbackStatic ? 0 : (livePrice - buyPrice) * quantity;
    return {
      holding,
      quoteKey,
      currency: holdingCurrency(holding),
      quantity,
      cost,
      value,
      pnl,
      displayPrice,
      fallbackStatic,
      changePercent,
      quoteSource: quote?.source,
    };
  });
}

type CurrencyTotals = { cost: number; value: number; pnl: number };

function sumByCurrency(rows: PortfolioRow[]): { INR: CurrencyTotals; USD: CurrencyTotals } {
  const totals = {
    INR: { cost: 0, value: 0, pnl: 0 },
    USD: { cost: 0, value: 0, pnl: 0 },
  };
  for (const row of rows) {
    const bucket = totals[row.currency];
    bucket.cost += row.cost;
    bucket.value += row.value;
    bucket.pnl += row.pnl;
  }
  return totals;
}

function PortfolioMatrix({ holdings, prices }: { holdings: PortfolioHolding[]; prices: LivePrice }) {
  const rows = useMemo(() => portfolioRows(holdings, prices), [holdings, prices]);
  const totals = useMemo(() => sumByCurrency(rows), [rows]);
  const hasInr = rows.some((row) => row.currency === "INR");
  const hasUsd = rows.some((row) => row.currency === "USD");

  return (
    <Panel num="04" name="LIVE PORTFOLIO" bodyClass="flex h-full min-h-0 flex-col p-0">
      <div className="grid grid-cols-[1.1fr_0.7fr_1fr_1fr_1fr] border-b border-line px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
        <span>Ticker</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Avg Price</span>
        <span className="text-right">LTP (Live)</span>
        <span className="text-right">P&amp;L</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {rows.length === 0 && (
          <div className="px-4 py-8 text-sm text-muted">No portfolio holdings saved yet. Run the finance snapshot sync.</div>
        )}
        {rows.map((row) => (
          <div
            key={`${row.holding.ticker}-${row.holding.buy_price}-${row.holding.quantity}`}
            className="grid grid-cols-[1.1fr_0.7fr_1fr_1fr_1fr] items-center border-b border-line px-4 py-2.5 font-mono text-sm tabular-nums hover:bg-white/[0.025]"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            <div className="min-w-0">
              <div className="truncate text-soft">{row.holding.raw_ticker || row.holding.ticker}</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted">{row.quoteKey}</div>
            </div>
            <span className="text-right text-soft/80">{formatPlain(row.quantity)}</span>
            <span className="text-right text-soft/80">{formatCurrencyFor(row.holding.buy_price, row.currency)}</span>
            <span className={`text-right ${row.fallbackStatic ? "text-muted" : row.changePercent && row.changePercent < 0 ? "text-hot" : "text-ok"}`}>
              {formatCurrencyFor(row.displayPrice, row.currency)}
              <span className="ml-2 text-[10px] text-muted">
                {row.fallbackStatic ? "static" : `${row.quoteSource || "live"} ${(row.changePercent ?? 0).toFixed(2)}%`}
              </span>
            </span>
            <span className={`text-right ${row.fallbackStatic ? "text-muted" : row.pnl >= 0 ? "text-ok" : "text-hot"}`}>
              {formatCurrencyFor(row.pnl, row.currency)}
            </span>
          </div>
        ))}
      </div>
      {rows.length > 0 && (
        <div className="flex-shrink-0 border-t border-line bg-black/55">
          {hasInr && (
            <PortfolioTotalRow label="TOTAL (INR)" currency="INR" totals={totals.INR} positions={rows.filter((r) => r.currency === "INR").length} />
          )}
          {hasUsd && (
            <PortfolioTotalRow label="TOTAL (USD)" currency="USD" totals={totals.USD} positions={rows.filter((r) => r.currency === "USD").length} />
          )}
        </div>
      )}
    </Panel>
  );
}

function PortfolioTotalRow({
  label,
  currency,
  totals,
  positions,
}: {
  label: string;
  currency: "INR" | "USD";
  totals: CurrencyTotals;
  positions: number;
}) {
  const positive = totals.pnl >= 0;
  return (
    <div
      className="grid grid-cols-[1.1fr_0.7fr_1fr_1fr_1fr] items-center px-4 py-3 font-mono text-sm tabular-nums"
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      <div>
        <div className="text-[11px] uppercase tracking-[0.14em] text-soft">{label}</div>
        <div className="mt-0.5 text-[10px] text-muted">{positions} position{positions === 1 ? "" : "s"}</div>
      </div>
      <span className="text-right text-muted">—</span>
      <span className="text-right text-soft">{formatCurrencyFor(totals.cost, currency)}</span>
      <span className="text-right text-soft">{formatCurrencyFor(totals.value, currency)}</span>
      <span className={`text-right font-medium ${positive ? "text-ok" : "text-hot"}`}>{formatCurrencyFor(totals.pnl, currency)}</span>
    </div>
  );
}

function Chart({ tone = "ok", className = "" }: { tone?: "ok" | "danger"; className?: string }) {
  const color = tone === "danger" ? "#ef4444" : "#10b981";
  const id = `fill-${tone}-${className.replace(/\W/g, "") || "chart"}`;
  return (
    <svg viewBox="0 0 520 110" className={`w-full ${className}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 86 C90 78 125 82 180 66 C240 49 310 58 370 38 C430 20 474 31 520 18 L520 110 L0 110 Z" fill={`url(#${id})`} />
      <path d="M0 86 C90 78 125 82 180 66 C240 49 310 58 370 38 C430 20 474 31 520 18" fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}
