// src/strengthStandards.ts — Strength level calculator based on bodyweight ratios

export type StrengthLevel = "beginner" | "novice" | "intermediate" | "advanced" | "elite";
export type Gender = "male" | "female";

type StandardEntry = {
  exerciseId: string;
  /** Bodyweight multipliers for each level [beginner, novice, intermediate, advanced, elite] */
  male: [number, number, number, number, number];
  female: [number, number, number, number, number];
};

/**
 * Strength standards as bodyweight multipliers for estimated 1RM.
 * Based on commonly referenced strength standard tables.
 */
const STANDARDS: StandardEntry[] = [
  {
    exerciseId: "bench_press",
    male:   [0.50, 0.75, 1.00, 1.25, 1.50],
    female: [0.25, 0.40, 0.60, 0.80, 1.00],
  },
  {
    exerciseId: "squat",
    male:   [0.75, 1.00, 1.50, 2.00, 2.50],
    female: [0.50, 0.75, 1.00, 1.50, 1.75],
  },
  {
    exerciseId: "deadlift",
    male:   [1.00, 1.25, 1.75, 2.25, 3.00],
    female: [0.50, 0.75, 1.25, 1.50, 2.00],
  },
  {
    exerciseId: "overhead_press",
    male:   [0.35, 0.50, 0.65, 0.85, 1.10],
    female: [0.20, 0.30, 0.45, 0.60, 0.75],
  },
  {
    exerciseId: "barbell_row",
    male:   [0.40, 0.60, 0.80, 1.05, 1.30],
    female: [0.25, 0.35, 0.55, 0.70, 0.90],
  },
  {
    exerciseId: "incline_bench_press",
    male:   [0.40, 0.60, 0.85, 1.10, 1.35],
    female: [0.20, 0.35, 0.50, 0.70, 0.85],
  },
  {
    exerciseId: "front_squat",
    male:   [0.60, 0.85, 1.20, 1.60, 2.00],
    female: [0.40, 0.60, 0.85, 1.15, 1.40],
  },
  {
    exerciseId: "romanian_deadlift",
    male:   [0.60, 0.85, 1.15, 1.50, 1.90],
    female: [0.40, 0.55, 0.85, 1.10, 1.40],
  },
];

const LEVELS: StrengthLevel[] = ["beginner", "novice", "intermediate", "advanced", "elite"];

/**
 * Get the list of exercise IDs that have strength standards.
 */
export function getStandardExerciseIds(): string[] {
  return STANDARDS.map((s) => s.exerciseId);
}

/**
 * Check if an exercise has strength standards.
 */
export function hasStandard(exerciseId: string): boolean {
  return STANDARDS.some((s) => s.exerciseId === exerciseId);
}

/**
 * Determine the strength level for a given exercise based on e1RM and bodyweight.
 */
export function getStandard(
  exerciseId: string,
  e1rm: number,
  bodyweight: number,
  gender: Gender = "male"
): StrengthLevel | null {
  const entry = STANDARDS.find((s) => s.exerciseId === exerciseId);
  if (!entry || !bodyweight || bodyweight <= 0 || !e1rm) return null;

  const multipliers = gender === "female" ? entry.female : entry.male;
  const ratio = e1rm / bodyweight;

  // Find the highest level the ratio meets
  let level: StrengthLevel = "beginner";
  for (let i = 0; i < multipliers.length; i++) {
    if (ratio >= multipliers[i]) {
      level = LEVELS[i];
    }
  }
  return level;
}

/**
 * Get the ratio thresholds for an exercise and gender.
 */
export function getThresholds(
  exerciseId: string,
  gender: Gender = "male"
): { level: StrengthLevel; multiplier: number }[] | null {
  const entry = STANDARDS.find((s) => s.exerciseId === exerciseId);
  if (!entry) return null;

  const multipliers = gender === "female" ? entry.female : entry.male;
  return LEVELS.map((level, i) => ({ level, multiplier: multipliers[i] }));
}

/**
 * Calculate what weight is needed for each level given bodyweight.
 */
export function getTargetWeights(
  exerciseId: string,
  bodyweight: number,
  gender: Gender = "male"
): { level: StrengthLevel; weight: number }[] | null {
  const thresholds = getThresholds(exerciseId, gender);
  if (!thresholds || !bodyweight) return null;
  return thresholds.map(({ level, multiplier }) => ({
    level,
    weight: Math.round(bodyweight * multiplier * 2) / 2, // Round to 0.5kg
  }));
}
