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
  // `inheritFrom` marks an alternative with the exercise it stands in for, so
  // its target can start from that exercise's sets x reps.
  const add = (dayIndex: number, exerciseId: string, inheritFrom?: string) => {
    if (!exerciseId) return;
    const key = `${dayIndex}:${exerciseId}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push(inheritFrom ? { dayIndex, exerciseId, inheritFrom } : { dayIndex, exerciseId });
  };
  for (let di = 0; di < program.days.length; di += 1) {
    const day = program.days[di];
    const map = alts[di] ?? {};
    // All primaries of the day first: an exercise that is both a primary and
    // someone's alternative keeps its own target.
    for (const block of day.blocks) {
      if (block.type === "single") {
        add(di, block.exId);
      } else {
        add(di, block.a);
        add(di, block.b);
        if (block.c) add(di, block.c);
      }
    }
    for (const block of day.blocks) {
      const primaries = block.type === "single" ? [block.exId] : [block.a, block.b, ...(block.c ? [block.c] : [])];
      for (const primary of primaries) {
        for (const alt of map[primary] ?? []) add(di, alt, primary);
      }
    }
  }
  return pairs;
}
