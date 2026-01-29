// app/(tabs)/analysis.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, Modal, FlatList } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Svg, { Path, Circle } from "react-native-svg";
import { theme } from "../../src/theme";
import { ensureDb, getDb, getSettingAsync, setSettingAsync } from "../../src/db";
import { displayNameFor, EXERCISES, searchExercises, tagsFor, resolveExerciseId, isBodyweight } from "../../src/exerciseLibrary";
import AppLoading from "../../components/AppLoading";
import { Screen, TopBar, Card, SegButton, IconButton, TextField, ListRow } from "../../src/ui";

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

const MUSCLE_GROUPS = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
] as const;

function primaryMuscleGroups(exerciseId?: string | null, exerciseName?: string | null): string[] {
  const exId = exerciseId ? String(exerciseId) : exerciseName ? resolveExerciseId(exerciseName) : null;
  if (!exId) return ["other"];
  const tags = tagsFor(exId);
  const groups = tags.filter((t) => MUSCLE_GROUPS.includes(t as (typeof MUSCLE_GROUPS)[number]));
  if (groups.length === 0) return ["other"];
  return groups.slice(0, 2);
}

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

function buildLinePath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  let d = `M ${first.x} ${first.y}`;
  for (const p of rest) d += ` L ${p.x} ${p.y}`;
  return d;
}

function LineChart({
  values,
  labels,
  height = 140,
}: {
  values: number[];
  labels: string[];
  height?: number;
}) {
  const width = 320;

  const safeValues = values.filter((v) => Number.isFinite(v));
  const minV = safeValues.length ? Math.min(...safeValues) : 0;
  const maxV = safeValues.length ? Math.max(...safeValues) : 1;
  const pad = 12;

  const span = Math.max(1e-9, maxV - minV);

  const points = values.map((v, i) => {
    const x = pad + (i * (width - pad * 2)) / Math.max(1, values.length - 1);
    const y = pad + ((maxV - v) * (height - pad * 2)) / span;
    return { x, y };
  });

  const d = buildLinePath(points);

  if (values.length === 0) {
    return (
      <View style={{ paddingVertical: 10 }}>
        <Text style={{ color: theme.muted }}>Ingen data i valgt periode.</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <Svg width={width} height={height}>
        <Path d={d} stroke={theme.text} strokeWidth={2} fill="none" />
        {points.map((p, idx) => (
          <Circle key={idx} cx={p.x} cy={p.y} r={2.8} fill={theme.text} />
        ))}
      </Svg>

      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>{labels[0] ?? ""}</Text>
        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>
          {labels[labels.length - 1] ?? ""}
        </Text>
      </View>

      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>
        Min {minV.toFixed(1)} - Max {maxV.toFixed(1)}
      </Text>
    </View>
  );
}

export default function Analysis() {
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

  useEffect(() => {
    ensureDb().then(async () => {
      const savedRange = (await getSettingAsync("analysisRange")) as RangeKey | null;
      if (savedRange) setRange(savedRange);

      const savedExerciseKey = await getSettingAsync("analysisExerciseKey");
      if (savedExerciseKey) setSelectedExerciseKey(savedExerciseKey);

      setReady(true);
    });
  }, []);

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
    return found?.label ?? "Velg øvelse";
  }, [exerciseKeys, selectedExerciseKey]);

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
      if (count < low) return "for lite";
      if (count > high) return "mye";
      return "ok";
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

  if (!ready) {
    return <AppLoading />;
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.md }}>
        <TopBar title="Analyse" subtitle={`Range: ${range}`} left={<IconButton icon="menu" onPress={openDrawer} />} />

        <Card title="RANGE">
          <View style={{ flexDirection: "row", gap: 8 }}>
            <SegButton label="UKE" active={range === "week"} onPress={() => setRangeAndPersist("week")} />
            <SegButton label="MÅNED" active={range === "month"} onPress={() => setRangeAndPersist("month")} />
            <SegButton label="ÅR" active={range === "year"} onPress={() => setRangeAndPersist("year")} />
          </View>
          <Text style={{ color: theme.muted }}>Viser data fra siste {daysBack(range)} dager.</Text>
        </Card>

        <Card title="STRENGTH INDEX">
          <Text style={{ color: theme.muted }}>
            Basert på beste e1RM per øvelse per økt (uten warmup). Baseline = snitt av de 3 første øktene.
          </Text>
          <LineChart values={strengthIndexSeries.values} labels={strengthIndexSeries.labels} />
        </Card>

        <Card title="VOLUM">
          <Text style={{ color: theme.muted }}>
            {range === "week"
              ? "Daglig volum (sum kg x reps)."
              : range === "month"
              ? "Ukentlig volum i perioden."
              : "Månedlig volum i perioden."}
          </Text>
          <LineChart values={volumeSeries.values} labels={volumeSeries.labels} />
          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
            Totalt: {volumeSeries.values.reduce((a, b) => a + b, 0).toFixed(0)} kg-reps
          </Text>
        </Card>

        <Card title="MUSKELGRUPPER (HARD SETS)">
          {muscleStats.rows.length === 0 ? (
            <Text style={{ color: theme.muted }}>Ingen sett i valgt periode.</Text>
          ) : (
            <View style={{ gap: 8 }}>
              <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                Uke fra {muscleStats.week}
              </Text>
              {muscleStats.rows.map((r, idx) => (
                <ListRow
                  key={r.group}
                  title={r.group}
                  subtitle={`${r.count} sett · ${r.status}${r.delta === 0 ? "" : r.delta > 0 ? ` (+${r.delta})` : ` (${r.delta})`}`}
                  divider={idx < muscleStats.rows.length - 1}
                />
              ))}
            </View>
          )}
        </Card>

        <Card title="KONSISTENS">
          {consistencyStats.length === 0 ? (
            <Text style={{ color: theme.muted }}>Ingen økter i valgt periode.</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {consistencyStats.map((row, idx) => (
                <ListRow
                  key={row.week}
                  title={`Uke ${row.week}`}
                  subtitle={`${row.count} økter · ${row.totalMin.toFixed(0)} min`}
                  divider={idx < consistencyStats.length - 1}
                />
              ))}
            </View>
          )}
        </Card>

        <Card title="ØVELSE">
          <Pressable
            onPress={() => setExercisePickerOpen(true)}
            style={{
              borderColor: theme.line,
              borderWidth: 1,
              borderRadius: 14,
              padding: 12,
              backgroundColor: theme.panel2,
            }}
          >
            <Text style={{ color: theme.text, fontSize: 16 }} numberOfLines={1}>
              {selectedExerciseLabel}
            </Text>
            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>Trykk for å velge</Text>
          </Pressable>

          <Text style={{ color: theme.muted }}>
            Grafen bruker «best set per dag» (estimert 1RM) for å være stabil.
          </Text>

          <LineChart values={exerciseSeries.values} labels={exerciseSeries.labels} />
        </Card>

        <Card title="STATISTIKK">
          {!exerciseStats ? (
            <Text style={{ color: theme.muted }}>Ingen sett logget for valgt øvelse enda.</Text>
          ) : (
            <View style={{ gap: 6 }}>
              <Text style={{ color: theme.text }}>
                Sist: {exerciseStats.last.weight} kg x {exerciseStats.last.reps} ({exerciseStats.last.created_at.slice(0, 10)})
              </Text>
              <Text style={{ color: theme.muted }}>Beste vekt: {exerciseStats.bestWeight.toFixed(1)} kg</Text>
              <Text style={{ color: theme.muted }}>Beste est. 1RM: {exerciseStats.best1rm.toFixed(1)} kg</Text>
              <Text style={{ color: theme.muted }}>Snitt reps: {exerciseStats.avgReps.toFixed(1)}</Text>
              <Text style={{ color: theme.muted }}>Sett i perioden: {exerciseStats.count}</Text>
            </View>
          )}
        </Card>

        <Card title="PRS">
          {!prStats || (!prStats.heaviest && !prStats.e1rm && !prStats.volume) ? (
            <Text style={{ color: theme.muted }}>Ingen PR-data for valgt øvelse.</Text>
          ) : (
            <View style={{ gap: 6 }}>
              {prStats.heaviest ? (
                <Text style={{ color: theme.text }}>
                  Tungeste: {prStats.heaviest.value.toFixed(1)} kg
                  {prStats.heaviest.date ? ` (${prStats.heaviest.date})` : ""}
                </Text>
              ) : null}
              {prStats.e1rm ? (
                <Text style={{ color: theme.text }}>
                  e1RM: {prStats.e1rm.value.toFixed(1)} kg
                  {prStats.e1rm.date ? ` (${prStats.e1rm.date})` : ""}
                </Text>
              ) : null}
              {prStats.volume ? (
                <Text style={{ color: theme.text }}>
                  Volum-sett: {prStats.volume.value.toFixed(1)}
                  {prStats.volume.date ? ` (${prStats.volume.date})` : ""}
                </Text>
              ) : null}
            </View>
          )}
        </Card>

        <Card title="OVERALL PROGRESJON">
          <Text style={{ color: theme.muted }}>
            Gjennomsnitt av «beste sett» per øvelse per dag (estimert 1RM).
          </Text>
          <LineChart values={overallSeries.values} labels={overallSeries.labels} />
        </Card>

        <Card title="ØKT-TID (SNITT)">
          {durationStats.count === 0 ? (
            <Text style={{ color: theme.muted }}>Ingen komplette økter med starttid funnet i valgt periode.</Text>
          ) : (
            <>
              <Text style={{ color: theme.text, fontSize: 18 }}>{durationStats.avg.toFixed(1)} min</Text>
              <Text style={{ color: theme.muted }}>
                Basert på {durationStats.count} økter (start til siste set).
              </Text>

              {durationStats.dayAverages.length > 0 ? (
                <View style={{ gap: 6, marginTop: 8 }}>
                  {durationStats.dayAverages.map((d) => (
                    <Text key={d.dayIndex} style={{ color: theme.muted, fontFamily: theme.mono }}>
                      Dag {d.dayIndex + 1}: {d.avgMin.toFixed(1)} min (n={d.n})
                    </Text>
                  ))}
                </View>
              ) : null}
            </>
          )}
        </Card>

        {sets.length === 0 ? (
          <Text style={{ color: theme.muted, textAlign: "center", marginTop: 8 }}>
            Ingen sett logget i valgt periode enda.
          </Text>
        ) : null}
      </ScrollView>

      <Modal visible={exercisePickerOpen} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", padding: 14, justifyContent: "flex-end" }}>
          <View
            style={{
              backgroundColor: theme.bg,
              borderColor: theme.line,
              borderWidth: 1,
              borderRadius: 18,
              overflow: "hidden",
              maxHeight: "80%",
            }}
          >
            <View
              style={{
                padding: 14,
                borderBottomColor: theme.line,
                borderBottomWidth: 1,
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ color: theme.text, fontSize: 16 }}>Velg øvelse</Text>
              <Pressable
                onPress={() => setExercisePickerOpen(false)}
                style={{ borderColor: theme.line, borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 }}
              >
                <Text style={{ color: theme.muted, fontFamily: theme.mono }}>LUKK</Text>
              </Pressable>
            </View>

            <View style={{ padding: 14, gap: 10 }}>
              <TextField
                value={exerciseQuery}
                onChangeText={setExerciseQuery}
                placeholder="Søk..."
                placeholderTextColor={theme.muted}
                style={{
                  color: theme.text,
                  backgroundColor: theme.panel,
                  borderColor: theme.line,
                  borderWidth: 1,
                  borderRadius: 14,
                  padding: 12,
                }}
              />

              {filteredExerciseList.length === 0 ? (
                <Text style={{ color: theme.muted }}>Ingen treff.</Text>
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
                          padding: 12,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: active ? theme.accent : theme.line,
                          backgroundColor: theme.panel,
                          marginBottom: 8,
                        }}
                      >
                        <Text style={{ color: theme.text, fontSize: 16 }} numberOfLines={1}>
                          {item.label}
                        </Text>
                        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>
                          {item.count} sett
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
    </Screen>
  );
}













