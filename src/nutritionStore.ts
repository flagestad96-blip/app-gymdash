// src/nutritionStore.ts — Meal logging CRUD + daily/weekly aggregations
import { ensureDb, getDb } from "./db";
import { uid, isoDateOnly, isoNow } from "./storage";

// ── Types ──

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export type Meal = {
  id: string;
  date: string;
  mealType: MealType;
  name: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  notes: string | null;
  createdAt: string;
};

export type CreateMealInput = {
  date: string;
  mealType: MealType;
  name?: string | null;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  notes?: string | null;
};

export type UpdateMealInput = Partial<Omit<CreateMealInput, "date">> & { date?: string };

export type MacroTotals = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type DailyTotals = MacroTotals & {
  date: string;
  mealCount: number;
};

export type WeeklySummary = {
  startDate: string;
  endDate: string;
  daysWithLogs: number;
  totals: MacroTotals;
  averages: MacroTotals;
};

// ── Row mapping ──

type MealRow = {
  id: string;
  date: string;
  meal_type: string;
  name: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  notes: string | null;
  created_at: string;
};

function clampNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

function rowToMeal(row: MealRow): Meal {
  const t = row.meal_type as MealType;
  const mealType: MealType = MEAL_TYPES.includes(t) ? t : "snack";
  return {
    id: row.id,
    date: row.date,
    mealType,
    name: row.name,
    calories: clampNumber(row.calories),
    proteinG: clampNumber(row.protein_g),
    carbsG: clampNumber(row.carbs_g),
    fatG: clampNumber(row.fat_g),
    notes: row.notes,
    createdAt: row.created_at,
  };
}

// ── CRUD ──

export async function listMealsByDate(date: string): Promise<Meal[]> {
  await ensureDb();
  try {
    const rows = await getDb().getAllAsync<MealRow>(
      `SELECT id, date, meal_type, name, calories, protein_g, carbs_g, fat_g, notes, created_at
       FROM meals WHERE date = ? ORDER BY created_at ASC`,
      [date]
    );
    return (rows ?? []).map(rowToMeal);
  } catch {
    return [];
  }
}

export async function listMealsBetween(startDate: string, endDate: string): Promise<Meal[]> {
  await ensureDb();
  try {
    const rows = await getDb().getAllAsync<MealRow>(
      `SELECT id, date, meal_type, name, calories, protein_g, carbs_g, fat_g, notes, created_at
       FROM meals WHERE date >= ? AND date <= ? ORDER BY date ASC, created_at ASC`,
      [startDate, endDate]
    );
    return (rows ?? []).map(rowToMeal);
  } catch {
    return [];
  }
}

export async function getMeal(id: string): Promise<Meal | null> {
  await ensureDb();
  try {
    const row = await getDb().getFirstAsync<MealRow>(
      `SELECT id, date, meal_type, name, calories, protein_g, carbs_g, fat_g, notes, created_at
       FROM meals WHERE id = ? LIMIT 1`,
      [id]
    );
    return row ? rowToMeal(row) : null;
  } catch {
    return null;
  }
}

export async function createMeal(input: CreateMealInput): Promise<Meal> {
  await ensureDb();
  const id = uid("meal");
  const now = isoNow();
  await getDb().runAsync(
    `INSERT INTO meals(id, date, meal_type, name, calories, protein_g, carbs_g, fat_g, notes, created_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.date,
      input.mealType,
      input.name ?? null,
      clampNumber(input.calories),
      clampNumber(input.proteinG),
      clampNumber(input.carbsG),
      clampNumber(input.fatG),
      input.notes ?? null,
      now,
    ]
  );
  const meal = await getMeal(id);
  if (!meal) throw new Error(`createMeal: failed to read back meal ${id}`);
  return meal;
}

export async function updateMeal(id: string, input: UpdateMealInput): Promise<Meal | null> {
  await ensureDb();
  const existing = await getMeal(id);
  if (!existing) return null;
  const date = input.date ?? existing.date;
  const mealType = input.mealType ?? existing.mealType;
  const name = "name" in input ? (input.name ?? null) : existing.name;
  const calories = clampNumber(input.calories ?? existing.calories);
  const proteinG = clampNumber(input.proteinG ?? existing.proteinG);
  const carbsG = clampNumber(input.carbsG ?? existing.carbsG);
  const fatG = clampNumber(input.fatG ?? existing.fatG);
  const notes = "notes" in input ? (input.notes ?? null) : existing.notes;
  await getDb().runAsync(
    `UPDATE meals SET date=?, meal_type=?, name=?, calories=?, protein_g=?, carbs_g=?, fat_g=?, notes=? WHERE id=?`,
    [date, mealType, name, calories, proteinG, carbsG, fatG, notes, id]
  );
  return getMeal(id);
}

export async function deleteMeal(id: string): Promise<void> {
  await ensureDb();
  try {
    await getDb().runAsync(`DELETE FROM meals WHERE id = ?`, [id]);
  } catch {
    // Silent fail
  }
}

// ── Aggregation helpers ──

const ZERO_TOTALS: MacroTotals = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };

export function sumMacros(meals: Meal[]): MacroTotals {
  return meals.reduce<MacroTotals>(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      proteinG: acc.proteinG + m.proteinG,
      carbsG: acc.carbsG + m.carbsG,
      fatG: acc.fatG + m.fatG,
    }),
    { ...ZERO_TOTALS }
  );
}

export async function getDailyTotals(date: string): Promise<DailyTotals> {
  const meals = await listMealsByDate(date);
  const totals = sumMacros(meals);
  return {
    date,
    mealCount: meals.length,
    ...totals,
  };
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return isoDateOnly(dt);
}

/** Returns weekly summary for the 7-day window ending on (and including) `endDate`. */
export async function getWeeklySummary(endDate: string = isoDateOnly()): Promise<WeeklySummary> {
  const startDate = addDays(endDate, -6);
  const meals = await listMealsBetween(startDate, endDate);
  const totals = sumMacros(meals);
  const daysWithLogs = new Set(meals.map((m) => m.date)).size;
  const divisor = Math.max(1, daysWithLogs);
  return {
    startDate,
    endDate,
    daysWithLogs,
    totals,
    averages: {
      calories: totals.calories / divisor,
      proteinG: totals.proteinG / divisor,
      carbsG: totals.carbsG / divisor,
      fatG: totals.fatG / divisor,
    },
  };
}

/** Returns array of daily totals over the past `days` days (oldest first). */
export async function getDailyTotalsRange(days: number = 7, endDate: string = isoDateOnly()): Promise<DailyTotals[]> {
  const span = Math.max(1, Math.trunc(days));
  const startDate = addDays(endDate, -(span - 1));
  const meals = await listMealsBetween(startDate, endDate);

  const buckets = new Map<string, MacroTotals & { count: number }>();
  for (const m of meals) {
    const cur = buckets.get(m.date) ?? { ...ZERO_TOTALS, count: 0 };
    cur.calories += m.calories;
    cur.proteinG += m.proteinG;
    cur.carbsG += m.carbsG;
    cur.fatG += m.fatG;
    cur.count += 1;
    buckets.set(m.date, cur);
  }

  const out: DailyTotals[] = [];
  for (let i = 0; i < span; i++) {
    const date = addDays(startDate, i);
    const b = buckets.get(date);
    out.push({
      date,
      mealCount: b?.count ?? 0,
      calories: b?.calories ?? 0,
      proteinG: b?.proteinG ?? 0,
      carbsG: b?.carbsG ?? 0,
      fatG: b?.fatG ?? 0,
    });
  }
  return out;
}
