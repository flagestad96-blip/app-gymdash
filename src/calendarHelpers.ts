// src/calendarHelpers.ts — pure calendar helpers (workout classification + dates).

import { tagsFor } from "./exerciseLibrary";

export type WorkoutType = "push" | "pull" | "legs" | "other";

/**
 * Classify a workout as push / pull / legs / other from its exercises' muscle
 * tags. Requires >60% of tagged hits in one category, else "other".
 */
export function classifyWorkout(exerciseIds: string[]): WorkoutType {
  let push = 0,
    pull = 0,
    legs = 0;
  for (const id of exerciseIds) {
    const tags = tagsFor(id);
    for (const tag of tags) {
      if (tag === "chest" || tag === "shoulders" || tag === "triceps") push++;
      else if (tag === "back" || tag === "biceps" || tag === "forearms") pull++;
      else if (tag === "quads" || tag === "hamstrings" || tag === "glutes" || tag === "calves") legs++;
    }
  }
  const total = push + pull + legs;
  if (total === 0) return "other";
  if (push / total > 0.6) return "push";
  if (pull / total > 0.6) return "pull";
  if (legs / total > 0.6) return "legs";
  return "other";
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function startOfMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex, 1);
}

export function formatTime(isoStr: string | null | undefined): string {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}
