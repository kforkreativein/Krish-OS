import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

type LivePrice = {
  price: number | null;
  changePercent: number | null;
  source?: "yahoo" | "google" | "static";
};

type YahooQuote = {
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
};

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

function normalizeGoogleFinanceSymbol(ticker: string): string {
  const trimmed = ticker.trim();
  if (/^MUTF_IN:/i.test(trimmed)) return `${trimmed.split(":")[1]}:MUTF_IN`;
  return trimmed;
}

function parseGoogleCurrency(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/[₹,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

async function googleFinanceQuote(ticker: string): Promise<LivePrice | null> {
  const symbol = normalizeGoogleFinanceSymbol(ticker);
  if (!symbol.toUpperCase().endsWith(":MUTF_IN")) return null;

  const url = `https://www.google.com/finance/quote/${encodeURIComponent(symbol)}?hl=en`;
  const response = await fetch(url, {
    headers: {
      "accept-language": "en-US,en;q=0.9",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    },
    cache: "no-store",
  });
  if (!response.ok) return null;

  const html = await response.text();
  const price = parseGoogleCurrency(html.match(/<span[^>]*>\s*(₹[\d,.]+)\s*<\/span>/)?.[1] || html.match(/₹[\d,.]+/)?.[0]);
  const changeRaw = html.match(/<span class="ymyBi">([+-]?[\d,.]+)%<\/span>/)?.[1];
  const changePercent = changeRaw ? Number(changeRaw.replace(/,/g, "")) : null;

  if (price == null) return null;
  return {
    price,
    changePercent: Number.isFinite(changePercent) ? changePercent : null,
    source: "google",
  };
}

export async function POST(req: Request) {
  let body: { tickers?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const tickers = Array.isArray(body.tickers)
    ? Array.from(new Set(body.tickers
      .map((ticker) => {
        if (typeof ticker === "string") return ticker.trim();
        if (ticker && typeof ticker === "object" && "ticker" in ticker) return String(ticker.ticker).trim();
        return "";
      })
      .filter(Boolean)))
    : [];

  if (!tickers.length) {
    return NextResponse.json({}, { headers: noStoreHeaders });
  }

  const entries = await Promise.all(tickers.map(async (ticker): Promise<[string, LivePrice]> => {
    try {
      const googleQuote = await googleFinanceQuote(ticker);
      if (googleQuote) return [ticker, googleQuote];

      const quote = await yahooFinance.quote(ticker) as YahooQuote;
      const price = Number(quote.regularMarketPrice);
      const changePercent = Number(quote.regularMarketChangePercent);
      return [
        ticker,
        {
          price: Number.isFinite(price) ? price : null,
          changePercent: Number.isFinite(changePercent) ? changePercent : null,
          source: "yahoo",
        },
      ];
    } catch {
      return [ticker, { price: null, changePercent: null, source: "static" }];
    }
  }));

  return NextResponse.json(Object.fromEntries(entries), {
    headers: noStoreHeaders,
  });
}
