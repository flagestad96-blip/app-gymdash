// app/summary.tsx — Post-workout summary (aurora)
//
// Port of Gymdash.html's <Summary> component:
//
//   ScreenHeader (back)
//   Centered "Workout complete" violet pill with check icon
//   Serif h1 "Nice work" with gradient italic accent
//   Subline "{day name} · {weekday}"
//   Strong glass card with 4-stat grid (gradient Mono readouts):
//       Duration · Volume · Sets · Avg HR
//   PR banner glass card (pink-tinted icon box + "N new PRs")
//   "How did it feel?" glass card with Easy / Good / Hard / Brutal chips
//   Share + Done buttons (Done is the gradient CTA)
//
// On Done we persist the user-picked feeling to `workouts.notes` so the
// choice isn't silently discarded.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../src/theme";
import { useI18n } from "../src/i18n";
import { ensureDb, getDb, formatDuration } from "../src/db";
import { useWeightUnit } from "../src/units";
import { GlassCard, Pill, Mono } from "../src/ui/modern";

// ── Data types ───────────────────────────────────────────────────────────────

type WorkoutRow = {
  id: string;
  started_at: string | null;
  ended_at: string | null;
  program_id: string | null;
  day_index: number | null;
};

type Stats = {
  sets: number;
  volume: number;
  exercises: number;
  prCount: number;
  topPr: { exerciseName: string; value: number; reps: number | null } | null;
};

type FeelKey = "easy" | "good" | "hard" | "brutal";

// Map prototype's 4-level feel to RPE numbers so the data remains useful.
const FEEL_TO_RPE: Record<FeelKey, number> = { easy: 6, good: 7, hard: 8, brutal: 9 };

// ── Screen ───────────────────────────────────────────────────────────────────

export default function SummaryScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const wu = useWeightUnit();
  const params = useLocalSearchParams<{ workoutId?: string }>();

  const [workout, setWorkout] = useState<WorkoutRow | null>(null);
  const [dayName, setDayName] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ sets: 0, volume: 0, exercises: 0, prCount: 0, topPr: null });
  const [feel, setFeel] = useState<FeelKey | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      await ensureDb();
      const db = getDb();

      // Resolve workout — the one passed in params, or the most recently finished.
      let row: WorkoutRow | null = null;
      if (params.workoutId) {
        row = db.getFirstSync<WorkoutRow>(
          "SELECT id, started_at, ended_at, program_id, day_index FROM workouts WHERE id = ?",
          [String(params.workoutId)],
        ) ?? null;
      } else {
        row = db.getFirstSync<WorkoutRow>(
          "SELECT id, started_at, ended_at, program_id, day_index FROM workouts WHERE ended_at IS NOT NULL ORDER BY started_at DESC LIMIT 1",
        ) ?? null;
      }
      if (!row?.id) return;
      setWorkout(row);

      // Session stats (volume, sets, exercises)
      const s = db.getFirstSync<{ sets: number; vol: number; ex: number }>(
        `SELECT COUNT(1) as sets, COALESCE(SUM(weight * reps), 0) as vol, COUNT(DISTINCT exercise_id) as ex
         FROM sets WHERE workout_id = ?`,
        [row.id],
      );

      // PRs created during this workout — matches by overlapping start..end window.
      let prCount = 0;
      let topPr: Stats["topPr"] = null;
      if (row.started_at) {
        try {
          type PrRow = { exercise_id: string; value: number; reps: number | null; date: string };
          const end = row.ended_at ?? new Date().toISOString();
          const prs = db.getAllSync<PrRow>(
            `SELECT exercise_id, value, reps, date FROM pr_records
             WHERE date >= ? AND date <= ?`,
            [row.started_at, end],
          ) ?? [];
          prCount = prs.length;
          if (prs.length > 0) {
            const best = prs.reduce((a, b) => (a.value >= b.value ? a : b));
            // Fetch a readable name — fall back to exercise_id.
            let name = best.exercise_id;
            try {
              const nameRow = db.getFirstSync<{ exercise_name: string }>(
                "SELECT exercise_name FROM sets WHERE exercise_id = ? AND workout_id = ? LIMIT 1",
                [best.exercise_id, row.id],
              );
              if (nameRow?.exercise_name) name = nameRow.exercise_name;
            } catch {}
            topPr = { exerciseName: name, value: best.value, reps: best.reps };
          }
        } catch {}
      }
      setStats({
        sets: s?.sets ?? 0,
        volume: Math.round(s?.vol ?? 0),
        exercises: s?.ex ?? 0,
        prCount,
        topPr,
      });

      // Day name — "Upper body power" style subtitle
      if (row.program_id != null && row.day_index != null) {
        try {
          const dr = db.getFirstSync<{ name: string }>(
            "SELECT name FROM program_days WHERE program_id = ? AND day_index = ?",
            [row.program_id, row.day_index],
          );
          setDayName(dr?.name ?? null);
        } catch {}
      }
    })();
  }, [params.workoutId]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const durationLabel = useMemo(() => {
    if (!workout) return "--";
    return formatDuration(workout.started_at, workout.ended_at);
  }, [workout]);

  const weekday = useMemo(() => {
    try {
      const d = workout?.started_at ? new Date(workout.started_at) : new Date();
      return d.toLocaleDateString(locale === "nb" ? "nb-NO" : "en-US", { weekday: "long" });
    } catch {
      return "";
    }
  }, [workout, locale]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const persistAndDone = useCallback(() => {
    if (feel != null && workout?.id) {
      const rpe = FEEL_TO_RPE[feel];
      try {
        getDb().runSync("UPDATE workouts SET notes = ? WHERE id = ?", [
          `Feel: ${feel} (RPE ${rpe})`,
          workout.id,
        ]);
      } catch {}
    }
    router.replace("/");
  }, [feel, workout, router]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top", "left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Back only (no title) — matches prototype ScreenHeader with empty title */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
          <Pressable
            onPress={() => router.replace("/")}
            style={({ pressed }) => ({
              width: 38,
              height: 38,
              borderRadius: 12,
              backgroundColor: "rgba(255,255,255,0.05)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.12)",
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <MaterialIcons name="arrow-back" size={16} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }} />
        </View>

        {/* Hero heading */}
        <View style={{ alignItems: "center", marginTop: 4 }}>
          <Pill tone="violet" icon="check">{t("summary.complete")}</Pill>

          <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 14, flexWrap: "wrap", justifyContent: "center" }}>
            <Text
              style={{
                color: theme.text,
                fontSize: 34,
                fontFamily: theme.fontFamily.serif,
                letterSpacing: -0.4,
                lineHeight: 38,
              }}
            >
              {t("summary.niceWork")}{" "}
            </Text>
            <Text
              style={{
                color: theme.aurora.violet,
                fontSize: 34,
                fontFamily: "InstrumentSerif_400Regular_Italic",
                letterSpacing: -0.4,
                lineHeight: 38,
              }}
            >
              {t("summary.niceWorkAccent")}
            </Text>
          </View>

          <Text style={{ color: theme.muted2, fontSize: 13, marginTop: 6 }}>
            {[dayName, weekday].filter(Boolean).join(" · ") || t("summary.subtitle")}
          </Text>
        </View>

        {/* 4-stat grid */}
        <GlassCard strong radius={24} padding={20} style={{ marginTop: 18 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            <SummaryStat label={t("common.duration")} value={durationLabel} unit="" theme={theme} />
            <SummaryStat label={t("common.volume")} value={wu.toDisplay(stats.volume).toString()} unit={wu.unitLabel().toLowerCase()} theme={theme} />
            <SummaryStat label={t("common.sets")} value={String(stats.sets)} unit="" theme={theme} />
            <SummaryStat label={t("summary.exercises")} value={String(stats.exercises)} unit="" theme={theme} />
          </View>
        </GlassCard>

        {/* PR banner */}
        {stats.prCount > 0 ? (
          <GlassCard radius={18} padding={14} style={{ marginTop: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: "rgba(244,114,182,0.18)",
                  borderWidth: 1,
                  borderColor: "rgba(244,114,182,0.35)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialIcons name="auto-awesome" size={18} color={theme.aurora.pink} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: 13, fontFamily: theme.fontFamily.semibold }}>
                  {t("summary.newPrs", { n: stats.prCount })}
                </Text>
                {stats.topPr ? (
                  <Text style={{ color: theme.muted2, fontSize: 11, marginTop: 2 }}>
                    {stats.topPr.exerciseName} · {stats.topPr.reps ? `${stats.topPr.reps}×` : ""}{wu.formatWeight(stats.topPr.value)}
                  </Text>
                ) : null}
              </View>
            </View>
          </GlassCard>
        ) : null}

        {/* "How did it feel?" */}
        <GlassCard radius={18} padding={14} style={{ marginTop: 10 }}>
          <Text
            style={{
              color: theme.muted2,
              fontSize: 12,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              fontFamily: theme.fontFamily.medium,
              marginBottom: 10,
            }}
          >
            {t("summary.feelTitle")}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["easy", "good", "hard", "brutal"] as FeelKey[]).map((f) => {
              const active = feel === f;
              return (
                <Pressable
                  key={f}
                  onPress={() => setFeel(f)}
                  style={({ pressed }) => ({
                    flex: 1,
                    height: 44,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: active ? "rgba(192,132,252,0.5)" : "rgba(255,255,255,0.10)",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    backgroundColor: active ? "transparent" : "rgba(255,255,255,0.04)",
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  {active ? (
                    <LinearGradient
                      colors={["rgba(96,165,250,0.35)", "rgba(192,132,252,0.35)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                  ) : null}
                  <Text style={{ color: "#fff", fontSize: 12, fontFamily: theme.fontFamily.medium }}>
                    {t(`summary.feel.${f}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </GlassCard>

        {/* Footer */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
          <Pressable
            onPress={() => {}}
            style={({ pressed }) => ({
              flex: 1,
              height: 52,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.12)",
              backgroundColor: "rgba(255,255,255,0.04)",
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: "#fff", fontSize: 14, fontFamily: theme.fontFamily.medium }}>
              {t("summary.share")}
            </Text>
          </Pressable>
          <Pressable
            onPress={persistAndDone}
            style={({ pressed }) => ({
              flex: 2,
              height: 52,
              borderRadius: 16,
              overflow: "hidden",
              opacity: pressed ? 0.9 : 1,
              shadowColor: theme.aurora.violet,
              shadowOpacity: 0.55,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 10 },
              elevation: 8,
            })}
          >
            <LinearGradient
              colors={theme.auroraGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: "#fff", fontSize: 14, fontFamily: theme.fontFamily.semibold }}>
                {t("summary.done")}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Stat tile (2 per row on phones) ──────────────────────────────────────────

function SummaryStat({ label, value, unit, theme }: { label: string; value: string; unit: string; theme: any }) {
  return (
    <View style={{ width: "50%", paddingVertical: 8 }}>
      <Text
        style={{
          color: theme.muted2,
          fontSize: 10,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          fontFamily: theme.fontFamily.medium,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 4 }}>
        <Mono style={{ fontSize: 28, color: theme.text, lineHeight: 32 }}>{value}</Mono>
        {unit ? <Text style={{ color: theme.muted2, fontSize: 12 }}>{unit}</Text> : null}
      </View>
    </View>
  );
}
