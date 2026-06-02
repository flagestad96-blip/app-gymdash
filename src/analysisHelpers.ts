// src/analysisHelpers.ts — pure date/format helpers used by the Analysis screen.

import { isoDateOnly } from "./storage";

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

/** Parse a "YYYY-MM-DD" string as a local date (no UTC shift). */
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "YYYY-MM-DD" of the Monday of the week containing `d`. */
export function weekStartKey(d: Date): string {
  const day = d.getDay();
  const diff = (day + 6) % 7;
  return isoDateOnly(addDays(d, -diff));
}

/** "YYYY-MM" key for `d`. */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** Format seconds as "m:ss". */
export function fmtRest(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
