import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MarketQuote = {
  symbol: string;
  label: string;
  value: number;
  change: number;
  changePercent: number;
  currency: "INR" | "POINTS";
  source: string;
};

const fallback: MarketQuote[] = [
  { symbol: "NIFTY", label: "NIFTY 50", value: 23547.75, change: -359.4, changePercent: -1.5, currency: "POINTS", source: "fallback" },
  { symbol: "SENSEX", label: "SENSEX", value: 74775.74, change: -1092.06, changePercent: -1.44, currency: "POINTS", source: "fallback" },
  { symbol: "BTC", label: "BITCOIN", value: 6997113, change: 0, changePercent: 0, currency: "INR", source: "fallback" },
  { symbol: "GOLD", label: "GOLD 10G", value: 140279, change: 0, changePercent: 0, currency: "INR", source: "fallback" },
];

async function fetchNifty(): Promise<MarketQuote | null> {
  const headers = {
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    accept: "application/json,text/plain,*/*",
    referer: "https://www.nseindia.com/",
  };
  await fetch("https://www.nseindia.com", { headers, cache: "no-store" }).catch(() => null);
  const response = await fetch("https://www.nseindia.com/api/allIndices", { headers, cache: "no-store" });
  if (!response.ok) return null;
  const payload = await response.json();
  const nifty = payload?.data?.find((item: { index?: string }) => item.index === "NIFTY 50");
  if (!nifty) return null;
  return {
    symbol: "NIFTY",
    label: "NIFTY 50",
    value: Number(nifty.last) || 0,
    change: Number(nifty.variation) || 0,
    changePercent: Number(nifty.percentChange) || 0,
    currency: "POINTS",
    source: "nseindia.com",
  };
}

async function fetchSensex(): Promise<MarketQuote | null> {
  const response = await fetch("https://api.bseindia.com/RealTimeBseIndiaAPI/api/GetSensexData/w", {
    headers: {
      "user-agent": "Mozilla/5.0",
      accept: "application/json",
      referer: "https://www.bseindia.com/",
    },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const payload = await response.json();
  const sensex = payload?.[0];
  if (!sensex) return null;
  const value = Number(String(sensex.ltp).replace(/,/g, ""));
  return {
    symbol: "SENSEX",
    label: "SENSEX",
    value: Number.isFinite(value) ? value : 0,
    change: Number(sensex.chg) || 0,
    changePercent: Number(sensex.perchg) || 0,
    currency: "POINTS",
    source: "bseindia.com",
  };
}

async function fetchBitcoin(): Promise<MarketQuote | null> {
  const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=inr&include_24hr_change=true", {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const payload = await response.json();
  const value = Number(payload?.bitcoin?.inr);
  const changePercent = Number(payload?.bitcoin?.inr_24h_change) || 0;
  if (!Number.isFinite(value)) return null;
  return {
    symbol: "BTC",
    label: "BITCOIN",
    value,
    change: 0,
    changePercent,
    currency: "INR",
    source: "coingecko.com",
  };
}

async function fetchGold(): Promise<MarketQuote | null> {
  const response = await fetch("https://stooq.com/q/l/?s=gc.f+usdinr&f=sd2t2ohlcv&h&e=csv", { cache: "no-store" });
  if (!response.ok) return null;
  const csv = await response.text();
  const rows = csv.trim().split("\n").slice(1).map((line) => {
    const [symbol, , , open, , , close] = line.split(",");
    return { symbol, open: Number(open), close: Number(close) };
  });
  const gold = rows.find((row) => row.symbol === "GC.F");
  const usdInr = rows.find((row) => row.symbol === "USDINR");
  const goldUsdOz = Number(gold?.close);
  const inr = Number(usdInr?.close);
  if (!Number.isFinite(goldUsdOz) || !Number.isFinite(inr)) return null;
  const value = (goldUsdOz * inr / 31.1034768) * 10;
  const prev = (Number(gold?.open) * inr / 31.1034768) * 10;
  const change = Number.isFinite(prev) ? value - prev : 0;
  return {
    symbol: "GOLD",
    label: "GOLD 10G",
    value,
    change,
    changePercent: prev ? (change / prev) * 100 : 0,
    currency: "INR",
    source: "stooq.com",
  };
}

export async function GET() {
  const settled = await Promise.allSettled([fetchNifty(), fetchSensex(), fetchBitcoin(), fetchGold()]);
  const quotes = settled.map((result, index) => result.status === "fulfilled" && result.value ? result.value : fallback[index]);
  return NextResponse.json({ quotes, updated_at: new Date().toISOString() });
}
