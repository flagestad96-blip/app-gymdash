// src/warmupRamp.ts — Warm-up ramp suggestion for a working weight.
//
// Classic strength ramp: empty bar × 10 (barbell-style equipment), then
// 40% × 5, 60% × 3, 80% × 1 of the working weight, each rounded to the
// exercise's increment. Steps that collapse into each other (light working
// weights) or land at/below the bar are dropped, so light lifts get a short
// ramp instead of nonsense like 20 → 18 → 25.

export type WarmupStep = {
  weightKg: number;
  reps: number;
  /** True for the empty-bar step (renders as "bar" rather than a percentage). */
  isBar: boolean;
};

/**
 * Bar weight used for the empty-bar step, by equipment. Smith machines vary
 * too much between gyms (0–10+ kg counterbalanced) to assume anything, so
 * they ramp on percentages only, like machines and dumbbells.
 */
export function barWeightForEquipment(equipment: string | undefined | null): number | null {
  switch (equipment) {
    case "barbell":
      return 20;
    case "trapbar":
      return 25;
    default:
      return null;
  }
}

const PCT_STEPS: { pct: number; reps: number }[] = [
  { pct: 0.4, reps: 5 },
  { pct: 0.6, reps: 3 },
  { pct: 0.8, reps: 1 },
];

export function warmupRamp(
  workingKg: number,
  opts: { incrementKg: number; barWeightKg?: number | null },
): WarmupStep[] {
  if (!Number.isFinite(workingKg) || workingKg <= 0) return [];
  const inc = Number.isFinite(opts.incrementKg) && opts.incrementKg > 0 ? opts.incrementKg : 2.5;
  const bar = opts.barWeightKg != null && opts.barWeightKg > 0 ? opts.barWeightKg : null;

  // With a bar, no step can go below the bar itself — and a working weight at
  // or under the empty bar leaves nothing to ramp with.
  if (bar != null && bar >= workingKg) return [];

  const steps: WarmupStep[] = [];
  if (bar != null) {
    steps.push({ weightKg: bar, reps: 10, isBar: true });
  }
  for (const { pct, reps } of PCT_STEPS) {
    const rounded = Math.round((workingKg * pct) / inc) * inc;
    const weightKg = Math.round(rounded * 100) / 100; // kill float noise from inc math
    if (weightKg <= 0 || weightKg >= workingKg) continue;
    const prev = steps[steps.length - 1];
    if (prev && weightKg <= prev.weightKg) continue;
    steps.push({ weightKg, reps, isBar: false });
  }
  return steps;
}
