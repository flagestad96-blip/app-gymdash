// src/bodyMetrics.ts — pure body-metric calculations (BMI, weight trend / phase).

import { round1 } from "./metrics";
import { isoDateOnly } from "./storage";

/** BMI to 1 decimal, or null when inputs are invalid. */
export function computeBmi(weightKg: number | null | undefined, heightCm: number): number | null {
  if (!Number.isFinite(heightCm) || heightCm <= 0) return null;
  if (!Number.isFinite(weightKg ?? NaN)) return null;
  const hM = heightCm / 100;
  return round1((weightKg as number) / (hM * hM));
}

export type WeightPhase = "bulk" | "cut" | "maintenance";
export type WeightTrend = {
  rawLabels: string[];
  rawValues: number[];
  smoothed: number[];
  phase: WeightPhase;
};

/**
 * 7-day rolling-average weight trend + a bulk/cut/maintenance phase tag derived
 * from the smoothed start-vs-end delta. Returns null with fewer than 2 metrics.
 */
export function computeWeightTrend(metrics: { date: string; weight_kg: number }[]): WeightTrend | null {
  if (metrics.length < 2) return null;
  const sorted = [...metrics].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const rawLabels = sorted.map((m) => m.date.slice(5));
  const rawValues = sorted.map((m) => m.weight_kg);

  const smoothed: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const [cy, cm, cd] = sorted[i].date.split("-").map(Number);
    const cutoff = new Date(cy, cm - 1, cd);
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffIso = isoDateOnly(cutoff);
    const window = sorted.filter((m) => m.date > cutoffIso && m.date <= sorted[i].date);
    const avg = window.reduce((sum, m) => sum + m.weight_kg, 0) / window.length;
    smoothed.push(round1(avg));
  }

  const n = Math.min(7, Math.floor(smoothed.length / 2));
  const recentAvg = smoothed.slice(-n).reduce((a, b) => a + b, 0) / n;
  const earlyAvg = smoothed.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const delta = recentAvg - earlyAvg;
  let phase: WeightPhase = "maintenance";
  if (delta > 0.5) phase = "bulk";
  else if (delta < -0.5) phase = "cut";

  return { rawLabels, rawValues, smoothed, phase };
}
