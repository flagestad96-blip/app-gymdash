// app/(tabs)/index.tsx — Home Dashboard
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ensureDb, getDb, getSettingAsync, formatDuration } from "../../src/db";
import { useTheme } from "../../src/theme";
import { useI18n } from "../../src/i18n";
import { Screen, TopBar, IconButton, Card } from "../../src/ui";
import { GradientButton } from "../../src/ui/modern";
import { displayNameFor } from "../../src/exerciseLibrary";
import { useWeightUnit } from "../../src/units";
import { getNextWorkoutPreview } from "../../src/programStore";
import { getPendingSuggestions, applySuggestion, dismissSuggestion, type ProgressionSuggestion } from "../../src/progressionStore";

type TodayWorkout = {
  id: string;
  day_index: number | null;
  started_at: string | null;
  ended_at: string | null;
  totalSets: number;
  totalVolume: number;
  exercises: number;
};

type PrRow = {
  exercise_id: string;
  type: string;
  value: number;
  date: string;
};

function isoDateOnly() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
}

export default function HomeScreen() {
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

  const [ready, setReady] = useState(false);
  const [todayWorkout, setTodayWorkout] = useState<TodayWorkout | null>(null);
  const [weekStats, setWeekStats] = useState({ days: 0, sets: 0, volume: 0 });
  const [streak, setStreak] = useState(0);
  const [recentPRs, setRecentPRs] = useState<PrRow[]>([]);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [nextWorkout, setNextWorkout] = useState<{ dayName: string; exercises: string[] } | null>(null);
  const [suggestions, setSuggestions] = useState<ProgressionSuggestion[]>([]);

  useEffect(() => {
    ensureDb().then(async () => {
      const db = getDb();
      const today = isoDateOnly();
      const monday = getMonday();

      // Today's workout
      try {
        const w = db.getFirstSync<{ id: string; day_index: number | null; started_at: string | null; ended_at: string | null }>(
          `SELECT id, day_index, started_at, ended_at FROM workouts WHERE date = ? LIMIT 1`,
          [today]
        );
        if (w?.id) {
          const stats = db.getFirstSync<{ c: number; vol: number; ex: number }>(
            `SELECT COUNT(1) as c,
                    COALESCE(SUM(CASE WHEN is_warmup = 1 THEN 0 ELSE weight * reps END), 0) as vol,
                    COUNT(DISTINCT exercise_id) as ex
             FROM sets WHERE workout_id = ?`,
            [w.id]
          );
          setTodayWorkout({
            id: w.id,
            day_index: w.day_index,
            started_at: w.started_at,
            ended_at: w.ended_at ?? null,
            totalSets: stats?.c ?? 0,
            totalVolume: Math.round(stats?.vol ?? 0),
            exercises: stats?.ex ?? 0,
          });
        }
      } catch {}

      // Week stats
      try {
        const ws = db.getFirstSync<{ days: number; sets: number; vol: number }>(
          `SELECT COUNT(DISTINCT w.date) as days,
                  COUNT(s.id) as sets,
                  COALESCE(SUM(CASE WHEN s.is_warmup = 1 THEN 0 ELSE s.weight * s.reps END), 0) as vol
           FROM workouts w
           LEFT JOIN sets s ON s.workout_id = w.id
           WHERE w.date >= ?`,
          [monday]
        );
        if (ws) setWeekStats({ days: ws.days ?? 0, sets: ws.sets ?? 0, volume: Math.round(ws.vol ?? 0) });
      } catch {}

      // Streak
      try {
        const dates = db.getAllSync<{ date: string }>(
          `SELECT DISTINCT date FROM workouts ORDER BY date DESC LIMIT 365`
        );
        let count = 0;
        const now = new Date();
        for (let i = 0; i < (dates?.length ?? 0); i++) {
          const check = new Date(now);
          check.setDate(check.getDate() - i);
          const checkStr = `${check.getFullYear()}-${String(check.getMonth() + 1).padStart(2, "0")}-${String(check.getDate()).padStart(2, "0")}`;
          if (dates?.some((d) => d.date === checkStr)) {
            count++;
          } else if (i === 0) {
            // Today might not have a workout yet — still count streak from yesterday
            continue;
          } else {
            break;
          }
        }
        setStreak(count);
      } catch {}

      // Recent PRs
      try {
        const prs = db.getAllSync<PrRow>(
          `SELECT exercise_id, type, value, date FROM pr_records ORDER BY date DESC LIMIT 5`
        );
        setRecentPRs(Array.isArray(prs) ? prs : []);
      } catch {}

      // Total workouts
      try {
        const tw = db.getFirstSync<{ c: number }>(`SELECT COUNT(1) as c FROM workouts`);
        setTotalWorkouts(tw?.c ?? 0);
      } catch {}

      // Next workout preview (only when no workout today)
      try {
        const hasToday = db.getFirstSync<{ id: string }>(`SELECT id FROM workouts WHERE date = ? LIMIT 1`, [today]);
        if (!hasToday) {
          const programMode = (await getSettingAsync("programMode")) || "normal";
          const programId = await getSettingAsync(`activeProgramId_${programMode}`);
          if (programId) {
            const nextIdxStr = await getSettingAsync(`nextSuggestedDayIndex_${programId}`);
            const nextIdx = nextIdxStr ? parseInt(nextIdxStr, 10) : 0;
            const preview = await getNextWorkoutPreview(programId, nextIdx);
            setNextWorkout(preview);
          }
        }
      } catch {}

      // Load progression suggestions
      try {
        const programMode = (await getSettingAsync("programMode")) || "normal";
        const programId = await getSettingAsync(`activeProgramId_${programMode}`);
        if (programId) {
          const pending = await getPendingSuggestions(programId);
          setSuggestions(pending);
        }
      } catch {}

      setReady(true);
    });
  }, []);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return t("home.greeting.night");
    if (h < 12) return t("home.greeting.morning");
    if (h < 18) return t("home.greeting.afternoon");
    return t("home.greeting.evening");
  }, [t]);

  const prTypeLabel = (type: string) => {
    switch (type) {
      case "heaviest": return t("home.prType.heaviest");
      case "e1rm": return t("home.prType.e1rm");
      case "volume": return t("home.prType.volume");
      default: return type;
    }
  };

  if (!ready) return <Screen><View style={{ flex: 1 }} /></Screen>;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.md, paddingBottom: 80 }}>
        <TopBar
          title={t("home.title")}
          subtitle={greeting}
          left={<IconButton icon="menu" onPress={openDrawer} />}
        />

        {/* Today's Workout */}
        <Card>
          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
            {t("home.todayWorkout")}
          </Text>
          {todayWorkout ? (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                <StatBadge label={t("common.exercises")} value={String(todayWorkout.exercises)} theme={theme} />
                <StatBadge label={t("common.sets")} value={String(todayWorkout.totalSets)} theme={theme} />
                <StatBadge label={t("common.volume")} value={wu.formatWeight(todayWorkout.totalVolume)} theme={theme} />
                {todayWorkout.ended_at ? (
                  <StatBadge label={t("common.duration")} value={formatDuration(todayWorkout.started_at, todayWorkout.ended_at)} theme={theme} />
                ) : null}
              </View>
              <GradientButton
                text={t("home.goToWorkout")}
                onPress={() => router.push("/log")}
                icon="fitness-center"
              />
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={{ color: theme.muted, fontSize: theme.fontSize.sm }}>
                {t("home.noWorkout")}
              </Text>
              <GradientButton
                text={t("home.startWorkout")}
                onPress={() => router.push("/log")}
                icon="fitness-center"
              />
            </View>
          )}
        </Card>

        {/* Next Workout Preview */}
        {!todayWorkout && nextWorkout && (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
                {t("home.nextWorkout")}
              </Text>
              <MaterialIcons name="arrow-forward" size={14} color={theme.muted} />
            </View>
            <Text style={{ color: theme.text, fontFamily: theme.fontFamily.semibold, fontSize: 17, marginBottom: 8 }}>
              {nextWorkout.dayName}
            </Text>
            <View style={{ gap: 5 }}>
              {nextWorkout.exercises.slice(0, 5).map((exId, idx) => (
                <View key={`${exId}_${idx}`} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: theme.accent }} />
                  <Text style={{ color: theme.text, fontFamily: theme.fontFamily.regular, fontSize: 14 }}>
                    {displayNameFor(exId)}
                  </Text>
                </View>
              ))}
              {nextWorkout.exercises.length > 5 && (
                <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11, marginTop: 2 }}>
                  {t("home.andMore", { count: String(nextWorkout.exercises.length - 5) })}
                </Text>
              )}
            </View>
            <View style={{ marginTop: 12 }}>
              <GradientButton
                text={t("home.startThisWorkout")}
                onPress={() => router.push("/log")}
                icon="play-arrow"
              />
            </View>
          </Card>
        )}

        {/* Weekly Stats */}
        <Card>
          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
            {t("home.thisWeek")}
          </Text>
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            <StatBadge label={t("common.workouts")} value={String(weekStats.days)} theme={theme} accent />
            <StatBadge label={t("common.sets")} value={String(weekStats.sets)} theme={theme} />
            <StatBadge label={t("common.volume")} value={wu.formatWeight(weekStats.volume)} theme={theme} />
          </View>
        </Card>

        {/* Progression Suggestions */}
        {suggestions.length > 0 ? (
          <Card>
            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
              {t("progression.suggestions")}
            </Text>
            <View style={{ gap: 8 }}>
              {suggestions.map((s) => (
                <View
                  key={s.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.divider,
                  }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: theme.text, fontFamily: theme.fontFamily.medium, fontSize: 14 }}>
                      {displayNameFor(s.exerciseId)}
                    </Text>
                    <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                      {wu.formatWeight(s.oldWeightKg)} {"\u2192"} {wu.formatWeight(s.newWeightKg)}
                    </Text>
                    {s.reason ? (
                      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>{s.reason}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={async () => {
                      await applySuggestion(s.id);
                      setSuggestions((prev) => prev.filter((x) => x.id !== s.id));
                    }}
                    style={{ borderColor: theme.accent, borderWidth: 1, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 }}
                  >
                    <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: 11 }}>{t("progression.apply")}</Text>
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      await dismissSuggestion(s.id);
                      setSuggestions((prev) => prev.filter((x) => x.id !== s.id));
                    }}
                    style={{ borderColor: theme.glassBorder, borderWidth: 1, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 }}
                  >
                    <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>{t("progression.dismiss")}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {/* Streak + Total */}
        <View style={{ flexDirection: "row", gap: theme.space.md }}>
          <Card style={{ flex: 1 }}>
            <View style={{ alignItems: "center", gap: 4 }}>
              <MaterialIcons name="local-fire-department" size={28} color={theme.warn} />
              <Text style={{ color: theme.text, fontFamily: theme.fontFamily.bold, fontSize: 28 }}>{streak}</Text>
              <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>{t("home.streak")}</Text>
            </View>
          </Card>
          <Card style={{ flex: 1 }}>
            <View style={{ alignItems: "center", gap: 4 }}>
              <MaterialIcons name="trending-up" size={28} color={theme.accent} />
              <Text style={{ color: theme.text, fontFamily: theme.fontFamily.bold, fontSize: 28 }}>{totalWorkouts}</Text>
              <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>{t("home.total")}</Text>
            </View>
          </Card>
        </View>

        {/* Recent PRs */}
        {recentPRs.length > 0 ? (
          <Card>
            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
              {t("home.recentPRs")}
            </Text>
            <View style={{ gap: 8 }}>
              {recentPRs.map((pr, idx) => (
                <View
                  key={`${pr.exercise_id}_${pr.type}_${idx}`}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingVertical: 6,
                    borderBottomWidth: idx < recentPRs.length - 1 ? 1 : 0,
                    borderBottomColor: theme.divider,
                  }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: theme.text, fontFamily: theme.fontFamily.medium, fontSize: 14 }}>
                      {displayNameFor(pr.exercise_id)}
                    </Text>
                    <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>
                      {prTypeLabel(pr.type)} \u00B7 {pr.date.slice(5).replace("-", ".")}
                    </Text>
                  </View>
                  <View style={{
                    backgroundColor: theme.isDark ? "rgba(182,104,245,0.15)" : "rgba(124,58,237,0.10)",
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}>
                    <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: 14 }}>
                      {wu.formatWeight(pr.value)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {/* Quick Actions */}
        <View style={{ flexDirection: "row", gap: theme.space.md }}>
          <View style={{ flex: 1 }}>
            <GradientButton
              text={t("nav.log")}
              onPress={() => router.push("/log")}
              icon="fitness-center"
            />
          </View>
          <View style={{ flex: 1 }}>
            <GradientButton
              text={t("nav.program")}
              onPress={() => router.push("/program")}
              icon="list-alt"
              variant="success"
            />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function StatBadge({ label, value, theme, accent }: { label: string; value: string; theme: any; accent?: boolean }) {
  return (
    <View style={{
      flex: 1,
      minWidth: 80,
      backgroundColor: accent
        ? (theme.isDark ? "rgba(182,104,245,0.15)" : "rgba(124,58,237,0.10)")
        : theme.glass,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: accent ? theme.accent : theme.glassBorder,
      alignItems: "center",
    }}>
      <Text style={{ color: accent ? theme.accent : theme.text, fontFamily: theme.fontFamily.bold, fontSize: 18 }}>
        {value}
      </Text>
      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 9 }}>{label}</Text>
    </View>
  );
}
