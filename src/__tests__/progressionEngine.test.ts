import {
  assessProgression,
  daysBetween,
  roundToIncrement,
  GAP_SHORT_DAYS,
  GAP_LONG_DAYS,
  GAP_VERY_LONG_DAYS,
  type AdviceSession,
  type AdviceTarget,
} from "../progressionEngine";

const TARGET: AdviceTarget = { repMin: 6, repMax: 10, targetSets: 3, incrementKg: 2.5 };
const TODAY = "2026-08-23";

function session(date: string, sets: { weight: number; reps: number; rpe?: number | null; isWarmup?: boolean }[]): AdviceSession {
  return { date, sets };
}

function daysAgo(n: number): string {
  const d = new Date(Date.parse(`${TODAY}T00:00:00Z`) - n * 86_400_000);
  return d.toISOString().slice(0, 10);
}

describe("daysBetween / roundToIncrement", () => {
  it("computes whole days between iso dates", () => {
    expect(daysBetween("2026-08-01", "2026-08-23")).toBe(22);
    expect(daysBetween("2026-08-23", "2026-08-23")).toBe(0);
    expect(daysBetween("2026-08-25", "2026-08-23")).toBe(0); // never negative
  });

  it("rounds to the exercise increment", () => {
    expect(roundToIncrement(47.3, 2.5)).toBe(47.5);
    expect(roundToIncrement(59.4, 2.5)).toBe(60);
    expect(roundToIncrement(59.4, 5)).toBe(60);
    expect(roundToIncrement(50, 0)).toBe(50); // 0 falls back to 2.5 step
  });
});

describe("assessProgression — comeback (detraining)", () => {
  it("returns null without usable history", () => {
    expect(assessProgression({ today: TODAY, target: TARGET, sessions: [] })).toBeNull();
    expect(
      assessProgression({
        today: TODAY,
        target: TARGET,
        sessions: [session(daysAgo(3), [{ weight: 50, reps: 8, isWarmup: true }])],
      })
    ).toBeNull();
  });

  it("suggests ~10% lighter after 3+ weeks away", () => {
    const advice = assessProgression({
      today: TODAY,
      target: TARGET,
      sessions: [session(daysAgo(30), [{ weight: 80, reps: 8 }, { weight: 80, reps: 8 }])],
    });
    expect(advice?.kind).toBe("comebackLong");
    expect(advice?.gapDays).toBe(30);
    expect(advice?.reductionPct).toBe(10);
    // 80 * 0.9 = 72 → rounds to 72.5 with 2.5 step
    expect(advice?.suggestedWeightKg).toBe(72.5);
  });

  it("suggests ~15% lighter after 6+ weeks away", () => {
    const advice = assessProgression({
      today: TODAY,
      target: TARGET,
      sessions: [session(daysAgo(50), [{ weight: 100, reps: 8 }])],
    });
    expect(advice?.kind).toBe("comebackLong");
    expect(advice?.reductionPct).toBe(15);
    expect(advice?.suggestedWeightKg).toBe(85);
  });

  it("comeback weight is always at least one increment below the old top", () => {
    const advice = assessProgression({
      today: TODAY,
      target: TARGET,
      sessions: [session(daysAgo(25), [{ weight: 10, reps: 8 }])],
    });
    // 10 * 0.9 = 9 → rounds to 10 with 2.5 step; clamp forces 7.5
    expect(advice?.suggestedWeightKg).toBe(7.5);
  });

  it("holds weight (no reduction) after 2–3 weeks away", () => {
    const advice = assessProgression({
      today: TODAY,
      target: TARGET,
      sessions: [session(daysAgo(16), [{ weight: 80, reps: 10, rpe: 8 }, { weight: 80, reps: 10, rpe: 8 }, { weight: 80, reps: 10, rpe: 8 }])],
    });
    // Even though all sets hit repMax, the gap wins: no increase suggestion.
    expect(advice?.kind).toBe("comebackShort");
    expect(advice?.suggestedWeightKg).toBeUndefined();
  });

  it("thresholds line up with the exported constants", () => {
    const at = (days: number) =>
      assessProgression({
        today: TODAY,
        target: TARGET,
        sessions: [session(daysAgo(days), [{ weight: 80, reps: 7 }])],
      })?.kind;
    expect(at(GAP_SHORT_DAYS - 1)).toBe("buildReps");
    expect(at(GAP_SHORT_DAYS)).toBe("comebackShort");
    expect(at(GAP_LONG_DAYS)).toBe("comebackLong");
    expect(at(GAP_VERY_LONG_DAYS)).toBe("comebackLong");
  });
});

describe("assessProgression — last-session verdict", () => {
  it("recommends an increase when all sets hit repMax at manageable RPE", () => {
    const advice = assessProgression({
      today: TODAY,
      target: TARGET,
      sessions: [
        session(daysAgo(3), [
          { weight: 60, reps: 10, rpe: 7 },
          { weight: 60, reps: 10, rpe: 8 },
          { weight: 60, reps: 11, rpe: 8 },
        ]),
      ],
    });
    expect(advice?.kind).toBe("increase");
    expect(advice?.suggestedWeightKg).toBe(62.5);
    expect(advice?.facts.avgRpe).toBe(7.7);
  });

  it("holds when reps are there but avg RPE is 9+", () => {
    const advice = assessProgression({
      today: TODAY,
      target: TARGET,
      sessions: [
        session(daysAgo(3), [
          { weight: 60, reps: 10, rpe: 9 },
          { weight: 60, reps: 10, rpe: 9.5 },
          { weight: 60, reps: 10, rpe: 9 },
        ]),
      ],
    });
    expect(advice?.kind).toBe("holdHighRpe");
  });

  it("recommends an increase without RPE data when reps are there", () => {
    const advice = assessProgression({
      today: TODAY,
      target: TARGET,
      sessions: [session(daysAgo(3), [
        { weight: 60, reps: 10 },
        { weight: 60, reps: 10 },
        { weight: 60, reps: 10 },
      ])],
    });
    expect(advice?.kind).toBe("increase");
    expect(advice?.facts.avgRpe).toBeNull();
  });

  it("recommends reducing when 2+ sets fall under repMin", () => {
    const advice = assessProgression({
      today: TODAY,
      target: TARGET,
      sessions: [session(daysAgo(3), [
        { weight: 60, reps: 5 },
        { weight: 60, reps: 4 },
        { weight: 60, reps: 6 },
      ])],
    });
    expect(advice?.kind).toBe("reduce");
    expect(advice?.suggestedWeightKg).toBe(57.5);
  });

  it("says build reps when inside the range below repMax", () => {
    const advice = assessProgression({
      today: TODAY,
      target: TARGET,
      sessions: [session(daysAgo(3), [
        { weight: 60, reps: 8, rpe: 8.5 },
        { weight: 60, reps: 7, rpe: 8.5 },
        { weight: 60, reps: 7, rpe: 9 },
      ])],
    });
    expect(advice?.kind).toBe("buildReps");
    expect(advice?.facts.bestReps).toBe(8);
  });

  it("ignores warmup sets in the verdict", () => {
    const advice = assessProgression({
      today: TODAY,
      target: TARGET,
      sessions: [session(daysAgo(3), [
        { weight: 40, reps: 15, isWarmup: true },
        { weight: 60, reps: 10, rpe: 8 },
        { weight: 60, reps: 10, rpe: 8 },
        { weight: 60, reps: 10, rpe: 8 },
      ])],
    });
    expect(advice?.kind).toBe("increase");
    expect(advice?.facts.topWeightKg).toBe(60);
  });
});

describe("assessProgression — plateau detection", () => {
  const stuckSets = (rpe: number) => [
    { weight: 60, reps: 8, rpe },
    { weight: 60, reps: 8, rpe },
    { weight: 60, reps: 8, rpe },
  ];

  it("pushes reps when stuck at the same weight with low RPE", () => {
    const advice = assessProgression({
      today: TODAY,
      target: TARGET,
      sessions: [
        session(daysAgo(3), stuckSets(7.5)),
        session(daysAgo(7), stuckSets(7.5)),
        session(daysAgo(10), stuckSets(7.5)),
      ],
    });
    expect(advice?.kind).toBe("plateauPushReps");
    expect(advice?.facts.sessionsAtSameWeight).toBe(3);
  });

  it("suggests a light deload when stuck at the same weight with high RPE", () => {
    const advice = assessProgression({
      today: TODAY,
      target: TARGET,
      sessions: [
        session(daysAgo(3), stuckSets(9.5)),
        session(daysAgo(7), stuckSets(9.5)),
        session(daysAgo(10), stuckSets(9)),
      ],
    });
    expect(advice?.kind).toBe("plateauDeload");
    expect(advice?.suggestedWeightKg).toBe(55); // 60 * 0.9 = 54 → 55 with 2.5 step
  });

  it("does not flag a plateau when reps are climbing", () => {
    const advice = assessProgression({
      today: TODAY,
      target: TARGET,
      sessions: [
        session(daysAgo(3), [{ weight: 60, reps: 9, rpe: 7.5 }, { weight: 60, reps: 8, rpe: 7.5 }, { weight: 60, reps: 8, rpe: 7.5 }]),
        session(daysAgo(7), [{ weight: 60, reps: 8, rpe: 7.5 }]),
        session(daysAgo(10), [{ weight: 60, reps: 7, rpe: 7.5 }]),
      ],
    });
    expect(advice?.kind).toBe("buildReps");
  });

  it("does not flag a plateau when weight changed between sessions", () => {
    const advice = assessProgression({
      today: TODAY,
      target: TARGET,
      sessions: [
        session(daysAgo(3), stuckSets(7.5)),
        session(daysAgo(7), [{ weight: 57.5, reps: 8, rpe: 7.5 }]),
        session(daysAgo(10), stuckSets(7.5)),
      ],
    });
    expect(advice?.kind).toBe("buildReps");
  });
});
