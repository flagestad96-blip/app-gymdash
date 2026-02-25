// src/analysisInsights.ts
// Pure function — no DB calls, no React imports.

export type InsightResult = {
  key: string;
  params?: Record<string, string | number>;
};

/**
 * Generate a one-sentence exercise insight based on e1RM % change and RPE delta.
 *
 * Decision tree (8 branches):
 *   e1RM up   + RPE down  → strongAndEasy
 *   e1RM up   + RPE up    → strongButHarder
 *   e1RM up   + RPE flat  → strongStableRpe
 *   e1RM flat + RPE down  → flatButEasier
 *   e1RM flat + RPE up    → flatAndHard
 *   e1RM flat + RPE flat  → plateau
 *   e1RM down (any RPE)   → decliningFatigued
 *   sessionCount < 2      → notEnoughData (with {n} param)
 *
 * Thresholds:
 *   e1RM "up"   = e1rmPctChange >  2.0
 *   e1RM "down" = e1rmPctChange < -2.0
 *   e1RM "flat" = -2.0 to +2.0
 *   RPE  "up"   = rpeDelta > 0.3
 *   RPE  "down" = rpeDelta < -0.3
 *   RPE  "flat" = -0.3 to +0.3
 */
export function generateExerciseInsight(input: {
  e1rmPctChange: number | null;
  rpeDelta: number | null;
  sessionCount: number;
}): InsightResult {
  const { e1rmPctChange, rpeDelta, sessionCount } = input;

  // Not enough data — need at least 2 sessions to split early/late halves
  if (sessionCount < 2 || e1rmPctChange === null) {
    const needed = Math.max(0, 2 - sessionCount);
    return { key: "analysis.insight.notEnoughData", params: { n: needed } };
  }

  const e1rmUp   = e1rmPctChange >  2.0;
  const e1rmDown = e1rmPctChange < -2.0;
  // e1rmFlat = neither up nor down

  const rpeUp   = rpeDelta !== null && rpeDelta >  0.3;
  const rpeDown = rpeDelta !== null && rpeDelta < -0.3;
  // rpeFlat = neither up nor down (or rpeDelta is null)

  if (e1rmDown) {
    return { key: "analysis.insight.decliningFatigued" };
  }

  if (e1rmUp && rpeDown) {
    return { key: "analysis.insight.strongAndEasy" };
  }

  if (e1rmUp && rpeUp) {
    return { key: "analysis.insight.strongButHarder" };
  }

  if (e1rmUp) {
    // RPE flat or null
    return { key: "analysis.insight.strongStableRpe" };
  }

  // e1RM flat from here
  if (rpeDown) {
    return { key: "analysis.insight.flatButEasier" };
  }

  if (rpeUp) {
    return { key: "analysis.insight.flatAndHard" };
  }

  // e1RM flat + RPE flat (or no RPE data)
  return { key: "analysis.insight.plateau" };
}
