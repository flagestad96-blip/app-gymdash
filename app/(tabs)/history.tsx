// app/(tabs)/history.tsx
//
// Two-mode history screen:
//   - Workouts (default): list of completed workouts; tap → /workout/[id]
//   - Sets: legacy search-by-exercise behaviour preserved
//
// The Workouts mode is what users intuitively expect from a "log" tab:
// each completed session is a tappable row with date, day name, duration,
// volume and set count. Editing is intentionally deferred (will be wired
// to PR-recalculation in a follow-up sprint).
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, FlatList, Modal } from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { ensureDb, getDb } from "../../src/db";
import { useTheme } from "../../src/theme";
import { useI18n } from "../../src/i18n";
import { Screen, TopBar, Chip, IconButton, TextField, Btn } from "../../src/ui";
import { displayNameFor, searchExercises } from "../../src/exerciseLibrary";
import { SkeletonCard } from "../../src/components/Skeleton";
import { useWeightUnit } from "../../src/units";
import { isoDateOnly } from "../../src/storage";
import { formatWeight } from "../../src/format";

// ── Types ──────────────────────────────────────────────────────────────────

type TimePeriod = "week" | "month" | "3mo" | "all";
type Mode = "workouts" | "sets";

type WorkoutRow = {
  id: string;
  date: string;
  started_at: string | null;
  ended_at: string | null;
  day_index: number | null;
  program_id: string | null;
  day_name: string | null;
  set_count: number;
  working_sets: number;
  volume_kg: number;
};

type HistorySetRow = {
  id: string;
  workout_id: string;
  exercise_id: string | null;
  exercise_name: string;
  set_index: number;
  weight: number;
  reps: number;
  rpe: number | null;
  created_at: string;
  workout_date: string;
  started_at: string | null;
  day_index: number | null;
  rest_seconds: number | null;
};

type SectionItem =
  | { kind: "header"; key: string; workoutDate: string; workoutId: string; setCount: number; expanded: boolean }
  | { kind: "set"; key: string; set: HistorySetRow };

// ── Helpers ────────────────────────────────────────────────────────────────

const PERIOD_ORDER: TimePeriod[] = ["all", "week", "month", "3mo"];
const PAGE_SIZE = 500;

function periodCutoffIso(period: TimePeriod): string | null {
  if (period === "all") return null;
  const d = new Date();
  if (period === "week") d.setDate(d.getDate() - 7);
  else if (period === "month") d.setDate(d.getDate() - 30);
  else if (period === "3mo") d.setDate(d.getDate() - 90);
  return isoDateOnly(d);
}

function durationMinutes(startIso: string | null, endIso: string | null): number | null {
  if (!startIso || !endIso) return null;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.round((end - start) / 60000);
}

// ── Component ──────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const wu = useWeightUnit();
  const navigation = useNavigation();
  const router = useRouter();

  const openDrawer = useCallback(() => {
    const parent = (navigation as any)?.getParent?.();
    if (parent?.openDrawer) parent.openDrawer();
    else if ((navigation as any)?.openDrawer) (navigation as any).openDrawer();
  }, [navigation]);

  // ── State ──────────────────────────────────────────────────────────────

  const [mode, setMode] = useState<Mode>("workouts");
  const [ready, setReady] = useState(false);

  // Shared filter
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("all");

  // Workouts mode
  const [workoutRows, setWorkoutRows] = useState<WorkoutRow[]>([]);

  // Sets mode (legacy)
  const [searchQuery, setSearchQuery] = useState("");
  const [exerciseFilter, setExerciseFilter] = useState<string | null>(null);
  const [exerciseFilterLabel, setExerciseFilterLabel] = useState("");
  const [minWeight, setMinWeight] = useState("");
  const [rawResults, setRawResults] = useState<HistorySetRow[]>([]);
  const [expandedWorkouts, setExpandedWorkouts] = useState<Set<string>>(new Set());
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false);
  const [exercisePickerQuery, setExercisePickerQuery] = useState("");
  const [minWeightModalOpen, setMinWeightModalOpen] = useState(false);
  const [minWeightDraft, setMinWeightDraft] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Data loading: workouts ─────────────────────────────────────────────

  const loadWorkouts = useCallback(async () => {
    await ensureDb();
    const db = getDb();

    const params: (string | number)[] = [];
    const where: string[] = ["w.ended_at IS NOT NULL"];
    const cutoff = periodCutoffIso(timePeriod);
    if (cutoff) {
      where.push("w.date >= ?");
      params.push(cutoff);
    }

    const sql = `SELECT w.id, w.date, w.started_at, w.ended_at, w.day_index, w.program_id,
       pd.name AS day_name,
       COUNT(s.id) AS set_count,
       COALESCE(SUM(CASE WHEN s.is_warmup = 1 THEN 0 ELSE 1 END), 0) AS working_sets,
       COALESCE(SUM(CASE WHEN s.is_warmup = 1 THEN 0 ELSE s.weight * s.reps END), 0) AS volume_kg
FROM workouts w
LEFT JOIN sets s ON s.workout_id = w.id
LEFT JOIN program_days pd ON pd.program_id = w.program_id AND pd.day_index = w.day_index
WHERE ${where.join(" AND ")}
GROUP BY w.id
ORDER BY w.date DESC, w.started_at DESC
LIMIT 500`;

    try {
      const rows = db.getAllSync<WorkoutRow>(sql, params);
      setWorkoutRows(rows ?? []);
    } catch (err) {
      console.warn("history loadWorkouts failed", err);
      setWorkoutRows([]);
    }
    setReady(true);
  }, [timePeriod]);

  // ── Data loading: sets (legacy) ────────────────────────────────────────

  const loadSets = useCallback(async () => {
    await ensureDb();
    const db = getDb();

    const whereClauses: string[] = [];
    const params: (string | number)[] = [];

    if (exerciseFilter) {
      whereClauses.push("s.exercise_id = ?");
      params.push(exerciseFilter);
    } else if (searchQuery.trim()) {
      const matches = searchExercises(searchQuery.trim());
      if (matches.length === 0) {
        setRawResults([]);
        setHasMore(false);
        setReady(true);
        return;
      }
      const ids = matches.map((m) => m.id);
      const ph = ids.map(() => "?").join(",");
      whereClauses.push(`s.exercise_id IN (${ph})`);
      params.push(...ids);
    }

    const cutoff = periodCutoffIso(timePeriod);
    if (cutoff) {
      whereClauses.push("w.date >= ?");
      params.push(cutoff);
    }

    const minNum = parseFloat(minWeight);
    if (Number.isFinite(minNum) && minNum > 0) {
      whereClauses.push("s.weight >= ?");
      params.push(wu.toKg(minNum));
    }

    const whereStr = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

    const sql = `SELECT s.id, s.workout_id, s.exercise_id, s.exercise_name, s.set_index,
       s.weight, s.reps, s.rpe, s.created_at, s.rest_seconds,
       w.date AS workout_date, w.started_at, w.day_index
FROM sets s
JOIN workouts w ON s.workout_id = w.id
${whereStr}
ORDER BY w.date DESC, s.created_at ASC
LIMIT ?`;

    params.push(limit + 1);

    try {
      const rows = db.getAllSync<HistorySetRow>(sql, params);
      const results = rows ?? [];
      if (results.length > limit) {
        setHasMore(true);
        setRawResults(results.slice(0, limit));
      } else {
        setHasMore(false);
        setRawResults(results);
      }
    } catch {
      setRawResults([]);
      setHasMore(false);
    }
    setReady(true);
  }, [exerciseFilter, searchQuery, timePeriod, minWeight, limit, wu]);

  // ── Effects ────────────────────────────────────────────────────────────

  const loadActive = useCallback(() => {
    if (mode === "workouts") void loadWorkouts();
    else void loadSets();
  }, [mode, loadWorkouts, loadSets]);

  useFocusEffect(useCallback(() => { loadActive(); }, [loadActive]));

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadActive(), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [loadActive]);

  // ── Derived data (sets mode) ───────────────────────────────────────────

  const sectionData = useMemo(() => {
    const grouped = new Map<string, HistorySetRow[]>();
    for (const row of rawResults) {
      const key = `${row.workout_date}_${row.workout_id}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    }
    const items: SectionItem[] = [];
    for (const [key, sets] of grouped) {
      const expanded = expandedWorkouts.has(key);
      items.push({
        kind: "header",
        key,
        workoutDate: sets[0].workout_date,
        workoutId: sets[0].workout_id,
        setCount: sets.length,
        expanded,
      });
      if (expanded) {
        for (const s of sets) items.push({ kind: "set", key: s.id, set: s });
      }
    }
    return items;
  }, [rawResults, expandedWorkouts]);

  const summary = useMemo(() => {
    const workoutIds = new Set(rawResults.map((r) => r.workout_id));
    return { sets: rawResults.length, workouts: workoutIds.size };
  }, [rawResults]);

  // ── Handlers ───────────────────────────────────────────────────────────

  const toggleWorkout = useCallback((key: string) => {
    setExpandedWorkouts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const cyclePeriod = useCallback(() => {
    setTimePeriod((prev) => {
      const idx = PERIOD_ORDER.indexOf(prev);
      return PERIOD_ORDER[(idx + 1) % PERIOD_ORDER.length];
    });
  }, []);

  const openWorkout = useCallback(
    (id: string) => {
      router.push({ pathname: "/workout/[id]", params: { id } } as never);
    },
    [router],
  );

  const pickerResults = useMemo(() => {
    const q = exercisePickerQuery.trim();
    return q ? searchExercises(q).slice(0, 30) : [];
  }, [exercisePickerQuery]);

  // ── Render ─────────────────────────────────────────────────────────────

  if (!ready) {
    return (
      <Screen>
        <TopBar title={t("history.title")} subtitle={t("history.subtitle")} left={<IconButton icon="menu" onPress={openDrawer} />} />
        <View style={{ padding: 16, gap: 12 }}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar title={t("history.title")} subtitle={t("history.subtitle")} left={<IconButton icon="menu" onPress={openDrawer} />} />

      <View style={{ paddingHorizontal: 16, gap: 10, flex: 1 }}>
        {/* Mode toggle */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Chip text={t("history.mode.workouts")} active={mode === "workouts"} onPress={() => setMode("workouts")} />
          <Chip text={t("history.mode.sets")} active={mode === "sets"} onPress={() => setMode("sets")} />
        </View>

        {mode === "workouts" ? (
          <>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <Chip
                text={t(`history.period.${timePeriod}` as any)}
                active={timePeriod !== "all"}
                onPress={cyclePeriod}
              />
            </View>

            {workoutRows.length === 0 ? (
              <View style={{ alignItems: "center", paddingTop: 40 }}>
                <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 14 }}>
                  {t("history.noWorkouts")}
                </Text>
              </View>
            ) : (
              <FlatList
                data={workoutRows}
                keyExtractor={(w) => w.id}
                contentContainerStyle={{ paddingBottom: 40, gap: 8 }}
                renderItem={({ item }) => {
                  const dayLabel = item.day_name
                    ? item.day_name
                    : Number.isFinite(item.day_index ?? NaN)
                      ? `${t("common.day")} ${(item.day_index ?? 0) + 1}`
                      : "";
                  const dur = durationMinutes(item.started_at, item.ended_at);
                  return (
                    <Pressable
                      onPress={() => openWorkout(item.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.date} ${dayLabel}`}
                      style={({ pressed }) => ({
                        padding: 14,
                        borderRadius: theme.radius.lg,
                        borderWidth: 1,
                        borderColor: theme.glassBorder,
                        backgroundColor: pressed
                          ? (theme.isDark ? "rgba(182, 104, 245, 0.10)" : "rgba(124, 58, 237, 0.06)")
                          : theme.glass,
                        gap: 6,
                      })}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={{ color: theme.text, fontFamily: theme.fontFamily.semibold, fontSize: 15 }}>
                          {item.date}
                        </Text>
                        {dur != null ? (
                          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                            {t("history.workoutRow.duration", { min: dur })}
                          </Text>
                        ) : null}
                      </View>
                      {dayLabel ? (
                        <Text style={{ color: theme.accent, fontFamily: theme.fontFamily.medium, fontSize: 13 }}>
                          {dayLabel}
                        </Text>
                      ) : null}
                      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>
                        {t("history.workoutRow.setsLine", {
                          sets: item.working_sets,
                          volume: formatWeight(wu.toDisplay(item.volume_kg)),
                          unit: wu.unitLabel(),
                        })}
                      </Text>
                    </Pressable>
                  );
                }}
              />
            )}
          </>
        ) : (
          <>
            <TextField
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t("history.searchPlaceholder")}
              placeholderTextColor={theme.muted}
              style={{
                color: theme.text,
                backgroundColor: theme.glass,
                borderColor: theme.glassBorder,
                borderWidth: 1,
                borderRadius: theme.radius.lg,
                padding: 12,
                fontSize: 14,
                fontFamily: theme.mono,
              }}
            />

            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <Chip
                text={exerciseFilter ? exerciseFilterLabel : t("history.exercise")}
                active={!!exerciseFilter}
                onPress={() => { setExercisePickerQuery(""); setExercisePickerOpen(true); }}
              />
              <Chip
                text={t(`history.period.${timePeriod}` as any)}
                active={timePeriod !== "all"}
                onPress={cyclePeriod}
              />
              <Chip
                text={minWeight ? `${t("history.minWeight")}: ${minWeight}` : t("history.minWeight")}
                active={!!minWeight}
                onPress={() => { setMinWeightDraft(minWeight); setMinWeightModalOpen(true); }}
              />
            </View>

            {rawResults.length > 0 && (
              <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>
                {t("history.summary", { sets: summary.sets, workouts: summary.workouts })}
              </Text>
            )}

            {rawResults.length === 0 ? (
              <View style={{ alignItems: "center", paddingTop: 40 }}>
                <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 14 }}>
                  {t("history.noResults")}
                </Text>
              </View>
            ) : (
              <FlatList
                data={sectionData}
                keyExtractor={(item) => item.key}
                contentContainerStyle={{ paddingBottom: 40, gap: 2 }}
                renderItem={({ item }) => {
                  if (item.kind === "header") {
                    return (
                      <Pressable
                        onLongPress={() => openWorkout(item.workoutId)}
                        onPress={() => toggleWorkout(item.key)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: 12,
                          backgroundColor: theme.glass,
                          borderRadius: theme.radius.lg,
                          borderWidth: 1,
                          borderColor: item.expanded ? theme.accent : theme.glassBorder,
                          marginTop: 8,
                        }}
                      >
                        <View>
                          <Text style={{ color: theme.text, fontSize: 15, fontFamily: theme.mono }}>
                            {item.workoutDate}
                          </Text>
                          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                            {item.setCount} {t("common.sets").toLowerCase()}
                          </Text>
                        </View>
                        <Text style={{ color: theme.muted, fontSize: 14 }}>
                          {item.expanded ? "▲" : "▼"}
                        </Text>
                      </Pressable>
                    );
                  }

                  const s = item.set;
                  const exName = s.exercise_id ? displayNameFor(s.exercise_id) : s.exercise_name;
                  return (
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 6,
                        paddingHorizontal: 12,
                        paddingVertical: 5,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{ color: theme.text, flex: 2, fontSize: 13, fontFamily: theme.mono }}
                        numberOfLines={1}
                      >
                        {exName}
                      </Text>
                      <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 13, minWidth: 70 }}>
                        {formatWeight(wu.toDisplay(s.weight))}{"×"}{s.reps}
                      </Text>
                      {s.rpe != null && (
                        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11, minWidth: 28 }}>
                          @{s.rpe}
                        </Text>
                      )}
                      {s.rest_seconds != null && s.rest_seconds > 0 && (
                        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>
                          {"⏱"} {Math.floor(s.rest_seconds / 60)}:{String(s.rest_seconds % 60).padStart(2, "0")}
                        </Text>
                      )}
                    </View>
                  );
                }}
                ListFooterComponent={
                  hasMore ? (
                    <Pressable
                      onPress={() => setLimit((prev) => prev + PAGE_SIZE)}
                      style={{
                        alignItems: "center",
                        padding: 14,
                        marginTop: 8,
                        backgroundColor: theme.glass,
                        borderRadius: theme.radius.lg,
                        borderWidth: 1,
                        borderColor: theme.glassBorder,
                      }}
                    >
                      <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: 13 }}>
                        {t("history.loadMore")}
                      </Text>
                    </Pressable>
                  ) : null
                }
              />
            )}
          </>
        )}
      </View>

      {/* ── Exercise Picker Modal ───────────────────────────────────── */}
      <Modal visible={exercisePickerOpen} transparent animationType="fade" onRequestClose={() => setExercisePickerOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: theme.modalOverlay, justifyContent: "center", padding: 16 }}
          onPress={() => setExercisePickerOpen(false)}
        >
          <View
            onStartShouldSetResponder={() => true}
            style={{
              backgroundColor: theme.modalGlass,
              borderColor: theme.glassBorder,
              borderWidth: 1,
              borderRadius: theme.radius.xl,
              padding: 18,
              gap: 12,
              maxHeight: "70%",
            }}
          >
            <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 16 }}>
              {t("history.exercise")}
            </Text>
            <TextField
              value={exercisePickerQuery}
              onChangeText={setExercisePickerQuery}
              placeholder={t("history.searchPlaceholder")}
              placeholderTextColor={theme.muted}
              autoFocus
              style={{
                color: theme.text,
                backgroundColor: theme.glass,
                borderColor: theme.glassBorder,
                borderWidth: 1,
                borderRadius: theme.radius.lg,
                padding: 10,
                fontSize: 14,
                fontFamily: theme.mono,
              }}
            />
            {exerciseFilter && (
              <Pressable
                onPress={() => {
                  setExerciseFilter(null);
                  setExerciseFilterLabel("");
                  setExercisePickerOpen(false);
                }}
                style={{ padding: 10, borderRadius: theme.radius.md, backgroundColor: theme.glass }}
              >
                <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: 13 }}>
                  {t("history.clearFilter")}
                </Text>
              </Pressable>
            )}
            <FlatList
              data={pickerResults}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setExerciseFilter(item.id);
                    setExerciseFilterLabel(item.displayName);
                    setSearchQuery("");
                    setExercisePickerOpen(false);
                  }}
                  style={{
                    padding: 12,
                    borderRadius: theme.radius.md,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.glassBorder,
                  }}
                >
                  <Text style={{ color: theme.text, fontSize: 14 }}>{item.displayName}</Text>
                  {item.equipment && (
                    <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>{item.equipment}</Text>
                  )}
                </Pressable>
              )}
            />
            <Btn label={t("common.close")} onPress={() => setExercisePickerOpen(false)} />
          </View>
        </Pressable>
      </Modal>

      {/* ── Min Weight Modal ────────────────────────────────────────── */}
      <Modal visible={minWeightModalOpen} transparent animationType="fade" onRequestClose={() => setMinWeightModalOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: theme.modalOverlay, justifyContent: "center", padding: 16 }}
          onPress={() => setMinWeightModalOpen(false)}
        >
          <View
            onStartShouldSetResponder={() => true}
            style={{
              backgroundColor: theme.modalGlass,
              borderColor: theme.glassBorder,
              borderWidth: 1,
              borderRadius: theme.radius.xl,
              padding: 18,
              gap: 12,
            }}
          >
            <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 16 }}>
              {t("history.minWeightTitle")} ({wu.unitLabel()})
            </Text>
            <TextField
              value={minWeightDraft}
              onChangeText={setMinWeightDraft}
              placeholder="0"
              placeholderTextColor={theme.muted}
              keyboardType="numeric"
              autoFocus
              style={{
                color: theme.text,
                backgroundColor: theme.glass,
                borderColor: theme.glassBorder,
                borderWidth: 1,
                borderRadius: theme.radius.lg,
                padding: 10,
                fontSize: 16,
                fontFamily: theme.mono,
              }}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Btn
                label={t("common.save")}
                tone="accent"
                onPress={() => {
                  setMinWeight(minWeightDraft.trim());
                  setMinWeightModalOpen(false);
                }}
              />
              <Btn
                label={t("history.clearFilter")}
                onPress={() => {
                  setMinWeight("");
                  setMinWeightDraft("");
                  setMinWeightModalOpen(false);
                }}
              />
            </View>
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}
