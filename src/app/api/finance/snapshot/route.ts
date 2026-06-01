import { NextResponse } from "next/server";
import { google } from "googleapis";
import ExcelJS from "exceljs";
import { geminiGenerate, hasGemini } from "@/lib/gemini";
import { supabaseService } from "@/lib/supabase";
import { OWNER_USER_ID } from "@/lib/env";
import { localDateKey } from "@/lib/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const host = new URL(req.url).hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  const got = req.headers.get("authorization") || req.headers.get("x-cron-secret") || "";
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const token = got.startsWith("Bearer ") ? got.slice(7) : got;
  return token === expected;
}

async function downloadWorkbook(): Promise<ArrayBuffer> {
  const fileId = process.env.GOOGLE_SHEETS_FILE_ID || process.env.GOOGLE_SHEETS_FINANCE_ID;
  if (!fileId) throw new Error("GOOGLE_SHEETS_FILE_ID or GOOGLE_SHEETS_FINANCE_ID not set");
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!email || !key) throw new Error("Google service account env vars not set");

  const jwt = new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  await jwt.authorize();
  const drive = google.drive({ version: "v3", auth: jwt });
  const res = await drive.files.export(
    {
      fileId,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
    { responseType: "arraybuffer" },
  );
  return res.data as ArrayBuffer;
}

type FinanceCells = {
  net_worth: number;
  liquid_cash: number;
  invested_assets: number;
  runway_months: number;
  monthly_income: number;
  monthly_burn: number;
  business_net: number;
  business_income: number;
  personal_income: number;
  business_expense: number;
  personal_expense: number;
  liabilities_total: number;
};

type PortfolioHolding = {
  ticker: string;
  raw_ticker: string;
  exchange: string;
  buy_price: number;
  quantity: number;
  is_mutual_fund: boolean;
  google_symbol?: string;
};

type FinancePayload = FinanceCells & {
  portfolio_holdings: PortfolioHolding[];
  timestamp: string;
  currency?: string;
  as_of?: string;
  categories?: Array<{ name: string; value: number; kind?: string }>;
  notes?: string;
};

function cellNumber(value: ExcelJS.CellValue): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value instanceof Date) return 0;
  if (typeof value === "object") {
    if ("result" in value) return cellNumber(value.result as ExcelJS.CellValue);
    if ("text" in value) return cellNumber(value.text as ExcelJS.CellValue);
    if ("richText" in value) return cellNumber(value.richText?.map((part) => part.text).join("") ?? "");
  }
  const normalized = String(value)
    .replace(/[₹$,]/g, "")
    .replace(/[^\d.-]/g, "")
    .trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cellResultNumber(cell: ExcelJS.Cell): number {
  const raw = cell.value;
  if (raw && typeof raw === "object" && "result" in raw) {
    return cellNumber((raw.result ?? null) as ExcelJS.CellValue);
  }
  return cellNumber(raw);
}

function cellText(cell: ExcelJS.Cell): string {
  const raw = cell.value;
  if (raw == null) return "";
  if (typeof raw === "object") {
    if ("result" in raw) return String(raw.result ?? "").trim();
    if ("text" in raw) return String(raw.text ?? "").trim();
    if ("richText" in raw) return raw.richText?.map((part) => part.text).join("").trim() ?? "";
  }
  return String(raw).trim();
}

async function parseDashboard(buf: ArrayBuffer): Promise<FinanceCells> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const sheet = wb.getWorksheet("DASHBOARD");
  if (!sheet) throw new Error('DASHBOARD sheet not found');

  const liquid_cash = cellResultNumber(sheet.getCell("C23"));
  const invested_assets = cellResultNumber(sheet.getCell("F30"));
  const net_worth = liquid_cash + invested_assets;
  const monthly_income = cellResultNumber(sheet.getCell("F7"));
  const monthly_burn = cellResultNumber(sheet.getCell("I7"));
  const business_net = cellResultNumber(sheet.getCell("C28"));
  const business_income = cellResultNumber(sheet.getCell("R7"));
  const personal_income = cellResultNumber(sheet.getCell("V7"));
  const business_expense = cellResultNumber(sheet.getCell("R22"));
  const personal_expense = cellResultNumber(sheet.getCell("V22"));
  const liabilities_total = 0;

  return {
    net_worth,
    liquid_cash,
    invested_assets,
    monthly_income,
    monthly_burn,
    business_net,
    business_income,
    personal_income,
    business_expense,
    personal_expense,
    liabilities_total,
    runway_months: monthly_burn > 0 ? liquid_cash / monthly_burn : 999,
  };
}

function emptyFinanceCells(): FinanceCells {
  return {
    net_worth: 0,
    liquid_cash: 0,
    invested_assets: 0,
    runway_months: 0,
    monthly_income: 0,
    monthly_burn: 0,
    business_net: 0,
    business_income: 0,
    personal_income: 0,
    business_expense: 0,
    personal_expense: 0,
    liabilities_total: 0,
  };
}

function cellValueSerializable(raw: ExcelJS.CellValue): string | number | null {
  if (raw == null) return null;
  if (typeof raw === "number" || typeof raw === "string") return raw;
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === "object") {
    if ("result" in raw) return cellValueSerializable((raw.result ?? null) as ExcelJS.CellValue);
    if ("text" in raw) return raw.text ?? null;
    if ("richText" in raw) return raw.richText?.map((part) => part.text).join("") ?? null;
    if ("formula" in raw) return raw.result == null ? null : String(raw.result);
  }
  return String(raw);
}

function cellSerializable(cell: ExcelJS.Cell): string | number | null {
  return cellValueSerializable(cell.value);
}

async function workbookDump(buf: ArrayBuffer): Promise<Record<string, Array<Array<string | number | null>>>> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const dump: Record<string, Array<Array<string | number | null>>> = {};

  wb.worksheets.forEach((sheet) => {
    const rows: Array<Array<string | number | null>> = [];
    const rowLimit = Math.min(sheet.rowCount, 160);
    const colLimit = Math.min(sheet.columnCount, 32);
    for (let r = 1; r <= rowLimit; r += 1) {
      const row: Array<string | number | null> = [];
      let hasValue = false;
      for (let c = 1; c <= colLimit; c += 1) {
        const value = cellSerializable(sheet.getRow(r).getCell(c));
        if (value !== null && value !== "") hasValue = true;
        row.push(value);
      }
      if (hasValue) rows.push(row);
    }
    dump[sheet.name] = rows;
  });
  return dump;
}

async function parsePortfolio(buf: ArrayBuffer): Promise<PortfolioHolding[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const sheet = wb.getWorksheet("PORTFOLIO");
  if (!sheet) throw new Error('PORTFOLIO sheet not found');

  const holdings: PortfolioHolding[] = [];
  for (let rowNumber = 3; rowNumber <= 100; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const rowValues = Array.isArray(row.values) ? row.values : Object.values(row.values ?? {});
    const rowText = rowValues
      .map((value) => String(value ?? ""))
      .join(" ")
      .toLowerCase();
    if (rowText.includes("sold holdings")) break;

    const rawTicker = cellText(row.getCell("C"));
    const exchange = cellText(row.getCell("D")).toUpperCase();
    const buyPrice = cellResultNumber(row.getCell("F"));
    const quantity = cellResultNumber(row.getCell("G"));
    if (!rawTicker || !quantity) continue;
    if (rawTicker.toLowerCase().includes("cash balance")) continue;

    const isMutualFund = exchange === "COIN" || rawTicker.toUpperCase().includes("MUTF");
    const ticker = exchange === "NSE" ? `${rawTicker}.NS` : rawTicker;
    const googleSymbol = googleSymbolForHolding(rawTicker, exchange);

    holdings.push({
      raw_ticker: rawTicker,
      exchange,
      ticker,
      buy_price: buyPrice,
      quantity,
      is_mutual_fund: isMutualFund,
      google_symbol: googleSymbol,
    });
  }
  return holdings;
}

function googleSymbolForHolding(rawTicker: string, exchange: string): string | undefined {
  const normalized = rawTicker.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (normalized.includes("jioblackrock") && normalized.includes("flexi")) return "JIOB_FLEX_CAP_123XBSR:MUTF_IN";
  if (normalized.includes("nippon") && normalized.includes("large")) return "NIPP_INDI_LARG_M0P6CR:MUTF_IN";
  if (normalized.includes("hdfc") && normalized.includes("small")) return "HDFC_SMAL_CAP_3AM37B:MUTF_IN";
  if (normalized.includes("motilal") && normalized.includes("mid")) return "MOTI_OSWA_MIDC_1E5B8T2:MUTF_IN";
  if (normalized.includes("kotak") && normalized.includes("gold")) return "KOTA_GOLD_DIR_1XXKHDT:MUTF_IN";
  if (exchange === "MUTF_IN" && /^[A-Z0-9_]+$/.test(rawTicker)) return `${rawTicker}:MUTF_IN`;
  if (rawTicker.toUpperCase().startsWith("MUTF_IN:")) return `${rawTicker.split(":")[1]}:MUTF_IN`;
  if (rawTicker.toUpperCase().endsWith(":MUTF_IN")) return rawTicker.toUpperCase();
  return undefined;
}

function validateFinancePayload(payload: Record<string, unknown>, source: FinanceCells): FinancePayload {
  const categories = Array.isArray(payload.categories)
    ? payload.categories
      .map((category) => {
        const row = category && typeof category === "object" ? category as Record<string, unknown> : {};
        const name = typeof row.name === "string" ? row.name : "";
        if (!name) return null;
        const item: { name: string; value: number; kind?: string } = { name, value: cellNumber(row.value as ExcelJS.CellValue) };
        if (typeof row.kind === "string") item.kind = row.kind;
        return item;
      })
      .filter((category): category is { name: string; value: number; kind?: string } => Boolean(category))
    : undefined;

  return {
    net_worth: cellNumber((payload.net_worth ?? source.net_worth) as ExcelJS.CellValue),
    liquid_cash: cellNumber((payload.liquid_cash ?? payload.liquid ?? source.liquid_cash) as ExcelJS.CellValue),
    invested_assets: cellNumber((payload.invested_assets ?? payload.invested ?? source.invested_assets) as ExcelJS.CellValue),
    runway_months: cellNumber((payload.runway_months ?? source.runway_months) as ExcelJS.CellValue),
    monthly_income: cellNumber((payload.monthly_income ?? source.monthly_income) as ExcelJS.CellValue),
    monthly_burn: cellNumber((payload.monthly_burn ?? payload.burn_monthly ?? source.monthly_burn) as ExcelJS.CellValue),
    business_net: cellNumber((payload.business_net ?? source.business_net) as ExcelJS.CellValue),
    business_income: source.business_income,
    personal_income: source.personal_income,
    business_expense: source.business_expense,
    personal_expense: source.personal_expense,
    liabilities_total: cellNumber((payload.liabilities_total ?? payload.liabilities ?? source.liabilities_total) as ExcelJS.CellValue),
    portfolio_holdings: [],
    timestamp: "",
    currency: typeof payload.currency === "string" ? payload.currency : "INR",
    as_of: typeof payload.as_of === "string" ? payload.as_of : undefined,
    categories,
    notes: typeof payload.notes === "string" ? payload.notes : undefined,
  };
}

function stripGeminiJsonFences(raw: string): string {
  return raw
    .trim()
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
}

async function standardizeFinance(source: FinanceCells): Promise<FinancePayload> {
  if (!hasGemini()) throw new Error("GEMINI_API_KEY not set");
  const raw = await geminiGenerate({
    system:
      "You are an OS formatting engine. Take this verified asset data and return a strictly clean JSON payload " +
      "mirroring this interface structural mapping exactly: " +
      `{ "net_worth": number, "liquid_cash": number, "invested_assets": number, "runway_months": number, ` +
      `"monthly_income": number, "monthly_burn": number, "business_net": number, ` +
      `"business_income": number, "personal_income": number, "business_expense": number, "personal_expense": number } ` +
      "Do not introduce any reasoning markdown blocks or wrapper text arrays.",
    user: JSON.stringify(source),
    json: true,
    maxTokens: 700,
  });
  console.log("[finance.snapshot] Gemini raw response", raw);
  const cleaned = stripGeminiJsonFences(raw);
  console.log("[finance.snapshot] Gemini cleaned response", cleaned);
  try { return validateFinancePayload(JSON.parse(cleaned), source); }
  catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try { return validateFinancePayload(JSON.parse(m[0]), source); }
      catch {}
    }
    console.log("[finance.snapshot] Gemini returned unparseable JSON; using verified Excel extraction fallback");
    return validateFinancePayload({}, source);
  }
}

async function extractFinanceFromWorkbook(buf: ArrayBuffer, fallback: FinanceCells): Promise<FinancePayload> {
  if (!hasGemini()) return validateFinancePayload({}, fallback);
  const dump = await workbookDump(buf);
  const raw = await geminiGenerate({
    system:
      "You extract a personal finance snapshot from an XLSX workbook dump. Return JSON only. " +
      "Use all tabs, but avoid double-counting summary rows plus detail rows. Use the most recent row of time-series tabs. " +
      "If a field is ambiguous, use the best conservative value and explain briefly in notes. " +
      "Schema: { net_worth, currency, as_of, liquid_cash, invested_assets, liabilities_total, runway_months, " +
      "monthly_income, monthly_burn, business_net, categories:[{name,value,kind}], notes }.",
    user: JSON.stringify(dump).slice(0, 120_000),
    json: true,
    maxTokens: 1200,
  });
  const cleaned = stripGeminiJsonFences(raw);
  try { return validateFinancePayload(JSON.parse(cleaned), fallback); }
  catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return validateFinancePayload(JSON.parse(match[0]), fallback); } catch {}
    }
    return validateFinancePayload({}, fallback);
  }
}

async function run() {
  const buf = await downloadWorkbook();
  console.log("[finance.snapshot] workbook downloaded", { byteLength: buf.byteLength });
  const fallback = await parseDashboard(buf).catch((error) => {
    console.warn("[finance.snapshot] fixed DASHBOARD parse unavailable; using AI/general extraction only", error);
    return emptyFinanceCells();
  });
  console.log("[finance.snapshot] exceljs fallback extracted cells", fallback);
  const extracted = await extractFinanceFromWorkbook(buf, fallback).catch((error) => {
    console.warn("[finance.snapshot] general workbook extraction failed; using fallback", error);
    return validateFinancePayload({}, fallback);
  });
  const portfolio_holdings = await parsePortfolio(buf).catch((error) => {
    console.warn("[finance.snapshot] portfolio parse unavailable", error);
    return [] as PortfolioHolding[];
  });
  console.log("[finance.snapshot] exceljs PORTFOLIO extracted holdings", {
    count: portfolio_holdings.length,
    tickers: portfolio_holdings.map((holding) => holding.ticker),
  });
  const finance = { ...extracted, portfolio_holdings, timestamp: new Date().toISOString() };
  console.log("[finance.snapshot] validated finance payload", finance);

  const sb = supabaseService();
  const today = localDateKey();
  console.log("[finance.snapshot] writing Supabase daily_logs row", { log_date: today });
  const { data: existing } = await sb
    .from("daily_logs").select("id, notes")
    .eq("user_id", OWNER_USER_ID).eq("log_date", today)
    .maybeSingle();
  const nextNotes = { ...((existing?.notes as Record<string, unknown>) || {}), finance };
  if (existing) {
    await sb.from("daily_logs").update({ notes: nextNotes }).eq("id", existing.id);
  } else {
    await sb.from("daily_logs").insert({ user_id: OWNER_USER_ID, log_date: today, notes: nextNotes });
  }
  await sb.from("audit_log").insert({
    user_id: OWNER_USER_ID, action: "finance_snapshot", resource_type: "daily_logs",
    metadata: { date: today, keys: Object.keys(finance) },
  });
  return { ok: true, date: today, finance };
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try { return NextResponse.json(await run()); }
  catch (e) { return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 }); }
}

export async function POST(req: Request) {
  return GET(req);
}
