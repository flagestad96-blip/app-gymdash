// src/achievements.ts
// Achievement system with gamification

import { ensureDb, getDb } from "./db";

export type AchievementCategory =
  | "milestone" // First workout, workout milestones
  | "strength" // Weight thresholds
  | "pr" // Personal records
  | "volume" // Volume milestones
  | "streak" // Consistency
  | "social"; // Time-based fun achievements

export type AchievementTier = "common" | "rare" | "epic" | "legendary";

export type RequirementType =
  | "workout_count"
  | "pr_count"
  | "weight_threshold"
  | "volume_workout"
  | "volume_week"
  | "volume_lifetime"
  | "streak"
  | "time_of_day"
  | "weekend_count";

export type Achievement = {
  id: string;
  category: AchievementCategory;
  name: string;
  description: string;
  icon: string;
  requirementType: RequirementType;
  requirementValue: number;
  requirementExerciseId?: string | null;
  tier: AchievementTier;
  points: number;
  createdAt: string;
};

export type UserAchievement = {
  id: string;
  achievementId: string;
  unlockedAt: string;
  workoutId?: string | null;
  setId?: string | null;
  valueAchieved?: number | null;
};

export type AchievementContext = {
  workoutId?: string;
  setId?: string;
  exerciseId?: string;
  weight?: number;
  reps?: number;
  workoutDate?: string;
};

/**
 * Default achievements seeded into the database
 */
const DEFAULT_ACHIEVEMENTS: Omit<Achievement, "createdAt">[] = [
  // Milestones
  {
    id: "first_workout",
    category: "milestone",
    name: "First Steps",
    description: "Complete your first workout",
    icon: "fitness-center",
    requirementType: "workout_count",
    requirementValue: 1,
    tier: "common",
    points: 10,
  },
  {
    id: "workout_10",
    category: "milestone",
    name: "Getting Started",
    description: "Complete 10 workouts",
    icon: "self-improvement",
    requirementType: "workout_count",
    requirementValue: 10,
    tier: "common",
    points: 20,
  },
  {
    id: "workout_50",
    category: "milestone",
    name: "Committed",
    description: "Complete 50 workouts",
    icon: "trending-up",
    requirementType: "workout_count",
    requirementValue: 50,
    tier: "rare",
    points: 50,
  },
  {
    id: "workout_100",
    category: "milestone",
    name: "Century Club",
    description: "Complete 100 workouts",
    icon: "emoji-events",
    requirementType: "workout_count",
    requirementValue: 100,
    tier: "epic",
    points: 100,
  },
  {
    id: "workout_365",
    category: "milestone",
    name: "Year of Iron",
    description: "Complete 365 workouts",
    icon: "military-tech",
    requirementType: "workout_count",
    requirementValue: 365,
    tier: "legendary",
    points: 500,
  },

  // Strength
  {
    id: "bench_100kg",
    category: "strength",
    name: "Plate Pusher",
    description: "Bench press 100kg",
    icon: "fitness-center",
    requirementType: "weight_threshold",
    requirementValue: 100,
    requirementExerciseId: "bench_press",
    tier: "rare",
    points: 50,
  },
  {
    id: "squat_150kg",
    category: "strength",
    name: "Leg Legend",
    description: "Squat 150kg",
    icon: "fitness-center",
    requirementType: "weight_threshold",
    requirementValue: 150,
    requirementExerciseId: "back_squat",
    tier: "epic",
    points: 75,
  },
  {
    id: "deadlift_200kg",
    category: "strength",
    name: "Back Breaker",
    description: "Deadlift 200kg",
    icon: "fitness-center",
    requirementType: "weight_threshold",
    requirementValue: 200,
    requirementExerciseId: "deadlift",
    tier: "epic",
    points: 100,
  },
  {
    id: "pullup_10",
    category: "strength",
    name: "Chin Up Champion",
    description: "10 pull-ups in one set",
    icon: "fitness-center",
    requirementType: "weight_threshold",
    requirementValue: 10,
    requirementExerciseId: "pull_up",
    tier: "rare",
    points: 40,
  },

  // PRs
  {
    id: "first_pr",
    category: "pr",
    name: "Personal Best",
    description: "Set your first PR",
    icon: "star",
    requirementType: "pr_count",
    requirementValue: 1,
    tier: "common",
    points: 10,
  },
  {
    id: "pr_10",
    category: "pr",
    name: "Record Setter",
    description: "Set 10 PRs",
    icon: "stars",
    requirementType: "pr_count",
    requirementValue: 10,
    tier: "rare",
    points: 50,
  },
  {
    id: "pr_50",
    category: "pr",
    name: "Unstoppable",
    description: "Set 50 PRs",
    icon: "auto-awesome",
    requirementType: "pr_count",
    requirementValue: 50,
    tier: "epic",
    points: 150,
  },

  // Volume
  {
    id: "volume_10k",
    category: "volume",
    name: "Heavy Lifter",
    description: "Lift 10,000kg in one workout",
    icon: "fitness-center",
    requirementType: "volume_workout",
    requirementValue: 10000,
    tier: "rare",
    points: 50,
  },
  {
    id: "volume_50k_week",
    category: "volume",
    name: "Volume King",
    description: "Lift 50,000kg in one week",
    icon: "trending-up",
    requirementType: "volume_week",
    requirementValue: 50000,
    tier: "epic",
    points: 100,
  },
  {
    id: "volume_1m_lifetime",
    category: "volume",
    name: "Million Pound Club",
    description: "Lift 1,000,000kg lifetime",
    icon: "emoji-events",
    requirementType: "volume_lifetime",
    requirementValue: 1000000,
    tier: "legendary",
    points: 500,
  },

  // Streaks
  {
    id: "streak_7",
    category: "streak",
    name: "Week Warrior",
    description: "7-day workout streak",
    icon: "local-fire-department",
    requirementType: "streak",
    requirementValue: 7,
    tier: "rare",
    points: 40,
  },
  {
    id: "streak_30",
    category: "streak",
    name: "Monthly Master",
    description: "30-day workout streak",
    icon: "whatshot",
    requirementType: "streak",
    requirementValue: 30,
    tier: "epic",
    points: 150,
  },
  {
    id: "streak_100",
    category: "streak",
    name: "Unbreakable",
    description: "100-day workout streak",
    icon: "military-tech",
    requirementType: "streak",
    requirementValue: 100,
    tier: "legendary",
    points: 500,
  },

  // Social/Fun
  {
    id: "morning_bird",
    category: "social",
    name: "Early Riser",
    description: "Complete a workout before 8am",
    icon: "wb-sunny",
    requirementType: "time_of_day",
    requirementValue: 8,
    tier: "common",
    points: 15,
  },
  {
    id: "night_owl",
    category: "social",
    name: "Night Grinder",
    description: "Complete a workout after 10pm",
    icon: "nightlight",
    requirementType: "time_of_day",
    requirementValue: 22,
    tier: "common",
    points: 15,
  },
  {
    id: "weekend_warrior",
    category: "social",
    name: "Weekend Legend",
    description: "Complete 10 weekend workouts",
    icon: "celebration",
    requirementType: "weekend_count",
    requirementValue: 10,
    tier: "common",
    points: 30,
  },
];

/**
 * Seed default achievements into the database
 */
export async function seedAchievements(opts?: { skipEnsure?: boolean }): Promise<void> {
  if (!opts?.skipEnsure) {
    await ensureDb();
  }
  const db = getDb();
  const now = new Date().toISOString();

  for (const achievement of DEFAULT_ACHIEVEMENTS) {
    try {
      await db.runAsync(
        `INSERT OR IGNORE INTO achievements (
          id, category, name, description, icon, requirement_type,
          requirement_value, requirement_exercise_id, tier, points, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          achievement.id,
          achievement.category,
          achievement.name,
          achievement.description,
          achievement.icon,
          achievement.requirementType,
          achievement.requirementValue,
          achievement.requirementExerciseId ?? null,
          achievement.tier,
          achievement.points,
          now,
        ]
      );
    } catch (error) {
      console.error(`Failed to seed achievement ${achievement.id}:`, error);
    }
  }
}

/**
 * Get all achievements
 */
export async function getAllAchievements(): Promise<Achievement[]> {
  await ensureDb();
  const db = getDb();

  const rows = await db.getAllAsync<{
    id: string;
    category: string;
    name: string;
    description: string;
    icon: string;
    requirement_type: string;
    requirement_value: number;
    requirement_exercise_id?: string | null;
    tier: string;
    points: number;
    created_at: string;
  }>(`SELECT * FROM achievements ORDER BY points ASC, name ASC`);

  return (rows ?? []).map((row) => ({
    id: row.id,
    category: row.category as AchievementCategory,
    name: row.name,
    description: row.description,
    icon: row.icon,
    requirementType: row.requirement_type as RequirementType,
    requirementValue: row.requirement_value,
    requirementExerciseId: row.requirement_exercise_id,
    tier: row.tier as AchievementTier,
    points: row.points,
    createdAt: row.created_at,
  }));
}

/**
 * Get user's unlocked achievements
 */
export async function getUserAchievements(): Promise<UserAchievement[]> {
  await ensureDb();
  const db = getDb();

  const rows = await db.getAllAsync<{
    id: string;
    achievement_id: string;
    unlocked_at: string;
    workout_id?: string | null;
    set_id?: string | null;
    value_achieved?: number | null;
  }>(`SELECT * FROM user_achievements ORDER BY unlocked_at DESC`);

  return (rows ?? []).map((row) => ({
    id: row.id,
    achievementId: row.achievement_id,
    unlockedAt: row.unlocked_at,
    workoutId: row.workout_id,
    setId: row.set_id,
    valueAchieved: row.value_achieved,
  }));
}

/**
 * Check if an achievement is unlocked
 */
export async function isAchievementUnlocked(achievementId: string): Promise<boolean> {
  await ensureDb();
  const db = getDb();

  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM user_achievements WHERE achievement_id = ?`,
    [achievementId]
  );

  return (row?.count ?? 0) > 0;
}

/**
 * Unlock an achievement
 */
export async function unlockAchievement(
  achievementId: string,
  context: AchievementContext = {}
): Promise<void> {
  await ensureDb();
  const db = getDb();

  // Check if already unlocked
  if (await isAchievementUnlocked(achievementId)) {
    return;
  }

  const now = new Date().toISOString();
  const id = `ua_${achievementId}_${Date.now()}`;

  await db.runAsync(
    `INSERT INTO user_achievements (
      id, achievement_id, unlocked_at, workout_id, set_id, value_achieved
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      achievementId,
      now,
      context.workoutId ?? null,
      context.setId ?? null,
      context.weight ?? context.reps ?? null,
    ]
  );
}

/**
 * Get total workout count
 */
async function getWorkoutCount(): Promise<number> {
  const db = getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(DISTINCT id) as count FROM workouts`
  );
  return row?.count ?? 0;
}

/**
 * Get total PR count
 */
async function getPRCount(): Promise<number> {
  const db = getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM pr_records`
  );
  return row?.count ?? 0;
}

/**
 * Check if a weight threshold is met for an exercise
 */
async function checkWeightThreshold(exerciseId: string, threshold: number): Promise<boolean> {
  const db = getDb();
  const row = await db.getFirstAsync<{ max_weight: number | null }>(
    `SELECT MAX(weight) as max_weight FROM sets WHERE exercise_id = ? AND is_warmup IS NOT 1`,
    [exerciseId]
  );
  return (row?.max_weight ?? 0) >= threshold;
}

/**
 * Get current workout streak
 */
async function getCurrentStreak(): Promise<number> {
  const db = getDb();
  const rows = await db.getAllAsync<{ date: string }>(
    `SELECT DISTINCT date FROM workouts ORDER BY date DESC`
  );

  if (!rows || rows.length === 0) return 0;

  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  for (const row of rows) {
    const workoutDate = new Date(row.date);
    workoutDate.setHours(0, 0, 0, 0);

    const dayDiff = Math.floor((currentDate.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24));

    if (dayDiff === streak) {
      streak++;
      currentDate = workoutDate;
    } else if (dayDiff > streak) {
      break;
    }
  }

  return streak;
}

/**
 * Check all achievements and unlock any that are newly met
 */
export async function checkAndUnlockAchievements(context: AchievementContext = {}): Promise<Achievement[]> {
  await ensureDb();
  const achievements = await getAllAchievements();
  const unlocked: Achievement[] = [];

  for (const achievement of achievements) {
    // Skip if already unlocked
    if (await isAchievementUnlocked(achievement.id)) {
      continue;
    }

    let shouldUnlock = false;

    switch (achievement.requirementType) {
      case "workout_count":
        const workoutCount = await getWorkoutCount();
        shouldUnlock = workoutCount >= achievement.requirementValue;
        break;

      case "pr_count":
        const prCount = await getPRCount();
        shouldUnlock = prCount >= achievement.requirementValue;
        break;

      case "weight_threshold":
        if (achievement.requirementExerciseId) {
          shouldUnlock = await checkWeightThreshold(
            achievement.requirementExerciseId,
            achievement.requirementValue
          );
        }
        break;

      case "streak":
        const currentStreak = await getCurrentStreak();
        shouldUnlock = currentStreak >= achievement.requirementValue;
        break;

      // Add more requirement type checks as needed
      default:
        break;
    }

    if (shouldUnlock) {
      await unlockAchievement(achievement.id, context);
      unlocked.push(achievement);
    }
  }

  return unlocked;
}

/**
 * Get user's total achievement points
 */
export async function getTotalPoints(): Promise<number> {
  await ensureDb();
  const db = getDb();

  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(a.points) as total
     FROM user_achievements ua
     JOIN achievements a ON ua.achievement_id = a.id`
  );

  return row?.total ?? 0;
}

/**
 * Get achievement progress (locked vs unlocked counts by tier)
 */
export async function getAchievementProgress(): Promise<{
  total: number;
  unlocked: number;
  byTier: Record<AchievementTier, { total: number; unlocked: number }>;
}> {
  await ensureDb();
  const db = getDb();

  const all = await getAllAchievements();
  const unlocked = await getUserAchievements();
  const unlockedIds = new Set(unlocked.map((ua) => ua.achievementId));

  const byTier: Record<AchievementTier, { total: number; unlocked: number }> = {
    common: { total: 0, unlocked: 0 },
    rare: { total: 0, unlocked: 0 },
    epic: { total: 0, unlocked: 0 },
    legendary: { total: 0, unlocked: 0 },
  };

  for (const achievement of all) {
    byTier[achievement.tier].total++;
    if (unlockedIds.has(achievement.id)) {
      byTier[achievement.tier].unlocked++;
    }
  }

  return {
    total: all.length,
    unlocked: unlocked.length,
    byTier,
  };
}
