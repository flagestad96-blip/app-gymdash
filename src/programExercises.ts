// src/programExercises.ts — derive the (day, exercise) pairs of a program,
// including alternatives. Pure + testable. Type-only imports keep it free of
// runtime coupling to the stores.

import type { Program, AlternativesMap } from "./programStore";
import type { DayExerciseRef } from "./progressionStore";

/**
 * Every distinct (dayIndex, exerciseId) pair in a program — primary exercises,
 * superset slots (a/b/c), and all of their alternatives — de-duplicated.
 */
export function collectDayExercisePairs(program: Program, alts: AlternativesMap): DayExerciseRef[] {
  const seen = new Set<string>();
  const pairs: DayExerciseRef[] = [];
  const add = (dayIndex: number, exerciseId: string) => {
    if (!exerciseId) return;
    const key = `${dayIndex}:${exerciseId}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push({ dayIndex, exerciseId });
  };
  for (let di = 0; di < program.days.length; di += 1) {
    const day = program.days[di];
    const map = alts[di] ?? {};
    for (const block of day.blocks) {
      if (block.type === "single") {
        add(di, block.exId);
        for (const alt of map[block.exId] ?? []) add(di, alt);
      } else {
        add(di, block.a);
        add(di, block.b);
        if (block.c) add(di, block.c);
        for (const alt of map[block.a] ?? []) add(di, alt);
        for (const alt of map[block.b] ?? []) add(di, alt);
        if (block.c) for (const alt of map[block.c] ?? []) add(di, alt);
      }
    }
  }
  return pairs;
}
