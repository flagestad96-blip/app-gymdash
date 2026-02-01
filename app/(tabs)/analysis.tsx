// app/(tabs)/analysis.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, Modal, FlatList, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../src/theme";
import { useI18n } from "../../src/i18n";
import { LinearGradient } from "expo-linear-gradient";
import { ensureDb, getDb, getSettingAsync, setSettingAsync, listBodyMetrics, type BodyMetricRow } from "../../src/db";
import LineChart from "../../src/components/charts/LineChart";
import MuscleGroupBars, { MUSCLE_GROUPS, primaryMuscleGroups } from "../../src/components/charts/MuscleGroupBars";
import { getStandard, getStandardExerciseIds, hasStandard, getTargetWeights, type StrengthLevel, type Gender } from "../../src/strengthStandards";
import RadarChart, { type RadarDataPoint } from "../../src/components/charts/RadarChart";
import { getGoalsForExercise, createGoal, deleteGoal, getCurrentValueForGoal, type ExerciseGoal, type GoalType } from "../../src/goals";
import { displayNameFor, EXERCISES, searchExercises, resolveExerciseId, isBodyweight } from "../../src/exerciseLibrary";
import AppLoading from "../../components/AppLoading";
import { Screen, TopBar, Card, SegButton, IconButton, TextField, ListRow, Chip } from "../../src/ui";
import { useWeightUnit, unitLabel } from "../../src/units";

type RangeKey = "week" | "month" | "year";

type RowSet = {
  workout_id: string;
  exercise_id?: string | null;
  exercise_name: string;
  weight: number;
  reps: number;
  rpe?: number | null;
  created_at: string;
  set_type?: string | null;
  is_warmup?: number | null;
  est_total_load_kg?: number | null;
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

function isoDateOnly(d: Date) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const da = pad2(d.getDate());
  return `${y}-${m}-${da}`;
}

function addDays(d: Date, n: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
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

function parseTimeMs(iso: string | null | undefined) {
  if (!iso) return NaN;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function epley1RM(weight: number, reps: number) {
  const r = Math.max(1, reps);
  return weight * (1 + r / 30);
}

function isWarmup(row: RowSet) {
  if (row.is_warmup === 1) return true;
  return row.set_type === "warmup";
}

function weightForSet(row: RowSet): number | null {
  const exId = row.exercise_id ? String(row.exercise_id) : null;
  if (exId && isBodyweight(exId)) {
    return Number.isFinite(row.est_total_load_kg ?? NaN) ? (row.est_total_load_kg as number) : null;
  }
  return row.weight;
}

export default function Analysis() {
  const theme = useTheme();
  const { t } = useI18n();
  const wu = useWeightUnit();
  const [ready, setReady] = useState(false);

  const navigation = useNavigation();
  const openDrawer = useCallback(() => {
    const parent = (navigation as any)?.getParent?.();
    if (parent?.openDrawer) parent.openDrawer();
    else if ((navigation as any)?.openDrawer) (navigation as any).openDrawer();
  }, [navigation]);
  const [range, setRange] = useState<RangeKey>("month");

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

  useEffect(() => {
    ensureDb().then(async () => {
      const savedRange = (await getSettingAsync("analysisRange")) as RangeKey | null;
      if (savedRange) setRange(savedRange);

      const savedExerciseKey = await getSettingAsync("analysisExerciseKey");
      if (savedExerciseKey) setSelectedExerciseKey(savedExerciseKey);

      setReady(true);
    });
  }, []);

  // Load bodyweight and body metrics on mount
  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        const latest = await listBodyMetrics(1);
        if (latest.length > 0) setBodyweight(latest[0].weight_kg);
      } catch {}
      try {
        const metrics = await listBodyMetrics(90);
        setBodyMetrics90(metrics);
      } catch {}
    })();
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
      `SELECT workout_id, exercise_id, exercise_name, weight, reps, rpe, created_at, set_type, is_warmup, est_total_load_kg
       FROM sets
       WHERE created_at >= ?
       ORDER BY created_at ASC`,
      [fromDate]
    );
    setSets(Array.isArray(s) ? s : []);
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

      const day = isoDateOnly(new Date(row.created_at));
      const w = weightForSet(row);
      if (w == null) continue;
      const val = epley1RM(w, row.reps);
      perDay[day] = Math.max(perDay[day] ?? 0, val);
    }

    const days = Object.keys(perDay).sort();
    const labels = days.map((d) => d.slice(5));
    const values = days.map((d) => perDay[d]);
    return { labels, values };
  }, [sets, selectedExerciseKey]);

  const comparisonSeries = useMemo(() => {
    if (!comparisonMode || !comparisonExerciseKey) return { labels: [] as string[], values: [] as number[] };
    const perDay: Record<string, number> = {};
    for (const row of sets) {
      const key = (row.exercise_id && String(row.exercise_id)) || row.exercise_name;
      if (key !== comparisonExerciseKey) continue;
      const day = isoDateOnly(new Date(row.created_at));
      const w = weightForSet(row);
      if (w == null) continue;
      const val = epley1RM(w, row.reps);
      perDay[day] = Math.max(perDay[day] ?? 0, val);
    }
    const days = Object.keys(perDay).sort();
    return { labels: days.map((d) => d.slice(5)), values: days.map((d) => perDay[d]) };
  }, [sets, comparisonExerciseKey, comparisonMode]);

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

    return {
      last,
      bestWeight,
      best1rm,
      avgReps,
      count: filtered.length,
    };
  }, [sets, selectedExerciseKey]);

  const volumeSeries = useMemo(() => {
    const volumeByDay: Record<string, number> = {};
    for (const row of sets) {
      if (isWarmup(row)) continue;
      const day = isoDateOnly(new Date(row.created_at));
      const w = weightForSet(row);
      if (w == null) continue;
      const vol = w * row.reps;
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
        const wk = weekStartKey(new Date(day));
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
      const mk = monthKey(new Date(day));
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
      if (isWarmup(row)) continue;
      const wk = weekStartKey(new Date(row.created_at));
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
      const wk = weekStartKey(new Date(w.date));
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
      const day = isoDateOnly(new Date(row.created_at));
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
      if (isWarmup(row)) continue;
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
        const w = weightForSet(r);
        if (w == null) continue;
        const val = epley1RM(w, r.reps);
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

  // ── Muscle Balance Radar ──────────────────────────────────────────
  const RADAR_GROUPS = ["chest", "back", "shoulders", "biceps", "triceps", "quads", "hamstrings"] as const;

  const radarData = useMemo((): RadarDataPoint[] => {
    // Use last 4 weeks of sets
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 28);
    const cutoffIso = isoDateOnly(cutoff);

    const volumeByGroup: Record<string, number> = {};
    for (const g of RADAR_GROUPS) volumeByGroup[g] = 0;

    for (const row of sets) {
      if (isWarmup(row)) continue;
      const d = isoDateOnly(new Date(row.created_at));
      if (d < cutoffIso) continue;
      const w = weightForSet(row);
      if (w == null) continue;
      const vol = w * row.reps;
      const groups = primaryMuscleGroups(row.exercise_id, row.exercise_name);
      for (const g of groups) {
        if (g in volumeByGroup) {
          volumeByGroup[g] += vol;
        }
      }
    }

    const maxVol = Math.max(...Object.values(volumeByGroup), 1);
    return RADAR_GROUPS.map((g) => ({
      label: g.charAt(0).toUpperCase() + g.slice(1),
      value: volumeByGroup[g],
      max: maxVol,
    }));
  }, [sets]);

  if (!ready) {
    return <AppLoading />;
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.md }}>
        <TopBar title={t("analysis.title")} subtitle={t("analysis.subtitle")} left={<IconButton icon="menu" onPress={openDrawer} />} />

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
          <LineChart values={strengthIndexSeries.values.map(v => wu.toDisplay(v))} labels={strengthIndexSeries.labels} unit={wu.unitLabel()} />
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
            Totalt: {wu.toDisplay(volumeSeries.values.reduce((a, b) => a + b, 0)).toFixed(0)} {wu.unitLabel().toLowerCase()}-reps
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
              <LineChart values={exerciseSeries.values.map(v => wu.toDisplay(v))} labels={exerciseSeries.labels} unit={wu.unitLabel()} height={140} />
              <LineChart values={comparisonSeries.values.map(v => wu.toDisplay(v))} labels={comparisonSeries.labels} unit={wu.unitLabel()} height={140} />
            </View>
          ) : (
            <LineChart values={exerciseSeries.values.map(v => wu.toDisplay(v))} labels={exerciseSeries.labels} unit={wu.unitLabel()} />
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
                  {t("analysis.prVolume")}: {prStats.volume.value.toFixed(1)}
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
                        <Pressable onPress={async () => { await deleteGoal(goal.id); loadGoals(); }}>
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
                      <Text style={{ color: theme.text, fontSize: 14, fontFamily: theme.fontFamily.medium }}>
                        {label}
                      </Text>
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

        {/* ── Muscle Balance Radar Card ──────────────────────────── */}
        <Card title={t("analysis.muscleBalance")}>
          {radarData.every((d) => d.value === 0) ? (
            <Text style={{ color: theme.muted }}>{t("analysis.noSetsInPeriod")}</Text>
          ) : (
            <View style={{ alignItems: "center", gap: 8 }}>
              <RadarChart data={radarData} size={240} />
              <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>
                {t("analysis.muscleBalance")} — last 4 weeks volume
              </Text>
            </View>
          )}
        </Card>

        {sets.length === 0 ? (
          <Text style={{ color: theme.muted, textAlign: "center", marginTop: 8 }}>
            {t("analysis.noSetsInPeriod")}
          </Text>
        ) : null}
      </ScrollView>

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













