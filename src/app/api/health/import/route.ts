import { NextResponse } from "next/server";
import { OWNER_USER_ID } from "@/lib/env";
import { localDateKey } from "@/lib/date";
import { supabaseService } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HealthMetric = {
  type: string;
  value: number | string | null;
  unit?: string | null;
  start?: string | null;
  end?: string | null;
  source?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function metricFrom(value: unknown): HealthMetric | null {
  const row = asRecord(value);
  const type =
    stringValue(row.type) ||
    stringValue(row.name) ||
    stringValue(row.identifier) ||
    stringValue(row.quantityType) ||
    stringValue(row.category);
  if (!type) return null;

  return {
    type,
    value: numericValue(row.value) ?? stringValue(row.value),
    unit: stringValue(row.unit),
    start: stringValue(row.start) || stringValue(row.startDate) || stringValue(row.date),
    end: stringValue(row.end) || stringValue(row.endDate),
    source: stringValue(row.sourceName) || stringValue(row.source),
  };
}

function extractMetrics(body: Record<string, unknown>): HealthMetric[] {
  const candidates = [
    ...asArray(body.metrics),
    ...asArray(body.data),
    ...asArray(body.samples),
    ...asArray(body.records),
    ...asArray(body.workouts),
  ];

  const directMetric = metricFrom(body);
  const metrics = candidates.map(metricFrom).filter((metric): metric is HealthMetric => Boolean(metric));
  if (directMetric && metrics.length === 0) metrics.push(directMetric);

  return metrics.slice(0, 1000);
}

function inferDate(body: Record<string, unknown>, metrics: HealthMetric[]): string {
  const explicit = stringValue(body.date) || stringValue(body.log_date);
  if (explicit) return explicit.slice(0, 10);
  const firstDate = metrics.find((metric) => metric.start)?.start;
  return firstDate ? firstDate.slice(0, 10) : localDateKey();
}

function summarize(metrics: HealthMetric[]) {
  const totals: Record<string, number> = {};
  for (const metric of metrics) {
    const key = metric.type.toLowerCase().replace(/^hk(quantity|category)typeidentifier/i, "");
    if (typeof metric.value === "number") totals[key] = (totals[key] || 0) + metric.value;
  }
  return totals;
}

export async function POST(req: Request) {
  const body = asRecord(await req.json().catch(() => null));
  if (!Object.keys(body).length) return NextResponse.json({ error: "bad-request" }, { status: 400 });

  const metrics = extractMetrics(body);
  if (!metrics.length) return NextResponse.json({ error: "no-health-metrics" }, { status: 400 });

  const date = inferDate(body, metrics);
  const sb = supabaseService();
  const { data: existing, error: readError } = await sb
    .from("daily_logs")
    .select("id, notes")
    .eq("user_id", OWNER_USER_ID)
    .eq("log_date", date)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });

  const notes = (existing?.notes as Record<string, unknown>) ?? {};
  const appleHealth = {
    imported_at: new Date().toISOString(),
    source: "apple-health-shortcut",
    summary: summarize(metrics),
    metrics,
  };
  const nextNotes = { ...notes, health: { ...(asRecord(notes.health)), apple: appleHealth } };

  const write = existing
    ? await sb.from("daily_logs").update({ notes: nextNotes }).eq("id", existing.id)
    : await sb.from("daily_logs").insert({ user_id: OWNER_USER_ID, log_date: date, notes: nextNotes });

  if (write.error) return NextResponse.json({ error: write.error.message }, { status: 500 });

  await sb.from("audit_log").insert({
    user_id: OWNER_USER_ID,
    action: "health_import",
    resource_type: "daily_logs",
    metadata: { date, count: metrics.length, source: "apple-health-shortcut" },
  });

  return NextResponse.json({ ok: true, date, count: metrics.length, summary: appleHealth.summary });
}
