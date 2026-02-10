// app/(tabs)/calendar.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, Modal, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ensureDb, getDb, formatDuration } from "../../src/db";
import { useTheme } from "../../src/theme";
import { useI18n } from "../../src/i18n";
import { Screen, TopBar, IconButton, Card, ListRow, Btn } from "../../src/ui";
import { displayNameFor, tagsFor } from "../../src/exerciseLibrary";
import BackImpactDot from "../../src/components/BackImpactDot";
import { useWeightUnit } from "../../src/units";

type WorkoutRow = {
  id: string;
  date: string;
  day_index?: number | null;
  started_at?: string | null;
  ended_at?: string | null;
  notes?: string | null;
};

type SetRow = {
  id: string;
  exercise_id: string;
  exercise_name: string;
  set_index: number;
  weight: number;
  reps: number;
  rpe?: number | null;
  set_type?: string | null;
  is_warmup?: number | null;
  created_at?: string | null;
  notes?: string | null;
};

type DayMark = "rest" | "skipped" | "sick";

type WorkoutType = "push" | "pull" | "legs" | "other";

const WORKOUT_TYPE_COLORS: Record<WorkoutType, string> = {
  push: "#F97316",
  pull: "#A78BFA",
  legs: "#34D399",
  other: "#94A3B8",
};

const DAY_MARK_LABELS: Record<DayMark, { icon: string }> = {
  rest: { icon: "R" },
  skipped: { icon: "S" },
  sick: { icon: "!" },
};

const DAY_MARK_COLORS: Record<DayMark, string> = {
  rest: "#60A5FA",
  skipped: "#FBBF24",
  sick: "#F87171",
};

function classifyWorkout(exerciseIds: string[]): WorkoutType {
  let push = 0, pull = 0, legs = 0;
  for (const id of exerciseIds) {
    const tags = tagsFor(id);
    for (const tag of tags) {
      if (tag === "chest" || tag === "shoulders" || tag === "triceps") push++;
      else if (tag === "back" || tag === "biceps") pull++;
      else if (tag === "quads" || tag === "hamstrings" || tag === "glutes" || tag === "calves") legs++;
    }
  }
  const total = push + pull + legs;
  if (total === 0) return "other";
  // Must have >60% of tagged exercises in one category to classify
  if (push / total > 0.6) return "push";
  if (pull / total > 0.6) return "pull";
  if (legs / total > 0.6) return "legs";
  return "other";
}

function isoDateOnly(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function startOfMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex, 1);
}

function formatTime(isoStr: string | null | undefined): string {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

function epley1RM(w: number, r: number): number {
  if (r <= 0 || w <= 0) return 0;
  if (r === 1) return w;
  return w * (1 + r / 30);
}


export default function CalendarScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const wu = useWeightUnit();
  const navigation = useNavigation();
  const openDrawer = useCallback(() => {
    const parent = (navigation as any)?.getParent?.();
    if (parent?.openDrawer) parent.openDrawer();
    else if ((navigation as any)?.openDrawer) (navigation as any).openDrawer();
  }, [navigation]);

  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [setsByWorkout, setSetsByWorkout] = useState<Record<string, number>>({});
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Workout type classification per date
  const [workoutTypeByDate, setWorkoutTypeByDate] = useState<Record<string, WorkoutType>>({});

  // Day marks (rest/skipped/sick)
  const [dayMarks, setDayMarks] = useState<Record<string, DayMark>>({});

  // Day summary data: exercises + best set per exercise for each workout
  const [daySummaries, setDaySummaries] = useState<Record<string, Array<{ exId: string; name: string; bestWeight: number; bestReps: number; best1rm: number }>>>({});

  // Detail modal state
  const [detailWorkout, setDetailWorkout] = useState<WorkoutRow | null>(null);
  const [detailSets, setDetailSets] = useState<SetRow[]>([]);
  const [detailPRSetIds, setDetailPRSetIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    await ensureDb();
    const db = getDb();

    const w = await db.getAllAsync<WorkoutRow>(
      `SELECT id, date, day_index, started_at, ended_at, notes FROM workouts ORDER BY date ASC`
    );
    const wList = Array.isArray(w) ? w : [];
    setWorkouts(wList);

    const rows = await db.getAllAsync<{ workout_id: string; c: number }>(
      `SELECT workout_id, COUNT(1) as c FROM sets GROUP BY workout_id`
    );
    const map: Record<string, number> = {};
    for (const r of rows ?? []) map[r.workout_id] = r.c ?? 0;
    setSetsByWorkout(map);

    // Load exercise IDs per workout for classification + day summaries
    try {
      const allSets = await db.getAllAsync<{ workout_id: string; exercise_id: string; weight: number; reps: number; is_warmup: number | null }>(
        `SELECT workout_id, exercise_id, weight, reps, is_warmup FROM sets ORDER BY workout_id`
      );
      const byWorkout = new Map<string, Array<{ exercise_id: string; weight: number; reps: number; is_warmup: number | null }>>();
      for (const s of allSets ?? []) {
        if (!byWorkout.has(s.workout_id)) byWorkout.set(s.workout_id, []);
        byWorkout.get(s.workout_id)!.push(s);
      }

      const typeMap: Record<string, WorkoutType> = {};
      const summaryMap: Record<string, Array<{ exId: string; name: string; bestWeight: number; bestReps: number; best1rm: number }>> = {};

      // Group workouts by date for summary
      const workoutsByDateLocal: Record<string, WorkoutRow[]> = {};
      for (const wo of wList) {
        if (!workoutsByDateLocal[wo.date]) workoutsByDateLocal[wo.date] = [];
        workoutsByDateLocal[wo.date].push(wo);
      }

      for (const [date, dateWorkouts] of Object.entries(workoutsByDateLocal)) {
        // Merge all sets for the date for classification
        const allExIds: string[] = [];
        const exBest = new Map<string, { weight: number; reps: number; e1rm: number }>();

        for (const wo of dateWorkouts) {
          const sets = byWorkout.get(wo.id) ?? [];
          for (const s of sets) {
            if (s.exercise_id) allExIds.push(s.exercise_id);
            if (s.is_warmup) continue;
            const key = s.exercise_id || "unknown";
            const e1rm = epley1RM(s.weight, s.reps);
            const prev = exBest.get(key);
            if (!prev || e1rm > prev.e1rm) {
              exBest.set(key, { weight: s.weight, reps: s.reps, e1rm });
            }
          }
        }

        const uniqueIds = [...new Set(allExIds)];
        typeMap[date] = classifyWorkout(uniqueIds);

        // Build summary: best set per exercise
        const summary: Array<{ exId: string; name: string; bestWeight: number; bestReps: number; best1rm: number }> = [];
        for (const [exId, best] of exBest) {
          summary.push({
            exId,
            name: displayNameFor(exId),
            bestWeight: best.weight,
            bestReps: best.reps,
            best1rm: best.e1rm,
          });
        }
        summary.sort((a, b) => b.best1rm - a.best1rm);
        summaryMap[date] = summary;
      }

      setWorkoutTypeByDate(typeMap);
      setDaySummaries(summaryMap);
    } catch {}

    // Load day marks
    try {
      const marks = await db.getAllAsync<{ date: string; status: string }>(
        `SELECT date, status FROM day_marks`
      );
      const markMap: Record<string, DayMark> = {};
      for (const m of marks ?? []) markMap[m.date] = m.status as DayMark;
      setDayMarks(markMap);
    } catch {}
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const setDayMark = useCallback(async (date: string, status: DayMark | null) => {
    try {
      const db = getDb();
      if (status) {
        db.runSync(
          `INSERT INTO day_marks(date, status) VALUES(?, ?) ON CONFLICT(date) DO UPDATE SET status=excluded.status`,
          [date, status]
        );
        setDayMarks((prev) => ({ ...prev, [date]: status }));
      } else {
        db.runSync(`DELETE FROM day_marks WHERE date = ?`, [date]);
        setDayMarks((prev) => {
          const next = { ...prev };
          delete next[date];
          return next;
        });
      }
    } catch {}
  }, []);

  const openDetail = useCallback(async (w: WorkoutRow) => {
    setDetailWorkout(w);
    try {
      const sets = await getDb().getAllAsync<SetRow>(
        `SELECT id, exercise_id, exercise_name, set_index, weight, reps, rpe, set_type, is_warmup, created_at, notes
         FROM sets WHERE workout_id = ? ORDER BY exercise_id, set_index`,
        [w.id]
      );
      setDetailSets(Array.isArray(sets) ? sets : []);

      // Find PR set IDs for this workout
      const prRows = await getDb().getAllAsync<{ set_id: string }>(
        `SELECT set_id FROM pr_records WHERE set_id IN (
           SELECT id FROM sets WHERE workout_id = ?
         )`,
        [w.id]
      );
      const prIds = new Set<string>();
      for (const r of prRows ?? []) if (r.set_id) prIds.add(r.set_id);
      setDetailPRSetIds(prIds);
    } catch {
      setDetailSets([]);
      setDetailPRSetIds(new Set());
    }
  }, []);

  // Group detail sets by exercise
  const exerciseGroups = useMemo(() => {
    const groups: Array<{ exId: string; name: string; sets: SetRow[] }> = [];
    const map = new Map<string, SetRow[]>();
    const order: string[] = [];
    for (const s of detailSets) {
      const key = s.exercise_id || s.exercise_name;
      if (!map.has(key)) {
        map.set(key, []);
        order.push(key);
      }
      map.get(key)!.push(s);
    }
    for (const key of order) {
      const sets = map.get(key)!;
      const name = sets[0].exercise_id ? displayNameFor(sets[0].exercise_id) : sets[0].exercise_name;
      groups.push({ exId: key, name, sets });
    }
    return groups;
  }, [detailSets]);

  // Summary stats
  const detailSummary = useMemo(() => {
    if (!detailSets.length) return { totalSets: 0, totalVolume: 0, exercises: 0, duration: "" };
    const nonWarmup = detailSets.filter((s) => !s.is_warmup);
    const totalVolume = nonWarmup.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0);
    const lastSet = detailSets[detailSets.length - 1];
    const endRef = detailWorkout?.ended_at || lastSet?.created_at;
    return {
      totalSets: nonWarmup.length,
      totalVolume: Math.round(totalVolume),
      exercises: exerciseGroups.length,
      duration: formatDuration(detailWorkout?.started_at, endRef),
    };
  }, [detailSets, detailWorkout, exerciseGroups]);

  const monthDate = useMemo(() => {
    const now = new Date();
    now.setMonth(now.getMonth() + monthOffset);
    return now;
  }, [monthOffset]);

  const monthKey = useMemo(() => {
    const y = monthDate.getFullYear();
    const m = String(monthDate.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }, [monthDate]);

  const days = useMemo(() => {
    const year = monthDate.getFullYear();
    const monthIdx = monthDate.getMonth();
    const count = daysInMonth(year, monthIdx);
    const first = startOfMonth(year, monthIdx);
    const startOffset = (first.getDay() + 6) % 7; // monday first

    const cells: Array<{ date: string | null; label: string }> = [];
    for (let i = 0; i < startOffset; i += 1) cells.push({ date: null, label: "" });
    for (let d = 1; d <= count; d += 1) {
      const date = new Date(year, monthIdx, d);
      cells.push({ date: isoDateOnly(date), label: String(d) });
    }
    return cells;
  }, [monthDate]);

  const workoutsByDate = useMemo(() => {
    const map: Record<string, WorkoutRow[]> = {};
    for (const w of workouts) {
      if (!map[w.date]) map[w.date] = [];
      map[w.date].push(w);
    }
    return map;
  }, [workouts]);

  const selectedWorkouts = selectedDate ? workoutsByDate[selectedDate] ?? [] : [];
  const selectedMark = selectedDate ? dayMarks[selectedDate] ?? null : null;
  const selectedSummary = selectedDate ? daySummaries[selectedDate] ?? [] : [];

  function showMarkOptions(date: string) {
    const options: Array<{ text: string; onPress: () => void; style?: "cancel" | "destructive" }> = [
      { text: t("calendar.markRest"), onPress: () => setDayMark(date, "rest") },
      { text: t("calendar.markSkipped"), onPress: () => setDayMark(date, "skipped") },
      { text: t("calendar.markSick"), onPress: () => setDayMark(date, "sick") },
    ];
    if (dayMarks[date]) {
      options.push({ text: t("calendar.clearMark"), onPress: () => setDayMark(date, null), style: "destructive" });
    }
    options.push({ text: t("common.cancel"), onPress: () => {}, style: "cancel" });
    Alert.alert(t("calendar.markDay"), t("calendar.markDayMsg"), options);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.md, paddingBottom: 80 }}>
        <TopBar title={t("calendar.title")} subtitle={monthKey} left={<IconButton icon="menu" onPress={openDrawer} />} />

        <Card title={t("calendar.month")}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <BtnSmall label="‹" onPress={() => setMonthOffset((v) => v - 1)} />
            <Text style={{ color: theme.text, fontFamily: theme.mono }}>{monthKey}</Text>
            <BtnSmall label="›" onPress={() => setMonthOffset((v) => v + 1)} />
          </View>

          {/* Legend */}
          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
            {(["push", "pull", "legs", "other"] as WorkoutType[]).map((wt) => (
              <View key={wt} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: WORKOUT_TYPE_COLORS[wt] }} />
                <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 9 }}>
                  {t(`calendar.type.${wt}`)}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        <Card title={t("calendar.days")}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {[t("calendar.dayAbbr.mon"), t("calendar.dayAbbr.tue"), t("calendar.dayAbbr.wed"), t("calendar.dayAbbr.thu"), t("calendar.dayAbbr.fri"), t("calendar.dayAbbr.sat"), t("calendar.dayAbbr.sun")].map((d, i) => (
              <Text key={`${d}_${i}`} style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12, width: 28, textAlign: "center" }}>
                {d}
              </Text>
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
            {days.map((cell, idx) => {
              const hasWorkout = cell.date ? (workoutsByDate[cell.date]?.length ?? 0) > 0 : false;
              const isSelected = cell.date && cell.date === selectedDate;
              const wType = cell.date ? workoutTypeByDate[cell.date] : undefined;
              const mark = cell.date ? dayMarks[cell.date] : undefined;
              return (
                <Pressable
                  key={`${cell.label}_${idx}`}
                  onPress={() => cell.date && setSelectedDate(cell.date)}
                  onLongPress={() => cell.date && showMarkOptions(cell.date)}
                  style={{
                    width: "14.28%",
                    paddingVertical: 8,
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: isSelected ? theme.accent : theme.glassBorder,
                      backgroundColor: hasWorkout ? theme.panel2 : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 12 }}>
                      {cell.label}
                    </Text>
                  </View>
                  {hasWorkout ? (
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        backgroundColor: wType ? WORKOUT_TYPE_COLORS[wType] : theme.accent,
                        marginTop: 4,
                      }}
                    />
                  ) : mark ? (
                    <Text style={{
                      color: DAY_MARK_COLORS[mark],
                      fontFamily: theme.mono,
                      fontSize: 7,
                      marginTop: 3,
                      lineHeight: 8,
                    }}>
                      {DAY_MARK_LABELS[mark].icon}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card title={t("calendar.workouts")}>
          {!selectedDate ? (
            <Text style={{ color: theme.muted }}>{t("calendar.selectDate")}</Text>
          ) : selectedWorkouts.length === 0 && !selectedMark ? (
            <View style={{ gap: 10 }}>
              <Text style={{ color: theme.muted }}>{t("calendar.noWorkouts", { date: selectedDate })}</Text>
              <Btn label={t("calendar.markDay")} onPress={() => showMarkOptions(selectedDate)} />
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {/* Day mark badge */}
              {selectedMark ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    borderRadius: 8,
                    backgroundColor: `${DAY_MARK_COLORS[selectedMark]}22`,
                    borderWidth: 1,
                    borderColor: DAY_MARK_COLORS[selectedMark],
                  }}>
                    <Text style={{
                      color: DAY_MARK_COLORS[selectedMark],
                      fontFamily: theme.mono,
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}>
                      {t(`calendar.mark.${selectedMark}`)}
                    </Text>
                  </View>
                  <Pressable onPress={() => setDayMark(selectedDate, null)}>
                    <Text style={{ color: theme.muted, fontSize: 11 }}>{t("calendar.clearMark")}</Text>
                  </Pressable>
                </View>
              ) : null}

              {/* Workout type badge + date */}
              {selectedWorkouts.length > 0 ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: theme.muted, fontFamily: theme.mono }}>{selectedDate}</Text>
                  {workoutTypeByDate[selectedDate] ? (
                    <View style={{
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 6,
                      backgroundColor: `${WORKOUT_TYPE_COLORS[workoutTypeByDate[selectedDate]]}22`,
                      borderWidth: 1,
                      borderColor: WORKOUT_TYPE_COLORS[workoutTypeByDate[selectedDate]],
                    }}>
                      <Text style={{
                        color: WORKOUT_TYPE_COLORS[workoutTypeByDate[selectedDate]],
                        fontFamily: theme.mono,
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}>
                        {t(`calendar.type.${workoutTypeByDate[selectedDate]}`)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Enhanced day summary: exercises + best sets */}
              {selectedSummary.length > 0 ? (
                <View style={{
                  backgroundColor: theme.glass,
                  borderRadius: 10,
                  padding: 10,
                  borderWidth: 1,
                  borderColor: theme.glassBorder,
                  gap: 4,
                }}>
                  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {t("calendar.daySummary")}
                  </Text>
                  {selectedSummary.map((ex) => (
                    <View key={ex.exId} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ color: theme.text, fontSize: 13, flex: 1 }} numberOfLines={1}>
                        {ex.name}
                      </Text>
                      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>
                        {wu.formatWeight(ex.bestWeight)}{"\u00d7"}{ex.bestReps}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Workout list rows */}
              {selectedWorkouts.map((w, idx) => {
                const setsCount = setsByWorkout[w.id] ?? 0;
                const dayLabel = Number.isFinite(w.day_index ?? NaN) ? `${t("common.day")} ${(w.day_index ?? 0) + 1}` : "";
                return (
                  <ListRow
                    key={w.id}
                    title={dayLabel || t("common.workouts")}
                    subtitle={`${setsCount} ${t("common.sets").toLowerCase()}`}
                    onPress={() => openDetail(w)}
                    right={
                      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>
                        {w.date.slice(5)}
                      </Text>
                    }
                    divider={idx < selectedWorkouts.length - 1}
                  />
                );
              })}

              {/* Mark day button when workouts exist */}
              {selectedWorkouts.length > 0 && !selectedMark ? (
                <Btn label={t("calendar.markDay")} onPress={() => showMarkOptions(selectedDate)} />
              ) : null}
            </View>
          )}
        </Card>
      </ScrollView>

      {/* Workout Detail Modal */}
      <Modal visible={detailWorkout !== null} transparent animationType="slide" onRequestClose={() => setDetailWorkout(null)}>
        <View style={{ flex: 1, backgroundColor: theme.modalOverlay, padding: 14, paddingTop: 60, justifyContent: "flex-start" }}>
          <View
            style={{
              backgroundColor: theme.modalGlass,
              borderColor: theme.glassBorder,
              borderWidth: 1,
              borderRadius: 18,
              overflow: "hidden",
              maxHeight: "90%",
            }}
          >
            {/* Header */}
            <View style={{ padding: 14, borderBottomColor: theme.glassBorder, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ color: theme.text, fontFamily: theme.fontFamily.semibold, fontSize: 18 }}>
                  {detailWorkout?.date ?? ""}
                  {detailWorkout?.day_index != null ? ` \u2014 ${t("common.day")} ${(detailWorkout.day_index ?? 0) + 1}` : ""}
                </Text>
                {detailWorkout?.started_at ? (
                  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>
                    {t("calendar.started", { time: formatTime(detailWorkout.started_at) })}
                    {detailSummary.duration ? ` \u00B7 ${detailSummary.duration}` : ""}
                  </Text>
                ) : null}
              </View>
              <IconButton icon="close" onPress={() => setDetailWorkout(null)} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 14, gap: 14, paddingBottom: 30 }}>
              {/* Summary */}
              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                <StatChip label={t("common.exercises")} value={String(detailSummary.exercises)} theme={theme} />
                <StatChip label={t("common.sets")} value={String(detailSummary.totalSets)} theme={theme} />
                <StatChip label={t("common.volume")} value={wu.formatWeight(detailSummary.totalVolume)} theme={theme} />
              </View>

              {/* Workout notes */}
              {detailWorkout?.notes ? (
                <View style={{ backgroundColor: theme.glass, borderRadius: 10, padding: 10 }}>
                  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, marginBottom: 4 }}>{t("calendar.note")}</Text>
                  <Text style={{ color: theme.text, fontFamily: theme.fontFamily.regular, fontSize: 14 }}>{detailWorkout.notes}</Text>
                </View>
              ) : null}

              {/* Exercise groups */}
              {exerciseGroups.map((group) => (
                <View key={group.exId} style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ color: theme.text, fontFamily: theme.fontFamily.semibold, fontSize: 15 }}>
                      {group.name}
                    </Text>
                    <BackImpactDot exerciseId={group.exId} />
                  </View>

                  {/* Set header */}
                  <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 4 }}>
                    <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, width: 24 }}>#</Text>
                    <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, flex: 1 }}>{wu.unitLabel()}</Text>
                    <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, flex: 1 }}>REPS</Text>
                    <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, width: 36 }}>RPE</Text>
                    <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, width: 50 }}>TYPE</Text>
                  </View>

                  {/* Individual sets */}
                  {group.sets.map((s, sIdx) => {
                    const isPR = detailPRSetIds.has(s.id);
                    const isWarmup = s.is_warmup === 1;
                    const typeLabel = isWarmup ? "warmup" : (s.set_type && s.set_type !== "normal" ? s.set_type : "");
                    return (
                      <View key={s.id}>
                        <View
                          style={{
                            flexDirection: "row",
                            gap: 6,
                            paddingHorizontal: 4,
                            paddingVertical: 4,
                            backgroundColor: isPR ? (theme.isDark ? "rgba(182,104,245,0.12)" : "rgba(124,58,237,0.08)") : "transparent",
                            borderRadius: 6,
                            alignItems: "center",
                          }}
                        >
                          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12, width: 24 }}>
                            {sIdx + 1}
                          </Text>
                          <Text style={{ color: isWarmup ? theme.muted : theme.text, fontFamily: theme.mono, fontSize: 14, flex: 1 }}>
                            {wu.toDisplay(s.weight ?? 0)}
                          </Text>
                          <Text style={{ color: isWarmup ? theme.muted : theme.text, fontFamily: theme.mono, fontSize: 14, flex: 1 }}>
                            {s.reps ?? 0}
                          </Text>
                          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12, width: 36 }}>
                            {s.rpe ?? ""}
                          </Text>
                          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, width: 50 }}>
                            {isPR ? "PR" : typeLabel}
                          </Text>
                        </View>
                        {s.notes ? (
                          <Text style={{ color: theme.muted, fontFamily: theme.fontFamily.regular, fontSize: 12, paddingLeft: 28, paddingBottom: 2 }}>
                            {s.notes}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ))}

              {exerciseGroups.length === 0 ? (
                <Text style={{ color: theme.muted }}>{t("calendar.noSetsLogged")}</Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function StatChip({ label, value, theme }: { label: string; value: string; theme: any }) {
  return (
    <View style={{ backgroundColor: theme.glass, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: theme.glassBorder }}>
      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>{label}</Text>
      <Text style={{ color: theme.text, fontFamily: theme.fontFamily.semibold, fontSize: 16 }}>{value}</Text>
    </View>
  );
}

function BtnSmall({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderColor: theme.glassBorder,
        borderWidth: 1,
        borderRadius: theme.radius.md,
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: theme.panel2,
      }}
    >
      <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: theme.textSize.md }}>{label}</Text>
    </Pressable>
  );
}
