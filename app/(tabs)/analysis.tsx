// app/(tabs)/analysis.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, Modal, FlatList, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../src/theme";
import { useI18n } from "../../src/i18n";
import { LinearGradient } from "expo-linear-gradient";
import { ensureDb, getDb, getSettingAsync, setSettingAsync, listBodyMetrics, type BodyMetricRow } from "../../src/db";
import LineChart from "../../src/components/charts/LineChart";
import MuscleGroupBars, { MUSCLE_GROUPS, primaryMuscleGroups } from "../../src/components/charts/MuscleGroupBars";
import RpeHistogram from "../../src/components/charts/RpeHistogram";
import { getStandard, getStandardExerciseIds, hasStandard, getTargetWeights, type StrengthLevel, type Gender } from "../../src/strengthStandards";
import RadarChart, { type RadarDataPoint } from "../../src/components/charts/RadarChart";
import { getGoalsForExercise, createGoal, deleteGoal, getCurrentValueForGoal, type ExerciseGoal, type GoalType } from "../../src/goals";
import { displayNameFor, EXERCISES, searchExercises, resolveExerciseId, isBodyweight, isPerSideExercise } from "../../src/exerciseLibrary";
import BackImpactDot from "../../src/components/BackImpactDot";
import { SkeletonCard } from "../../src/components/Skeleton";
import { Screen, TopBar, Card, SegButton, IconButton, TextField, ListRow, Chip } from "../../src/ui";
import { useWeightUnit, unitLabel } from "../../src/units";
import { isoDateOnly } from "../../src/storage";
import { epley1RM } from "../../src/metrics";
import { parseTimeMs } from "../../src/format";
import { generateExerciseInsight } from "../../src/analysisInsights";
import TrainingStatusCard from "../../src/components/TrainingStatusCard";
import HintBanner from "../../src/components/HintBanner";
import { computeTrainingStatus, type TrainingStatusResult } from "../../src/trainingStatus";
import { toggleManualDeload } from "../../src/periodization";

type RangeKey = "week" | "month" | "year";
type ChartMetric = "e1rm" | "volume" | "repsPr" | "topSet";

type RowSet = {
  workout_id: string;
  exercise_id?: string | null;
  exercise_name: string;
  weight: number;
  reps: number;
  rpe?: number | null;
  created_at: string;
  workout_date: string;
  est_total_load_kg?: number | null;
  rest_seconds?: number | null;
};

type RowWorkout = {
  id: string;
  date: string;
  day_index?: number | null;
  started_at?: string | null;
};

type PrRow = {
  exercise_id: string;
  type: string;
  value: number;
  reps?: number | null;
  weight?: number | null;
  set_id?: string | null;
  date?: string | null;
  program_id?: string | null;
};

type PrView = {
  heaviest?: PrRow;
  e1rm?: PrRow;
  volume?: PrRow;
};

function daysBack(range: RangeKey) {
  if (range === "week") return 7;
  if (range === "month") return 30;
  return 365;
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function addDays(d: Date, n: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function weekStartKey(d: Date) {
  const day = d.getDay();
  const diff = (day + 6) % 7;
  const start = addDays(d, -diff);
  return isoDateOnly(start);
}

function monthKey(d: Date) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  return `${y}-${m}`;
}

function fmtRest(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function weightForSet(row: RowSet): number | null {
  const exId = row.exercise_id ? String(row.exercise_id) : null;
  if (exId && isBodyweight(exId)) {
    return Number.isFinite(row.est_total_load_kg ?? NaN) ? (row.est_total_load_kg as number) : null;
  }
  return row.weight;
}

// Module-level flag - persists across component remounts (tab switches)
let _analysisTabInitialized = false;

export default function Analysis() {
  const theme = useTheme();
  const { t } = useI18n();
  const wu = useWeightUnit();
  const [ready, setReady] = useState(_analysisTabInitialized);

  const navigation = useNavigation();
  const openDrawer = useCallback(() => {
    const parent = (navigation as any)?.getParent?.();
    if (parent?.openDrawer) parent.openDrawer();
    else if ((navigation as any)?.openDrawer) (navigation as any).openDrawer();
  }, [navigation]);
  const [range, setRange] = useState<RangeKey>("month");
  const [chartMetric, setChartMetric] = useState<ChartMetric>("e1rm");

  const [exercisePickerOpen, setExercisePickerOpen] = useState(false);
  const [exerciseQuery, setExerciseQuery] = useState("");

  const [selectedExerciseKey, setSelectedExerciseKey] = useState<string>("");
  const [sets, setSets] = useState<RowSet[]>([]);
  const [workouts, setWorkouts] = useState<RowWorkout[]>([]);
  const [prStats, setPrStats] = useState<PrView | null>(null);

  // Comparison mode
  const [comparisonMode, setComparisonMode] = useState(false);
  const [comparisonExerciseKey, setComparisonExerciseKey] = useState<string>("");
  const [comparisonPickerOpen, setComparisonPickerOpen] = useState(false);

  // Goals
  const [exerciseGoals, setExerciseGoals] = useState<(ExerciseGoal & { currentValue: number })[]>([]);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalType, setGoalType] = useState<GoalType>("weight");
  const [goalTarget, setGoalTarget] = useState("");

  // Advanced analytics state
  const [bodyweight, setBodyweight] = useState<number | null>(null);
  const [gender, setGender] = useState<Gender>("male");
  const [bodyMetrics90, setBodyMetrics90] = useState<BodyMetricRow[]>([]);
  const [allPrRecords, setAllPrRecords] = useState<PrRow[]>([]);
  const [prevPeriodData, setPrevPeriodData] = useState<{ workouts: number; sets: number; volume: number; bestE1rm: number }>({ workouts: 0, sets: 0, volume: 0, bestE1rm: 0 });
  const [trainingStatus, setTrainingStatus] = useState<TrainingStatusResult | null>(null);
  const [trainingStatusLoading, setTrainingStatusLoading] = useState(true);
  const [analysisProgramId, setAnalysisProgramId] = useState<string | null>(null);
  const [deloadToast, setDeloadToast] = useState(false);
  const deloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (deloadTimerRef.current) clearTimeout(deloadTimerRef.current); }, []);

  useEffect(() => {
    // Skip loading screen if already initialized (tab re-focus)
    if (_analysisTabInitialized) {
      setReady(true);
      return;
    }
    let alive = true;
    ensureDb().then(async () => {
      if (!alive) return;
      const savedRange = (await getSettingAsync("analysisRange")) as RangeKey | null;
      if (!alive) return;
      if (savedRange) setRange(savedRange);
      const savedExerciseKey = await getSettingAsync("analysisExerciseKey");
      if (!alive) return;
      if (savedExerciseKey) setSelectedExerciseKey(savedExerciseKey);
      setReady(true);
      _analysisTabInitialized = true;
    });
    return () => { alive = false; };
  }, []);

  // Load bodyweight and body metrics on mount
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    (async () => {
      try {
        const latest = await listBodyMetrics(1);
        if (alive && latest.length > 0) setBodyweight(latest[0].weight_kg);
      } catch {}
      try {
        const metrics = await listBodyMetrics(90);
        if (alive) setBodyMetrics90(metrics);
      } catch {}
    })();
    return () => { alive = false; };
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    (async () => {
      try {
        const mode = (await getSettingAsync("programMode")) || "normal";
        const progId = await getSettingAsync(`activeProgramId_${mode}`);
        if (alive) setAnalysisProgramId(progId);
        const result = await computeTrainingStatus(progId);
        if (alive) setTrainingStatus(result);
      } catch {}
      if (alive) setTrainingStatusLoading(false);
    })();
    return () => { alive = false; };
  }, [ready]);

  // Load all PR records for strength standards
  useEffect(() => {
    if (!ready) return;
    try {
      const rows = getDb().getAllSync<PrRow>(
        `SELECT exercise_id, type, value, reps, weight, set_id, date, program_id FROM pr_records WHERE type = 'e1rm'`
      );
      setAllPrRecords(Array.isArray(rows) ? rows : []);
    } catch {
      setAllPrRecords([]);
    }
  }, [ready]);

  useEffect(() => {
    if (!ready) return;

    const d = new Date();
    d.setDate(d.getDate() - daysBack(range));
    const fromDate = isoDateOnly(d);

    const w = getDb().getAllSync<RowWorkout>(
      `SELECT id, date, day_index, started_at
       FROM workouts
       WHERE date >= ?
       ORDER BY date ASC`,
      [fromDate]
    );
    setWorkouts(Array.isArray(w) ? w : []);

    const s = getDb().getAllSync<RowSet>(
      `SELECT s.workout_id, s.exercise_id, s.exercise_name, s.weight, s.reps, s.rpe, s.created_at, w.date as workout_date, s.est_total_load_kg, s.rest_seconds
       FROM sets s
       JOIN workouts w ON s.workout_id = w.id
       WHERE w.date >= ?
       ORDER BY w.date ASC, s.created_at ASC`,
      [fromDate]
    );
    setSets(Array.isArray(s) ? s : []);

    // Previous period data (for period comparison)
    try {
      const d2 = new Date();
      d2.setDate(d2.getDate() - 30);
      const thisMonthStart = isoDateOnly(d2);
      const d3 = new Date();
      d3.setDate(d3.getDate() - 60);
      const lastMonthStart = isoDateOnly(d3);

      const prevW = getDb().getFirstSync<{ c: number }>(
        `SELECT COUNT(DISTINCT date) as c FROM workouts WHERE date >= ? AND date < ?`,
        [lastMonthStart, thisMonthStart]
      );
      const prevS = getDb().getFirstSync<{ c: number; vol: number }>(
        `SELECT COUNT(1) as c, COALESCE(SUM(weight * reps), 0) as vol FROM sets s JOIN workouts w ON s.workout_id = w.id WHERE w.date >= ? AND w.date < ?`,
        [lastMonthStart, thisMonthStart]
      );
      const prevE1rm = getDb().getAllSync<{ weight: number; reps: number; est_total_load_kg: number | null; exercise_id: string | null }>(
        `SELECT s.weight, s.reps, s.est_total_load_kg, s.exercise_id FROM sets s JOIN workouts w ON s.workout_id = w.id WHERE w.date >= ? AND w.date < ?`,
        [lastMonthStart, thisMonthStart]
      );
      let bestPrev = 0;
      for (const r of prevE1rm ?? []) {
        const wt = r.exercise_id && isBodyweight(r.exercise_id) && Number.isFinite(r.est_total_load_kg ?? NaN) ? r.est_total_load_kg! : r.weight;
        bestPrev = Math.max(bestPrev, epley1RM(wt, r.reps));
      }
      setPrevPeriodData({
        workouts: prevW?.c ?? 0,
        sets: prevS?.c ?? 0,
        volume: Math.round(prevS?.vol ?? 0),
        bestE1rm: Math.round(bestPrev * 10) / 10,
      });
    } catch {}
  }, [ready, range]);

  const exerciseKeys = useMemo(() => {
    const counts: Record<string, number> = {};
    const labels: Record<string, string> = {};

    for (const ex of EXERCISES) {
      counts[ex.id] = 0;
      labels[ex.id] = ex.displayName;
    }

    for (const row of sets) {
      const resolvedId = row.exercise_id
        ? String(row.exercise_id)
        : row.exercise_name
          ? resolveExerciseId(row.exercise_name)
          : null;
      const key = resolvedId ?? row.exercise_name;
      const label = resolvedId ? displayNameFor(resolvedId) : row.exercise_name;
      labels[key] = label;
      counts[key] = (counts[key] ?? 0) + 1;
    }

    return Object.keys(labels)
      .map((key) => ({ key, label: labels[key], count: counts[key] ?? 0 }))
      .sort((a, b) => b.count - a.count);
  }, [sets]);

  useEffect(() => {
    if (!selectedExerciseKey && exerciseKeys.length > 0) {
      const first = exerciseKeys[0].key;
      setSelectedExerciseKey(first);
      setSettingAsync("analysisExerciseKey", first).catch(() => {});
    }
  }, [exerciseKeys, selectedExerciseKey]);

  useEffect(() => {
    if (!ready || !selectedExerciseKey) {
      setPrStats(null);
      return;
    }

    const known = EXERCISES.some((e) => e.id === selectedExerciseKey);
    const exId = known ? selectedExerciseKey : resolveExerciseId(selectedExerciseKey);
    if (!exId) {
      setPrStats(null);
      return;
    }

    try {
      const rows = getDb().getAllSync<PrRow>(
        `SELECT exercise_id, type, value, reps, weight, set_id, date, program_id
         FROM pr_records
         WHERE exercise_id = ?`,
        [exId]
      );
      const best: PrView = {};
      for (const r of rows ?? []) {
        const t = r.type;
        const prev = (best as any)[t] as PrRow | undefined;
        if (!prev || r.value > prev.value) {
          (best as any)[t] = r;
        }
      }
      setPrStats(best);
    } catch {
      setPrStats(null);
    }
  }, [ready, selectedExerciseKey]);

  // Load goals for selected exercise
  const loadGoals = useCallback(async () => {
    if (!ready || !selectedExerciseKey) { setExerciseGoals([]); return; }
    try {
      const programMode = (await getSettingAsync("programMode")) || "normal";
      const programId = await getSettingAsync(`activeProgramId_${programMode}`);
      if (!programId) { setExerciseGoals([]); return; }
      const goals = await getGoalsForExercise(selectedExerciseKey, programId);
      const withProgress = await Promise.all(
        goals.map(async (g) => ({
          ...g,
          currentValue: await getCurrentValueForGoal(g),
        }))
      );
      setExerciseGoals(withProgress);
    } catch { setExerciseGoals([]); }
  }, [ready, selectedExerciseKey]);

  useEffect(() => { loadGoals(); }, [loadGoals]);

  function setRangeAndPersist(r: RangeKey) {
    setRange(r);
    setSettingAsync("analysisRange", r).catch(() => {});
  }

  const filteredExerciseList = useMemo(() => {
    const q = exerciseQuery.trim();
    if (!q) return exerciseKeys;

    const matches = new Set(searchExercises(q).map((e) => e.id));
    return exerciseKeys.filter((e) => {
      if (matches.has(e.key)) return true;
      const label = e.label.toLowerCase();
      const key = e.key.toLowerCase();
      const qq = q.toLowerCase();
      return label.includes(qq) || key.includes(qq);
    });
  }, [exerciseKeys, exerciseQuery]);

  const selectedExerciseLabel = useMemo(() => {
    const found = exerciseKeys.find((e) => e.key === selectedExerciseKey);
    return found?.label ?? t("analysis.chooseExercise");
  }, [exerciseKeys, selectedExerciseKey, t]);

  const exerciseSeries = useMemo(() => {
    if (!selectedExerciseKey) return { labels: [] as string[], values: [] as number[] };

    const perDay: Record<string, number> = {};
    for (const row of sets) {
      const key = (row.exercise_id && String(row.exercise_id)) || row.exercise_name;
      if (key !== selectedExerciseKey) continue;


      const day = row.workout_date;
      const w = weightForSet(row);
      if (w == null) continue;

      if (chartMetric === "e1rm") {
        const val = epley1RM(w, row.reps);
        perDay[day] = Math.max(perDay[day] ?? 0, val);
      } else if (chartMetric === "volume") {
        const multiplier = row.exercise_id && isPerSideExercise(row.exercise_id) ? 2 : 1;
        perDay[day] = (perDay[day] ?? 0) + w * row.reps * multiplier;
      } else if (chartMetric === "repsPr") {
        perDay[day] = Math.max(perDay[day] ?? 0, row.reps);
      } else if (chartMetric === "topSet") {
        perDay[day] = Math.max(perDay[day] ?? 0, w);
      }
    }

    const days = Object.keys(perDay).sort();
    const labels = days.map((d) => d.slice(5));
    const values = days.map((d) => perDay[d]);
    return { labels, values };
  }, [sets, selectedExerciseKey, chartMetric]);

  const prIndices = useMemo(() => {
    if (!selectedExerciseKey || !allPrRecords.length || !exerciseSeries.labels.length) return [];
    const prDates = new Set(
      allPrRecords
        .filter((r) => r.exercise_id === selectedExerciseKey && r.date)
        .map((r) => r.date!.slice(5))
    );
    const indices: number[] = [];
    for (let i = 0; i < exerciseSeries.labels.length; i++) {
      if (prDates.has(exerciseSeries.labels[i])) indices.push(i);
    }
    return indices;
  }, [selectedExerciseKey, allPrRecords, exerciseSeries.labels]);

  const comparisonSeries = useMemo(() => {
    if (!comparisonMode || !comparisonExerciseKey) return { labels: [] as string[], values: [] as number[] };
    const perDay: Record<string, number> = {};
    for (const row of sets) {
      const key = (row.exercise_id && String(row.exercise_id)) || row.exercise_name;
      if (key !== comparisonExerciseKey) continue;

      const day = row.workout_date;
      const w = weightForSet(row);
      if (w == null) continue;
      if (chartMetric === "e1rm") {
        perDay[day] = Math.max(perDay[day] ?? 0, epley1RM(w, row.reps));
      } else if (chartMetric === "volume") {
        const multiplier = row.exercise_id && isPerSideExercise(row.exercise_id) ? 2 : 1;
        perDay[day] = (perDay[day] ?? 0) + w * row.reps * multiplier;
      } else if (chartMetric === "repsPr") {
        perDay[day] = Math.max(perDay[day] ?? 0, row.reps);
      } else if (chartMetric === "topSet") {
        perDay[day] = Math.max(perDay[day] ?? 0, w);
      }
    }
    const days = Object.keys(perDay).sort();
    return { labels: days.map((d) => d.slice(5)), values: days.map((d) => perDay[d]) };
  }, [sets, comparisonExerciseKey, comparisonMode, chartMetric]);

  const comparisonExerciseLabel = useMemo(() => {
    if (!comparisonExerciseKey) return t("analysis.chooseSecondExercise");
    const found = exerciseKeys.find((e) => e.key === comparisonExerciseKey);
    return found?.label ?? comparisonExerciseKey;
  }, [exerciseKeys, comparisonExerciseKey, t]);

  const exerciseStats = useMemo(() => {
    if (!selectedExerciseKey) return null;
    const filtered = sets.filter((row) => {
      const key = (row.exercise_id && String(row.exercise_id)) || row.exercise_name;
      return key === selectedExerciseKey;
    });
    if (filtered.length === 0) return null;

    const last = filtered.reduce((a, b) => (a.created_at > b.created_at ? a : b));
    const weights = filtered.map((s) => weightForSet(s)).filter((v): v is number => Number.isFinite(v ?? NaN));
    if (!weights.length) return null;
    const bestWeight = Math.max(...weights);
    const best1rm = Math.max(...filtered.map((s) => {
      const w = weightForSet(s);
      return w == null ? 0 : epley1RM(w, s.reps);
    }));
    const avgReps = filtered.reduce((sum, s) => sum + s.reps, 0) / filtered.length;

    // 4-week trend: compare avg e1RM of first 2 weeks vs last 2 weeks
    const now = new Date();
    const d28 = new Date(); d28.setDate(d28.getDate() - 28);
    const d14 = new Date(); d14.setDate(d14.getDate() - 14);
    const iso28 = isoDateOnly(d28);
    const iso14 = isoDateOnly(d14);

    const recent = filtered.filter((s) => s.workout_date >= iso28);
    const firstHalf = recent.filter((s) => s.workout_date < iso14);
    const secondHalf = recent.filter((s) => s.workout_date >= iso14);

    const avg1rm = (rows: RowSet[]) => {
      if (!rows.length) return 0;
      const vals = rows.map((s) => { const w = weightForSet(s); return w == null ? 0 : epley1RM(w, s.reps); });
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };
    const trendValue = firstHalf.length > 0 && secondHalf.length > 0
      ? Math.round((avg1rm(secondHalf) - avg1rm(firstHalf)) * 10) / 10
      : null;

    // Consistency: distinct dates with this exercise / weeks in period
    const distinctDates = new Set(filtered.map((s) => s.workout_date));
    const periodWeeks = Math.max(1, daysBack(range) / 7);
    const consistencyValue = Math.round((distinctDates.size / periodWeeks) * 10) / 10;

    return {
      last,
      bestWeight,
      best1rm,
      avgReps,
      count: filtered.length,
      trend: trendValue,
      consistency: consistencyValue,
    };
  }, [sets, selectedExerciseKey, range]);

  // ── Insight inputs: e1RM % change + RPE delta ────────────────────
  const insightInputs = useMemo(() => {
    if (!selectedExerciseKey) return { e1rmPctChange: null, rpeDelta: null, sessionCount: 0 };

    const filtered = sets.filter((row) => {
      const key = (row.exercise_id && String(row.exercise_id)) || row.exercise_name;
      return key === selectedExerciseKey;
    });

    // Split selected range in half: first half vs second half
    const totalDays = daysBack(range);
    const halfDays = Math.floor(totalDays / 2);
    const dMid = new Date(); dMid.setDate(dMid.getDate() - halfDays);
    const isoMid = isoDateOnly(dMid);

    const sessionCount = new Set(filtered.map((s) => s.workout_id)).size;
    const firstHalf = filtered.filter((s) => s.workout_date < isoMid);
    const secondHalf = filtered.filter((s) => s.workout_date >= isoMid);

    // e1RM % change
    let e1rmPctChange: number | null = null;
    if (firstHalf.length > 0 && secondHalf.length > 0) {
      const avg1rm = (rows: RowSet[]) => {
        const vals = rows.map((s) => { const w = weightForSet(s); return w == null ? 0 : epley1RM(w, s.reps); });
        return vals.reduce((a, b) => a + b, 0) / vals.length;
      };
      const early = avg1rm(firstHalf);
      const late  = avg1rm(secondHalf);
      if (early > 0) {
        e1rmPctChange = ((late - early) / early) * 100;
      }
    }

    // RPE delta: avg RPE in first half vs second half
    let rpeDelta: number | null = null;
    const rpeOf = (rows: RowSet[]) => {
      const vals = rows.map((s) => s.rpe).filter((v): v is number => v != null && Number.isFinite(v));
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    const earlyRpe = rpeOf(firstHalf);
    const lateRpe  = rpeOf(secondHalf);
    if (earlyRpe !== null && lateRpe !== null) {
      rpeDelta = lateRpe - earlyRpe;
    }

    return { e1rmPctChange, rpeDelta, sessionCount };
  }, [sets, selectedExerciseKey, range]);

  const restStats = useMemo(() => {
    const allRest = sets.filter(s => s.rest_seconds != null && s.rest_seconds > 0);
    const overallAvg = allRest.length > 0 ? Math.round(allRest.reduce((sum, s) => sum + s.rest_seconds!, 0) / allRest.length) : null;

    if (!selectedExerciseKey) return { overallAvg, exercise: null };
    const exRest = allRest.filter(s => {
      const key = (s.exercise_id && String(s.exercise_id)) || s.exercise_name;
      return key === selectedExerciseKey;
    });
    if (exRest.length === 0) return { overallAvg, exercise: null };

    const vals = exRest.map(s => s.rest_seconds!);
    const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    const min = Math.min(...vals);
    const max = Math.max(...vals);

    // Trend: compare avg rest of first 2 weeks vs last 2 weeks in recent 4-week window
    const d28 = new Date(); d28.setDate(d28.getDate() - 28);
    const d14 = new Date(); d14.setDate(d14.getDate() - 14);
    const iso14 = isoDateOnly(d14);
    const iso28 = isoDateOnly(d28);
    const recent = exRest.filter(s => s.workout_date >= iso28);
    const firstHalf = recent.filter(s => s.workout_date < iso14);
    const secondHalf = recent.filter(s => s.workout_date >= iso14);
    const avgOf = (arr: typeof exRest) => arr.length ? Math.round(arr.reduce((a, b) => a + b.rest_seconds!, 0) / arr.length) : null;
    const trendDiff = (firstHalf.length > 0 && secondHalf.length > 0)
      ? (avgOf(secondHalf)! - avgOf(firstHalf)!)
      : null;

    return { overallAvg, exercise: { avg, min, max, trend: trendDiff, count: exRest.length } };
  }, [sets, selectedExerciseKey]);

  // ── RPE Distribution ──────────────────────────────────────────────
  const rpeDistribution = useMemo(() => {
    const rpeSets = sets.filter((s) => s.rpe != null && Number.isFinite(s.rpe as number) && (s.rpe as number) >= 6);
    if (rpeSets.length === 0) return null;

    let light = 0, moderate = 0, hard = 0;
    for (const s of rpeSets) {
      const rpe = s.rpe as number;
      if (rpe <= 7) light++;
      else if (rpe <= 8.5) moderate++;
      else hard++;
    }
    const total = rpeSets.length;
    return {
      light:    (light    / total) * 100,
      moderate: (moderate / total) * 100,
      hard:     (hard     / total) * 100,
    };
  }, [sets]);

  const volumeSeries = useMemo(() => {
    const volumeByDay: Record<string, number> = {};
    for (const row of sets) {

      const day = row.workout_date;
      const w = weightForSet(row);
      if (w == null) continue;
      const multiplier = row.exercise_id && isPerSideExercise(row.exercise_id) ? 2 : 1;
      const vol = w * row.reps * multiplier;
      volumeByDay[day] = (volumeByDay[day] ?? 0) + vol;
    }

    if (range === "week") {
      const start = addDays(new Date(), -6);
      const labels: string[] = [];
      const values: number[] = [];
      for (let i = 0; i < 7; i += 1) {
        const d = addDays(start, i);
        const key = isoDateOnly(d);
        labels.push(key.slice(5));
        values.push(volumeByDay[key] ?? 0);
      }
      return { labels, values };
    }

    if (range === "month") {
      const weekMap: Record<string, number> = {};
      for (const day of Object.keys(volumeByDay)) {
        const wk = weekStartKey(parseLocalDate(day));
        weekMap[wk] = (weekMap[wk] ?? 0) + (volumeByDay[day] ?? 0);
      }
      const weeks = Object.keys(weekMap).sort();
      return {
        labels: weeks.map((w) => w.slice(5)),
        values: weeks.map((w) => weekMap[w]),
      };
    }

    const monthMap: Record<string, number> = {};
    for (const day of Object.keys(volumeByDay)) {
      const mk = monthKey(parseLocalDate(day));
      monthMap[mk] = (monthMap[mk] ?? 0) + (volumeByDay[day] ?? 0);
    }
    const months = Object.keys(monthMap).sort();
    return {
      labels: months.map((m) => m.slice(5)),
      values: months.map((m) => monthMap[m]),
    };
  }, [sets, range]);

  const muscleStats = useMemo(() => {
    const bigGroups = new Set(["chest", "back", "quads", "hamstrings", "glutes", "shoulders"]);
    const statusFor = (count: number, group: string) => {
      const [low, high] = bigGroups.has(group) ? [8, 12] : [6, 10];
      if (count < low) return t("analysis.tooLittle");
      if (count > high) return t("analysis.tooMuch");
      return t("analysis.ok");
    };

    const byWeek: Record<string, Record<string, number>> = {};
    for (const row of sets) {

      const wk = weekStartKey(parseLocalDate(row.workout_date));
      if (!byWeek[wk]) byWeek[wk] = {};
      const groups = primaryMuscleGroups(row.exercise_id, row.exercise_name);
      for (const g of groups) {
        byWeek[wk][g] = (byWeek[wk][g] ?? 0) + 1;
      }
    }

    const weeks = Object.keys(byWeek).sort();
    if (!weeks.length) return { week: "", rows: [] as { group: string; count: number; delta: number; status: string }[] };

    const latest = weeks[weeks.length - 1];
    const prev = weeks.length > 1 ? weeks[weeks.length - 2] : "";
    const latestMap = byWeek[latest] ?? {};
    const prevMap = prev ? byWeek[prev] ?? {} : {};

    const allGroups = [...MUSCLE_GROUPS, "other"];
    const rows: Array<{ group: string; count: number; delta: number; status: string }> = allGroups
      .map((g) => ({
        group: g,
        count: latestMap[g] ?? 0,
        delta: (latestMap[g] ?? 0) - (prevMap[g] ?? 0),
        status: statusFor(latestMap[g] ?? 0, g),
      }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);

    return { week: latest, rows };
  }, [sets]);

  const consistencyStats = useMemo(() => {
    const endByWorkout: Record<string, number> = {};
    for (const s of sets) {
      const t = parseTimeMs(s.created_at);
      if (!Number.isFinite(t)) continue;
      endByWorkout[s.workout_id] = Math.max(endByWorkout[s.workout_id] ?? 0, t);
    }

    const perWeek: Record<string, { count: number; totalMin: number }> = {};
    for (const w of workouts) {
      const wk = weekStartKey(parseLocalDate(w.date));
      if (!perWeek[wk]) perWeek[wk] = { count: 0, totalMin: 0 };
      perWeek[wk].count += 1;

      const start = parseTimeMs(w.started_at ?? null);
      const end = endByWorkout[w.id];
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        perWeek[wk].totalMin += (end - start) / 60000;
      }
    }

    const weeks = Object.keys(perWeek).sort();
    const rows = weeks.map((wk) => ({
      week: wk,
      count: perWeek[wk].count,
      totalMin: perWeek[wk].totalMin,
    }));
    return rows;
  }, [sets, workouts]);

  const overallSeries = useMemo(() => {
    const perDayPerEx: Record<string, Record<string, number>> = {};

    for (const row of sets) {
      const day = row.workout_date;
      const exKey = (row.exercise_id && String(row.exercise_id)) || row.exercise_name;
      if (!perDayPerEx[day]) perDayPerEx[day] = {};
      const w = weightForSet(row);
      if (w == null) continue;
      const val = epley1RM(w, row.reps);
      perDayPerEx[day][exKey] = Math.max(perDayPerEx[day][exKey] ?? 0, val);
    }

    const days = Object.keys(perDayPerEx).sort();
    const values = days.map((day) => {
      const obj = perDayPerEx[day] || {};
      const vals = Object.values(obj);
      if (!vals.length) return 0;
      const sum = vals.reduce((a, b) => a + b, 0);
      return sum / vals.length;
    });

    const labels = days.map((d) => d.slice(5));
    return { labels, values };
  }, [sets]);

  const strengthIndexSeries = useMemo(() => {
    const setsByWorkout: Record<string, RowSet[]> = {};
    for (const row of sets) {

      if (!setsByWorkout[row.workout_id]) setsByWorkout[row.workout_id] = [];
      setsByWorkout[row.workout_id].push(row);
    }

    const eligible: Array<{ date: string; avg: number }> = [];
    for (const w of workouts) {
      const rows = setsByWorkout[w.id] ?? [];
      if (!rows.length) continue;
      const bestByEx: Record<string, number> = {};
      for (const r of rows) {
        const exKey = (r.exercise_id && String(r.exercise_id)) || r.exercise_name;
        const wt = weightForSet(r);
        if (wt == null) continue;
        const val = epley1RM(wt, r.reps);
        bestByEx[exKey] = Math.max(bestByEx[exKey] ?? 0, val);
      }
      const vals = Object.values(bestByEx);
      if (vals.length < 3) continue;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      eligible.push({ date: w.date, avg });
    }

    if (!eligible.length) return { labels: [] as string[], values: [] as number[] };

    const baselineCount = Math.min(3, eligible.length);
    const baseline =
      eligible.slice(0, baselineCount).reduce((a, b) => a + b.avg, 0) / baselineCount;
    if (!Number.isFinite(baseline) || baseline <= 0) {
      return { labels: [] as string[], values: [] as number[] };
    }

    const labels = eligible.map((e) => e.date.slice(5));
    const values = eligible.map((e) => (e.avg / baseline) * 100);
    return { labels, values };
  }, [sets, workouts]);

  const durationStats = useMemo(() => {
    const endByWorkout: Record<string, number> = {};
    for (const s of sets) {
      const t = parseTimeMs(s.created_at);
      if (!Number.isFinite(t)) continue;
      endByWorkout[s.workout_id] = Math.max(endByWorkout[s.workout_id] ?? 0, t);
    }

    const durationsMin: number[] = [];
    const perDayIndex: Record<string, number[]> = {};

    for (const w of workouts) {
      const start = parseTimeMs(w.started_at ?? null);
      const end = endByWorkout[w.id];
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;

      const mins = (end - start) / 60000;
      durationsMin.push(mins);

      const di = String(w.day_index ?? -1);
      if (!perDayIndex[di]) perDayIndex[di] = [];
      perDayIndex[di].push(mins);
    }

    const avg = durationsMin.length ? durationsMin.reduce((a, b) => a + b, 0) / durationsMin.length : 0;

    const dayAverages = Object.entries(perDayIndex)
      .map(([k, arr]) => {
        const idx = Number(k);
        const a = arr.reduce((x, y) => x + y, 0) / Math.max(1, arr.length);
        return { dayIndex: idx, avgMin: a, n: arr.length };
      })
      .filter((x) => Number.isFinite(x.dayIndex) && x.dayIndex >= 0)
      .sort((a, b) => a.dayIndex - b.dayIndex);

    return { avg, dayAverages, count: durationsMin.length };
  }, [sets, workouts]);

  // ── Period Comparison (this month) ─────────────────────────────────
  const thisPeriodData = useMemo(() => {
    const d30 = new Date();
    d30.setDate(d30.getDate() - 30);
    const cutoff = isoDateOnly(d30);

    const recentWorkouts = workouts.filter((w) => w.date >= cutoff);
    const recentSets = sets.filter((s) => s.workout_date >= cutoff);
    const vol = recentSets.reduce((sum, s) => {
      const w = weightForSet(s);
      return sum + (w != null ? w * s.reps : 0);
    }, 0);
    let bestE1rm = 0;
    for (const s of recentSets) {
      const w = weightForSet(s);
      if (w != null) bestE1rm = Math.max(bestE1rm, epley1RM(w, s.reps));
    }
    return {
      workouts: new Set(recentWorkouts.map((w) => w.date)).size,
      sets: recentSets.length,
      volume: Math.round(vol),
      bestE1rm: Math.round(bestE1rm * 10) / 10,
    };
  }, [sets, workouts]);

  // ── Strength Standards ──────────────────────────────────────────────
  const STRENGTH_LIFT_IDS = ["bench_press", "back_squat", "deadlift", "overhead_press", "barbell_row"] as const;
  const STANDARD_EXERCISE_MAP: Record<string, string> = { back_squat: "squat" };

  const strengthStandardsData = useMemo(() => {
    return STRENGTH_LIFT_IDS.map((exId) => {
      const standardId = STANDARD_EXERCISE_MAP[exId] ?? exId;
      const prRow = allPrRecords.find((r) => r.exercise_id === exId);
      const e1rm = prRow?.value ?? null;
      let level: StrengthLevel | null = null;
      if (e1rm && bodyweight && bodyweight > 0 && hasStandard(standardId)) {
        level = getStandard(standardId, e1rm, bodyweight, gender);
      }
      return { exId, standardId, e1rm, level };
    });
  }, [allPrRecords, bodyweight, gender]);

  const LEVEL_COLORS: Record<StrengthLevel, string> = {
    beginner: "#9CA3AF",
    novice: "#60A5FA",
    intermediate: "#34D399",
    advanced: "#FBBF24",
    elite: "#F87171",
  };

  // ── Body Composition ──────────────────────────────────────────────
  const bodyCompData = useMemo(() => {
    if (!bodyMetrics90.length) return null;
    const sorted = [...bodyMetrics90].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const weights = sorted.map((m) => m.weight_kg);
    const current = weights[weights.length - 1];
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const change = weights.length >= 2 ? current - weights[0] : 0;
    const labels = sorted.map((m) => m.date.slice(5));
    return { labels, values: weights, current, min, max, change };
  }, [bodyMetrics90]);

  // ── Muscle Balance Radar (Relative Distribution) ──────────────────
  const RADAR_GROUPS = ["chest", "back", "shoulders", "biceps", "triceps", "forearms", "quads", "hamstrings"] as const;

  // Ideal weekly distribution (target %) — should sum to 100
  const TARGET_PCT: Record<string, number> = {
    chest: 16, back: 18, shoulders: 14,
    quads: 16, hamstrings: 14,
    biceps: 10, triceps: 12, forearms: 4,
  };

  const radarData = useMemo((): RadarDataPoint[] => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffIso = isoDateOnly(cutoff);

    const setsByGroup: Record<string, number> = {};
    for (const g of RADAR_GROUPS) setsByGroup[g] = 0;

    let totalSets = 0;
    for (const row of sets) {

      if (row.workout_date < cutoffIso) continue;
      const groups = primaryMuscleGroups(row.exercise_id, row.exercise_name);
      for (const g of groups) {
        if (g in setsByGroup) {
          setsByGroup[g] += 1;
          totalSets += 1;
        }
      }
    }

    // Score = (actual% / target%) × 100, capped at 150
    return RADAR_GROUPS.map((g) => {
      const actualPct = totalSets > 0 ? (setsByGroup[g] / totalSets) * 100 : 0;
      const targetPct = TARGET_PCT[g] ?? 12;
      const score = targetPct > 0 ? Math.min(150, (actualPct / targetPct) * 100) : 0;
      return {
        label: g.charAt(0).toUpperCase() + g.slice(1),
        value: Math.round(score),
        max: 150,
      };
    });
  }, [sets]);

  // Balance hint
  const radarHint = useMemo((): string => {
    if (radarData.every((d) => d.value === 0)) return "";
    const sorted = [...radarData].sort((a, b) => b.value - a.value);
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];
    const spread = top.value - bottom.value;
    if (spread < 30) return t("analysis.balanced");
    // Check push/pull/legs dominance
    const pushGroups = ["Chest", "Shoulders", "Triceps"];
    const pullGroups = ["Back", "Biceps", "Forearms"];
    const legGroups = ["Quads", "Hamstrings"];
    const avgOf = (labels: string[]) => {
      const matches = radarData.filter((d) => labels.includes(d.label));
      return matches.length > 0 ? matches.reduce((s, d) => s + d.value, 0) / matches.length : 0;
    };
    const pushAvg = avgOf(pushGroups);
    const pullAvg = avgOf(pullGroups);
    const legAvg = avgOf(legGroups);
    const maxAvg = Math.max(pushAvg, pullAvg, legAvg);
    if (maxAvg === pushAvg && pushAvg > pullAvg + 20) return t("analysis.pushDominant");
    if (maxAvg === pullAvg && pullAvg > pushAvg + 20) return t("analysis.pullDominant");
    if (maxAvg === legAvg && legAvg > pushAvg + 20 && legAvg > pullAvg + 20) return t("analysis.legDominant");
    return t("analysis.balanced");
  }, [radarData, t]);

  if (!ready) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.md }}>
          <TopBar title={t("analysis.title")} subtitle={t("analysis.subtitle")} left={<IconButton icon="menu" onPress={openDrawer} />} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.md }}>
        <TopBar title={t("analysis.title")} subtitle={t("analysis.subtitle")} left={<IconButton icon="menu" onPress={openDrawer} />} />

        <HintBanner hintKey="analysis_intro" icon="insights">
          {t("hint.analysisIntro")}
        </HintBanner>

        {sets.length === 0 && workouts.length === 0 ? (
          <Card>
            <Text style={{ color: theme.muted, textAlign: "center", paddingVertical: theme.space.md }}>
              {t("analysis.emptyState")}
            </Text>
          </Card>
        ) : null}

        {/* ── Program Overview Hero ─────────────────────────────── */}
        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
          {t("analysis.overview")}
        </Text>
        <TrainingStatusCard
          result={trainingStatus}
          loading={trainingStatusLoading}
          onViewAnalysis={() => {/* already on analysis */}}
          onStartDeload={async () => {
            try {
              const programMode = (await getSettingAsync("programMode")) || "normal";
              const programId = await getSettingAsync(`activeProgramId_${programMode}`);
              if (!programId) return;
              await toggleManualDeload(programId);
              const freshStatus = await computeTrainingStatus(programId);
              setTrainingStatus(freshStatus);
              setDeloadToast(true);
              if (deloadTimerRef.current) clearTimeout(deloadTimerRef.current);
              deloadTimerRef.current = setTimeout(() => setDeloadToast(false), 3000);
            } catch {}
          }}
        />

        {/* ── Exercise Detail Section ───────────────────────────── */}
        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
          {t("analysis.exerciseDetail")}
        </Text>

        <Card title={t("analysis.range")}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <SegButton label={t("analysis.week")} active={range === "week"} onPress={() => setRangeAndPersist("week")} />
            <SegButton label={t("analysis.month")} active={range === "month"} onPress={() => setRangeAndPersist("month")} />
            <SegButton label={t("analysis.year")} active={range === "year"} onPress={() => setRangeAndPersist("year")} />
          </View>
          <Text style={{ color: theme.muted }}>{t("analysis.showingData", { n: daysBack(range) })}</Text>
        </Card>

        <Card title={t("analysis.strengthIndex")}>
          <Text style={{ color: theme.muted }}>
            {t("analysis.e1rmNote")}
          </Text>
          <LineChart values={strengthIndexSeries.values} labels={strengthIndexSeries.labels} unit="%" />
        </Card>

        <Card title={t("analysis.volume")}>
          <Text style={{ color: theme.muted }}>
            {range === "week"
              ? t("analysis.dailyVolume")
              : range === "month"
              ? t("analysis.weeklyVolume")
              : t("analysis.monthlyVolume")}
          </Text>
          <LineChart values={volumeSeries.values.map(v => wu.toDisplay(v))} labels={volumeSeries.labels} unit={wu.unitLabel()} />
          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
            {t("analysis.total")} {wu.toDisplay(volumeSeries.values.reduce((a, b) => a + b, 0)).toFixed(0)} {wu.unitLabel().toLowerCase()}-reps
          </Text>
        </Card>

        <Card title={t("analysis.muscleGroups")}>
          <MuscleGroupBars rows={muscleStats.rows} week={muscleStats.week} />
        </Card>

        <Card title={t("analysis.consistency")}>
          {consistencyStats.length === 0 ? (
            <Text style={{ color: theme.muted }}>{t("analysis.noSessions")}</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {consistencyStats.map((row, idx) => (
                <ListRow
                  key={row.week}
                  title={t("analysis.weekLabel", { week: row.week })}
                  subtitle={t("analysis.sessionsCount", { count: row.count, min: row.totalMin.toFixed(0) })}
                  divider={idx < consistencyStats.length - 1}
                />
              ))}
            </View>
          )}
        </Card>

        <Card title={t("analysis.restTime")}>
          {restStats.overallAvg == null ? (
            <Text style={{ color: theme.muted }}>{t("analysis.noRestData")}</Text>
          ) : (
            <View style={{ gap: 6 }}>
              <Text style={{ color: theme.muted }}>
                {t("analysis.overallAvgRest")}: {fmtRest(restStats.overallAvg)}
              </Text>
              {restStats.exercise ? (
                <>
                  <Text style={{ color: theme.text }}>
                    {t("analysis.avgRest")}: {fmtRest(restStats.exercise.avg)}
                  </Text>
                  <Text style={{ color: theme.muted }}>
                    {t("analysis.minRest")}: {fmtRest(restStats.exercise.min)} {"\u00B7"} {t("analysis.maxRest")}: {fmtRest(restStats.exercise.max)}
                  </Text>
                  {restStats.exercise.trend != null && (
                    <Text style={{
                      color: restStats.exercise.trend > 0 ? "#F87171" : restStats.exercise.trend < 0 ? "#34D399" : theme.muted,
                    }}>
                      {t("analysis.restTrend")}: {restStats.exercise.trend > 0 ? "+" : ""}{fmtRest(Math.abs(restStats.exercise.trend))}
                    </Text>
                  )}
                </>
              ) : null}
            </View>
          )}
        </Card>

        {/* ── RPE Distribution ──────────────────────────────── */}
        {rpeDistribution && (
          <Card title={t("analysis.rpeDistribution")}>
            <RpeHistogram data={rpeDistribution} />
          </Card>
        )}

        <Card title={t("analysis.exercise")}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => setExercisePickerOpen(true)}
              style={{
                flex: 1,
                borderColor: theme.glassBorder,
                borderWidth: 1,
                borderRadius: theme.radius.lg,
                padding: 14,
                backgroundColor: theme.glass,
              }}
            >
              <Text style={{ color: theme.text, fontSize: 16 }} numberOfLines={1}>
                {selectedExerciseLabel}
              </Text>
              <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>
                {comparisonMode ? t("analysis.exercise1") : t("analysis.tapToChoose")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { setComparisonMode(!comparisonMode); if (comparisonMode) setComparisonExerciseKey(""); }}
              style={{
                borderColor: comparisonMode ? theme.accent : theme.glassBorder,
                borderWidth: 1,
                borderRadius: theme.radius.lg,
                padding: 14,
                backgroundColor: comparisonMode
                  ? (theme.isDark ? "rgba(182,104,245,0.15)" : "rgba(124,58,237,0.10)")
                  : theme.glass,
                width: 52,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: comparisonMode ? theme.accent : theme.muted, fontSize: 18 }}>{"\u2194"}</Text>
            </Pressable>
          </View>

          {comparisonMode && (
            <Pressable
              onPress={() => setComparisonPickerOpen(true)}
              style={{
                borderColor: comparisonExerciseKey ? "#F97316" : theme.glassBorder,
                borderWidth: 1,
                borderRadius: theme.radius.lg,
                padding: 14,
                backgroundColor: theme.glass,
              }}
            >
              <Text style={{ color: theme.text, fontSize: 16 }} numberOfLines={1}>
                {comparisonExerciseLabel}
              </Text>
              <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>{t("analysis.exercise2")}</Text>
            </Pressable>
          )}

          <Text style={{ color: theme.muted }}>
            {t("analysis.graphNote")}
          </Text>

          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <SegButton label={t("analysis.chartE1rm")} active={chartMetric === "e1rm"} onPress={() => setChartMetric("e1rm")} />
            <SegButton label={t("analysis.chartVolume")} active={chartMetric === "volume"} onPress={() => setChartMetric("volume")} />
            <SegButton label={t("analysis.chartRepsPr")} active={chartMetric === "repsPr"} onPress={() => setChartMetric("repsPr")} />
            <SegButton label={t("analysis.chartTopSet")} active={chartMetric === "topSet"} onPress={() => setChartMetric("topSet")} />
          </View>

          {comparisonMode && comparisonExerciseKey ? (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", gap: 16, justifyContent: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 16, height: 3, backgroundColor: theme.accent, borderRadius: 2 }} />
                  <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 11 }} numberOfLines={1}>{selectedExerciseLabel}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 16, height: 3, backgroundColor: "#F97316", borderRadius: 2 }} />
                  <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 11 }} numberOfLines={1}>{comparisonExerciseLabel}</Text>
                </View>
              </View>
              <LineChart values={chartMetric === "repsPr" ? exerciseSeries.values : exerciseSeries.values.map(v => wu.toDisplay(v))} labels={exerciseSeries.labels} unit={chartMetric === "repsPr" ? "reps" : wu.unitLabel()} height={140} markers={prIndices} />
              <LineChart values={chartMetric === "repsPr" ? comparisonSeries.values : comparisonSeries.values.map(v => wu.toDisplay(v))} labels={comparisonSeries.labels} unit={chartMetric === "repsPr" ? "reps" : wu.unitLabel()} height={140} />
            </View>
          ) : (
            <LineChart values={chartMetric === "repsPr" ? exerciseSeries.values : exerciseSeries.values.map(v => wu.toDisplay(v))} labels={exerciseSeries.labels} unit={chartMetric === "repsPr" ? "reps" : wu.unitLabel()} markers={prIndices} />
          )}
        </Card>

        <Card title={t("analysis.stats")}>
          {!exerciseStats ? (
            <Text style={{ color: theme.muted }}>{t("analysis.noSetsLogged")}</Text>
          ) : (
            <View style={{ gap: 6 }}>
              <Text style={{ color: theme.text }}>
                {t("log.previous")}: {wu.formatWeight(exerciseStats.last.weight)} x {exerciseStats.last.reps} ({exerciseStats.last.created_at.slice(0, 10)})
              </Text>
              <Text style={{ color: theme.muted }}>{t("analysis.bestWeight")}: {wu.formatWeight(exerciseStats.bestWeight)}</Text>
              <Text style={{ color: theme.muted }}>{t("analysis.bestE1rm")}: {wu.formatWeight(exerciseStats.best1rm)}</Text>
              <Text style={{ color: theme.muted }}>{t("analysis.avgReps")}: {exerciseStats.avgReps.toFixed(1)}</Text>
              <Text style={{ color: theme.muted }}>{t("analysis.setsInPeriod")}: {exerciseStats.count}</Text>
              {exerciseStats.trend !== null && (
                <Text style={{
                  color: exerciseStats.trend > 0 ? "#34D399" : exerciseStats.trend < 0 ? "#F87171" : theme.muted,
                  fontFamily: theme.mono,
                  fontSize: 13,
                }}>
                  {t("analysis.trend")}: {exerciseStats.trend > 0
                    ? t("analysis.trendUp", { value: wu.toDisplay(exerciseStats.trend).toFixed(1) + " " + wu.unitLabel() })
                    : exerciseStats.trend < 0
                      ? t("analysis.trendDown", { value: wu.toDisplay(exerciseStats.trend).toFixed(1) + " " + wu.unitLabel() })
                      : t("analysis.trendFlat")}
                </Text>
              )}
              <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 13 }}>
                {t("analysis.consistencyLabel")}: {t("analysis.sessionsPerWeek", { value: exerciseStats.consistency })}
              </Text>
              {/* ── Exercise insight sentence ── */}
              {(() => {
                const insight = generateExerciseInsight(insightInputs);
                return (
                  <Text style={{
                    color: theme.muted,
                    fontFamily: theme.mono,
                    fontSize: 12,
                    fontStyle: "italic",
                    marginTop: 6,
                    lineHeight: 17,
                  }}>
                    {t(insight.key, insight.params)}
                  </Text>
                );
              })()}
            </View>
          )}
        </Card>

        <Card title={t("analysis.prs")}>
          {!prStats || (!prStats.heaviest && !prStats.e1rm && !prStats.volume) ? (
            <Text style={{ color: theme.muted }}>{t("analysis.noPRData")}</Text>
          ) : (
            <View style={{ gap: 6 }}>
              {prStats.heaviest ? (
                <Text style={{ color: theme.text }}>
                  {t("analysis.prHeaviest")}: {wu.formatWeight(prStats.heaviest.value)}
                  {prStats.heaviest.date ? ` (${prStats.heaviest.date})` : ""}
                </Text>
              ) : null}
              {prStats.e1rm ? (
                <Text style={{ color: theme.text }}>
                  {t("analysis.prE1rm")}: {wu.formatWeight(prStats.e1rm.value)}
                  {prStats.e1rm.date ? ` (${prStats.e1rm.date})` : ""}
                </Text>
              ) : null}
              {prStats.volume ? (
                <Text style={{ color: theme.text }}>
                  {t("analysis.prVolume")}: {wu.formatWeight(prStats.volume.value)}
                  {prStats.volume.date ? ` (${prStats.volume.date})` : ""}
                </Text>
              ) : null}
            </View>
          )}
        </Card>

        {/* Goals */}
        <Card title={t("analysis.goals")}>
          {!selectedExerciseKey ? (
            <Text style={{ color: theme.muted }}>{t("analysis.selectExerciseFirst")}</Text>
          ) : (
            <View style={{ gap: 10 }}>
              {exerciseGoals.filter(g => !g.achievedAt).map((goal) => {
                const progress = goal.targetValue > 0 ? Math.min(100, (goal.currentValue / goal.targetValue) * 100) : 0;
                const isReps = goal.goalType === "reps";
                return (
                  <View key={goal.id} style={{ gap: 4 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ color: theme.text, fontFamily: theme.fontFamily.medium, fontSize: 14 }}>
                        {t(`analysis.goalType.${goal.goalType}`)}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: 13 }}>
                          {isReps ? `${goal.currentValue}` : wu.formatWeight(goal.currentValue)} / {isReps ? `${goal.targetValue}` : wu.formatWeight(goal.targetValue)}
                        </Text>
                        <Pressable onPress={async () => { try { await deleteGoal(goal.id); loadGoals(); } catch {} }}>
                          <Text style={{ color: theme.muted, fontSize: 16 }}>{"\u00D7"}</Text>
                        </Pressable>
                      </View>
                    </View>
                    <View style={{ height: 6, backgroundColor: theme.glass, borderRadius: 3, overflow: "hidden", borderWidth: 1, borderColor: theme.glassBorder }}>
                      <View style={{ height: "100%", width: `${progress}%`, backgroundColor: progress >= 100 ? "#2ed573" : theme.accent, borderRadius: 3 }} />
                    </View>
                    <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>
                      {progress >= 100 ? t("analysis.goalAchieved") : `${Math.round(progress)}% ${t("analysis.complete")}`}
                    </Text>
                  </View>
                );
              })}
              {exerciseGoals.filter(g => g.achievedAt).length > 0 && (
                <View style={{ gap: 4 }}>
                  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", marginTop: 4 }}>
                    {t("analysis.achievedGoals")}
                  </Text>
                  {exerciseGoals.filter(g => g.achievedAt).map((goal) => {
                    const isReps = goal.goalType === "reps";
                    return (
                      <View key={goal.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", opacity: 0.6 }}>
                        <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 12 }}>
                          {t(`analysis.goalType.${goal.goalType}`)} {isReps ? goal.targetValue : wu.formatWeight(goal.targetValue)}
                        </Text>
                        <Text style={{ color: "#2ed573", fontFamily: theme.mono, fontSize: 11 }}>{"\u2713"}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
              <Pressable
                onPress={() => { setGoalType("weight"); setGoalTarget(""); setGoalModalOpen(true); }}
                style={{
                  borderColor: theme.glassBorder,
                  borderWidth: 1,
                  borderRadius: theme.radius.lg,
                  paddingVertical: 10,
                  alignItems: "center",
                  backgroundColor: theme.glass,
                }}
              >
                <Text style={{ color: theme.accent, fontFamily: theme.fontFamily.medium, fontSize: 14 }}>
                  {exerciseGoals.filter(g => !g.achievedAt).length > 0 ? t("analysis.addGoal") : t("analysis.setGoal")}
                </Text>
              </Pressable>
            </View>
          )}
        </Card>

        <Card title={t("analysis.progression")}>
          <Text style={{ color: theme.muted }}>
            {t("analysis.avgNote")}
          </Text>
          <LineChart values={overallSeries.values.map(v => wu.toDisplay(v))} labels={overallSeries.labels} unit={wu.unitLabel()} />
        </Card>

        <Card title={t("analysis.sessionTime")}>
          {durationStats.count === 0 ? (
            <Text style={{ color: theme.muted }}>{t("analysis.noCompleteSessions")}</Text>
          ) : (
            <>
              <Text style={{ color: theme.text, fontSize: 18 }}>{durationStats.avg.toFixed(1)} min</Text>
              <Text style={{ color: theme.muted }}>
                {t("analysis.basedOnSessions", { count: durationStats.count })}
              </Text>

              {durationStats.dayAverages.length > 0 ? (
                <View style={{ gap: 6, marginTop: 8 }}>
                  {durationStats.dayAverages.map((d) => (
                    <Text key={d.dayIndex} style={{ color: theme.muted, fontFamily: theme.mono }}>
                      {t("analysis.dayLabel", { day: d.dayIndex + 1 })}: {d.avgMin.toFixed(1)} min (n={d.n})
                    </Text>
                  ))}
                </View>
              ) : null}
            </>
          )}
        </Card>

        {/* ── Strength Standards Card ──────────────────────────────── */}
        <Card title={t("analysis.strengthStandards")}>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
            <Chip text={t("analysis.male")} active={gender === "male"} onPress={() => setGender("male")} />
            <Chip text={t("analysis.female")} active={gender === "female"} onPress={() => setGender("female")} />
          </View>
          {!bodyweight ? (
            <Text style={{ color: theme.muted }}>{t("analysis.noBodyweight")}</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {strengthStandardsData.map((item) => {
                const label = displayNameFor(item.exId);
                return (
                  <View
                    key={item.exId}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingVertical: 6,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.glassBorder,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ color: theme.text, fontSize: 14, fontFamily: theme.fontFamily.medium }}>
                          {label}
                        </Text>
                        <BackImpactDot exerciseId={item.exId} />
                      </View>
                      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                        {t("analysis.e1rmLabel")}: {item.e1rm ? wu.formatWeight(item.e1rm) : "—"}
                      </Text>
                    </View>
                    {item.level ? (
                      <View
                        style={{
                          backgroundColor: LEVEL_COLORS[item.level] + "22",
                          borderColor: LEVEL_COLORS[item.level],
                          borderWidth: 1,
                          borderRadius: theme.radius.md,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                        }}
                      >
                        <Text
                          style={{
                            color: LEVEL_COLORS[item.level],
                            fontFamily: theme.mono,
                            fontSize: 11,
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                          }}
                        >
                          {t(`analysis.${item.level}`)}
                        </Text>
                      </View>
                    ) : (
                      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>—</Text>
                    )}
                  </View>
                );
              })}
              <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, marginTop: 4 }}>
                {t("analysis.ratio")}: {bodyweight ? `${wu.formatWeight(bodyweight)} ${t("analysis.gender").toLowerCase()}` : ""}
              </Text>
            </View>
          )}
        </Card>

        {/* ── Body Composition Card ──────────────────────────────── */}
        <Card title={t("analysis.bodyComposition")}>
          {!bodyCompData ? (
            <Text style={{ color: theme.muted }}>{t("analysis.noBodyweight")}</Text>
          ) : (
            <View style={{ gap: 8 }}>
              <Text style={{ color: theme.muted }}>{t("analysis.weightTrend")}</Text>
              <LineChart
                values={bodyCompData.values.map((v) => wu.toDisplay(v))}
                labels={bodyCompData.labels}
                unit={wu.unitLabel()}
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                <View>
                  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>Current</Text>
                  <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 14 }}>
                    {wu.formatWeight(bodyCompData.current)}
                  </Text>
                </View>
                <View>
                  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>Min</Text>
                  <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 14 }}>
                    {wu.formatWeight(bodyCompData.min)}
                  </Text>
                </View>
                <View>
                  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>Max</Text>
                  <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 14 }}>
                    {wu.formatWeight(bodyCompData.max)}
                  </Text>
                </View>
                <View>
                  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>Change</Text>
                  <Text
                    style={{
                      color: bodyCompData.change > 0 ? "#FBBF24" : bodyCompData.change < 0 ? "#34D399" : theme.text,
                      fontFamily: theme.mono,
                      fontSize: 14,
                    }}
                  >
                    {bodyCompData.change > 0 ? "+" : ""}{wu.toDisplay(bodyCompData.change).toFixed(1)} {wu.unitLabel()}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </Card>

        {/* ── Compare Periods Card ─────────────────────────────── */}
        <Card title={t("analysis.comparePeriods")}>
          {(() => {
            const rows = [
              { label: t("common.workouts"), cur: thisPeriodData.workouts, prev: prevPeriodData.workouts },
              { label: t("common.volume"), cur: thisPeriodData.volume, prev: prevPeriodData.volume, isWeight: true },
              { label: t("common.sets"), cur: thisPeriodData.sets, prev: prevPeriodData.sets },
              { label: "e1RM", cur: thisPeriodData.bestE1rm, prev: prevPeriodData.bestE1rm, isWeight: true },
            ];
            return (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: theme.glassBorder }}>
                  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, flex: 1 }}> </Text>
                  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, width: 70, textAlign: "right" }}>{t("analysis.thisMonth")}</Text>
                  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, width: 70, textAlign: "right" }}>{t("analysis.lastMonth")}</Text>
                  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, width: 60, textAlign: "right" }}>{t("analysis.change")}</Text>
                </View>
                {rows.map((r) => {
                  const delta = r.cur - r.prev;
                  const pct = r.prev > 0 ? Math.round((delta / r.prev) * 100) : (r.cur > 0 ? 100 : 0);
                  const curDisplay = r.isWeight ? wu.toDisplay(r.cur).toFixed(0) : String(r.cur);
                  const prevDisplay = r.isWeight ? wu.toDisplay(r.prev).toFixed(0) : String(r.prev);
                  return (
                    <View key={r.label} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ color: theme.text, fontSize: 13, flex: 1 }}>{r.label}</Text>
                      <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 13, width: 70, textAlign: "right" }}>{curDisplay}</Text>
                      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 13, width: 70, textAlign: "right" }}>{prevDisplay}</Text>
                      <Text style={{
                        color: delta > 0 ? "#34D399" : delta < 0 ? "#F87171" : theme.muted,
                        fontFamily: theme.mono,
                        fontSize: 12,
                        width: 60,
                        textAlign: "right",
                      }}>
                        {delta > 0 ? `+${pct}% \u2191` : delta < 0 ? `${pct}% \u2193` : "\u2192"}
                      </Text>
                    </View>
                  );
                })}
              </View>
            );
          })()}
        </Card>

        {/* ── Muscle Balance Radar Card ──────────────────────────── */}
        <Card title={t("analysis.muscleBalance")}>
          {radarData.every((d) => d.value === 0) ? (
            <Text style={{ color: theme.muted }}>{t("analysis.noSetsInPeriod")}</Text>
          ) : (
            <View style={{ alignItems: "center", gap: 8 }}>
              <RadarChart data={radarData} size={240} />
              {radarHint ? (
                <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                  {radarHint}
                </Text>
              ) : null}
            </View>
          )}
        </Card>

        {sets.length === 0 ? (
          <Text style={{ color: theme.muted, textAlign: "center", marginTop: 8 }}>
            {t("analysis.noSetsInPeriod")}
          </Text>
        ) : null}
      </ScrollView>

      {/* Deload activated toast */}
      {deloadToast && (
        <View
          style={{
            position: "absolute",
            bottom: 50,
            left: 24,
            right: 24,
            backgroundColor: theme.glass,
            borderColor: theme.success,
            borderWidth: 1,
            borderRadius: 14,
            paddingVertical: 12,
            paddingHorizontal: 18,
            alignItems: "center",
            zIndex: 9999,
          }}
        >
          <Text style={{ color: theme.success, fontFamily: theme.fontFamily.semibold, fontSize: 14 }}>
            {t("home.deloadStarted")}
          </Text>
        </View>
      )}

      <Modal visible={exercisePickerOpen} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: theme.modalOverlay, padding: 14, justifyContent: "flex-end" }}>
          <View
            style={{
              backgroundColor: theme.modalGlass,
              borderColor: theme.glassBorder,
              borderWidth: 1,
              borderRadius: theme.radius.xl,
              overflow: "hidden",
              maxHeight: "80%",
              shadowColor: theme.shadow.lg.color,
              shadowOpacity: theme.shadow.lg.opacity,
              shadowRadius: theme.shadow.lg.radius,
              shadowOffset: theme.shadow.lg.offset,
              elevation: theme.shadow.lg.elevation,
            }}
          >
            <View
              style={{
                padding: 16,
                borderBottomColor: theme.glassBorder,
                borderBottomWidth: 1,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ color: theme.text, fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold }}>{t("analysis.chooseExercise")}</Text>
              <Pressable
                onPress={() => setExercisePickerOpen(false)}
                style={{ borderColor: theme.glassBorder, borderWidth: 1, borderRadius: theme.radius.md, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: theme.glass }}
              >
                <Text style={{ color: theme.accent, fontFamily: theme.mono }}>{t("analysis.close")}</Text>
              </Pressable>
            </View>

            <View style={{ padding: 16, gap: 12 }}>
              <TextField
                value={exerciseQuery}
                onChangeText={setExerciseQuery}
                placeholder={t("common.search")}
                placeholderTextColor={theme.muted}
                style={{
                  color: theme.text,
                  backgroundColor: theme.glass,
                  borderColor: theme.glassBorder,
                  borderWidth: 1,
                  borderRadius: theme.radius.lg,
                  padding: 12,
                }}
              />

              {filteredExerciseList.length === 0 ? (
                <Text style={{ color: theme.muted }}>{t("analysis.noMatch")}</Text>
              ) : (
                <FlatList
                  data={filteredExerciseList}
                  keyExtractor={(item) => item.key}
                  keyboardShouldPersistTaps="handled"
                  style={{ maxHeight: 360 }}
                  renderItem={({ item }) => {
                    const active = item.key === selectedExerciseKey;
                    return (
                      <Pressable
                        onPress={() => {
                          setSelectedExerciseKey(item.key);
                          setSettingAsync("analysisExerciseKey", item.key).catch(() => {});
                          setExercisePickerOpen(false);
                        }}
                        style={{
                          padding: 14,
                          borderRadius: theme.radius.lg,
                          borderWidth: 1,
                          borderColor: active ? theme.accent : theme.glassBorder,
                          backgroundColor: active ? (theme.isDark ? "rgba(182, 104, 245, 0.18)" : "rgba(124, 58, 237, 0.12)") : theme.glass,
                          marginBottom: 8,
                        }}
                      >
                        <Text style={{ color: theme.text, fontSize: 16 }} numberOfLines={1}>
                          {item.label}
                        </Text>
                        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>
                          {item.count} {t("common.sets").toLowerCase()}
                        </Text>
                      </Pressable>
                    );
                  }}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Goal Creation Modal */}
      <Modal visible={goalModalOpen} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: theme.modalOverlay, padding: 14, justifyContent: "center" }}>
          <View style={{ backgroundColor: theme.modalGlass, borderColor: theme.glassBorder, borderWidth: 1, borderRadius: theme.radius.xl, padding: 20, gap: 16 }}>
            <Text style={{ color: theme.text, fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.bold }}>
              {t("analysis.setGoal")}
            </Text>
            <Text style={{ color: theme.text, fontSize: theme.fontSize.md }}>{selectedExerciseLabel}</Text>

            <View style={{ gap: 8 }}>
              <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>{t("analysis.goalTypeLabel")}</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["weight", "volume", "reps"] as GoalType[]).map((gt) => (
                  <Pressable
                    key={gt}
                    onPress={() => setGoalType(gt)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      alignItems: "center",
                      borderRadius: theme.radius.lg,
                      borderWidth: 1,
                      borderColor: goalType === gt ? theme.accent : theme.glassBorder,
                      backgroundColor: goalType === gt
                        ? (theme.isDark ? "rgba(182,104,245,0.15)" : "rgba(124,58,237,0.10)")
                        : theme.glass,
                    }}
                  >
                    <Text style={{ color: goalType === gt ? theme.accent : theme.text, fontFamily: theme.fontFamily.medium, fontSize: 13 }}>
                      {t(`analysis.goalType.${gt}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>{t("analysis.targetValue")}</Text>
              <TextField
                value={goalTarget}
                onChangeText={setGoalTarget}
                keyboardType="numeric"
                placeholder={goalType === "reps" ? "12" : "100"}
                placeholderTextColor={theme.muted}
                style={{
                  color: theme.text,
                  backgroundColor: theme.glass,
                  borderColor: theme.glassBorder,
                  borderWidth: 1,
                  borderRadius: theme.radius.lg,
                  padding: 16,
                  fontSize: 28,
                  fontFamily: theme.mono,
                  textAlign: "center",
                }}
              />
              <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11, textAlign: "center" }}>
                {goalType === "reps"
                  ? t("analysis.repsHint")
                  : prStats?.heaviest
                    ? `${t("analysis.currentBest")}: ${goalType === "weight" ? wu.formatWeight(prStats.heaviest.value) : wu.formatWeight(prStats.volume?.value ?? 0)}`
                    : t("analysis.noPRYet")
                }
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={() => { setGoalModalOpen(false); setGoalTarget(""); }}
                style={{ flex: 1, paddingVertical: 14, alignItems: "center", borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.glassBorder, backgroundColor: theme.glass }}
              >
                <Text style={{ color: theme.text, fontFamily: theme.fontFamily.medium }}>{t("common.cancel")}</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  const target = parseFloat(goalTarget);
                  if (!target || target <= 0) { Alert.alert(t("common.error"), t("analysis.invalidGoalValue")); return; }
                  try {
                    const programMode = (await getSettingAsync("programMode")) || "normal";
                    const programId = await getSettingAsync(`activeProgramId_${programMode}`);
                    if (!programId) return;
                    const targetStore = goalType !== "reps" ? wu.toKg(target) : target;
                    await createGoal(selectedExerciseKey, goalType, targetStore, programId);
                    setGoalModalOpen(false);
                    setGoalTarget("");
                    loadGoals();
                  } catch (err) {
                    console.error("Failed to create goal:", err);
                  }
                }}
                style={{ flex: 1, paddingVertical: 14, alignItems: "center", borderRadius: theme.radius.lg, backgroundColor: theme.accent }}
              >
                <Text style={{ color: "#fff", fontFamily: theme.fontFamily.bold }}>{t("common.save")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Comparison Exercise Picker Modal */}
      <Modal visible={comparisonPickerOpen} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: theme.modalOverlay, padding: 14, justifyContent: "flex-end" }}>
          <View
            style={{
              backgroundColor: theme.modalGlass,
              borderColor: theme.glassBorder,
              borderWidth: 1,
              borderRadius: theme.radius.xl,
              overflow: "hidden",
              maxHeight: "80%",
            }}
          >
            <View
              style={{
                padding: 16,
                borderBottomColor: theme.glassBorder,
                borderBottomWidth: 1,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ color: theme.text, fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold }}>
                {t("analysis.chooseSecondExercise")}
              </Text>
              <Pressable
                onPress={() => setComparisonPickerOpen(false)}
                style={{ borderColor: theme.glassBorder, borderWidth: 1, borderRadius: theme.radius.md, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: theme.glass }}
              >
                <Text style={{ color: theme.accent, fontFamily: theme.mono }}>{t("analysis.close")}</Text>
              </Pressable>
            </View>

            <View style={{ padding: 16, gap: 12 }}>
              <TextField
                value={exerciseQuery}
                onChangeText={setExerciseQuery}
                placeholder={t("common.search")}
                placeholderTextColor={theme.muted}
                style={{
                  color: theme.text,
                  backgroundColor: theme.glass,
                  borderColor: theme.glassBorder,
                  borderWidth: 1,
                  borderRadius: theme.radius.lg,
                  padding: 12,
                }}
              />

              <FlatList
                data={filteredExerciseList.filter(e => e.key !== selectedExerciseKey)}
                keyExtractor={(item) => item.key}
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: 360 }}
                renderItem={({ item }) => {
                  const active = item.key === comparisonExerciseKey;
                  return (
                    <Pressable
                      onPress={() => {
                        setComparisonExerciseKey(item.key);
                        setComparisonPickerOpen(false);
                      }}
                      style={{
                        padding: 14,
                        borderRadius: theme.radius.lg,
                        borderWidth: 1,
                        borderColor: active ? "#F97316" : theme.glassBorder,
                        backgroundColor: active ? "rgba(249, 115, 22, 0.12)" : theme.glass,
                        marginBottom: 8,
                      }}
                    >
                      <Text style={{ color: theme.text, fontSize: 16 }} numberOfLines={1}>
                        {item.label}
                      </Text>
                      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>
                        {item.count} {t("common.sets").toLowerCase()}
                      </Text>
                    </Pressable>
                  );
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}













