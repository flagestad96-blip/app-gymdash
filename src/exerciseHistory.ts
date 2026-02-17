// src/exerciseHistory.ts — Fetch recent sessions for an exercise (inline history)

import { getDb } from "./db";

export type ExerciseSession = {
  workoutId: string;
  date: string;
  sets: { weight: number; reps: number; rpe?: number | null }[];
  exerciseOrder: number;
};

export async function getRecentSessions(
  exerciseId: string,
  excludeWorkoutId: string | null,
  limit: number = 5
): Promise<ExerciseSession[]> {
  try {
    const db = getDb();

    const workoutRows = db.getAllSync<{ workout_id: string; date: string }>(
      `SELECT DISTINCT s.workout_id, w.date
       FROM sets s JOIN workouts w ON s.workout_id = w.id
       WHERE s.exercise_id = ?${excludeWorkoutId ? " AND s.workout_id != ?" : ""}
       ORDER BY w.date DESC
       LIMIT ?`,
      excludeWorkoutId ? [exerciseId, excludeWorkoutId, limit] : [exerciseId, limit]
    );

    if (!workoutRows || workoutRows.length === 0) return [];

    const sessions: ExerciseSession[] = [];

    for (const wr of workoutRows) {
      const display = db.getAllSync<{
        weight: number;
        reps: number;
        rpe: number | null;
      }>(
        `SELECT weight, reps, rpe FROM sets
         WHERE workout_id = ? AND exercise_id = ?
         ORDER BY set_index ASC`,
        [wr.workout_id, exerciseId]
      ) ?? [];

      const exOrder = db.getAllSync<{ exercise_id: string }>(
        `SELECT exercise_id FROM sets WHERE workout_id = ?
         GROUP BY exercise_id ORDER BY MIN(set_index) ASC`,
        [wr.workout_id]
      );

      sessions.push({
        workoutId: wr.workout_id,
        date: wr.date,
        sets: display.map((s) => ({
          weight: s.weight,
          reps: s.reps,
          rpe: s.rpe,
        })),
        exerciseOrder:
          exOrder?.findIndex((e) => e.exercise_id === exerciseId) ?? 0,
      });
    }

    return sessions;
  } catch {
    return [];
  }
}
