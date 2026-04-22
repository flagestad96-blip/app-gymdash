// src/userPreferences.ts — Onboarding-derived user preferences (goals + training days).
//
// The onboarding flow asks two questions that shape the rest of the app:
//   • What are you chasing?  (one or more goals)
//   • How often will you train?  (1–7 days per week)
//
// Those answers are stored here, and screens consume them via `useUserPreferences()`.
// The Home screen uses the *primary* goal to re-prioritize which cards appear first.

import { useState, useEffect } from "react";
import { getSettingAsync, setSettingAsync } from "./db";

// ── Types ────────────────────────────────────────────────────────────────────

export type UserGoal =
  | "strength"      // build strength — PR-focused
  | "endurance"     // improve endurance — volume/duration focused
  | "weight"        // lose weight — frequency/consistency focused
  | "mobility"      // move better — back-impact/recovery focused
  | "consistency";  // show up — streak focused

export const USER_GOAL_LIST: UserGoal[] = [
  "strength",
  "endurance",
  "weight",
  "mobility",
  "consistency",
];

export type UserPreferences = {
  goals: UserGoal[];
  /** Preferred training days per week (1–7). */
  trainingDays: number;
  /** True once the onboarding flow has been completed. */
  onboardingCompleted: boolean;
};

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_PREFS: UserPreferences = {
  goals: ["strength"],
  trainingDays: 4,
  onboardingCompleted: false,
};

// ── Storage keys ─────────────────────────────────────────────────────────────

const KEY_GOALS = "user_goals";
const KEY_DAYS = "user_training_days";
const KEY_COMPLETED = "onboarding_completed";

// ── In-memory state + listeners (matches units.ts pattern) ───────────────────

let current: UserPreferences = { ...DEFAULT_PREFS };
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((cb) => cb());
}

export function getUserPreferences(): UserPreferences {
  return current;
}

/**
 * Primary goal — the first goal in the list.
 * Used by the Home screen to decide which section to show first.
 * Falls back to "strength" if no goals are set (shouldn't happen after onboarding).
 */
export function getPrimaryGoal(): UserGoal {
  return current.goals[0] ?? "strength";
}

// ── Loader (call once on app boot) ───────────────────────────────────────────

export async function loadUserPreferences() {
  try {
    const [rawGoals, rawDays, rawCompleted] = await Promise.all([
      getSettingAsync(KEY_GOALS),
      getSettingAsync(KEY_DAYS),
      getSettingAsync(KEY_COMPLETED),
    ]);

    const goals = parseGoals(rawGoals);
    const days = parseDays(rawDays);
    const completed = rawCompleted === "true";

    current = { goals, trainingDays: days, onboardingCompleted: completed };
  } catch {
    current = { ...DEFAULT_PREFS };
  }
}

function parseGoals(raw: string | null): UserGoal[] {
  if (!raw) return DEFAULT_PREFS.goals;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_PREFS.goals;
    const filtered = parsed.filter((g): g is UserGoal =>
      typeof g === "string" && (USER_GOAL_LIST as string[]).includes(g),
    );
    return filtered.length > 0 ? filtered : DEFAULT_PREFS.goals;
  } catch {
    return DEFAULT_PREFS.goals;
  }
}

function parseDays(raw: string | null): number {
  const n = raw == null ? NaN : parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 7) return DEFAULT_PREFS.trainingDays;
  return n;
}

// ── Setters ──────────────────────────────────────────────────────────────────

export function setUserGoals(goals: UserGoal[]) {
  const unique = Array.from(new Set(goals)).filter((g): g is UserGoal =>
    (USER_GOAL_LIST as string[]).includes(g),
  );
  const next = unique.length > 0 ? unique : DEFAULT_PREFS.goals;
  current = { ...current, goals: next };
  setSettingAsync(KEY_GOALS, JSON.stringify(next)).catch(() => {});
  notify();
}

export function setTrainingDays(days: number) {
  const clamped = Math.max(1, Math.min(7, Math.round(days)));
  current = { ...current, trainingDays: clamped };
  setSettingAsync(KEY_DAYS, String(clamped)).catch(() => {});
  notify();
}

export function setOnboardingCompleted(v: boolean) {
  current = { ...current, onboardingCompleted: v };
  setSettingAsync(KEY_COMPLETED, v ? "true" : "false").catch(() => {});
  notify();
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useUserPreferences() {
  const [state, setState] = useState<UserPreferences>(current);

  useEffect(() => {
    const cb = () => setState(current);
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);

  return {
    ...state,
    primaryGoal: state.goals[0] ?? "strength",
    setGoals: setUserGoals,
    setTrainingDays,
    setOnboardingCompleted,
  };
}
