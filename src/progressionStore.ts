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
};

export type LastSet = {
  weight: number;
  reps: number;
  rpe?: number | null;
  createdAt?: string | null;
};

export type NextSuggestion = {
  weight: number;
  reps: number;
  reason: string;
};

function isoNow() {
  return new Date().toISOString();
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
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
  }>(
    `SELECT program_id, exercise_id, rep_min, rep_max, target_sets, increment_kg, updated_at
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
}): Promise<void> {
  await ensureDb();
  const now = isoNow();
  await getDb().runAsync(
    `INSERT INTO exercise_targets(id, program_id, exercise_id, rep_min, rep_max, target_sets, increment_kg, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(program_id, exercise_id)
     DO UPDATE SET rep_min=excluded.rep_min, rep_max=excluded.rep_max, target_sets=excluded.target_sets, increment_kg=excluded.increment_kg, updated_at=excluded.updated_at`,
    [
      `target_${args.programId}_${args.exerciseId}`,
      args.programId,
      args.exerciseId,
      args.repMin,
      args.repMax,
      args.targetSets,
      args.incrementKg,
      now,
    ]
  );
}

export function buildSuggestion(args: {
  lastSet?: LastSet | null;
  repMin: number;
  repMax: number;
  incrementKg: number;
}): NextSuggestion | null {
  const { lastSet, repMin, repMax, incrementKg } = args;
  if (!lastSet) return null;

  const reps = clamp(lastSet.reps, 1, 100);
  const weight = lastSet.weight;

  if (lastSet.rpe != null && lastSet.rpe >= 9.0) {
    return {
      weight,
      reps: clamp(reps, repMin, repMax),
      reason: "RPE hoy -> hold",
    };
  }

  if (reps >= repMax) {
    return {
      weight: weight + incrementKg,
      reps: repMin,
      reason: `Nadde topp reps -> +${incrementKg}kg`,
    };
  }

  if (reps < repMin) {
    if (reps <= repMin - 2) {
      return {
        weight: Math.max(0, weight - incrementKg),
        reps: repMin,
        reason: "Under range -> hold",
      };
    }
    return {
      weight,
      reps: repMin,
      reason: "Under range -> hold",
    };
  }

  return {
    weight,
    reps: Math.min(reps + 1, repMax),
    reason: "Bygg reps -> +1 rep",
  };
}

const ProgressionStore = {
  ensureTargets,
  getTargets,
  upsertTarget,
  defaultTargetForExercise,
  buildSuggestion,
};

export default ProgressionStore;
