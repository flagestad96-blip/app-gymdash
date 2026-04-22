// app/exercise-detail.tsx — Exercise detail (aurora)
//
// Port of Gymdash.html's <ExerciseDetail> component:
//
//   ScreenHeader (back) with empty title
//   Muscle-group Pill (accent)
//   Serif h1 exercise name (30px)
//   Frosted "demonstration" hero placeholder (diagonal stripes + label)
//   3-column stat tiles: 1RM est. · Best set · Volume
//   "Cues" glass card with bullet list
//   "History" — glass cards with date + optional "New PR" pink pill + mono sets
//
// Stats come from the existing sets / pr_records tables. Cues are static per
// exercise id for now (can be moved to DB later).

import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../src/theme";
import { useI18n } from "../src/i18n";
import { useWeightUnit } from "../src/units";
import {
  displayNameFor,
  tagsFor,
  getExercise,
} from "../src/exerciseLibrary";
import { getDb, ensureDb } from "../src/db";
import { epley1RM } from "../src/metrics";
import { GlassCard, Pill, Mono } from "../src/ui/modern";

type SetRow = {
  id: string;
  weight: number;
  reps: number;
  workout_id: string;
  created_at: string;
};

type HistoryDay = {
  date: string;       // ISO date
  label: string;      // "Tue · May 14" style
  setsSummary: string; // "8×72.5 · 8×72.5 · 7×72.5"
  isPr: boolean;
};

export default function ExerciseDetailScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const wu = useWeightUnit();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const exerciseId = typeof id === "string" ? id : "";

  const def = useMemo(() => (exerciseId ? getExercise(exerciseId) : null), [exerciseId]);
  const [stats, setStats] = useState<{ e1rm: number; bestSet: string; volume: number }>({
    e1rm: 0,
    bestSet: "--",
    volume: 0,
  });
  const [history, setHistory] = useState<HistoryDay[]>([]);

  useEffect(() => {
    if (!exerciseId) return;
    (async () => {
      await ensureDb();
      const db = getDb();

      // All sets for this exercise, newest first
      let sets: SetRow[] = [];
      try {
        sets = db.getAllSync<SetRow>(
          `SELECT id, weight, reps, workout_id, created_at
           FROM sets
           WHERE exercise_id = ?
           ORDER BY created_at DESC`,
          [exerciseId],
        ) ?? [];
      } catch {}

      // Stats — e1RM, best single set, all-time volume
      let bestE1rm = 0;
      let bestSet: { weight: number; reps: number } | null = null;
      let totalVolume = 0;
      for (const s of sets) {
        const e = epley1RM(s.weight, s.reps);
        if (e > bestE1rm) bestE1rm = e;
        if (!bestSet || s.weight * s.reps > bestSet.weight * bestSet.reps) {
          bestSet = { weight: s.weight, reps: s.reps };
        }
        totalVolume += s.weight * s.reps;
      }
      setStats({
        e1rm: Math.round(bestE1rm * 10) / 10,
        bestSet: bestSet ? `${bestSet.reps}×${wu.toDisplay(bestSet.weight)}` : "--",
        volume: Math.round(totalVolume),
      });

      // Recent history — group sets by workout, build "8×72.5 · 8×70" summaries.
      type WRow = { id: string; date: string };
      let workouts: WRow[] = [];
      try {
        const ids = Array.from(new Set(sets.map((s) => s.workout_id))).slice(0, 8);
        if (ids.length > 0) {
          const placeholders = ids.map(() => "?").join(",");
          workouts = db.getAllSync<WRow>(
            `SELECT id, date FROM workouts WHERE id IN (${placeholders}) ORDER BY date DESC`,
            ids,
          ) ?? [];
        }
      } catch {}

      // PRs — any set whose id appears in pr_records counts the day as a PR day.
      let prSetIds = new Set<string>();
      try {
        const prRows = db.getAllSync<{ set_id: string | null }>(
          "SELECT set_id FROM pr_records WHERE exercise_id = ?",
          [exerciseId],
        ) ?? [];
        for (const r of prRows) if (r.set_id) prSetIds.add(r.set_id);
      } catch {}

      const days: HistoryDay[] = workouts.map((w) => {
        const daySets = sets
          .filter((s) => s.workout_id === w.id)
          .sort((a, b) => a.created_at.localeCompare(b.created_at));
        const summary = daySets
          .slice(0, 4)
          .map((s) => `${s.reps}×${wu.toDisplay(s.weight)}`)
          .join(" · ");
        const isPr = daySets.some((s) => prSetIds.has(s.id));
        const d = new Date(w.date);
        let label = w.date;
        try {
          const weekday = d.toLocaleDateString(locale === "nb" ? "nb-NO" : "en-US", { weekday: "short" });
          const monthDay = d.toLocaleDateString(locale === "nb" ? "nb-NO" : "en-US", { month: "short", day: "numeric" });
          label = `${weekday} · ${monthDay}`;
        } catch {}
        return { date: w.date, label, setsSummary: summary || "--", isPr };
      });
      setHistory(days);
    })();
  }, [exerciseId, wu, locale]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!def) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>
        <View style={{ padding: 20 }}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({
              width: 38, height: 38, borderRadius: 12,
              backgroundColor: "rgba(255,255,255,0.05)",
              borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
              alignItems: "center", justifyContent: "center",
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <MaterialIcons name="arrow-back" size={16} color="#fff" />
          </Pressable>
          <Text
            style={{
              marginTop: 20,
              color: theme.text,
              fontSize: 22,
              fontFamily: theme.fontFamily.serif,
            }}
          >
            {t("exerciseDetail.notFound")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const muscleSummary = tagsFor(def.id).slice(0, 3).join(" · ") || t("exerciseDetail.general");
  const cues = CUES[def.id] ?? DEFAULT_CUES;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top", "left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({
              width: 38, height: 38, borderRadius: 12,
              backgroundColor: "rgba(255,255,255,0.05)",
              borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
              alignItems: "center", justifyContent: "center",
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <MaterialIcons name="arrow-back" size={16} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }} />
        </View>

        {/* Pill + Serif title */}
        <View style={{ marginTop: 4 }}>
          <Pill tone="accent">{muscleSummary}</Pill>
          <Text
            style={{
              color: theme.text,
              fontSize: 30,
              fontFamily: theme.fontFamily.serif,
              letterSpacing: -0.4,
              lineHeight: 34,
              marginTop: 10,
              marginBottom: 8,
            }}
          >
            {displayNameFor(def.id)}
          </Text>
        </View>

        {/* Frosted hero placeholder (diagonal stripes) */}
        <View
          style={{
            height: 140,
            borderRadius: 20,
            marginTop: 8,
            backgroundColor: "rgba(255,255,255,0.05)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <HeroStripes />
          <Text style={{ color: theme.muted2, fontSize: 10, fontFamily: theme.mono, letterSpacing: 0.5 }}>
            [ {t("exerciseDetail.demoPlaceholder")} ]
          </Text>
        </View>

        {/* 3 stat tiles */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
          <StatTile label={t("exerciseDetail.oneRmEst")} value={stats.e1rm > 0 ? wu.toDisplay(stats.e1rm).toString() : "--"} unit={stats.e1rm > 0 ? wu.unitLabel().toLowerCase() : ""} />
          <StatTile label={t("exerciseDetail.bestSet")} value={stats.bestSet} unit="" />
          <StatTile label={t("common.volume")} value={stats.volume > 0 ? wu.toDisplay(stats.volume).toLocaleString() : "--"} unit={stats.volume > 0 ? wu.unitLabel().toLowerCase() : ""} />
        </View>

        {/* Cues */}
        <GlassCard radius={18} padding={14} style={{ marginTop: 12 }}>
          <Text
            style={{
              color: theme.muted2,
              fontSize: 12,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              fontFamily: theme.fontFamily.medium,
              marginBottom: 8,
            }}
          >
            {t("exerciseDetail.cues")}
          </Text>
          {cues.map((c, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}>
              <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 20 }}>•</Text>
              <Text style={{ flex: 1, color: theme.muted, fontSize: 13, lineHeight: 20 }}>{c}</Text>
            </View>
          ))}
        </GlassCard>

        {/* History */}
        <Text
          style={{
            color: theme.muted,
            fontSize: 13,
            fontFamily: theme.fontFamily.medium,
            letterSpacing: 0.3,
            marginTop: 18,
            marginBottom: 10,
          }}
        >
          {t("exerciseDetail.history")}
        </Text>
        {history.length === 0 ? (
          <GlassCard padding={14}>
            <Text style={{ color: theme.muted, textAlign: "center" }}>
              {t("exerciseDetail.noHistory")}
            </Text>
          </GlassCard>
        ) : (
          <View style={{ gap: 8 }}>
            {history.map((h, i) => (
              <GlassCard key={`${h.date}-${i}`} radius={14} padding={12}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <Text style={{ color: theme.text, fontSize: 12, fontFamily: theme.fontFamily.medium }}>
                    {h.label}
                  </Text>
                  {h.isPr ? <Pill tone="pink">{t("exerciseDetail.newPr")}</Pill> : null}
                </View>
                <Mono style={{ color: theme.muted2, fontSize: 11 }}>{h.setsSummary}</Mono>
              </GlassCard>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({ label, value, unit }: { label: string; value: string; unit: string }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <GlassCard radius={14} padding={10}>
        <Text
          style={{
            color: theme.muted2,
            fontSize: 9,
            letterSpacing: 1,
            textTransform: "uppercase",
            fontFamily: theme.fontFamily.medium,
          }}
        >
          {label}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2, marginTop: 4 }}>
          <Mono style={{ color: theme.text, fontSize: 15 }}>{value}</Mono>
          {unit ? <Text style={{ color: theme.muted2, fontSize: 9 }}>{unit}</Text> : null}
        </View>
      </GlassCard>
    </View>
  );
}

// ── Diagonal stripe hero ─────────────────────────────────────────────────────
// 10 angled 1px stripes drawn as tilted rects. Matches the prototype's
// `repeating-linear-gradient(135deg, ...)` visually.

function HeroStripes() {
  const rows = 14;
  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" }} pointerEvents="none">
      {Array.from({ length: rows }, (_, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            top: i * 22 - 20,
            left: -40,
            right: -40,
            height: 1,
            backgroundColor: "rgba(255,255,255,0.08)",
            transform: [{ rotate: "-45deg" }],
          }}
        />
      ))}
    </View>
  );
}

// ── Cues ─────────────────────────────────────────────────────────────────────
// Short static cues per exercise id. Move to DB when we let users edit these.

const DEFAULT_CUES: string[] = [
  "Brace the core before every rep",
  "Move through the full range of motion",
  "Control the eccentric — 2s down",
];

const CUES: Record<string, string[]> = {
  bench_press: [
    "Feet planted, slight arch in lower back",
    "Bar path slightly diagonal toward lower chest",
    "Elbows ~45° from torso, tucked on descent",
    "Drive through mid-foot, full lockout",
  ],
  back_squat: [
    "Brace + big breath before unrack",
    "Knees track over toes",
    "Hips below knees at the bottom",
    "Drive up through the whole foot",
  ],
  deadlift: [
    "Bar over mid-foot, close to shins",
    "Lats tight, shoulders slightly in front of bar",
    "Push the floor away, finish with hips",
    "Reverse smoothly — don't drop",
  ],
  overhead_press: [
    "Stack: wrists over elbows over shoulders",
    "Glutes and abs tight the whole rep",
    "Head forward through the top",
    "Lock out before lowering",
  ],
};
