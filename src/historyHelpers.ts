// src/historyHelpers.ts — pure helpers for the History screen.

import { isoDateOnly } from "./storage";

export type TimePeriod = "week" | "month" | "3mo" | "all";

/** Inclusive cutoff date (YYYY-MM-DD) for a period, or null for "all". */
export function periodCutoffIso(period: TimePeriod, now: Date = new Date()): string | null {
  if (period === "all") return null;
  const d = new Date(now);
  if (period === "week") d.setDate(d.getDate() - 7);
  else if (period === "month") d.setDate(d.getDate() - 30);
  else if (period === "3mo") d.setDate(d.getDate() - 90);
  return isoDateOnly(d);
}

/** Whole minutes between two ISO timestamps, or null if invalid / non-positive. */
export function durationMinutes(startIso: string | null, endIso: string | null): number | null {
  if (!startIso || !endIso) return null;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.round((end - start) / 60000);
}
