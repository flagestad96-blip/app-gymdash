// src/periodization.ts — Training periodization (mesocycles + deload)
import { ensureDb, getDb } from "./db";

export type Periodization = {
  enabled: boolean;
  cycleWeeks: number;     // e.g. 4
  deloadEvery: number;    // e.g. 4 (deload on week N)
  deloadPercent: number;  // e.g. 60 (use 60% of normal weight)
  currentWeek: number;    // 1-based
  manualDeload?: boolean; // manual deload override (drop 1 set per exercise)
};

const DEFAULT_PERIODIZATION: Periodization = {
  enabled: false,
  cycleWeeks: 4,
  deloadEvery: 4,
  deloadPercent: 60,
  currentWeek: 1,
};

/**
 * Get the periodization config for a program.
 * Returns null if the program has no periodization configured.
 */
export async function getPeriodization(programId: string): Promise<Periodization | null> {
  await ensureDb();
  const row = await getDb().getFirstAsync<{ periodization_json: string | null }>(
    `SELECT periodization_json FROM programs WHERE id = ?`,
    [programId]
  );
  if (!row?.periodization_json) return null;
  try {
    const parsed = JSON.parse(row.periodization_json);
    return {
      enabled: !!parsed.enabled,
      cycleWeeks: Number(parsed.cycleWeeks) || 4,
      deloadEvery: Number(parsed.deloadEvery) || 4,
      deloadPercent: Number(parsed.deloadPercent) || 60,
      currentWeek: Number(parsed.currentWeek) || 1,
      manualDeload: !!parsed.manualDeload,
    };
  } catch {
    return null;
  }
}

/**
 * Save periodization config for a program.
 */
export async function savePeriodization(programId: string, config: Periodization): Promise<void> {
  await ensureDb();
  const json = JSON.stringify(config);
  await getDb().runAsync(
    `UPDATE programs SET periodization_json = ? WHERE id = ?`,
    [json, programId]
  );
}

/**
 * Advance to the next week in the cycle. Wraps around at cycleWeeks.
 */
export async function advanceWeek(programId: string): Promise<Periodization | null> {
  const config = await getPeriodization(programId);
  if (!config || !config.enabled) return config;

  const nextWeek = config.currentWeek >= config.cycleWeeks ? 1 : config.currentWeek + 1;
  const updated = { ...config, currentWeek: nextWeek };
  await savePeriodization(programId, updated);
  return updated;
}

/**
 * Check if the current week is a deload week.
 */
export function isDeloadWeek(config: Periodization): boolean {
  if (config.manualDeload) return true;
  if (!config.enabled) return false;
  return config.currentWeek === config.deloadEvery;
}

/**
 * Calculate the deloaded weight for a given normal weight.
 */
export function deloadWeight(weight: number, config: Periodization): number {
  if (!config.enabled || !isDeloadWeek(config)) return weight;
  return Math.round((weight * config.deloadPercent) / 100 * 2) / 2; // Round to 0.5
}

/**
 * Toggle manual deload on/off for a program.
 * Creates a periodization entry if none exists.
 */
export async function toggleManualDeload(programId: string): Promise<boolean> {
  let config = await getPeriodization(programId);
  if (!config) {
    config = { ...DEFAULT_PERIODIZATION, manualDeload: true };
  } else {
    config = { ...config, manualDeload: !config.manualDeload };
  }
  await savePeriodization(programId, config);
  return !!config.manualDeload;
}

/**
 * Get default periodization config (not enabled by default).
 */
export function getDefaultPeriodization(): Periodization {
  return { ...DEFAULT_PERIODIZATION };
}
