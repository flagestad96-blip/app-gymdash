// src/backup.ts
// Centralized backup/export/import logic extracted from settings.tsx

import { ensureDb, getDb } from "./db";
import { displayNameFor, resolveExerciseId } from "./exerciseLibrary";

export const CURRENT_SCHEMA_VERSION = 4;

type CsvRow = {
  set_id: string;
  exercise_id?: string | null;
  exercise_name: string;
  weight?: number | null;
  reps?: number | null;
  rpe?: number | null;
  created_at?: string | null;
  workout_date?: string | null;
  day_index?: number | null;
  program_id?: string | null;
  program_name?: string | null;
  set_type?: string | null;
  is_warmup?: number | null;
  notes?: string | null;
  rest_seconds?: number | null;
};

export type ImportMode = "merge" | "fresh";

export interface BackupPayload {
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  data: Record<string, unknown[]>;
}

export interface ImportResult {
  success: boolean;
  error?: string;
}

/**
 * Export ALL database tables as a JSON backup string.
 * Covers every table defined in db.ts schema (version 4).
 */
export async function exportFullBackup(): Promise<string> {
  await ensureDb();
  const db = getDb();

  const workouts = await db.getAllAsync(
    `SELECT id, date, program_mode, program_id, day_key, back_status, notes, day_index, started_at, ended_at, gym_id FROM workouts`
  );
  const sets = await db.getAllAsync(
    `SELECT id, workout_id, exercise_name, set_index, weight, reps, rpe, created_at, exercise_id, set_type, is_warmup, external_load_kg, bodyweight_kg_used, bodyweight_factor, est_total_load_kg, notes, rest_seconds FROM sets`
  );
  const settings = await db.getAllAsync(`SELECT key, value FROM settings`);
  const programs = await db.getAllAsync(
    `SELECT id, name, mode, json, created_at, updated_at FROM programs`
  );
  const programDays = await db.getAllAsync(
    `SELECT id, program_id, day_index, name FROM program_days`
  );
  const programDayExercises = await db.getAllAsync(
    `SELECT id, program_id, day_index, sort_index, type, ex_id, a_id, b_id FROM program_day_exercises`
  );
  const programAlternatives = await db.getAllAsync(
    `SELECT id, program_id, day_index, exercise_id, alt_exercise_id, sort_index FROM program_exercise_alternatives`
  );
  const programReplacements = await db.getAllAsync(
    `SELECT id, program_id, day_index, original_ex_id, replaced_ex_id, updated_at FROM program_replacements`
  );
  const exerciseTargets = await db.getAllAsync(
    `SELECT id, program_id, exercise_id, rep_min, rep_max, target_sets, increment_kg, updated_at, auto_progress FROM exercise_targets`
  );
  const prRecords = await db.getAllAsync(
    `SELECT exercise_id, type, value, reps, weight, set_id, date, program_id FROM pr_records`
  );
  const bodyMetrics = await db.getAllAsync(
    `SELECT date, weight_kg, note FROM body_metrics`
  );
  const achievements = await db.getAllAsync(
    `SELECT id, category, name, description, icon, requirement_type, requirement_value, requirement_exercise_id, tier, points, created_at FROM achievements`
  );
  const userAchievements = await db.getAllAsync(
    `SELECT id, achievement_id, unlocked_at, workout_id, set_id, value_achieved FROM user_achievements`
  );
  const exerciseGoals = await db.getAllAsync(
    `SELECT id, exercise_id, goal_type, target_value, created_at, achieved_at, program_id FROM exercise_goals`
  );
  const customExercises = await db.getAllAsync(
    `SELECT id, display_name, equipment, tags, default_increment_kg, is_bodyweight, bodyweight_factor, created_at FROM custom_exercises`
  );
  const progressionLog = await db.getAllAsync(
    `SELECT id, program_id, exercise_id, old_weight_kg, new_weight_kg, reason, created_at, applied, dismissed FROM progression_log`
  );
  const workoutTemplates = await db.getAllAsync(
    `SELECT id, name, description, exercises_json, created_at, last_used_at FROM workout_templates`
  );
  const dayMarks = await db.getAllAsync(
    `SELECT date, status FROM day_marks`
  );
  const exerciseNotes = await db.getAllAsync(
    `SELECT exercise_id, note, updated_at FROM exercise_notes`
  );
  const gymLocations = await db.getAllAsync(
    `SELECT id, name, color, icon, available_equipment, available_plates, sort_index, created_at FROM gym_locations`
  );

  const payload: BackupPayload = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: "unknown",
    data: {
      workouts: workouts ?? [],
      sets: sets ?? [],
      settings: settings ?? [],
      programs: programs ?? [],
      program_days: programDays ?? [],
      program_day_exercises: programDayExercises ?? [],
      program_exercise_alternatives: programAlternatives ?? [],
      program_replacements: programReplacements ?? [],
      exercise_targets: exerciseTargets ?? [],
      pr_records: prRecords ?? [],
      body_metrics: bodyMetrics ?? [],
      achievements: achievements ?? [],
      user_achievements: userAchievements ?? [],
      exercise_goals: exerciseGoals ?? [],
      custom_exercises: customExercises ?? [],
      progression_log: progressionLog ?? [],
      workout_templates: workoutTemplates ?? [],
      day_marks: dayMarks ?? [],
      exercise_notes: exerciseNotes ?? [],
      gym_locations: gymLocations ?? [],
    },
  };

  // Record backup timestamp
  try {
    await db.runAsync(
      `INSERT OR REPLACE INTO settings(key, value) VALUES(?, ?)`,
      ["last_backup_at", new Date().toISOString()]
    );
  } catch {}

  return JSON.stringify(payload, null, 2);
}

/**
 * Import a JSON backup string into the database.
 *
 * @param jsonString - The raw JSON string from a backup export
 * @param mode - "merge" keeps existing data and inserts new rows (INSERT OR IGNORE),
 *               "fresh" wipes all tables first then inserts.
 * @returns ImportResult indicating success or failure with an error message.
 */
export async function importBackup(
  jsonString: string,
  mode: ImportMode
): Promise<ImportResult> {
  let parsed: any = null;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return { success: false, error: "invalid_json" };
  }

  const rawData =
    parsed && typeof parsed === "object"
      ? parsed.data && typeof parsed.data === "object"
        ? parsed.data
        : parsed
      : null;
  if (!rawData || typeof rawData !== "object") {
    return { success: false, error: "invalid_format" };
  }

  const schemaVersion = parsed?.schemaVersion ?? parsed?.version ?? 1;
  if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    return { success: false, error: "backup_too_new" };
  }

  const data = rawData as Record<string, unknown>;
  const workouts = Array.isArray(data.workouts) ? data.workouts : [];
  const sets = Array.isArray(data.sets) ? data.sets : [];
  const settingsRows = Array.isArray(data.settings) ? data.settings : [];
  const programs = Array.isArray(data.programs) ? data.programs : [];
  const programDays = Array.isArray(data.program_days) ? data.program_days : [];
  const programDayExercises = Array.isArray(data.program_day_exercises) ? data.program_day_exercises : [];
  const programAlternatives = Array.isArray(data.program_exercise_alternatives) ? data.program_exercise_alternatives : [];
  const programReplacements = Array.isArray(data.program_replacements) ? data.program_replacements : [];
  const exerciseTargets = Array.isArray(data.exercise_targets) ? data.exercise_targets : [];
  const prRecords = Array.isArray(data.pr_records) ? data.pr_records : [];
  const bodyMetrics = Array.isArray(data.body_metrics) ? data.body_metrics : [];
  const achievements = Array.isArray(data.achievements) ? data.achievements : [];
  const userAchievements = Array.isArray(data.user_achievements) ? data.user_achievements : [];
  const exerciseGoals = Array.isArray(data.exercise_goals) ? data.exercise_goals : [];
  const customExercises = Array.isArray(data.custom_exercises) ? data.custom_exercises : [];
  const progressionLog = Array.isArray(data.progression_log) ? data.progression_log : [];
  const workoutTemplates = Array.isArray(data.workout_templates) ? data.workout_templates : [];
  const dayMarks = Array.isArray(data.day_marks) ? data.day_marks : [];
  const exerciseNotes = Array.isArray(data.exercise_notes) ? data.exercise_notes : [];
  const gymLocations = Array.isArray(data.gym_locations) ? data.gym_locations : [];

  const hasAnyData =
    workouts.length > 0 ||
    sets.length > 0 ||
    settingsRows.length > 0 ||
    programs.length > 0 ||
    programDays.length > 0 ||
    programDayExercises.length > 0 ||
    programAlternatives.length > 0 ||
    programReplacements.length > 0 ||
    exerciseTargets.length > 0 ||
    prRecords.length > 0 ||
    bodyMetrics.length > 0 ||
    achievements.length > 0 ||
    userAchievements.length > 0 ||
    exerciseGoals.length > 0 ||
    customExercises.length > 0 ||
    progressionLog.length > 0 ||
    workoutTemplates.length > 0 ||
    dayMarks.length > 0 ||
    exerciseNotes.length > 0 ||
    gymLocations.length > 0;

  if (!hasAnyData) {
    return { success: false, error: "backup_empty" };
  }

  try {
    await ensureDb();
    const db = getDb();
    const verb = mode === "fresh" ? "INSERT INTO" : "INSERT OR REPLACE INTO";

    await db.execAsync("BEGIN");

    if (mode === "fresh") {
      await db.execAsync("DELETE FROM sets");
      await db.execAsync("DELETE FROM workouts");
      await db.execAsync("DELETE FROM program_exercise_alternatives");
      await db.execAsync("DELETE FROM program_day_exercises");
      await db.execAsync("DELETE FROM program_days");
      await db.execAsync("DELETE FROM program_replacements");
      await db.execAsync("DELETE FROM exercise_targets");
      await db.execAsync("DELETE FROM pr_records");
      await db.execAsync("DELETE FROM programs");
      await db.execAsync("DELETE FROM settings");
      await db.execAsync("DELETE FROM body_metrics");
      await db.execAsync("DELETE FROM achievements");
      await db.execAsync("DELETE FROM user_achievements");
      await db.execAsync("DELETE FROM exercise_goals");
      await db.execAsync("DELETE FROM custom_exercises");
      await db.execAsync("DELETE FROM progression_log");
      await db.execAsync("DELETE FROM workout_templates");
      await db.execAsync("DELETE FROM day_marks");
      await db.execAsync("DELETE FROM exercise_notes");
      await db.execAsync("DELETE FROM gym_locations");
    }

    for (const w of workouts) {
      await db.runAsync(
        `${verb} workouts(id, date, program_mode, day_key, back_status, notes, day_index, started_at, gym_id)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          w.id,
          w.date,
          w.program_mode,
          w.day_key,
          w.back_status,
          w.notes ?? null,
          w.day_index ?? null,
          w.started_at ?? null,
          w.gym_id ?? null,
        ]
      );
    }

    for (const s of sets) {
      await db.runAsync(
        `${verb} sets(id, workout_id, exercise_name, set_index, weight, reps, rpe, created_at, exercise_id, rest_seconds)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.id,
          s.workout_id,
          s.exercise_name,
          s.set_index,
          s.weight,
          s.reps,
          s.rpe ?? null,
          s.created_at,
          s.exercise_id ?? null,
          s.rest_seconds ?? null,
        ]
      );
    }

    for (const s of settingsRows) {
      await db.runAsync(`${verb} settings(key, value) VALUES(?, ?)`, [s.key, s.value]);
    }

    for (const p of programs) {
      await db.runAsync(
        `${verb} programs(id, name, mode, json, created_at, updated_at)
         VALUES(?, ?, ?, ?, ?, ?)`,
        [p.id, p.name, p.mode ?? null, p.json, p.created_at, p.updated_at]
      );
    }

    for (const d of programDays) {
      await db.runAsync(
        `${verb} program_days(id, program_id, day_index, name)
         VALUES(?, ?, ?, ?)`,
        [d.id, d.program_id, d.day_index, d.name]
      );
    }

    for (const b of programDayExercises) {
      await db.runAsync(
        `${verb} program_day_exercises(id, program_id, day_index, sort_index, type, ex_id, a_id, b_id)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
        [b.id, b.program_id, b.day_index, b.sort_index, b.type, b.ex_id ?? null, b.a_id ?? null, b.b_id ?? null]
      );
    }

    for (const a of programAlternatives) {
      await db.runAsync(
        `${verb} program_exercise_alternatives(id, program_id, day_index, exercise_id, alt_exercise_id, sort_index)
         VALUES(?, ?, ?, ?, ?, ?)`,
        [a.id, a.program_id, a.day_index, a.exercise_id, a.alt_exercise_id, a.sort_index]
      );
    }

    for (const r of programReplacements) {
      await db.runAsync(
        `${verb} program_replacements(id, program_id, day_index, original_ex_id, replaced_ex_id, updated_at)
         VALUES(?, ?, ?, ?, ?, ?)`,
        [r.id, r.program_id, r.day_index, r.original_ex_id, r.replaced_ex_id, r.updated_at]
      );
    }

    for (const t of exerciseTargets) {
      await db.runAsync(
        `${verb} exercise_targets(id, program_id, exercise_id, rep_min, rep_max, increment_kg, updated_at)
         VALUES(?, ?, ?, ?, ?, ?, ?)`,
        [t.id, t.program_id, t.exercise_id, t.rep_min, t.rep_max, t.increment_kg, t.updated_at]
      );
    }

    for (const pr of prRecords) {
      await db.runAsync(
        `${verb} pr_records(exercise_id, type, value, reps, weight, set_id, date, program_id)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pr.exercise_id,
          pr.type,
          pr.value,
          pr.reps ?? null,
          pr.weight ?? null,
          pr.set_id ?? null,
          pr.date ?? null,
          pr.program_id ?? "",
        ]
      );
    }

    for (const bm of bodyMetrics) {
      await db.runAsync(
        `${verb} body_metrics(date, weight_kg, note)
         VALUES(?, ?, ?)`,
        [bm.date, bm.weight_kg, bm.note ?? null]
      );
    }

    for (const a of achievements) {
      await db.runAsync(
        `${verb} achievements(id, category, name, description, icon, requirement_type, requirement_value, requirement_exercise_id, tier, points, created_at)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          a.id, a.category, a.name, a.description, a.icon,
          a.requirement_type, a.requirement_value, a.requirement_exercise_id ?? null,
          a.tier, a.points ?? 10, a.created_at,
        ]
      );
    }

    for (const ua of userAchievements) {
      await db.runAsync(
        `${verb} user_achievements(id, achievement_id, unlocked_at, workout_id, set_id, value_achieved)
         VALUES(?, ?, ?, ?, ?, ?)`,
        [
          ua.id, ua.achievement_id, ua.unlocked_at,
          ua.workout_id ?? null, ua.set_id ?? null, ua.value_achieved ?? null,
        ]
      );
    }

    for (const eg of exerciseGoals) {
      await db.runAsync(
        `${verb} exercise_goals(id, exercise_id, goal_type, target_value, created_at, achieved_at, program_id)
         VALUES(?, ?, ?, ?, ?, ?, ?)`,
        [
          eg.id, eg.exercise_id, eg.goal_type, eg.target_value,
          eg.created_at, eg.achieved_at ?? null, eg.program_id,
        ]
      );
    }

    for (const ce of customExercises) {
      await db.runAsync(
        `${verb} custom_exercises(id, display_name, equipment, tags, default_increment_kg, is_bodyweight, bodyweight_factor, created_at)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ce.id, ce.display_name, ce.equipment, ce.tags,
          ce.default_increment_kg ?? 2.5, ce.is_bodyweight ?? 0,
          ce.bodyweight_factor ?? null, ce.created_at,
        ]
      );
    }

    for (const pl of progressionLog) {
      await db.runAsync(
        `${verb} progression_log(id, program_id, exercise_id, old_weight_kg, new_weight_kg, reason, created_at, applied, dismissed)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pl.id, pl.program_id, pl.exercise_id,
          pl.old_weight_kg, pl.new_weight_kg, pl.reason ?? null,
          pl.created_at, pl.applied ?? 0, pl.dismissed ?? 0,
        ]
      );
    }

    for (const wt of workoutTemplates) {
      await db.runAsync(
        `${verb} workout_templates(id, name, description, exercises_json, created_at, last_used_at)
         VALUES(?, ?, ?, ?, ?, ?)`,
        [
          wt.id, wt.name, wt.description ?? null, wt.exercises_json,
          wt.created_at, wt.last_used_at ?? null,
        ]
      );
    }

    for (const dm of dayMarks) {
      await db.runAsync(
        `${verb} day_marks(date, status) VALUES(?, ?)`,
        [dm.date, dm.status]
      );
    }

    for (const en of exerciseNotes) {
      await db.runAsync(
        `${verb} exercise_notes(exercise_id, note, updated_at) VALUES(?, ?, ?)`,
        [en.exercise_id, en.note, en.updated_at]
      );
    }

    for (const gl of gymLocations) {
      await db.runAsync(
        `${verb} gym_locations(id, name, color, icon, available_equipment, available_plates, sort_index, created_at)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          gl.id,
          gl.name,
          gl.color ?? null,
          gl.icon ?? null,
          gl.available_equipment ?? null,
          gl.available_plates ?? null,
          gl.sort_index ?? 0,
          gl.created_at,
        ]
      );
    }

    await db.execAsync("COMMIT");
    return { success: true };
  } catch (err) {
    try {
      const db = getDb();
      await db.execAsync("ROLLBACK");
    } catch {}
    return { success: false, error: "import_failed" };
  }
}

/**
 * Export all sets as CSV with workout and program metadata.
 * Returns the CSV content as a string.
 */
export async function exportCsv(): Promise<string> {
  await ensureDb();
  const db = getDb();
  const rows = await db.getAllAsync<CsvRow>(
    `SELECT s.id as set_id, s.exercise_id, s.exercise_name, s.weight, s.reps, s.rpe,
            s.created_at, s.set_type, s.is_warmup, s.notes, s.rest_seconds,
            w.date as workout_date, w.day_index, w.program_id, p.name as program_name
     FROM sets s
     LEFT JOIN workouts w ON s.workout_id = w.id
     LEFT JOIN programs p ON w.program_id = p.id
     ORDER BY s.created_at ASC`
  );

  const header = [
    "date",
    "program",
    "day",
    "exerciseId",
    "displayName",
    "weight",
    "reps",
    "rpe",
    "setType",
    "warmup",
    "notes",
    "restSeconds",
  ];

  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [header.join(",")];
  for (const r of rows ?? []) {
    const exId = r.exercise_id ? String(r.exercise_id) : resolveExerciseId(r.exercise_name);
    const display = exId ? displayNameFor(exId) : r.exercise_name;
    const day = Number.isFinite(r.day_index) ? Number(r.day_index) + 1 : "";
    const programLabel = r.program_name ?? r.program_id ?? "";
    lines.push(
      [
        r.workout_date ?? r.created_at?.slice(0, 10) ?? "",
        programLabel,
        day,
        exId ?? "",
        display,
        r.weight ?? "",
        r.reps ?? "",
        r.rpe ?? "",
        r.set_type ?? "normal",
        r.is_warmup === 1 ? "yes" : "no",
        r.notes ?? "",
        r.rest_seconds ?? "",
      ]
        .map(escape)
        .join(",")
    );
  }

  return lines.join("\n");
}
