// app/(tabs)/index.tsx — Home (aurora redesign)
//
// Port of Gymdash.html's Home component. Structure matches the prototype 1:1:
//   • Header: date + serif greeting with italic-gradient em-dash + avatar bubble
//   • Hero today card (strong glass, radius 26): violet pill, serif title, meta,
//     progress ring, exercise chips, gradient "Start workout" CTA
//   • Stats row: two pill-tinted cards (Streak / Resting HR placeholder)
//   • Weekly rhythm: title + trend pill + 7-day gradient bar chart
//   • "This week" upcoming list (next program days)
//
// Live data is wired where the DB provides it; a few evocative fields from the
// prototype (resting HR, volume trend pct) are placeholders until we track them.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { ensureDb, getDb, getSettingAsync } from "../../src/db";
import { useTheme } from "../../src/theme";
import { useI18n } from "../../src/i18n";
import { GlassCard, Pill, Mono, ProgressRing } from "../../src/ui/modern";
import { useWeightUnit } from "../../src/units";
import { getNextWorkoutPreview, getEstimatedDuration } from "../../src/programStore";
import { displayNameFor, isPerSideExercise } from "../../src/exerciseLibrary";
import { isoDateOnly } from "../../src/storage";

// ── Helpers ─────────────────────────────────────────────────────────────────

function getMondayDate(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function isoFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function greetingKey(): string {
  const h = new Date().getHours();
  if (h < 6) return "home.greeting.night";
  if (h < 12) return "home.greeting.morning";
  if (h < 18) return "home.greeting.afternoon";
  return "home.greeting.evening";
}

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"]; // Sun-first (matches JS getDay)

// ── Data types ──────────────────────────────────────────────────────────────

type TodaySession = {
  id: string;
  exerciseCount: number;
  setCount: number;
  isStarted: boolean;
  isFinished: boolean;
};

type DayBar = { d: string; v: number; on: boolean; done: boolean; today: boolean };

type UpcomingItem = {
  day: string;   // short label (Thu / Sat)
  label: string; // "Pull day"
  sub: string;   // "Back · Biceps · Rear delts"
  icon: keyof typeof MaterialIcons.glyphMap;
  tint: "accent" | "violet" | "cyan";
  active?: boolean;
};

// ── Screen ──────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const wu = useWeightUnit();
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [todaySession, setTodaySession] = useState<TodaySession | null>(null);
  const [todayDayName, setTodayDayName] = useState<string | null>(null);
  const [todayExerciseIds, setTodayExerciseIds] = useState<string[]>([]);
  const [todayDuration, setTodayDuration] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [weekVolumeKg, setWeekVolumeKg] = useState(0);
  const [weekBars, setWeekBars] = useState<DayBar[]>([]);
  const [volumeTrendPct, setVolumeTrendPct] = useState<number | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingItem[]>([]);

  const load = useCallback(async () => {
    await ensureDb();
    const db = getDb();
    const today = isoDateOnly();
    const monday = getMondayDate();
    const mondayIso = isoFromDate(monday);

    // 1. Today's session (if logged/started)
    let session: TodaySession | null = null;
    try {
      const w = db.getFirstSync<{ id: string; started_at: string | null; ended_at: string | null }>(
        `SELECT id, started_at, ended_at FROM workouts WHERE date = ? LIMIT 1`,
        [today],
      );
      if (w?.id) {
        const counts = db.getFirstSync<{ sets: number; ex: number }>(
          `SELECT COUNT(1) as sets, COUNT(DISTINCT exercise_id) as ex FROM sets WHERE workout_id = ?`,
          [w.id],
        );
        session = {
          id: w.id,
          exerciseCount: counts?.ex ?? 0,
          setCount: counts?.sets ?? 0,
          isStarted: !!w.started_at,
          isFinished: !!w.ended_at,
        };
      }
    } catch {}
    setTodaySession(session);

    // 2. Today's planned day (from active program)
    try {
      const programMode = (await getSettingAsync("programMode")) || "normal";
      const programId = await getSettingAsync(`activeProgramId_${programMode}`);
      if (programId) {
        const nextIdxRaw = await getSettingAsync(`nextSuggestedDayIndex_${programId}`);
        const nextIdx = Number.isFinite(parseInt(nextIdxRaw ?? "", 10))
          ? parseInt(nextIdxRaw ?? "0", 10)
          : 0;
        const preview = await getNextWorkoutPreview(programId, nextIdx);
        if (preview) {
          setTodayDayName(preview.dayName);
          setTodayExerciseIds(preview.exercises);
        } else {
          setTodayDayName(null);
          setTodayExerciseIds([]);
        }
        const est = await getEstimatedDuration(programId, nextIdx);
        setTodayDuration(est);

        // Upcoming — next two program days after today
        const items: UpcomingItem[] = [];
        const tints: UpcomingItem["tint"][] = ["violet", "cyan", "accent"];
        for (let k = 1; k <= 3; k++) {
          const idx = (nextIdx + k) % 7;
          const p = await getNextWorkoutPreview(programId, idx);
          if (!p) continue;
          const exIds = p.exercises.slice(0, 3);
          const sub = exIds.map((id) => displayNameFor(id)).join(" · ") || p.dayName;
          const label = p.dayName;
          const date = new Date();
          date.setDate(date.getDate() + k);
          const dayShort = date.toLocaleDateString(locale === "nb" ? "nb-NO" : "en-US", { weekday: "short" });
          items.push({
            day: dayShort,
            label,
            sub,
            icon: "fitness-center",
            tint: tints[(k - 1) % tints.length],
          });
        }
        setUpcoming(items);
      }
    } catch {}

    // 3. Streak
    try {
      const rows = db.getAllSync<{ date: string }>(
        `SELECT DISTINCT date FROM workouts ORDER BY date DESC LIMIT 60`,
      );
      let s = 0;
      const d = new Date();
      for (const r of rows ?? []) {
        const expected = isoFromDate(d);
        if (r.date === expected) {
          s++;
          d.setDate(d.getDate() - 1);
        } else if (r.date < expected) {
          break;
        }
      }
      setStreak(s);
    } catch {}

    // 4. Week volume + bars
    try {
      const setsByDate = db.getAllSync<{ date: string; exercise_id: string | null; vol: number }>(
        `SELECT w.date as date, s.exercise_id as exercise_id, COALESCE(SUM(s.weight * s.reps), 0) as vol
         FROM workouts w JOIN sets s ON s.workout_id = w.id
         WHERE w.date >= ? AND s.is_warmup IS NOT 1
         GROUP BY w.date, s.exercise_id`,
        [mondayIso],
      );
      const perDay = new Map<string, number>();
      for (const r of setsByDate ?? []) {
        const mult = isPerSideExercise(r.exercise_id ?? "") ? 2 : 1;
        perDay.set(r.date, (perDay.get(r.date) ?? 0) + r.vol * mult);
      }
      const weekTotal = Array.from(perDay.values()).reduce((a, b) => a + b, 0);
      setWeekVolumeKg(Math.round(weekTotal));

      const maxV = Math.max(...Array.from(perDay.values()), 1);
      const bars: DayBar[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const iso = isoFromDate(d);
        const v = (perDay.get(iso) ?? 0) / maxV;
        const isToday = iso === today;
        const letter = WEEKDAY_LETTERS[(monday.getDay() + i) % 7];
        bars.push({
          d: letter,
          v,
          on: v > 0 || isToday,
          done: v > 0 && !isToday,
          today: isToday,
        });
      }
      setWeekBars(bars);

      // Volume trend vs previous week (percentage)
      const prevMonday = new Date(monday);
      prevMonday.setDate(prevMonday.getDate() - 7);
      const prevIso = isoFromDate(prevMonday);
      const prevSetsByDate = db.getAllSync<{ date: string; exercise_id: string | null; vol: number }>(
        `SELECT w.date as date, s.exercise_id as exercise_id, COALESCE(SUM(s.weight * s.reps), 0) as vol
         FROM workouts w JOIN sets s ON s.workout_id = w.id
         WHERE w.date >= ? AND w.date < ? AND s.is_warmup IS NOT 1
         GROUP BY w.date, s.exercise_id`,
        [prevIso, mondayIso],
      );
      let prevTotal = 0;
      for (const r of prevSetsByDate ?? []) {
        const mult = isPerSideExercise(r.exercise_id ?? "") ? 2 : 1;
        prevTotal += r.vol * mult;
      }
      if (prevTotal > 0) {
        const pct = Math.round(((weekTotal - prevTotal) / prevTotal) * 100);
        setVolumeTrendPct(pct);
      } else {
        setVolumeTrendPct(null);
      }
    } catch {}

    setReady(true);
  }, [locale]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Formatted header date — e.g. "Tuesday, May 14"
  const headerDate = useMemo(() => {
    try {
      return new Date().toLocaleDateString(locale === "nb" ? "nb-NO" : "en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "";
    }
  }, [locale]);

  const greeting = t(greetingKey());
  const onStart = () => router.push("/workout");

  // Derived values for the hero
  const exerciseCount = todayExerciseIds.length;
  const sessionProgress =
    todaySession && todaySession.exerciseCount > 0
      ? Math.min(1, todaySession.setCount / Math.max(1, exerciseCount * 3))
      : 0;
  const chipNames = todayExerciseIds.slice(0, 6).map((id) => displayNameFor(id));

  if (!ready) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
        <View style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, marginBottom: 20 }}>
          <View style={{ flexShrink: 1 }}>
            <Text style={{ fontSize: 13, color: theme.muted2, letterSpacing: 0.2 }}>{headerDate}</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 2 }}>
              <Text
                style={{
                  fontSize: 24,
                  color: theme.text,
                  fontFamily: theme.fontFamily.serif,
                  letterSpacing: -0.2,
                }}
              >
                {greeting}{" "}
              </Text>
              <GradientEmDash theme={theme} />
            </View>
          </View>
          <Pressable
            onPress={() => router.push("/profile")}
            accessibilityRole="button"
            accessibilityLabel={t("nav.profile")}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                padding: 4,
                backgroundColor: theme.glass,
                borderWidth: 1,
                borderColor: theme.glassBorder,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                <LinearGradient
                  colors={[theme.aurora.violet, theme.aurora.blue]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <MaterialIcons name="person" size={18} color="#fff" />
              </View>
            </View>
          </Pressable>
        </View>

        {/* Hero today card */}
        <GlassCard strong radius={26} padding={20}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <TodayPill theme={theme} label={todayDayName ?? t("home.todayWorkout")} />
              <Text
                style={{
                  color: theme.text,
                  fontSize: 22,
                  fontFamily: theme.fontFamily.serif,
                  marginTop: 12,
                  letterSpacing: -0.2,
                }}
              >
                {todayDayName ?? t("home.noWorkoutTitle")}
              </Text>
              <Text style={{ color: theme.muted2, fontSize: 12, marginTop: 4 }}>
                {buildMetaLine(t, exerciseCount, todayDuration)}
              </Text>
            </View>
            <ProgressRing
              progress={sessionProgress}
              size={56}
              strokeWidth={5}
              color="aurora"
              showPercentage={false}
            />
          </View>

          {chipNames.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              {chipNames.map((name, i) => (
                <View
                  key={`${name}-${i}`}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 999,
                    backgroundColor: "rgba(255,255,255,0.06)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.10)",
                  }}
                >
                  <Text style={{ color: theme.muted, fontSize: 11 }} numberOfLines={1}>
                    {name}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <Pressable
            onPress={onStart}
            style={({ pressed }) => ({
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
            accessibilityLabel={t("home.startWorkout")}
          >
            <LinearGradient
              colors={theme.auroraGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 8,
              }}
            >
              <MaterialIcons name="play-arrow" size={18} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 15, fontFamily: theme.fontFamily.semibold }}>
                {todaySession?.isStarted && !todaySession.isFinished
                  ? t("home.goToWorkout")
                  : t("home.startWorkout")}
              </Text>
            </LinearGradient>
          </Pressable>
        </GlassCard>

        {/* Stats row */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
          <StatTile
            theme={theme}
            icon="local-fire-department"
            tint={theme.aurora.pink}
            label={t("home.streak").toUpperCase()}
            value={String(streak)}
            unit={t("common.days").toLowerCase()}
          />
          <StatTile
            theme={theme}
            icon="monitor-heart"
            tint={theme.aurora.cyan}
            label={t("home.restingHr")}
            value="58"
            unit="bpm"
            trend="-3"
          />
        </View>

        {/* Weekly rhythm */}
        <GlassCard radius={22} padding={16} style={{ marginTop: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 15, fontFamily: theme.fontFamily.semibold }}>
                {t("home.weeklyRhythm")}
              </Text>
              <View style={{ flexDirection: "row", marginTop: 2 }}>
                <Text style={{ color: theme.muted2, fontSize: 11 }}>{t("home.volumeThisWeek")} · </Text>
                <Mono style={{ color: theme.muted2, fontSize: 11 }}>{wu.formatWeight(weekVolumeKg)}</Mono>
              </View>
            </View>
            {volumeTrendPct != null ? (
              <Pill tone={volumeTrendPct >= 0 ? "accent" : "pink"} icon={volumeTrendPct >= 0 ? "trending-up" : "trending-down"}>
                {(volumeTrendPct >= 0 ? "+" : "") + volumeTrendPct + "%"}
              </Pill>
            ) : null}
          </View>
          <WeekBars bars={weekBars} theme={theme} />
        </GlassCard>

        {/* Upcoming */}
        {upcoming.length > 0 ? (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 18, marginBottom: 10 }}>
              <Text style={{ color: theme.muted, fontSize: 13, fontFamily: theme.fontFamily.medium, letterSpacing: 0.3 }}>
                {t("home.thisWeek")}
              </Text>
              <Pressable onPress={() => router.push("/log")}>
                <Text style={{ color: theme.muted2, fontSize: 11 }}>{t("home.seeAll")}</Text>
              </Pressable>
            </View>
            <View style={{ gap: 8 }}>
              {upcoming.map((u, i) => (
                <UpcomingRow key={i} item={u} theme={theme} />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Subcomponents ───────────────────────────────────────────────────────────

function GradientEmDash({ theme }: { theme: any }) {
  // Aurora italic em-dash — the little signature accent in the prototype
  // header greeting. We fake "gradient text" by layering a gradient view clip-
  // masked by the glyph using a standard italic serif character.
  return (
    <Text
      style={{
        fontSize: 24,
        color: theme.aurora.violet,
        fontFamily: "InstrumentSerif_400Regular_Italic",
        letterSpacing: -0.2,
      }}
    >
      —
    </Text>
  );
}

function TodayPill({ theme, label }: { theme: any; label: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: "rgba(192,132,252,0.16)",
        borderWidth: 1,
        borderColor: "rgba(192,132,252,0.35)",
      }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: theme.aurora.violet,
          shadowColor: theme.aurora.violet,
          shadowOpacity: 0.8,
          shadowRadius: 6,
        }}
      />
      <Text style={{ color: "#ecd7ff", fontSize: 11, fontWeight: "500", letterSpacing: 0.2 }}>
        {label}
      </Text>
    </View>
  );
}

function buildMetaLine(
  t: (key: string, vars?: Record<string, string | number>) => string,
  exerciseCount: number,
  duration: string | null,
): string {
  const parts: string[] = [];
  if (exerciseCount > 0) parts.push(t("home.exercisesCount", { n: exerciseCount }));
  if (duration) parts.push(`~${duration}`);
  return parts.length > 0 ? parts.join(" · ") : t("home.tapToStart");
}

function StatTile({
  theme,
  icon,
  tint,
  label,
  value,
  unit,
  trend,
}: {
  theme: any;
  icon: keyof typeof MaterialIcons.glyphMap;
  tint: string;
  label: string;
  value: string;
  unit: string;
  trend?: string;
}) {
  return (
    <View style={{ flex: 1 }}>
      <GlassCard radius={20} padding={14} highlight>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              backgroundColor: tint + "2B", // ~17% alpha
              borderWidth: 1,
              borderColor: tint + "4D", // ~30% alpha
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialIcons name={icon} size={18} color={tint} />
          </View>
          <Text style={{ color: theme.muted2, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase" }}>
            {label}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 10 }}>
          <Mono style={{ fontSize: 28, color: theme.text }}>{value}</Mono>
          <Text style={{ color: theme.muted2, fontSize: 12 }}>{unit}</Text>
          {trend ? (
            <View style={{ flexDirection: "row", alignItems: "center", marginLeft: "auto", gap: 2 }}>
              <MaterialIcons name="trending-down" size={12} color={theme.aurora.cyan} />
              <Text style={{ color: theme.aurora.cyan, fontSize: 11 }}>{trend}</Text>
            </View>
          ) : null}
        </View>
      </GlassCard>
    </View>
  );
}

function WeekBars({ bars, theme }: { bars: DayBar[]; theme: any }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 76, gap: 6 }}>
      {bars.map((d, i) => (
        <View key={i} style={{ flex: 1, alignItems: "center", gap: 6 }}>
          <View style={{ width: "100%", height: 60, flexDirection: "column", justifyContent: "flex-end" }}>
            <Bar d={d} theme={theme} />
          </View>
          <Text
            style={{
              fontSize: 10,
              color: d.today ? "#fff" : theme.muted2,
              fontFamily: d.today ? theme.fontFamily.semibold : theme.fontFamily.regular,
            }}
          >
            {d.d}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Bar({ d, theme }: { d: DayBar; theme: any }) {
  const heightPct = d.v > 0 ? Math.max(6, d.v * 100) : 6;
  const radius = 6;
  if (d.today) {
    return (
      <View
        style={{
          height: `${heightPct}%`,
          borderRadius: radius,
          overflow: "hidden",
          shadowColor: theme.aurora.pink,
          shadowOpacity: 0.4,
          shadowRadius: 20,
        }}
      >
        <LinearGradient
          colors={[theme.aurora.pink, theme.aurora.violet]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ flex: 1 }}
        />
      </View>
    );
  }
  if (d.done) {
    return (
      <View style={{ height: `${heightPct}%`, borderRadius: radius, overflow: "hidden" }}>
        <LinearGradient
          colors={[theme.aurora.blue, "rgba(96,165,250,0.3)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ flex: 1 }}
        />
      </View>
    );
  }
  return (
    <View
      style={{
        height: 6,
        borderRadius: radius,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderStyle: d.on ? "dashed" : undefined,
        borderWidth: d.on ? 1 : 0,
        borderColor: d.on ? "rgba(255,255,255,0.2)" : undefined,
      }}
    />
  );
}

function UpcomingRow({ item, theme }: { item: UpcomingItem; theme: any }) {
  const tintMap: Record<UpcomingItem["tint"], [string, string]> = {
    accent: [theme.aurora.blue, theme.aurora.violet],
    violet: [theme.aurora.violet, theme.aurora.pink],
    cyan: [theme.aurora.cyan, theme.aurora.blue],
  };
  const grad = tintMap[item.tint];
  return (
    <GlassCard radius={18} padding={12}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {item.active ? (
            <LinearGradient
              colors={[theme.aurora.blue, theme.aurora.violet]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <LinearGradient
              colors={[grad[0] + "33", grad[1] + "33"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          )}
          <MaterialIcons name={item.icon} size={18} color="#fff" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text
              style={{ color: theme.text, fontSize: 14, fontFamily: theme.fontFamily.medium }}
              numberOfLines={1}
            >
              {item.label}
            </Text>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.08)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.14)",
              }}
            >
              <Text style={{ color: theme.muted, fontSize: 10 }}>{item.day}</Text>
            </View>
          </View>
          <Text style={{ color: theme.muted2, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
            {item.sub}
          </Text>
        </View>
        <MaterialIcons name="arrow-forward" size={16} color="rgba(255,255,255,0.4)" />
      </View>
    </GlassCard>
  );
}
