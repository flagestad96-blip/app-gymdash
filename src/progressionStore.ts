// src/progressionStore.ts
import { ensureDb, getDb } from "./db";
import { defaultIncrementFor, tagsFor } from "./exerciseLibrary";
import { uid, isoNow } from "./storage";

export type ExerciseTarget = {
  programId: string;
  exerciseId: string;
  dayIndex: number;
  repMin: number;
  repMax: number;
  targetSets: number;
  incrementKg: number;
  updatedAt: string;
  autoProgress: boolean;
};

export type DayExerciseRef = {
  dayIndex: number;
  exerciseId: string;
};

// Targets keyed by day index, then by exercise id.
export type TargetsByDay = Record<number, Record<string, ExerciseTarget>>;

export type ProgressionSuggestion = {
  id: string;
  programId: string;
  exerciseId: string;
  oldWeightKg: number;
  newWeightKg: number;
  reason: string | null;
  createdAt: string;
  applied: boolean;
  dismissed: boolean;
};

export type LastSet = {
  weight: number;
  reps: number;
  rpe?: number | null;
  createdAt?: string | null;
};

export function defaultTargetForExercise(exerciseId: string) {
  const tags = tagsFor(exerciseId);
  const isIsolation = tags.includes("isolation");
  const repMin = isIsolation ? 10 : 6;
  const repMax = isIsolation ? 15 : 10;
  const targetSets = isIsolation ? 3 : 3;
  const incRaw = defaultIncrementFor(exerciseId);
  const incrementKg = incRaw > 0 ? incRaw : 2.5;
  return { repMin, repMax, incrementKg, targetSets };
}

function targetId(programId: string, exerciseId: string, dayIndex: number) {
  return `target_${programId}_${exerciseId}_d${dayIndex}`;
}

export async function ensureTargets(
  programId: string,
  pairs: DayExerciseRef[] = []
): Promise<void> {
  if (!programId) return;
  if (!pairs.length) return;
  await ensureDb();

  const now = isoNow();
  const db = getDb();

  for (const { dayIndex, exerciseId } of pairs) {
    if (!exerciseId) continue;
    const { repMin, repMax, incrementKg, targetSets } = defaultTargetForExercise(exerciseId);
    await db.runAsync(
      `INSERT OR IGNORE INTO exercise_targets(id, program_id, exercise_id, day_index, rep_min, rep_max, target_sets, increment_kg, updated_at)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        targetId(programId, exerciseId, dayIndex),
        programId,
        exerciseId,
        dayIndex,
        repMin,
        repMax,
        targetSets,
        incrementKg,
        now,
      ]
    );
  }
}

type TargetRow = {
  program_id: string;
  exercise_id: string;
  day_index: number;
  rep_min: number;
  rep_max: number;
  target_sets?: number | null;
  increment_kg: number;
  updated_at: string;
  auto_progress?: number | null;
};

function rowToTarget(r: TargetRow): ExerciseTarget {
  return {
    programId: r.program_id,
    exerciseId: r.exercise_id,
    dayIndex: r.day_index,
    repMin: r.rep_min,
    repMax: r.rep_max,
    targetSets: Number.isFinite(r.target_sets ?? NaN) ? Number(r.target_sets) : 3,
    incrementKg: r.increment_kg,
    updatedAt: r.updated_at,
    autoProgress: r.auto_progress === 1,
  };
}

export async function getTargets(programId: string): Promise<TargetsByDay> {
  if (!programId) return {};
  await ensureDb();
  const rows = await getDb().getAllAsync<TargetRow>(
    `SELECT program_id, exercise_id, day_index, rep_min, rep_max, target_sets, increment_kg, updated_at, auto_progress
     FROM exercise_targets
     WHERE program_id = ?`,
    [programId]
  );

  const byDay: TargetsByDay = {};
  for (const r of rows ?? []) {
    const target = rowToTarget(r);
    if (!byDay[target.dayIndex]) byDay[target.dayIndex] = {};
    byDay[target.dayIndex][target.exerciseId] = target;
  }
  return byDay;
}

export async function upsertTarget(args: {
  programId: string;
  exerciseId: string;
  dayIndex: number;
  repMin: number;
  repMax: number;
  targetSets: number;
  incrementKg: number;
  autoProgress?: boolean;
}): Promise<void> {
  await ensureDb();
  const now = isoNow();
  const ap = args.autoProgress !== false ? 1 : 0;
  await getDb().runAsync(
    `INSERT INTO exercise_targets(id, program_id, exercise_id, day_index, rep_min, rep_max, target_sets, increment_kg, updated_at, auto_progress)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(program_id, exercise_id, day_index)
     DO UPDATE SET rep_min=excluded.rep_min, rep_max=excluded.rep_max, target_sets=excluded.target_sets, increment_kg=excluded.increment_kg, updated_at=excluded.updated_at, auto_progress=excluded.auto_progress`,
    [
      targetId(args.programId, args.exerciseId, args.dayIndex),
      args.programId,
      args.exerciseId,
      args.dayIndex,
      args.repMin,
      args.repMax,
      args.targetSets,
      args.incrementKg,
      now,
      ap,
    ]
  );
}

// ── Auto-progression ────────────────────────────────────────────────

type SetRow = { exercise_id: string; weight: number; reps: number };

export async function analyzeWorkoutForProgression(
  workoutId: string,
  programId: string
): Promise<string[]> {
  if (!workoutId || !programId) return [];
  await ensureDb();
  const db = getDb();

  const workout = await db.getFirstAsync<{ day_index: number | null }>(
    `SELECT day_index FROM workouts WHERE id = ? LIMIT 1`,
    [workoutId]
  );
  const dayIndex = Number.isFinite(workout?.day_index ?? NaN) ? Number(workout!.day_index) : 0;

  const sets = await db.getAllAsync<SetRow>(
    `SELECT exercise_id, weight, reps FROM sets
     WHERE workout_id = ? AND is_warmup IS NOT 1
     ORDER BY exercise_id, created_at`,
    [workoutId]
  );
  if (!sets?.length) return [];

  // Group by exercise
  const byEx: Record<string, SetRow[]> = {};
  for (const s of sets) {
    if (!s.exercise_id) continue;
    (byEx[s.exercise_id] ??= []).push(s);
  }

  const targetsByDay = await getTargets(programId);
  const dayTargets = targetsByDay[dayIndex] ?? {};
  const created: string[] = [];

  for (const [exerciseId, exSets] of Object.entries(byEx)) {
    const target = dayTargets[exerciseId];
    if (!target || !target.autoProgress) continue;

    // Check: did all targetSets sets hit repMax or above?
    const workingSets = exSets.filter((s) => s.weight > 0);
    if (workingSets.length < target.targetSets) continue;

    const hitMax = workingSets.filter((s) => s.reps >= target.repMax);
    if (hitMax.length < target.targetSets) continue;

    // All target sets hit repMax — suggest progression
    const maxWeight = Math.max(...workingSets.map((s) => s.weight));
    const newWeight = maxWeight + target.incrementKg;

    // Don't create duplicate suggestion for same exercise + weight
    const existing = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM progression_log
       WHERE program_id=? AND exercise_id=? AND new_weight_kg=? AND applied=0 AND dismissed=0`,
      [programId, exerciseId, newWeight]
    );
    if (existing) continue;

    const id = uid("prog");
    const reason = `${hitMax.length}x${target.repMax}+ @ ${maxWeight}kg`;
    await db.runAsync(
      `INSERT INTO progression_log (id, program_id, exercise_id, old_weight_kg, new_weight_kg, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, programId, exerciseId, maxWeight, newWeight, reason, isoNow()]
    );
    created.push(id);
  }

  return created;
}

type SuggestionRow = {
  id: string;
  program_id: string;
  exercise_id: string;
  old_weight_kg: number;
  new_weight_kg: number;
  reason: string | null;
  created_at: string;
  applied: number;
  dismissed: number;
};

function rowToSuggestion(r: SuggestionRow): ProgressionSuggestion {
  return {
    id: r.id,
    programId: r.program_id,
    exerciseId: r.exercise_id,
    oldWeightKg: r.old_weight_kg,
    newWeightKg: r.new_weight_kg,
    reason: r.reason,
    createdAt: r.created_at,
    applied: !!r.applied,
    dismissed: !!r.dismissed,
  };
}

export async function getPendingSuggestions(programId: string): Promise<ProgressionSuggestion[]> {
  if (!programId) return [];
  await ensureDb();
  const rows = await getDb().getAllAsync<SuggestionRow>(
    `SELECT * FROM progression_log
     WHERE program_id=? AND applied=0 AND dismissed=0
     ORDER BY created_at DESC`,
    [programId]
  );
  return (rows ?? []).map(rowToSuggestion);
}

export async function applySuggestion(id: string): Promise<void> {
  await ensureDb();
  await getDb().runAsync(`UPDATE progression_log SET applied=1 WHERE id=?`, [id]);
}

export async function dismissSuggestion(id: string): Promise<void> {
  await ensureDb();
  await getDb().runAsync(`UPDATE progression_log SET dismissed=1 WHERE id=?`, [id]);
}

const ProgressionStore = {
  ensureTargets,
  getTargets,
  upsertTarget,
  defaultTargetForExercise,
  analyzeWorkoutForProgression,
  getPendingSuggestions,
  applySuggestion,
  dismissSuggestion,
};

export default ProgressionStore;
