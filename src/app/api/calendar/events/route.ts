import { NextResponse } from "next/server";
import ICAL from "ical.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface CalEvent {
  uid: string;
  summary: string;
  start: string;
  end?: string;
  allDay?: boolean;
}

export async function GET() {
  const url = process.env.GOOGLE_CALENDAR_ICAL_URL;
  if (!url) return NextResponse.json({ error: "GOOGLE_CALENDAR_ICAL_URL not set" }, { status: 400 });

  let text: string;
  try {
    const r = await fetch(url, { next: { revalidate: 300 } });
    if (!r.ok) throw new Error(`fetch ical failed: ${r.status}`);
    text = await r.text();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  let events: CalEvent[] = [];
  try {
    const jcal = ICAL.parse(text);
    const comp = new ICAL.Component(jcal);
    const vevents = comp.getAllSubcomponents("vevent");

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 14);

    for (const ve of vevents) {
      const e = new ICAL.Event(ve);
      const isRecurring = e.isRecurring();
      if (isRecurring) {
        const it = e.iterator();
        let next;
        // safety cap
        for (let i = 0; i < 200 && (next = it.next()); i++) {
          const d = next.toJSDate();
          if (d < start) continue;
          if (d > end) break;
          const occ = e.getOccurrenceDetails(next);
          events.push(toEvent(e, occ.startDate.toJSDate(), occ.endDate?.toJSDate(), occ.startDate.isDate));
        }
      } else {
        const d = e.startDate?.toJSDate();
        if (!d) continue;
        if (d < start || d > end) continue;
        events.push(toEvent(e, d, e.endDate?.toJSDate(), e.startDate.isDate));
      }
    }
    events.sort((a, b) => a.start.localeCompare(b.start));
  } catch (e) {
    return NextResponse.json({ error: `parse failed: ${(e as Error).message}` }, { status: 500 });
  }
  return NextResponse.json({ events });
}

function toEvent(e: ICAL.Event, start: Date, end: Date | undefined, allDay: boolean): CalEvent {
  return {
    uid: e.uid,
    summary: e.summary || "(no title)",
    start: start.toISOString(),
    end: end?.toISOString(),
    allDay,
  };
}
