// app/(tabs)/workout/[id].tsx — Detail view of a completed workout
//
// Lists every set grouped by exercise with full metadata (weight, reps,
// RPE, rest, notes). Each set row is tappable to open EditSetModal so the
// user can correct a typo or delete a set after the fact. PR records are
// re-computed by EditSetModal on save/delete.
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ensureDb, getDb } from "../../../src/db";
import { useTheme } from "../../../src/theme";
import { useI18n } from "../../../src/i18n";
import { Screen, TopBar, IconButton } from "../../../src/ui";
import { displayNameFor } from "../../../src/exerciseLibrary";
import { useWeightUnit } from "../../../src/units";
import { formatWeight } from "../../../src/format";
import { SkeletonCard } from "../../../src/components/Skeleton";
import EditSetModal from "../../../src/components/workout/EditSetModal";
import type { SetRow } from "../../../src/components/workout/SetEntryRow";

type WorkoutRow = {
  id: string;
  date: string;
  started_at: string | null;
  ended_at: string | null;
  day_index: number | null;
  program_id: string | null;
  notes: string | null;
  day_name: string | null;
};

type ExerciseGroup = {
  exerciseId: string | null;
  displayName: string;
  sets: SetRow[];
};

function diffMinutes(startIso: string | null, endIso: string | null): number | null {
  if (!startIso || !endIso) return null;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.round((end - start) / 60000);
}

export default function WorkoutDetailScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const wu = useWeightUnit();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const workoutId = typeof params.id === "string" ? params.id : "";

  const [ready, setReady] = useState(false);
  const [workout, setWorkout] = useState<WorkoutRow | null>(null);
  const [groups, setGroups] = useState<ExerciseGroup[]>([]);
  const [editing, setEditing] = useState<SetRow | null>(null);

  const load = useCallback(async () => {
    if (!workoutId) {
      setReady(true);
      return;
    }
    await ensureDb();
    const db = getDb();

    const w = db.getFirstSync<WorkoutRow>(
      `SELECT w.id, w.date, w.started_at, w.ended_at, w.day_index, w.program_id, w.notes,
              pd.name AS day_name
       FROM workouts w
       LEFT JOIN program_days pd ON pd.program_id = w.program_id AND pd.day_index = w.day_index
       WHERE w.id = ?`,
      [workoutId],
    );
    setWorkout(w ?? null);

    const sets = db.getAllSync<SetRow>(
      `SELECT id, workout_id, exercise_id, exercise_name, set_index, weight, reps, rpe,
              is_warmup, notes, rest_seconds, created_at,
              external_load_kg, bodyweight_kg_used, bodyweight_factor, est_total_load_kg, set_type
       FROM sets
       WHERE workout_id = ?
       ORDER BY created_at ASC, set_index ASC`,
      [workoutId],
    );

    const map = new Map<string, ExerciseGroup>();
    for (const s of sets ?? []) {
      const key = s.exercise_id ?? `name:${s.exercise_name}`;
      if (!map.has(key)) {
        map.set(key, {
          exerciseId: s.exercise_id ?? null,
          displayName: s.exercise_id ? displayNameFor(s.exercise_id) : s.exercise_name,
          sets: [],
        });
      }
      map.get(key)!.sets.push(s);
    }
    setGroups(Array.from(map.values()));
    setReady(true);
  }, [workoutId]);

  useEffect(() => { void load(); }, [load]);

  if (!ready) {
    return (
      <Screen>
        <TopBar
          title={t("history.workoutDetail")}
          left={<IconButton icon="arrow-back" onPress={() => router.back()} />}
        />
        <View style={{ padding: 16, gap: 12 }}>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={5} />
        </View>
      </Screen>
    );
  }

  if (!workout) {
    return (
      <Screen>
        <TopBar
          title={t("history.workoutDetail")}
          left={<IconButton icon="arrow-back" onPress={() => router.back()} />}
        />
        <View style={{ padding: 16, alignItems: "center" }}>
          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 14 }}>
            {t("history.workoutNotFound")}
          </Text>
        </View>
      </Screen>
    );
  }

  const duration = diffMinutes(workout.started_at, workout.ended_at);
  const workingSets = groups.reduce(
    (n, g) => n + g.sets.filter((s) => !s.is_warmup).length,
    0,
  );
  const totalVolumeKg = groups.reduce(
    (vol, g) =>
      vol +
      g.sets.reduce((v, s) => (s.is_warmup ? v : v + s.weight * s.reps), 0),
    0,
  );
  const dayLabel = workout.day_name
    ? workout.day_name
    : Number.isFinite(workout.day_index ?? NaN)
      ? `${t("common.day")} ${(workout.day_index ?? 0) + 1}`
      : "";

  return (
    <Screen>
      <TopBar
        title={workout.date}
        subtitle={dayLabel || t("history.workoutDetail")}
        left={<IconButton icon="arrow-back" onPress={() => router.back()} />}
      />

      <FlatList
        data={groups}
        keyExtractor={(g) => g.exerciseId ?? `name:${g.displayName}`}
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
        ListHeaderComponent={
          <View
            style={{
              padding: 14,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: theme.glassBorder,
              backgroundColor: theme.glass,
              gap: 6,
            }}
          >
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
              <Stat
                label={t("history.detail.duration")}
                value={duration != null ? `${duration} ${t("common.minShort")}` : "—"}
              />
              <Stat label={t("history.detail.sets")} value={`${workingSets}`} />
              <Stat
                label={t("history.detail.volume")}
                value={`${formatWeight(wu.toDisplay(totalVolumeKg))} ${wu.unitLabel()}`}
              />
            </View>
            {workout.notes ? (
              <Text style={{ color: theme.muted, fontSize: 12, fontFamily: theme.mono, marginTop: 4 }}>
                {workout.notes}
              </Text>
            ) : null}
            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11, marginTop: 4, opacity: 0.8 }}>
              {t("history.tapSetToEdit")}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={{
              padding: 14,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: theme.glassBorder,
              backgroundColor: theme.glass,
              gap: 8,
            }}
          >
            <Text style={{ color: theme.text, fontSize: 15, fontFamily: theme.fontFamily.semibold }}>
              {item.displayName}
            </Text>
            <View style={{ gap: 4 }}>
              {item.sets.map((s, idx) => (
                <SetLine
                  key={s.id}
                  index={idx + 1}
                  set={s}
                  onPress={() => setEditing(s)}
                  theme={theme}
                  wu={wu}
                  t={t}
                />
              ))}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 13, textAlign: "center" }}>
            {t("history.noSetsInWorkout")}
          </Text>
        }
      />

      <EditSetModal
        visible={editing !== null}
        set={editing}
        programId={workout.program_id}
        onClose={() => setEditing(null)}
        onChanged={() => { void load(); }}
      />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={{ minWidth: 90 }}>
      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" }}>
        {label}
      </Text>
      <Text style={{ color: theme.text, fontFamily: theme.fontFamily.semibold, fontSize: 16, marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}

function SetLine({
  index,
  set,
  onPress,
  wu,
  theme,
  t,
}: {
  index: number;
  set: SetRow;
  onPress: () => void;
  wu: ReturnType<typeof useWeightUnit>;
  theme: ReturnType<typeof useTheme>;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const isWarmup = !!set.is_warmup;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("log.editSet")}
      style={({ pressed }) => ({
        gap: 2,
        paddingVertical: 4,
        paddingHorizontal: 6,
        borderRadius: theme.radius.sm,
        backgroundColor: pressed ? (theme.isDark ? "rgba(182, 104, 245, 0.08)" : "rgba(124, 58, 237, 0.05)") : "transparent",
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11, minWidth: 24 }}>
          {isWarmup ? "W" : `#${index}`}
        </Text>
        <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 13, flex: 1 }}>
          {formatWeight(wu.toDisplay(set.weight))}{"×"}{set.reps}
        </Text>
        {set.rpe != null ? (
          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>@{set.rpe}</Text>
        ) : null}
        {set.rest_seconds != null && set.rest_seconds > 0 ? (
          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>
            {"⏱ "}
            {Math.floor(set.rest_seconds / 60)}:{String(set.rest_seconds % 60).padStart(2, "0")}
          </Text>
        ) : null}
      </View>
      {set.notes ? (
        <Text style={{ color: theme.muted, fontSize: 11, fontStyle: "italic", paddingLeft: 32 }}>
          {set.notes}
        </Text>
      ) : null}
    </Pressable>
  );
}
