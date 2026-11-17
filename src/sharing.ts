// src/sharing.ts — Social sharing utilities
import { Share } from "react-native";
import { ensureDb, getDb, formatDuration } from "./db";
import { displayNameFor, isPerSideExercise } from "./exerciseLibrary";
import { t } from "./i18n";
import { getProgram, getAlternativesForProgram } from "./programStore";
import { getTargets } from "./progressionStore";

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
     FROM sets WHERE workout_id = ? AND is_warmup IS NOT 1 ORDER BY created_at`,
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
  if (duration) lines.push(`${t("common.duration")}: ${duration}`);
  lines.push(`${totalSets} ${t("common.sets").toLowerCase()} | ${Math.round(totalVolume)} ${t("common.kg")} ${t("common.volume").toLowerCase()}`);
  lines.push("");

  for (const [, ex] of Object.entries(byExercise)) {
    const perSide = ex.exId && isPerSideExercise(ex.exId);
    const setsStr = ex.sets.map((s) => `${s.weight}kg${perSide ? " each" : ""} x ${s.reps}`).join(", ");
    lines.push(`${ex.name}: ${setsStr}`);
  }

  lines.push("");
  lines.push(t("share.loggedWith"));

  const message = lines.join("\n");

  await Share.share({
    message,
    title: `Gymdash - ${workout.date}`,
  });
}

/**
 * The one format a program is shared in — as copied text or as a file, from
 * the Program screen or from Settings. Carries the whole plan: days, blocks
 * (singles and supersets), alternatives and per-day targets (sets, rep range,
 * increment, auto-progress). Read back by `parseProgramImport`.
 */
export async function buildProgramSharePayload(programId: string) {
  const program = await getProgram(programId);
  if (!program) return null;
  const dayCount = program.days.length;
  const alternatives = await getAlternativesForProgram(program.id);
  const targetsByDay = await getTargets(program.id);

  const altList: { dayIndex: number; exerciseId: string; alternatives: string[] }[] = [];
  for (const [dayKey, byExercise] of Object.entries(alternatives)) {
    const dayIndex = Number(dayKey);
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= dayCount) continue;
    for (const [exerciseId, alts] of Object.entries(byExercise ?? {})) {
      if (alts?.length) altList.push({ dayIndex, exerciseId, alternatives: alts });
    }
  }

  const targets = Object.values(targetsByDay)
    .flatMap((byExercise) => Object.values(byExercise))
    .filter((tgt) => tgt.dayIndex >= 0 && tgt.dayIndex < dayCount)
    .map((tgt) => ({
      exerciseId: tgt.exerciseId,
      dayIndex: tgt.dayIndex,
      repMin: tgt.repMin,
      repMax: tgt.repMax,
      targetSets: tgt.targetSets,
      incrementKg: tgt.incrementKg,
      autoProgress: tgt.autoProgress,
    }));

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    program: { name: program.name, createdAt: program.createdAt, daysCount: dayCount },
    days: program.days.map((d, dayIndex) => ({
      dayIndex,
      name: d.name,
      blocks: d.blocks.map((b, sortIndex) => {
        if (b.type === "single") return { type: "single", exerciseId: b.exId, sortIndex };
        return b.c
          ? { type: "superset", a: b.a, b: b.b, c: b.c, sortIndex }
          : { type: "superset", a: b.a, b: b.b, sortIndex };
      }),
    })),
    alternatives: altList,
    targets,
  };
}

/** The share payload as text, for copying or writing to a file. */
export async function getShareableProgramJson(programId: string): Promise<string | null> {
  const payload = await buildProgramSharePayload(programId);
  return payload ? JSON.stringify(payload, null, 2) : null;
}

/** A file name for a shared program; program names may contain "/" and other characters a path cannot. */
export function programShareFileName(programName: string): string {
  const safe = programName.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "_").replace(/^[-_.]+|[-_.]+$/g, "");
  return `gymdash_program_${safe || "program"}.json`;
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
    common: "🏅",
    rare: "🥉",
    epic: "🥇",
    legendary: "💎",
  };
  const emoji = tierEmoji[tier] ?? "🏆";

  const message = `${emoji} ${name}\n${description}\n\n${t("share.sharedWith")}`;

  await Share.share({
    message,
    title: name,
  });
}
