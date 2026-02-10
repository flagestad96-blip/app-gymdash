// src/progressionStore.ts
import { ensureDb, getDb } from "./db";
import { defaultIncrementFor, tagsFor } from "./exerciseLibrary";

export type ExerciseTarget = {
  programId: string;
  exerciseId: string;
  repMin: number;
  repMax: number;
  targetSets: number;
  incrementKg: number;
  updatedAt: string;
  autoProgress: boolean;
};

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

function isoNow() {
  return new Date().toISOString();
}

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

export async function ensureTargets(programId: string, exerciseIds: string[] = []): Promise<void> {
  if (!programId) return;
  if (!exerciseIds.length) return;
  await ensureDb();

  const now = isoNow();
  const db = getDb();

  for (const exerciseId of exerciseIds) {
    const { repMin, repMax, incrementKg, targetSets } = defaultTargetForExercise(exerciseId);
    await db.runAsync(
      `INSERT OR IGNORE INTO exercise_targets(id, program_id, exercise_id, rep_min, rep_max, target_sets, increment_kg, updated_at)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `target_${programId}_${exerciseId}`,
        programId,
        exerciseId,
        repMin,
        repMax,
        targetSets,
        incrementKg,
        now,
      ]
    );
  }
}

export async function getTargets(programId: string): Promise<Record<string, ExerciseTarget>> {
  if (!programId) return {};
  await ensureDb();
  const rows = await getDb().getAllAsync<{
    program_id: string;
    exercise_id: string;
    rep_min: number;
    rep_max: number;
    target_sets?: number | null;
    increment_kg: number;
    updated_at: string;
    auto_progress?: number | null;
  }>(
    `SELECT program_id, exercise_id, rep_min, rep_max, target_sets, increment_kg, updated_at, auto_progress
     FROM exercise_targets
     WHERE program_id = ?`,
    [programId]
  );

  const map: Record<string, ExerciseTarget> = {};
  for (const r of rows ?? []) {
    map[r.exercise_id] = {
      programId: r.program_id,
      exerciseId: r.exercise_id,
      repMin: r.rep_min,
      repMax: r.rep_max,
      targetSets: Number.isFinite(r.target_sets ?? NaN) ? Number(r.target_sets) : 3,
      incrementKg: r.increment_kg,
      updatedAt: r.updated_at,
      autoProgress: r.auto_progress !== 0,
    };
  }
  return map;
}

export async function upsertTarget(args: {
  programId: string;
  exerciseId: string;
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
    `INSERT INTO exercise_targets(id, program_id, exercise_id, rep_min, rep_max, target_sets, increment_kg, updated_at, auto_progress)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(program_id, exercise_id)
     DO UPDATE SET rep_min=excluded.rep_min, rep_max=excluded.rep_max, target_sets=excluded.target_sets, increment_kg=excluded.increment_kg, updated_at=excluded.updated_at, auto_progress=excluded.auto_progress`,
    [
      `target_${args.programId}_${args.exerciseId}`,
      args.programId,
      args.exerciseId,
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

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

type SetRow = { exercise_id: string; weight: number; reps: number };

export async function analyzeWorkoutForProgression(
  workoutId: string,
  programId: string
): Promise<string[]> {
  if (!workoutId || !programId) return [];
  await ensureDb();
  const db = getDb();

  const sets = await db.getAllAsync<SetRow>(
    `SELECT exercise_id, weight, reps FROM sets
     WHERE workout_id = ? AND (is_warmup = 0 OR is_warmup IS NULL) AND (set_type IS NULL OR set_type = 'normal')
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

  const targets = await getTargets(programId);
  const created: string[] = [];

  for (const [exerciseId, exSets] of Object.entries(byEx)) {
    const target = targets[exerciseId];
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
