// app/workout.tsx — Live workout (aurora redesign)
//
// Port of Gymdash.html's Workout component. The screen is the app's core loop:
//
//   Top bar:  ← back · "[day name]" + live mm:ss · ⋯
//   Hero:     • Active state — pill "Exercise X of Y", serif name, target,
//                set-chip row, reps+weight adjusters, gradient "Log set" CTA
//             • Rest state — 180px progress ring with gradient mono countdown,
//                +15s / Skip rest secondary buttons
//   Up next:  the next 1–2 exercises as small glass rows + "X/Y sets"
//   Bottom:   Pause/Resume · Finish workout (pink-tinted)
//
// DB side:
//   • Creates (or loads) today's workout row on mount.
//   • Pre-fills weight from the user's last set of the same exercise.
//   • Every logged set is written immediately to `sets`.
//   • Finish sets `ended_at` and navigates to `/summary?workoutId=…`.
//
// The global `FloatingRestTimer` stays idle here — the hero card owns the
// rest UI during a live session.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, AppState } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";
import { useTheme } from "../src/theme";
import { useI18n } from "../src/i18n";
import { ensureDb, getDb, getSettingAsync } from "../src/db";
import { uid, isoDateOnly } from "../src/storage";
import { useWeightUnit } from "../src/units";
import ProgramStore, { type ProgramDay, type Program } from "../src/programStore";
import { displayNameFor, defaultIncrementFor } from "../src/exerciseLibrary";
import { GlassCard, Pill, Mono } from "../src/ui/modern";

// ── Types ────────────────────────────────────────────────────────────────────

type SetState = {
  dbId: string | null;    // populated once written to DB
  reps: number | null;
  weight: number;
  done: boolean;
};

type ExerciseState = {
  exId: string;
  name: string;
  targetSets: number;
  targetReps: string;     // display label, e.g. "6–8"
  sets: SetState[];
};

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_SET_COUNT = 4;
const DEFAULT_REP_TARGET = "6–8";
const DEFAULT_START_REPS = 8;
const DEFAULT_REST_SECONDS = 90;

// ── Screen ───────────────────────────────────────────────────────────────────

export default function WorkoutScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const wu = useWeightUnit();

  const [ready, setReady] = useState(false);
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [dayName, setDayName] = useState<string>("");
  const [exercises, setExercises] = useState<ExerciseState[]>([]);

  // Active position
  const [exIndex, setExIndex] = useState(0);
  const [setIndex, setSetIndex] = useState(0);

  // Live clocks
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [resting, setResting] = useState(false);
  const [restLeft, setRestLeft] = useState(DEFAULT_REST_SECONDS);
  const [restTotal, setRestTotal] = useState(DEFAULT_REST_SECONDS);
  const startedAtRef = useRef<number | null>(null);

  // ── Load / create workout ──────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureDb();
      const db = getDb();
      const today = isoDateOnly();

      // Read the user's rest-timer preference from settings (Profile → Rest timer).
      // Fall back to DEFAULT_REST_SECONDS if unset or out of range.
      try {
        const rs = await getSettingAsync("restSeconds");
        const n = parseInt(rs ?? "", 10);
        if (Number.isFinite(n) && n >= 10 && n <= 600) {
          if (!cancelled) {
            setRestLeft(n);
            setRestTotal(n);
          }
        }
      } catch {}

      // Read program setup
      const programMode = ((await getSettingAsync("programMode")) === "back" ? "back" : "normal") as "back" | "normal";
      const programId = await getSettingAsync(`activeProgramId_${programMode}`);
      let program: Program | null = null;
      let dayIndex = 0;
      if (programId) {
        program = await ProgramStore.getProgram(programId);
        const nextIdxRaw = await getSettingAsync(`nextSuggestedDayIndex_${programId}`);
        const parsed = parseInt(nextIdxRaw ?? "", 10);
        dayIndex = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
      }

      // Find or create today's workout row
      let row = db.getFirstSync<{ id: string; started_at: string | null; day_index: number | null }>(
        "SELECT id, started_at, day_index FROM workouts WHERE date = ? LIMIT 1",
        [today],
      );
      let wId = row?.id ?? null;
      if (!wId) {
        wId = uid("w");
        const dayKey = program?.days[dayIndex]?.id ?? `day_${dayIndex}`;
        db.runSync(
          `INSERT INTO workouts (id, date, program_mode, program_id, day_key, back_status, day_index, started_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [wId, today, programMode, programId ?? null, dayKey, "green", dayIndex, new Date().toISOString()],
        );
        startedAtRef.current = Date.now();
      } else {
        startedAtRef.current = row?.started_at ? new Date(row.started_at).getTime() : Date.now();
      }

      // Resolve day + build exercise list
      const day: ProgramDay | null = program?.days[row?.day_index ?? dayIndex] ?? program?.days[dayIndex] ?? null;
      const exIds: string[] = [];
      if (day) {
        for (const block of day.blocks) {
          if (block.type === "single") exIds.push(block.exId);
          else { exIds.push(block.a); exIds.push(block.b); }
        }
      }
      if (cancelled) return;
      setDayName(day?.name ?? t("workout.freeSession"));

      // Load any sets already written for this workout so we can resume
      const existingSets = db.getAllSync<{
        id: string;
        exercise_id: string | null;
        set_index: number;
        weight: number;
        reps: number;
      }>(
        "SELECT id, exercise_id, set_index, weight, reps FROM sets WHERE workout_id = ? ORDER BY set_index ASC",
        [wId],
      );

      // Build exercise state
      const state: ExerciseState[] = exIds.map((id) => {
        // Pull last-session weight for this exercise to prefill
        const last = db.getFirstSync<{ weight: number; reps: number }>(
          `SELECT weight, reps FROM sets WHERE exercise_id = ? AND workout_id != ? ORDER BY created_at DESC LIMIT 1`,
          [id, wId!],
        );
        const baseWeight = Number.isFinite(last?.weight) ? (last!.weight as number) : 20;
        const baseReps = Number.isFinite(last?.reps) ? (last!.reps as number) : DEFAULT_START_REPS;
        const sets: SetState[] = [];
        for (let i = 0; i < DEFAULT_SET_COUNT; i++) {
          const already = existingSets?.find((s) => s.exercise_id === id && s.set_index === i);
          sets.push({
            dbId: already?.id ?? null,
            reps: already ? already.reps : null,
            weight: already ? already.weight : baseWeight,
            done: !!already,
          });
        }
        return {
          exId: id,
          name: displayNameFor(id),
          targetSets: DEFAULT_SET_COUNT,
          targetReps: DEFAULT_REP_TARGET,
          sets,
        };
      });

      if (cancelled) return;
      setWorkoutId(wId);
      setExercises(state);

      // Jump to the first non-done position
      let jumpedEx = 0;
      let jumpedSet = 0;
      outer: for (let i = 0; i < state.length; i++) {
        for (let j = 0; j < state[i].sets.length; j++) {
          if (!state[i].sets[j].done) {
            jumpedEx = i;
            jumpedSet = j;
            break outer;
          }
        }
      }
      setExIndex(jumpedEx);
      setSetIndex(jumpedSet);

      // Seed the editable reps/weight from the current set (or baseline)
      const firstEx = state[jumpedEx];
      if (firstEx) {
        setEditableReps(firstEx.sets[jumpedSet]?.reps ?? DEFAULT_START_REPS);
        setEditableWeight(firstEx.sets[jumpedSet]?.weight ?? 20);
      }

      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [t]);

  // Elapsed timer (1s tick, respects pause)
  useEffect(() => {
    if (!ready || !startedAtRef.current) return;
    if (paused) return;
    const tick = () => {
      if (startedAtRef.current) {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [ready, paused]);

  // Rest countdown
  useEffect(() => {
    if (!resting || paused) return;
    const id = setInterval(() => {
      setRestLeft((r) => {
        if (r <= 1) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setResting(false);
          return restTotal;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [resting, paused, restTotal]);

  // Re-anchor startedAt when app comes back from background (so elapsed is accurate)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && startedAtRef.current) {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    });
    return () => sub.remove();
  }, []);

  // ── Active set editing ────────────────────────────────────────────────────

  const [editableReps, setEditableReps] = useState<number>(DEFAULT_START_REPS);
  const [editableWeight, setEditableWeight] = useState<number>(20);

  // When the active cursor moves, sync the editable values
  // Sync editable values ONLY when the cursor moves to a different set.
  // Depending on `exercises` would re-fire after logCurrentSet advances the
  // cursor AND mutates the set — potentially clobbering whatever the user is
  // typing for the *next* set. By keying on a compact cursor string we only
  // sync on genuine position changes.
  const cursorKey = `${exIndex}:${setIndex}`;
  useEffect(() => {
    const ex = exercises[exIndex];
    if (!ex) return;
    const s = ex.sets[setIndex];
    if (!s) return;
    setEditableReps(s.reps ?? DEFAULT_START_REPS);
    setEditableWeight(s.weight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursorKey]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const currentEx = exercises[exIndex];
  const totalSets = useMemo(() => exercises.reduce((a, e) => a + e.sets.length, 0), [exercises]);
  const doneSets = useMemo(() => exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0), [exercises]);
  const progress = totalSets > 0 ? doneSets / totalSets : 0;

  const logCurrentSet = useCallback(() => {
    if (!workoutId || !currentEx) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const db = getDb();
    const sId = uid("s");
    try {
      db.runSync(
        `INSERT INTO sets (id, workout_id, exercise_name, set_index, weight, reps, exercise_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [sId, workoutId, currentEx.name, setIndex, editableWeight, editableReps, currentEx.exId, new Date().toISOString()],
      );
    } catch {}

    // Update in-memory state
    setExercises((prev) => {
      const next = [...prev];
      const ex = { ...next[exIndex] };
      const sets = [...ex.sets];
      sets[setIndex] = { dbId: sId, reps: editableReps, weight: editableWeight, done: true };
      ex.sets = sets;
      next[exIndex] = ex;
      return next;
    });

    // Advance cursor: next set → next exercise → finished
    if (setIndex < currentEx.sets.length - 1) {
      setSetIndex(setIndex + 1);
    } else if (exIndex < exercises.length - 1) {
      setExIndex(exIndex + 1);
      setSetIndex(0);
    }

    // Start rest — reuse whatever restTotal we loaded from settings on mount.
    setRestLeft(restTotal);
    setResting(true);
  }, [workoutId, currentEx, exIndex, setIndex, editableReps, editableWeight, exercises.length, restTotal]);

  const finishWorkout = useCallback(() => {
    if (!workoutId) {
      router.replace("/");
      return;
    }
    try {
      getDb().runSync("UPDATE workouts SET ended_at = ? WHERE id = ?", [new Date().toISOString(), workoutId]);
    } catch {}
    router.replace({ pathname: "/summary", params: { workoutId } });
  }, [workoutId, router]);

  const adjustReps = (d: number) => {
    setEditableReps((r) => Math.max(0, r + d));
    Haptics.selectionAsync().catch(() => {});
  };
  const adjustWeight = (d: number) => {
    const step = currentEx ? defaultIncrementFor(currentEx.exId) : 2.5;
    setEditableWeight((w) => Math.max(0, +((w + d * step).toFixed(2))));
    Haptics.selectionAsync().catch(() => {});
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (!ready) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
        <View style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  // Empty state — we created a workout row but the user has no active program
  // (or the program day has no exercises). Without this guard the screen shows
  // an empty hero, no way to log anything, and no way to recover except ←.
  if (exercises.length === 0 || !currentEx) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top", "left", "right", "bottom"]}>
        <View style={{ flex: 1, padding: 20, justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <IconBtn icon="arrow-back" onPress={() => router.back()} />
            <View style={{ width: 40 }} />
          </View>

          <View style={{ alignItems: "center", paddingHorizontal: 8 }}>
            <Pill tone="neutral" icon="info-outline">{t("workout.empty.pill")}</Pill>
            <Text
              style={{
                color: theme.text,
                fontFamily: theme.fontFamily.serif,
                fontSize: 30,
                letterSpacing: -0.4,
                marginTop: 16,
                textAlign: "center",
                lineHeight: 34,
              }}
            >
              {t("workout.empty.title")}
            </Text>
            <Text style={{ color: theme.muted, fontSize: 14, marginTop: 10, textAlign: "center", lineHeight: 20 }}>
              {t("workout.empty.body")}
            </Text>
          </View>

          <Pressable
            onPress={() => router.replace("/profile")}
            style={({ pressed }) => ({
              height: 52,
              borderRadius: 16,
              overflow: "hidden",
              opacity: pressed ? 0.9 : 1,
              shadowColor: theme.aurora.violet,
              shadowOpacity: 0.4,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 6,
            })}
            accessibilityRole="button"
          >
            <LinearGradient
              colors={theme.auroraGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}
            >
              <MaterialIcons name="tune" size={18} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 15, fontFamily: theme.fontFamily.semibold }}>
                {t("workout.empty.goToProfile")}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const restPct = (restTotal - restLeft) / Math.max(1, restTotal);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top", "left", "right", "bottom"]}>
      <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 6, paddingBottom: 18 }}>
        {/* Top bar */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <IconBtn icon="arrow-back" onPress={() => router.back()} />
          <View style={{ alignItems: "center" }}>
            <Text
              style={{
                color: theme.muted2,
                fontSize: 10,
                letterSpacing: 1.6,
                textTransform: "uppercase",
                fontFamily: theme.fontFamily.medium,
              }}
              numberOfLines={1}
            >
              {dayName}
            </Text>
            <Mono style={{ color: theme.text, fontSize: 14, letterSpacing: 0.4, marginTop: 2 }}>
              {fmtMMSS(elapsed)}
            </Mono>
          </View>
          <IconBtn icon="more-horiz" onPress={() => {}} />
        </View>

        {/* Hero — rest vs active */}
        <GlassCard strong radius={28} padding={20}>
          {resting ? (
            <RestView
              restLeft={restLeft}
              restPct={restPct}
              onAdd15={() => setRestLeft((r) => r + 15)}
              onSkip={() => {
                setResting(false);
                setRestLeft(restTotal);
              }}
              t={t}
              theme={theme}
            />
          ) : (
            <ActiveView
              ex={currentEx}
              exIndex={exIndex}
              exTotal={exercises.length}
              setIndex={setIndex}
              editableReps={editableReps}
              editableWeight={editableWeight}
              adjustReps={adjustReps}
              adjustWeight={adjustWeight}
              onLogSet={logCurrentSet}
              progress={progress}
              wu={wu}
              t={t}
              theme={theme}
            />
          )}
        </GlassCard>

        {/* Up next */}
        <View style={{ marginTop: 14, flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ color: theme.muted2, fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase", fontFamily: theme.fontFamily.medium }}>
              {t("workout.upNext")}
            </Text>
            <Text style={{ color: theme.muted2, fontSize: 11 }}>
              <Mono style={{ color: theme.muted2, fontSize: 11 }}>{doneSets}/{totalSets}</Mono> {t("common.sets").toLowerCase()}
            </Text>
          </View>
          <ScrollView contentContainerStyle={{ gap: 8 }} showsVerticalScrollIndicator={false}>
            {exercises.slice(exIndex + 1, exIndex + 3).map((e, i) => (
              <GlassCard key={`${e.exId}-${i}`} radius={16} padding={12} highlight={false}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "rgba(255,255,255,0.06)",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.10)",
                    }}
                  >
                    <MaterialIcons name="fitness-center" size={18} color="rgba(255,255,255,0.6)" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: theme.text, fontSize: 13, fontFamily: theme.fontFamily.medium }} numberOfLines={1}>
                      {e.name}
                    </Text>
                    <Text style={{ color: theme.muted2, fontSize: 11, marginTop: 1 }}>
                      {e.targetSets} × {e.targetReps}
                    </Text>
                  </View>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" }}>
                    <Text style={{ color: theme.muted, fontSize: 10 }}>{e.sets.length} {t("common.sets").toLowerCase()}</Text>
                  </View>
                </View>
              </GlassCard>
            ))}
          </ScrollView>
        </View>

        {/* Bottom bar */}
        <GlassCard radius={20} padding={8} strong style={{ marginTop: 10 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => setPaused((p) => !p)}
              style={({ pressed }) => ({
                flex: 1,
                height: 44,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.10)",
                backgroundColor: "rgba(255,255,255,0.04)",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 6,
                opacity: pressed ? 0.85 : 1,
              })}
              accessibilityRole="button"
              accessibilityLabel={paused ? t("workout.resume") : t("workout.pause")}
            >
              <MaterialIcons name={paused ? "play-arrow" : "pause"} size={14} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 13, fontFamily: theme.fontFamily.medium }}>
                {paused ? t("workout.resume") : t("workout.pause")}
              </Text>
            </Pressable>
            <Pressable
              onPress={finishWorkout}
              style={({ pressed }) => ({
                flex: 1,
                height: 44,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "rgba(244,114,182,0.4)",
                backgroundColor: "rgba(244,114,182,0.2)",
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.85 : 1,
              })}
              accessibilityRole="button"
              accessibilityLabel={t("workout.finish")}
            >
              <Text style={{ color: "#ffd9ec", fontSize: 13, fontFamily: theme.fontFamily.medium }}>
                {t("workout.finish")}
              </Text>
            </Pressable>
          </View>
        </GlassCard>
      </View>
    </SafeAreaView>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function IconBtn({ icon, onPress }: { icon: keyof typeof MaterialIcons.glyphMap; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.8 : 1,
      })}
      accessibilityRole="button"
    >
      <MaterialIcons name={icon} size={18} color="#fff" />
    </Pressable>
  );
}

function ActiveView({
  ex, exIndex, exTotal, setIndex, editableReps, editableWeight,
  adjustReps, adjustWeight, onLogSet, progress, wu, t, theme,
}: {
  ex: ExerciseState;
  exIndex: number;
  exTotal: number;
  setIndex: number;
  editableReps: number;
  editableWeight: number;
  adjustReps: (d: number) => void;
  adjustWeight: (d: number) => void;
  onLogSet: () => void;
  progress: number;
  wu: any;
  t: any;
  theme: any;
}) {
  return (
    <>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Pill tone="accent" icon="gps-fixed">
            {t("workout.exerciseCounter", { i: exIndex + 1, n: exTotal })}
          </Pill>
          <Text
            style={{
              color: theme.text,
              fontSize: 22,
              fontFamily: theme.fontFamily.serif,
              marginTop: 10,
              letterSpacing: -0.2,
              lineHeight: 26,
            }}
            numberOfLines={2}
          >
            {ex.name}
          </Text>
          <Text style={{ color: theme.muted2, fontSize: 12, marginTop: 4 }}>
            {t("workout.target")}: {ex.targetSets} × {ex.targetReps}
          </Text>
        </View>
        <AuroraRing progress={progress} size={52} strokeWidth={4} theme={theme} />
      </View>

      {/* Set chip row */}
      <View style={{ flexDirection: "row", gap: 6, marginTop: 18 }}>
        {ex.sets.map((s, i) => {
          const isCurrent = i === setIndex && !s.done;
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: 32,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                borderWidth: 1,
                borderColor: isCurrent ? "rgba(192,132,252,0.55)" : "rgba(255,255,255,0.08)",
                backgroundColor: s.done ? "transparent" : isCurrent ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)",
              }}
            >
              {s.done ? (
                <LinearGradient
                  colors={["rgba(96,165,250,0.35)", "rgba(192,132,252,0.35)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              ) : null}
              <Text
                style={{
                  color: s.done ? "#fff" : theme.muted,
                  fontFamily: theme.mono,
                  fontSize: 11,
                }}
              >
                {s.done ? `${s.reps}×${wu.toDisplay(s.weight)}` : `${t("workout.setLabel")} ${i + 1}`}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Adjusters */}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
        <Adjuster label={t("common.reps")} value={editableReps} unit="" onAdj={adjustReps} theme={theme} />
        <Adjuster label={t("workout.weight")} value={wu.toDisplay(editableWeight)} unit={wu.unitLabel().toLowerCase()} onAdj={adjustWeight} theme={theme} />
      </View>

      {/* Log set gradient button */}
      <Pressable
        onPress={onLogSet}
        style={({ pressed }) => ({
          marginTop: 16,
          height: 52,
          borderRadius: 16,
          overflow: "hidden",
          opacity: pressed ? 0.92 : 1,
          shadowColor: theme.aurora.violet,
          shadowOpacity: 0.55,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 10 },
          elevation: 8,
        })}
        accessibilityRole="button"
        accessibilityLabel={t("workout.logSet")}
      >
        <LinearGradient
          colors={theme.auroraGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}
        >
          <MaterialIcons name="check" size={16} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 15, fontFamily: theme.fontFamily.semibold }}>
            {t("workout.logSet")}
          </Text>
        </LinearGradient>
      </Pressable>
    </>
  );
}

function RestView({
  restLeft, restPct, onAdd15, onSkip, t, theme,
}: {
  restLeft: number;
  restPct: number;
  onAdd15: () => void;
  onSkip: () => void;
  t: any;
  theme: any;
}) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 4 }}>
      <View style={{ width: 180, height: 180, alignItems: "center", justifyContent: "center" }}>
        <AuroraRing progress={restPct} size={180} strokeWidth={6} theme={theme} />
        <View style={{ position: "absolute", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: theme.muted2, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", fontFamily: theme.fontFamily.medium }}>
            {t("workout.rest")}
          </Text>
          <Mono style={{ color: theme.aurora.cyan, fontSize: 54, lineHeight: 56, marginTop: 2 }}>
            {fmtMMSS(restLeft)}
          </Mono>
          <Text style={{ color: theme.muted2, fontSize: 11, marginTop: 4 }}>
            {t("workout.restHint")}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 18 }}>
        <Pressable
          onPress={onAdd15}
          style={({ pressed }) => ({
            paddingHorizontal: 18,
            paddingVertical: 10,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)",
            backgroundColor: "rgba(255,255,255,0.06)",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: "#fff", fontSize: 13, fontFamily: theme.fontFamily.medium }}>+15s</Text>
        </Pressable>
        <Pressable
          onPress={onSkip}
          style={({ pressed }) => ({
            paddingHorizontal: 18,
            paddingVertical: 10,
            borderRadius: 12,
            overflow: "hidden",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <LinearGradient
            colors={[theme.aurora.blue, theme.aurora.violet]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={{ color: "#fff", fontSize: 13, fontFamily: theme.fontFamily.medium }}>
            {t("workout.skipRest")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Adjuster({
  label, value, unit, onAdj, theme,
}: {
  label: string;
  value: number;
  unit: string;
  onAdj: (d: number) => void;
  theme: any;
}) {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.04)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        padding: 10,
      }}
    >
      <Text style={{ color: theme.muted2, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", fontFamily: theme.fontFamily.medium, marginBottom: 6 }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <AdjBtn onPress={() => onAdj(-1)} sign="−" />
        <View style={{ flex: 1, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 3 }}>
          <Mono style={{ color: theme.text, fontSize: 22 }}>{value}</Mono>
          {unit ? <Text style={{ color: theme.muted2, fontSize: 11 }}>{unit}</Text> : null}
        </View>
        <AdjBtn onPress={() => onAdj(1)} sign="+" />
      </View>
    </View>
  );
}

function AdjBtn({ onPress, sign }: { onPress: () => void; sign: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: 30,
        height: 30,
        borderRadius: 10,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.7 : 1,
      })}
      accessibilityRole="button"
    >
      <Text style={{ color: "#fff", fontSize: 16 }}>{sign}</Text>
    </Pressable>
  );
}

// Local aurora progress ring (gradient stroke, with dep-free animation via
// render-per-prop — the parent updates every second/adjustment).
function AuroraRing({
  progress, size, strokeWidth, theme,
}: {
  progress: number;
  size: number;
  strokeWidth: number;
  theme: any;
}) {
  const radius = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * radius;
  const offset = c * (1 - Math.max(0, Math.min(1, progress)));
  const gradId = `wk-grad-${size}`;
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
      <Defs>
        <SvgLinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={theme.auroraGradient[0]} />
          <Stop offset="60%" stopColor={theme.auroraGradient[1]} />
          <Stop offset="100%" stopColor={theme.auroraGradient[2]} />
        </SvgLinearGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.10)" strokeWidth={strokeWidth} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={`url(#${gradId})`}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${c} ${c}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function fmtMMSS(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
