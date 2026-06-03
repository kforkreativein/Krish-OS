"use client";

import { useEffect, useState } from "react";
import { localDateKey } from "@/lib/date";

/** Tracks local calendar date and fires when the day rolls over (midnight). */
export function useDailyDate(onDateChange?: (date: string) => void): string | null {
  const [date, setDate] = useState<string | null>(null);

  useEffect(() => {
    const apply = () => {
      const next = localDateKey();
      setDate((current) => {
        if (current && current !== next) onDateChange?.(next);
        return next;
      });
    };
    apply();
    const interval = window.setInterval(apply, 30_000);
    const now = new Date();
    const midnight = new Date(now);
    midnight.setDate(now.getDate() + 1);
    midnight.setHours(0, 0, 1, 0);
    const timeout = window.setTimeout(apply, midnight.getTime() - now.getTime());
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [onDateChange]);

  return date;
}
