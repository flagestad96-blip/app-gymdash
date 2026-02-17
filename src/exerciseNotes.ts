// src/exerciseNotes.ts — Exercise notes API
import { getDb } from "./db";

export function getNote(exerciseId: string): string | null {
  try {
    const row = getDb().getFirstSync<{ note: string }>(
      `SELECT note FROM exercise_notes WHERE exercise_id = ?`,
      [exerciseId]
    );
    return row?.note ?? null;
  } catch {
    return null;
  }
}

export function getAllNotes(): Record<string, string> {
  try {
    const rows = getDb().getAllSync<{ exercise_id: string; note: string }>(
      `SELECT exercise_id, note FROM exercise_notes`
    );
    const map: Record<string, string> = {};
    for (const r of rows ?? []) map[r.exercise_id] = r.note;
    return map;
  } catch {
    return {};
  }
}

export async function setNote(exerciseId: string, note: string): Promise<void> {
  await getDb().runAsync(
    `INSERT OR REPLACE INTO exercise_notes(exercise_id, note, updated_at) VALUES(?, ?, ?)`,
    [exerciseId, note, new Date().toISOString()]
  );
}

export async function deleteNote(exerciseId: string): Promise<void> {
  await getDb().runAsync(
    `DELETE FROM exercise_notes WHERE exercise_id = ?`,
    [exerciseId]
  );
}
