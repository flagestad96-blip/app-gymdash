// src/plateCalculator.ts — Plate breakdown calculator

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
const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

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
