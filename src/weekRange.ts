// src/weekRange.ts — ISO-week (Mon-start) date helpers (pure, testable).

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** YYYY-MM-DD of the Monday of the week containing `now` (Sunday counts as the prior week). */
export function mondayOf(now: Date = new Date()): string {
  const d = new Date(now);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return ymd(d);
}

/** YYYY-MM-DD of the Monday one week before `mondayOf(now)`. */
export function previousMondayOf(now: Date = new Date()): string {
  const d = new Date(now);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) - 7;
  d.setDate(diff);
  return ymd(d);
}
