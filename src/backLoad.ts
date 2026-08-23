// src/backLoad.ts — weekly lower-back load score.
//
// Sums training volume weighted by each exercise's backImpact level, so users
// managing back issues can see how much spinal loading a week actually held —
// two weeks with identical total volume can stress the lower back very
// differently (deadlift-heavy vs machine/leg-press-heavy).
//
// Weights are deliberately coarse (this is a relative gauge, not biomechanics):
//   red     1.0   heavy axial/shear loading (deadlifts, barbell rows, squats)
//   yellow  0.5   moderate — loaded but supported or partial
//   green   0.15  back-friendly — supported/machine variants
//   (none)  0     exercises where lower-back load isn't a relevant axis

import { backImpactFor } from "./exerciseLibrary";
import type { BackImpact } from "./exerciseLibrary";

export const BACK_IMPACT_WEIGHTS: Record<BackImpact, number> = {
  red: 1,
  yellow: 0.5,
  green: 0.15,
};

export type VolumeByExercise = {
  exerciseId: string | null;
  /** Working-set volume in kg (already per-side-corrected by the caller). */
  volumeKg: number;
};

export type BackLoadResult = {
  /** Weighted volume in kg-equivalents. */
  scoreKg: number;
  /** Raw (unweighted) volume that carried any back impact level. */
  flaggedVolumeKg: number;
};

export function computeBackLoad(
  rows: VolumeByExercise[],
  impactFor: (exerciseId: string) => BackImpact | null | undefined = backImpactFor,
): BackLoadResult {
  let scoreKg = 0;
  let flaggedVolumeKg = 0;
  for (const row of rows) {
    if (!row.exerciseId || !(row.volumeKg > 0)) continue;
    const impact = impactFor(row.exerciseId);
    if (!impact) continue;
    scoreKg += row.volumeKg * BACK_IMPACT_WEIGHTS[impact];
    flaggedVolumeKg += row.volumeKg;
  }
  return { scoreKg: Math.round(scoreKg), flaggedVolumeKg: Math.round(flaggedVolumeKg) };
}

/** Week-over-week direction with a ±5% dead zone (score is an estimate). */
export function backLoadTrend(
  thisWeekKg: number,
  prevWeekKg: number,
): { pct: number; dir: "up" | "down" | "flat" } | null {
  if (!(prevWeekKg > 0)) return null;
  const pct = Math.round(((thisWeekKg - prevWeekKg) / prevWeekKg) * 100);
  const dir = pct > 5 ? "up" : pct < -5 ? "down" : "flat";
  return { pct: Math.abs(pct), dir };
}
