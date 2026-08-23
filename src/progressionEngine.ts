// src/progressionEngine.ts — the "coach brain" behind per-exercise progression
// advice. Pure functions only (no DB, no React) so every rule is unit-testable.
//
// Two things make this smarter than the old one-set heuristic:
//   1. Detraining awareness — a long gap since the exercise was last trained
//      produces a comeback recommendation with a concrete, reduced start
//      weight instead of pretending the last session was yesterday.
//   2. Whole-session + trend analysis — the verdict looks at ALL working sets
//      (reps vs the target range), average RPE, and up to 4 recent sessions
//      (plateau detection), and always carries the facts needed to explain
//      itself to the user.

export type AdviceSet = {
  weight: number;
  reps: number;
  rpe?: number | null;
  isWarmup?: boolean;
};

/** One prior session for the exercise. `date` is yyyy-mm-dd. */
export type AdviceSession = {
  date: string;
  sets: AdviceSet[];
};

export type AdviceTarget = {
  repMin: number;
  repMax: number;
  targetSets: number;
  incrementKg: number;
};

export type AdviceKind =
  | "comebackLong" // 3+ weeks away — start lighter (suggestedWeightKg set)
  | "comebackShort" // 2–3 weeks away — keep weight, don't increase yet
  | "increase" // all sets at repMax with manageable RPE — go up
  | "holdHighRpe" // reps are there but RPE says it costs too much
  | "buildReps" // inside the rep range — build toward repMax first
  | "reduce" // repeatedly under repMin — step the weight down
  | "plateauPushReps" // stuck at same weight/reps with low RPE — push reps
  | "plateauDeload"; // stuck at same weight with high RPE — light deload

export type ProgressionAdvice = {
  kind: AdviceKind;
  /** Days since the exercise was last trained. */
  gapDays: number;
  /** Concrete next working weight, when the advice implies one (kg). */
  suggestedWeightKg?: number;
  /** Percent reduction applied for comebackLong / plateauDeload (e.g. 10). */
  reductionPct?: number;
  /** Facts backing the verdict — used to build the human explanation. */
  facts: {
    targetSets: number;
    repMin: number;
    repMax: number;
    topWeightKg: number;
    bestReps: number;
    avgRpe: number | null;
    /** Sessions in a row at the same top weight (plateau kinds only). */
    sessionsAtSameWeight?: number;
  };
};

// ── Gap thresholds (days) ────────────────────────────────────────────────────
// Strength is largely retained for ~2–3 weeks; beyond that, easing back in
// beats grinding at old numbers. Reductions are deliberately conservative —
// "muscle memory" brings it back within a couple of weeks.

export const GAP_SHORT_DAYS = 14; // hold weight, no increase
export const GAP_LONG_DAYS = 21; // −10%
export const GAP_VERY_LONG_DAYS = 42; // −15%

export function daysBetween(fromIsoDate: string, toIsoDate: string): number {
  const from = Date.parse(`${fromIsoDate.slice(0, 10)}T00:00:00Z`);
  const to = Date.parse(`${toIsoDate.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

/** Round to the exercise's increment (e.g. 47.3 @ 2.5 → 47.5). */
export function roundToIncrement(kg: number, incrementKg: number): number {
  const step = incrementKg > 0 ? incrementKg : 2.5;
  return Math.round(Math.round(kg / step) * step * 100) / 100;
}

function workingSets(session: AdviceSession): AdviceSet[] {
  return session.sets.filter((s) => !s.isWarmup && s.weight > 0 && s.reps > 0);
}

function avgRpeOf(sets: AdviceSet[]): number | null {
  const rpes = sets
    .map((s) => s.rpe)
    .filter((r): r is number => typeof r === "number" && r > 0);
  if (rpes.length === 0) return null;
  return Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10;
}

function comebackWeight(topWeightKg: number, pct: number, incrementKg: number): number {
  const step = incrementKg > 0 ? incrementKg : 2.5;
  const reduced = roundToIncrement(topWeightKg * (1 - pct / 100), step);
  // Always at least one increment below the old top weight, but never ≤ 0.
  return Math.max(step, Math.min(reduced, topWeightKg - step));
}

/**
 * Assess progression for one exercise from its recent history.
 *
 * @param today    yyyy-mm-dd
 * @param target   current rep range / set target / increment
 * @param sessions recent sessions, NEWEST FIRST (current workout excluded)
 * @returns advice, or null when there is no usable history
 */
export function assessProgression(args: {
  today: string;
  target: AdviceTarget;
  sessions: AdviceSession[];
}): ProgressionAdvice | null {
  const { today, target } = args;
  const sessions = (args.sessions ?? []).filter((s) => workingSets(s).length > 0);
  if (sessions.length === 0) return null;

  const last = sessions[0];
  const lastWorking = workingSets(last);
  const topWeightKg = Math.max(...lastWorking.map((s) => s.weight));
  const bestReps = Math.max(...lastWorking.map((s) => s.reps));
  const avgRpe = avgRpeOf(lastWorking);
  const gapDays = daysBetween(last.date, today);

  const baseFacts = {
    targetSets: target.targetSets,
    repMin: target.repMin,
    repMax: target.repMax,
    topWeightKg,
    bestReps,
    avgRpe,
  };

  // ── 1. Detraining / comeback ──
  if (gapDays >= GAP_LONG_DAYS) {
    const pct = gapDays >= GAP_VERY_LONG_DAYS ? 15 : 10;
    return {
      kind: "comebackLong",
      gapDays,
      reductionPct: pct,
      suggestedWeightKg: comebackWeight(topWeightKg, pct, target.incrementKg),
      facts: baseFacts,
    };
  }
  if (gapDays >= GAP_SHORT_DAYS) {
    return { kind: "comebackShort", gapDays, facts: baseFacts };
  }

  // ── 2. Last-session verdict ──
  const setsAtMax = lastWorking.filter((s) => s.reps >= target.repMax).length;
  const setsUnderMin = lastWorking.filter((s) => s.reps < target.repMin).length;
  const allAtMax =
    target.targetSets > 0 &&
    lastWorking.length >= target.targetSets &&
    setsAtMax >= target.targetSets;

  if (allAtMax) {
    if (avgRpe != null && avgRpe >= 9) {
      return { kind: "holdHighRpe", gapDays, facts: baseFacts };
    }
    return {
      kind: "increase",
      gapDays,
      suggestedWeightKg: topWeightKg + (target.incrementKg > 0 ? target.incrementKg : 2.5),
      facts: baseFacts,
    };
  }

  if (setsUnderMin >= 2) {
    const step = target.incrementKg > 0 ? target.incrementKg : 2.5;
    return {
      kind: "reduce",
      gapDays,
      suggestedWeightKg: Math.max(step, topWeightKg - step),
      facts: baseFacts,
    };
  }

  // ── 3. Plateau refinement (needs RPE data + 3 sessions at same top weight) ──
  if (sessions.length >= 3) {
    const recent = sessions.slice(0, 3);
    const tops = recent.map((s) => Math.max(...workingSets(s).map((x) => x.weight)));
    const sameWeight = tops.every((w) => Math.abs(w - topWeightKg) < 0.01);
    if (sameWeight) {
      const bests = recent.map((s) => Math.max(...workingSets(s).map((x) => x.reps)));
      const noRepProgress = bests[0] <= bests[bests.length - 1];
      if (noRepProgress && avgRpe != null) {
        const facts = { ...baseFacts, sessionsAtSameWeight: recent.length };
        if (avgRpe <= 8) {
          return { kind: "plateauPushReps", gapDays, facts };
        }
        if (avgRpe >= 9) {
          const pct = 10;
          return {
            kind: "plateauDeload",
            gapDays,
            reductionPct: pct,
            suggestedWeightKg: comebackWeight(topWeightKg, pct, target.incrementKg),
            facts,
          };
        }
      }
    }
  }

  return { kind: "buildReps", gapDays, facts: baseFacts };
}
