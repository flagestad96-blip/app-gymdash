// src/templates.ts — Workout template CRUD
import { ensureDb, getDb } from "./db";
import { uid, isoNow } from "./storage";

export type TemplateExercise = {
  exerciseId: string;
  type: "single" | "superset";
  /** For supersets, the second exercise */
  pairedExerciseId?: string;
};

export type WorkoutTemplate = {
  id: string;
  name: string;
  description: string | null;
  exercises: TemplateExercise[];
  createdAt: string;
  lastUsedAt: string | null;
};

type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  exercises_json: string;
  created_at: string;
  last_used_at: string | null;
};

function rowToTemplate(r: TemplateRow): WorkoutTemplate {
  let exercises: TemplateExercise[] = [];
  try {
    exercises = JSON.parse(r.exercises_json);
  } catch {}
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    exercises,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
  };
}

/**
 * Save a workout as a reusable template.
 * Extracts exercises from the given workout's sets.
 */
export async function saveAsTemplate(
  name: string,
  exercises: TemplateExercise[],
  description?: string
): Promise<string> {
  await ensureDb();
  const id = uid("tmpl");
  const now = isoNow();
  await getDb().runAsync(
    `INSERT INTO workout_templates (id, name, description, exercises_json, created_at, last_used_at)
     VALUES (?, ?, ?, ?, ?, NULL)`,
    [id, name, description ?? null, JSON.stringify(exercises), now]
  );
  return id;
}

/**
 * Save template from an existing workout's exercise blocks.
 */
export async function saveWorkoutAsTemplate(
  workoutId: string,
  name: string,
  description?: string
): Promise<string> {
  await ensureDb();
  const db = getDb();

  // Get distinct exercises from the workout sets (in order)
  const rows = await db.getAllAsync<{ exercise_id: string | null }>(
    `SELECT exercise_id FROM sets
     WHERE workout_id = ? AND exercise_id IS NOT NULL AND is_warmup IS NOT 1
     GROUP BY exercise_id
     ORDER BY MIN(set_index)`,
    [workoutId]
  );

  const exercises: TemplateExercise[] = (rows ?? [])
    .filter((r) => r.exercise_id)
    .map((r) => ({
      exerciseId: r.exercise_id!,
      type: "single" as const,
    }));

  return saveAsTemplate(name, exercises, description);
}

/**
 * List all templates, sorted by last used (most recent first), then created.
 */
export async function listTemplates(): Promise<WorkoutTemplate[]> {
  await ensureDb();
  const rows = await getDb().getAllAsync<TemplateRow>(
    `SELECT id, name, description, exercises_json, created_at, last_used_at
     FROM workout_templates
     ORDER BY COALESCE(last_used_at, created_at) DESC`
  );
  return (rows ?? []).map(rowToTemplate);
}

/**
 * Get a single template by ID.
 */
export async function getTemplate(id: string): Promise<WorkoutTemplate | null> {
  await ensureDb();
  const row = await getDb().getFirstAsync<TemplateRow>(
    `SELECT id, name, description, exercises_json, created_at, last_used_at
     FROM workout_templates WHERE id = ?`,
    [id]
  );
  return row ? rowToTemplate(row) : null;
}

/**
 * Delete a template.
 */
export async function deleteTemplate(id: string): Promise<void> {
  await ensureDb();
  await getDb().runAsync(`DELETE FROM workout_templates WHERE id = ?`, [id]);
}

/**
 * Update the last_used_at timestamp when a template is loaded.
 */
export async function updateLastUsed(id: string): Promise<void> {
  await ensureDb();
  await getDb().runAsync(
    `UPDATE workout_templates SET last_used_at = ? WHERE id = ?`,
    [isoNow(), id]
  );
}
