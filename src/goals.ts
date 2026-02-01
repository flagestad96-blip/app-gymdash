// src/goals.ts — Exercise goal tracking
import { ensureDb, getDb } from "./db";

export type GoalType = "weight" | "volume" | "reps";

export type ExerciseGoal = {
  id: string;
  exerciseId: string;
  goalType: GoalType;
  targetValue: number;
  createdAt: string;
  achievedAt: string | null;
  programId: string;
};

function isoNow() {
  return new Date().toISOString();
}

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

type GoalRow = {
  id: string;
  exercise_id: string;
  goal_type: string;
  target_value: number;
  created_at: string;
  achieved_at: string | null;
  program_id: string;
};

function rowToGoal(r: GoalRow): ExerciseGoal {
  return {
    id: r.id,
    exerciseId: r.exercise_id,
    goalType: r.goal_type as GoalType,
    targetValue: r.target_value,
    createdAt: r.created_at,
    achievedAt: r.achieved_at,
    programId: r.program_id,
  };
}

export async function createGoal(
  exerciseId: string,
  goalType: GoalType,
  targetValue: number,
  programId: string
): Promise<string> {
  await ensureDb();
  const id = uid("goal");
  await getDb().runAsync(
    `INSERT INTO exercise_goals (id, exercise_id, goal_type, target_value, created_at, achieved_at, program_id)
     VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    [id, exerciseId, goalType, targetValue, isoNow(), programId]
  );
  return id;
}

export async function getActiveGoals(programId: string): Promise<ExerciseGoal[]> {
  await ensureDb();
  const rows = await getDb().getAllAsync<GoalRow>(
    `SELECT id, exercise_id, goal_type, target_value, created_at, achieved_at, program_id
     FROM exercise_goals
     WHERE program_id = ? AND achieved_at IS NULL
     ORDER BY created_at DESC`,
    [programId]
  );
  return (rows ?? []).map(rowToGoal);
}

export async function getGoalsForExercise(
  exerciseId: string,
  programId: string
): Promise<ExerciseGoal[]> {
  await ensureDb();
  const rows = await getDb().getAllAsync<GoalRow>(
    `SELECT id, exercise_id, goal_type, target_value, created_at, achieved_at, program_id
     FROM exercise_goals
     WHERE exercise_id = ? AND program_id = ?
     ORDER BY created_at DESC`,
    [exerciseId, programId]
  );
  return (rows ?? []).map(rowToGoal);
}

export async function markGoalAchieved(goalId: string): Promise<void> {
  await ensureDb();
  await getDb().runAsync(
    `UPDATE exercise_goals SET achieved_at = ? WHERE id = ?`,
    [isoNow(), goalId]
  );
}

export async function deleteGoal(goalId: string): Promise<void> {
  await ensureDb();
  await getDb().runAsync(`DELETE FROM exercise_goals WHERE id = ?`, [goalId]);
}

export async function checkGoalAchievement(goal: ExerciseGoal): Promise<boolean> {
  await ensureDb();
  const db = getDb();

  if (goal.goalType === "weight") {
    const pr = await db.getFirstAsync<{ value: number }>(
      `SELECT MAX(value) as value FROM pr_records
       WHERE exercise_id = ? AND type = 'heaviest'`,
      [goal.exerciseId]
    );
    return pr ? (pr.value ?? 0) >= goal.targetValue : false;
  }

  if (goal.goalType === "volume") {
    const pr = await db.getFirstAsync<{ value: number }>(
      `SELECT MAX(value) as value FROM pr_records
       WHERE exercise_id = ? AND type = 'volume'`,
      [goal.exerciseId]
    );
    return pr ? (pr.value ?? 0) >= goal.targetValue : false;
  }

  if (goal.goalType === "reps") {
    const maxReps = await db.getFirstAsync<{ max_reps: number }>(
      `SELECT MAX(reps) as max_reps FROM sets
       WHERE exercise_id = ? AND is_warmup = 0`,
      [goal.exerciseId]
    );
    return maxReps ? (maxReps.max_reps ?? 0) >= goal.targetValue : false;
  }

  return false;
}

export async function autoCheckGoals(programId: string): Promise<string[]> {
  const activeGoals = await getActiveGoals(programId);
  const achievedIds: string[] = [];
  for (const goal of activeGoals) {
    const isAchieved = await checkGoalAchievement(goal);
    if (isAchieved) {
      await markGoalAchieved(goal.id);
      achievedIds.push(goal.id);
    }
  }
  return achievedIds;
}

/** Get current value for a goal (for progress display) */
export async function getCurrentValueForGoal(goal: ExerciseGoal): Promise<number> {
  await ensureDb();
  const db = getDb();

  if (goal.goalType === "weight") {
    const pr = await db.getFirstAsync<{ value: number }>(
      `SELECT MAX(value) as value FROM pr_records
       WHERE exercise_id = ? AND type = 'heaviest'`,
      [goal.exerciseId]
    );
    return pr?.value ?? 0;
  }

  if (goal.goalType === "volume") {
    const pr = await db.getFirstAsync<{ value: number }>(
      `SELECT MAX(value) as value FROM pr_records
       WHERE exercise_id = ? AND type = 'volume'`,
      [goal.exerciseId]
    );
    return pr?.value ?? 0;
  }

  if (goal.goalType === "reps") {
    const maxReps = await db.getFirstAsync<{ max_reps: number }>(
      `SELECT MAX(reps) as max_reps FROM sets
       WHERE exercise_id = ? AND is_warmup = 0`,
      [goal.exerciseId]
    );
    return maxReps?.max_reps ?? 0;
  }

  return 0;
}
