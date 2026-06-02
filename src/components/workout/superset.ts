// src/components/workout/superset.ts — shared superset slot constants + helpers.

import type { SetRow } from "./SetEntryRow";

export type SupersetSlotKey = "a" | "b" | "c";
export type SupersetLogPhase = "transition" | "round" | "final";

/** Fixed per-slot identity colors (A/B/C), independent of the accent palette. */
export const SLOT_COLORS: Record<SupersetSlotKey, string> = {
  a: "#c084fc", // aurora violet
  b: "#f59e0b", // amber
  c: "#ec4899", // pink
};

export const SLOT_LABELS: Record<SupersetSlotKey, string> = { a: "A", b: "B", c: "C" };

/** Count of working (non-warmup) sets. */
export function workingCount(sets: SetRow[]): number {
  return sets.filter((s) => !s.is_warmup).length;
}
