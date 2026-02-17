// src/sharing.ts — Social sharing utilities
import { Share, Platform } from "react-native";
import { ensureDb, getDb, formatDuration } from "./db";
import { displayNameFor, isPerSideExercise } from "./exerciseLibrary";

/**
 * Generate and share a workout summary via native share sheet.
 */
export async function shareWorkoutSummary(workoutId: string): Promise<void> {
  await ensureDb();
  const db = getDb();

  const workout = await db.getFirstAsync<{
    id: string;
    date: string;
    started_at: string | null;
    ended_at: string | null;
  }>(
    `SELECT id, date, started_at, ended_at FROM workouts WHERE id = ?`,
    [workoutId]
  );
  if (!workout) return;

  const allSets = await db.getAllAsync<{
    exercise_id: string | null;
    exercise_name: string;
    weight: number;
    reps: number;
  }>(
    `SELECT exercise_id, exercise_name, weight, reps
     FROM sets WHERE workout_id = ? ORDER BY created_at`,
    [workoutId]
  );

  // Group by exercise
  const byExercise: Record<string, { name: string; exId: string | null; sets: { weight: number; reps: number }[] }> = {};
  for (const s of allSets ?? []) {
    const key = s.exercise_id ?? s.exercise_name;
    if (!byExercise[key]) {
      byExercise[key] = {
        name: s.exercise_id ? displayNameFor(s.exercise_id) : s.exercise_name,
        exId: s.exercise_id ?? null,
        sets: [],
      };
    }
    byExercise[key].sets.push({ weight: s.weight, reps: s.reps });
  }

  const totalVolume = (allSets ?? []).reduce((sum, s) => {
    const multiplier = s.exercise_id && isPerSideExercise(s.exercise_id) ? 2 : 1;
    return sum + s.weight * s.reps * multiplier;
  }, 0);
  const totalSets = (allSets ?? []).length;
  const duration = formatDuration(workout.started_at, workout.ended_at);

  // Build summary text
  const lines: string[] = [];
  lines.push(`Gymdash - ${workout.date}`);
  if (duration) lines.push(`Varighet: ${duration}`);
  lines.push(`${totalSets} sett | ${Math.round(totalVolume)} kg volum`);
  lines.push("");

  for (const [, ex] of Object.entries(byExercise)) {
    const perSide = ex.exId && isPerSideExercise(ex.exId);
    const setsStr = ex.sets.map((s) => `${s.weight}kg${perSide ? " each" : ""} x ${s.reps}`).join(", ");
    lines.push(`${ex.name}: ${setsStr}`);
  }

  lines.push("");
  lines.push("Logget med Gymdash");

  const message = lines.join("\n");

  await Share.share({
    message,
    title: `Gymdash - ${workout.date}`,
  });
}

/**
 * Share a program as a JSON file via native share.
 * Returns the program JSON for file-based sharing.
 */
export async function getShareableProgramJson(programId: string): Promise<string | null> {
  await ensureDb();
  const db = getDb();

  const program = await db.getFirstAsync<{ id: string; name: string; json: string; mode: string | null }>(
    `SELECT id, name, json, mode FROM programs WHERE id = ?`,
    [programId]
  );
  if (!program) return null;

  return JSON.stringify({
    type: "gymdash_program",
    version: 1,
    name: program.name,
    mode: program.mode,
    data: JSON.parse(program.json),
    exportedAt: new Date().toISOString(),
  });
}

/**
 * Share an achievement as text.
 */
export async function shareAchievementText(
  name: string,
  description: string,
  tier: string
): Promise<void> {
  const tierEmoji: Record<string, string> = {
    bronze: "🥉",
    silver: "🥈",
    gold: "🥇",
    platinum: "💎",
  };
  const emoji = tierEmoji[tier] ?? "🏆";

  const message = `${emoji} ${name}\n${description}\n\nOpplast med Gymdash`;

  await Share.share({
    message,
    title: name,
  });
}
