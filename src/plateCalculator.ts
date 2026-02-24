// src/plateCalculator.ts — Plate breakdown calculator + bar types

import { getSettingAsync, setSettingAsync } from "./db";

// ── Bar types ──

export type BarType = {
  id: string;
  nameKey?: string;       // i18n key for built-in bars (e.g. "plate.barOlympic")
  customName?: string;    // user-provided name for custom bars
  kg: number;
  builtIn: boolean;
};

export const BUILT_IN_BARS: BarType[] = [
  { id: "olympic",       nameKey: "plate.barOlympic",  kg: 20, builtIn: true },
  { id: "womens",        nameKey: "plate.barWomens",   kg: 15, builtIn: true },
  { id: "ez_curl",       nameKey: "plate.barEzCurl",   kg: 10, builtIn: true },
  { id: "trap_hex",      nameKey: "plate.barTrapHex",  kg: 25, builtIn: true },
  { id: "safety_squat",  nameKey: "plate.barSafety",   kg: 25, builtIn: true },
  { id: "smith",         nameKey: "plate.barSmith",    kg: 0,  builtIn: true },
];

const SETTINGS_CUSTOM_BARS = "customBars";
const SETTINGS_EXERCISE_BAR = "exerciseBarPrefs";

/** Load custom bars from settings */
export async function loadCustomBars(): Promise<BarType[]> {
  try {
    const raw = await getSettingAsync(SETTINGS_CUSTOM_BARS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((b: any) => ({ id: b.id, customName: b.customName, kg: b.kg, builtIn: false }));
  } catch {}
  return [];
}

/** Save custom bars to settings */
export async function saveCustomBars(bars: BarType[]): Promise<void> {
  await setSettingAsync(SETTINGS_CUSTOM_BARS, JSON.stringify(bars.map((b) => ({ id: b.id, customName: b.customName, kg: b.kg }))));
}

/** Load per-exercise bar preferences: { [exerciseId]: barId } */
export async function loadExerciseBarPrefs(): Promise<Record<string, string>> {
  try {
    const raw = await getSettingAsync(SETTINGS_EXERCISE_BAR);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {}
  return {};
}

/** Save per-exercise bar preference */
export async function saveExerciseBarPref(exerciseId: string, barId: string): Promise<void> {
  const prefs = await loadExerciseBarPrefs();
  prefs[exerciseId] = barId;
  await setSettingAsync(SETTINGS_EXERCISE_BAR, JSON.stringify(prefs));
}

// ── Plate calculation ──

export type PlateEntry = {
  weight: number;
  count: number; // per side
};

export type PlateResult = {
  plates: PlateEntry[];
  barWeight: number;
  totalWeight: number;
  achievable: boolean;
};

const DEFAULT_BAR_KG = 20;
export const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

/**
 * Calculate plate breakdown for a target weight.
 * All values in kg internally.
 * Greedy algorithm: subtract bar, divide by 2 (per side), fill largest plates first.
 */
export function calculatePlates(
  targetKg: number,
  barWeight: number = DEFAULT_BAR_KG,
  availablePlates: number[] = DEFAULT_PLATES_KG
): PlateResult {
  const result: PlateEntry[] = [];

  if (targetKg <= barWeight) {
    return {
      plates: [],
      barWeight,
      totalWeight: barWeight,
      achievable: targetKg === barWeight,
    };
  }

  let remaining = (targetKg - barWeight) / 2; // per side
  const sorted = [...availablePlates].sort((a, b) => b - a);

  for (const plate of sorted) {
    if (remaining < plate) continue;
    const count = Math.floor(remaining / plate);
    if (count > 0) {
      result.push({ weight: plate, count });
      remaining -= plate * count;
    }
  }

  // Round to avoid floating point issues
  remaining = Math.round(remaining * 1000) / 1000;
  const totalLoaded = result.reduce((sum, p) => sum + p.weight * p.count, 0) * 2 + barWeight;

  return {
    plates: result,
    barWeight,
    totalWeight: Math.round(totalLoaded * 100) / 100,
    achievable: remaining === 0,
  };
}

/** Color for each plate weight (for visual display) */
export function plateColor(weightKg: number): string {
  if (weightKg >= 25) return "#E53935"; // red
  if (weightKg >= 20) return "#1E88E5"; // blue
  if (weightKg >= 15) return "#FDD835"; // yellow
  if (weightKg >= 10) return "#43A047"; // green
  if (weightKg >= 5) return "#FFFFFF";  // white
  if (weightKg >= 2.5) return "#E53935"; // red (small)
  return "#757575"; // grey
}
