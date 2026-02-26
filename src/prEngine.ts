// src/prEngine.ts  –  PR detection logic extracted from log.tsx
import { getDb } from "./db";
import { isBodyweight, isPerSideExercise } from "./exerciseLibrary";
import { isoDateOnly } from "./storage";
import { epley1RM, round1 } from "./metrics";

// ── Types ──────────────────────────────────────────────────────────────────

export type PrType = "heaviest" | "e1rm" | "volume";

export type PrRecord = {
  value: number;
  date?: string | null;
  reps?: number | null;
  weight?: number | null;
  setId?: string | null;
};

export type PrMap = Record<string, Partial<Record<PrType, PrRecord>>>;

// ── Load PR records ────────────────────────────────────────────────────────

export function loadPrRecords(programId: string, exerciseIds: string[]): PrMap {
  if (!programId || exerciseIds.length === 0) return {};
  try {
    const placeholders = exerciseIds.map(() => "?").join(",");
    const params: (string | number)[] = [...exerciseIds, programId];
    const rows = getDb().getAllSync<{
      exercise_id: string; type: string; value: number;
      reps?: number | null; weight?: number | null; set_id?: string | null; date?: string | null;
    }>(`SELECT exercise_id, type, value, reps, weight, set_id, date FROM pr_records WHERE exercise_id IN (${placeholders}) AND program_id = ?`, params);
    const map: PrMap = {};
    for (const r of rows ?? []) {
      const exId = String(r.exercise_id);
      if (!map[exId]) map[exId] = {};
      const t = r.type as PrType;
      map[exId][t] = { value: r.value, date: r.date ?? null, reps: r.reps ?? null, weight: r.weight ?? null, setId: r.set_id ?? null };
    }
    return map;
  } catch {
    return {};
  }
}

// ── Per-set PR check (heaviest + e1RM) ─────────────────────────────────────

export type CheckSetPRsParams = {
  exerciseId: string;
  weight: number;
  reps: number;
  setId: string;
  workoutId: string;
  programId: string;
  currentVolumeRecord: PrRecord | undefined;
  isBw: boolean;
  estTotalLoadKg: number | null | undefined;
};

export type CheckSetPRsResult = {
  updatedRecords: Partial<Record<PrType, PrRecord>>;
  messages: string[];
};

export async function checkSetPRs(params: CheckSetPRsParams): Promise<CheckSetPRsResult> {
  const { exerciseId, weight, reps, setId, workoutId, programId, currentVolumeRecord, isBw, estTotalLoadKg } = params;
  const dateOnly = isoDateOnly();
  const prWeight = isBw && estTotalLoadKg != null ? estTotalLoadKg : weight;
  const e1rm = round1(epley1RM(prWeight, reps));

  // Read PR records from DB (source of truth)
  let dbHeaviest: PrRecord | null = null;
  let dbE1rm: PrRecord | null = null;
  try {
    const db = getDb();
    const rows = db.getAllSync<{
      type: string; value: number; reps?: number | null; weight?: number | null; set_id?: string | null; date?: string | null;
    }>(`SELECT type, value, reps, weight, set_id, date FROM pr_records WHERE exercise_id = ? AND program_id = ? AND type IN ('heaviest', 'e1rm')`, [exerciseId, programId]);
    for (const r of rows ?? []) {
      const rec: PrRecord = { value: r.value, date: r.date ?? null, reps: r.reps ?? null, weight: r.weight ?? null, setId: r.set_id ?? null };
      if (r.type === "heaviest") dbHeaviest = rec;
      else if (r.type === "e1rm") dbE1rm = rec;
    }
  } catch {}

  const nextMap: Partial<Record<PrType, PrRecord>> = {};
  if (dbHeaviest) nextMap.heaviest = dbHeaviest;
  if (dbE1rm) nextMap.e1rm = dbE1rm;
  // Preserve volume from caller (only written at endWorkout)
  if (currentVolumeRecord) nextMap.volume = currentVolumeRecord;

  const messages: string[] = [];

  // Baseline = first-ever session for this exercise (no prior non-warmup sets outside current workout)
  let isBaseline = false;
  if (!dbHeaviest && !dbE1rm) {
    try {
      const prior = getDb().getFirstSync<{ c: number }>(
        `SELECT COUNT(1) as c FROM sets s JOIN workouts w ON w.id = s.workout_id WHERE s.exercise_id = ? AND w.id != ? AND s.is_warmup IS NOT 1 LIMIT 1`,
        [exerciseId, workoutId]
      );
      isBaseline = !(prior && prior.c > 0);
    } catch {}
  }

  let heaviestChanged = false;
  let e1rmChanged = false;

  if (!dbHeaviest || prWeight > (dbHeaviest.value ?? 0)) {
    nextMap.heaviest = { value: prWeight, date: dateOnly, reps, weight: prWeight, setId };
    heaviestChanged = true;
    if (!isBaseline) messages.push(`heaviest:${prWeight}`);
  }
  if (!dbE1rm || e1rm > (dbE1rm.value ?? 0)) {
    nextMap.e1rm = { value: e1rm, date: dateOnly, reps, weight: prWeight, setId };
    e1rmChanged = true;
    if (!isBaseline) messages.push(`e1rm:${e1rm}`);
  }

  try {
    const db = getDb();
    if (heaviestChanged && nextMap.heaviest) {
      await db.runAsync(`INSERT OR REPLACE INTO pr_records(exercise_id, type, value, reps, weight, set_id, date, program_id) VALUES(?, 'heaviest', ?, ?, ?, ?, ?, ?)`, [exerciseId, nextMap.heaviest.value, reps, prWeight, setId, dateOnly, programId]);
    }
    if (e1rmChanged && nextMap.e1rm) {
      await db.runAsync(`INSERT OR REPLACE INTO pr_records(exercise_id, type, value, reps, weight, set_id, date, program_id) VALUES(?, 'e1rm', ?, ?, ?, ?, ?, ?)`, [exerciseId, nextMap.e1rm.value, reps, prWeight, setId, dateOnly, programId]);
    }
  } catch {}

  return { updatedRecords: nextMap, messages };
}

// ── Recompute PRs for an exercise (full historical scan) ──────────────────

export function recomputePRForExercise(
  exerciseId: string,
  programId: string,
): Partial<Record<PrType, PrRecord>> {
  if (!exerciseId || !programId) return {};
  try {
    const db = getDb();
    const isBw = isBodyweight(exerciseId);

    const rows = db.getAllSync<{
      set_id: string; weight: number; reps: number;
      est_total_load_kg: number | null; date: string;
    }>(
      `SELECT s.id AS set_id, s.weight, s.reps, s.est_total_load_kg, w.date
       FROM sets s
       JOIN workouts w ON w.id = s.workout_id
       WHERE s.exercise_id = ?
         AND w.program_id = ?
         AND (s.is_warmup IS NULL OR s.is_warmup = 0)`,
      [exerciseId, programId]
    );

    if (!rows || rows.length === 0) {
      db.runSync(
        `DELETE FROM pr_records WHERE exercise_id = ? AND program_id = ? AND type IN ('heaviest', 'e1rm')`,
        [exerciseId, programId]
      );
      return {};
    }

    let bestHeaviestValue = -Infinity;
    let bestHeaviestRow: (typeof rows)[0] | null = null;
    let bestE1rmValue = -Infinity;
    let bestE1rmRow: (typeof rows)[0] | null = null;
    let bestE1rmReps = 0;
    let bestE1rmWeight = 0;

    for (const row of rows) {
      const prWeight = isBw && row.est_total_load_kg != null ? row.est_total_load_kg : row.weight;

      if (prWeight > bestHeaviestValue) {
        bestHeaviestValue = prWeight;
        bestHeaviestRow = row;
      }

      const e1rmVal = round1(epley1RM(prWeight, row.reps));
      if (e1rmVal > bestE1rmValue) {
        bestE1rmValue = e1rmVal;
        bestE1rmRow = row;
        bestE1rmReps = row.reps;
        bestE1rmWeight = prWeight;
      }
    }

    const result: Partial<Record<PrType, PrRecord>> = {};

    if (bestHeaviestRow) {
      db.runSync(
        `INSERT OR REPLACE INTO pr_records(exercise_id, type, value, reps, weight, set_id, date, program_id) VALUES(?, 'heaviest', ?, ?, ?, ?, ?, ?)`,
        [exerciseId, bestHeaviestValue, bestHeaviestRow.reps, bestHeaviestValue, bestHeaviestRow.set_id, bestHeaviestRow.date, programId]
      );
      result.heaviest = { value: bestHeaviestValue, reps: bestHeaviestRow.reps, weight: bestHeaviestValue, setId: bestHeaviestRow.set_id, date: bestHeaviestRow.date };
    }

    if (bestE1rmRow) {
      db.runSync(
        `INSERT OR REPLACE INTO pr_records(exercise_id, type, value, reps, weight, set_id, date, program_id) VALUES(?, 'e1rm', ?, ?, ?, ?, ?, ?)`,
        [exerciseId, bestE1rmValue, bestE1rmReps, bestE1rmWeight, bestE1rmRow.set_id, bestE1rmRow.date, programId]
      );
      result.e1rm = { value: bestE1rmValue, reps: bestE1rmReps, weight: bestE1rmWeight, setId: bestE1rmRow.set_id, date: bestE1rmRow.date };
    }

    return result;
  } catch {
    return {};
  }
}

// ── Session volume PR check ────────────────────────────────────────────────

export type SetForVolume = {
  exercise_id?: string | null;
  exercise_name: string;
  weight: number;
  reps: number;
  est_total_load_kg?: number | null;
};

export type CheckSessionVolumePRsParams = {
  workoutId: string;
  programId: string;
  sets: SetForVolume[];
};

export type CheckSessionVolumePRsResult = {
  dbPrMap: PrMap;
  volumePrs: string[];
};

export async function checkSessionVolumePRs(params: CheckSessionVolumePRsParams): Promise<CheckSessionVolumePRsResult> {
  const { workoutId, programId, sets } = params;

  const volumeByExercise: Record<string, number> = {};
  for (const s of sets) {
    const exId = s.exercise_id ?? s.exercise_name;
    const isBw = isBodyweight(exId);
    const effectiveWeight = isBw && s.est_total_load_kg != null ? s.est_total_load_kg : (s.weight ?? 0);
    const perSideMultiplier = isPerSideExercise(exId) ? 2 : 1;
    volumeByExercise[exId] = (volumeByExercise[exId] ?? 0) + effectiveWeight * (s.reps ?? 0) * perSideMultiplier;
  }

  const dateOnly = isoDateOnly();
  const volumePrs: string[] = [];

  // Load ALL current PR records from DB (source of truth) for exercises in this workout
  const workoutExIds = Object.keys(volumeByExercise);
  const dbPrMap: PrMap = {};
  if (workoutExIds.length > 0 && programId) {
    try {
      const ph = workoutExIds.map(() => "?").join(",");
      const dbRows = getDb().getAllSync<{
        exercise_id: string; type: string; value: number; reps?: number | null; weight?: number | null; set_id?: string | null; date?: string | null;
      }>(`SELECT exercise_id, type, value, reps, weight, set_id, date FROM pr_records WHERE exercise_id IN (${ph}) AND program_id = ?`, [...workoutExIds, programId]);
      for (const r of dbRows ?? []) {
        const eid = String(r.exercise_id);
        if (!dbPrMap[eid]) dbPrMap[eid] = {};
        dbPrMap[eid][r.type as PrType] = { value: r.value, date: r.date ?? null, reps: r.reps ?? null, weight: r.weight ?? null, setId: r.set_id ?? null };
      }
    } catch {}
  }

  for (const [exId, sessionVolume] of Object.entries(volumeByExercise)) {
    const vol = round1(sessionVolume);
    const dbVolume = dbPrMap[exId]?.volume;
    if (!dbVolume || vol > (dbVolume.value ?? 0)) {
      // Check baseline — skip banner if this is the very first session for this exercise
      let isBaseline = false;
      if (!dbPrMap[exId]?.heaviest && !dbPrMap[exId]?.e1rm && !dbVolume) {
        try {
          const prior = getDb().getFirstSync<{ c: number }>(
            `SELECT COUNT(1) as c FROM sets s JOIN workouts w ON w.id = s.workout_id WHERE s.exercise_id = ? AND w.id != ? AND s.is_warmup IS NOT 1 LIMIT 1`,
            [exId, workoutId]
          );
          isBaseline = !(prior && prior.c > 0);
        } catch {}
      }
      const record: PrRecord = { value: vol, date: dateOnly, reps: null, weight: null, setId: null };
      dbPrMap[exId] = { ...dbPrMap[exId], volume: record };
      try {
        await getDb().runAsync(
          `INSERT OR REPLACE INTO pr_records(exercise_id, type, value, reps, weight, set_id, date, program_id) VALUES(?, 'volume', ?, NULL, NULL, NULL, ?, ?)`,
          [exId, vol, dateOnly, programId]
        );
      } catch {}
      if (!isBaseline) volumePrs.push(`volume:${exId}:${vol}`);
    }
  }

  return { dbPrMap, volumePrs };
}
