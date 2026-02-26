// app/(tabs)/index.tsx — Home Dashboard
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ensureDb, getDb, getSettingAsync, formatDuration } from "../../src/db";
import { useTheme } from "../../src/theme";
import { useI18n } from "../../src/i18n";
import { Screen, TopBar, IconButton, Card } from "../../src/ui";
import { GradientButton } from "../../src/ui/modern";
import { displayNameFor, isPerSideExercise } from "../../src/exerciseLibrary";
import BackImpactDot from "../../src/components/BackImpactDot";
import { useWeightUnit } from "../../src/units";
import { getNextWorkoutPreview } from "../../src/programStore";
import { getPendingSuggestions, applySuggestion, dismissSuggestion, type ProgressionSuggestion } from "../../src/progressionStore";
import { isoDateOnly } from "../../src/storage";
import { getActiveGym } from "../../src/gymStore";
import TrainingStatusCard from "../../src/components/TrainingStatusCard";
import { computeTrainingStatus, type TrainingStatusResult } from "../../src/trainingStatus";
import { toggleManualDeload } from "../../src/periodization";

const BACKUP_REMINDER_DAYS = 14;

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

function getMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
}

function getPrevMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) - 7;
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

  const deloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showDeloadToast = useCallback(() => {
    setDeloadToast(true);
    if (deloadTimerRef.current) clearTimeout(deloadTimerRef.current);
    deloadTimerRef.current = setTimeout(() => setDeloadToast(false), 3000);
  }, []);
  useEffect(() => () => { if (deloadTimerRef.current) clearTimeout(deloadTimerRef.current); }, []);

  const [ready, setReady] = useState(false);
  const [todayWorkout, setTodayWorkout] = useState<TodayWorkout | null>(null);
  const [weekStats, setWeekStats] = useState({ days: 0, sets: 0, volume: 0, avgRpe: null as number | null });
  const [volumeTrend, setVolumeTrend] = useState<{ pct: number; dir: "up" | "down" | "flat" } | null>(null);
  const [streak, setStreak] = useState(0);
  const [recentPRs, setRecentPRs] = useState<PrRow[]>([]);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [nextWorkout, setNextWorkout] = useState<{ dayName: string; exercises: string[] } | null>(null);
  const [suggestions, setSuggestions] = useState<ProgressionSuggestion[]>([]);
  const [backupDaysAgo, setBackupDaysAgo] = useState<number | null>(null);
  const [backupDismissed, setBackupDismissed] = useState(false);
  const [activeGymName, setActiveGymName] = useState<string | null>(null);
  const [trainingStatus, setTrainingStatus] = useState<TrainingStatusResult | null>(null);
  const [trainingStatusLoading, setTrainingStatusLoading] = useState(true);
  const [activeProgramId, setActiveProgramId] = useState<string | null>(null);
  const [deloadToast, setDeloadToast] = useState(false);

  useEffect(() => {
    let alive = true;
    ensureDb().then(async () => {
      if (!alive) return;
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
          const setRows = db.getAllSync<{ exercise_id: string | null; vol: number }>(
            `SELECT exercise_id, COALESCE(SUM(weight * reps), 0) as vol
             FROM sets WHERE workout_id = ? GROUP BY exercise_id`,
            [w.id]
          );
          const countStats = db.getFirstSync<{ c: number; ex: number }>(
            `SELECT COUNT(1) as c, COUNT(DISTINCT exercise_id) as ex
             FROM sets WHERE workout_id = ?`,
            [w.id]
          );
          const todayVol = (setRows ?? []).reduce((total, row) => {
            const multiplier = isPerSideExercise(row.exercise_id ?? "") ? 2 : 1;
            return total + row.vol * multiplier;
          }, 0);
          setTodayWorkout({
            id: w.id,
            day_index: w.day_index,
            started_at: w.started_at,
            ended_at: w.ended_at ?? null,
            totalSets: countStats?.c ?? 0,
            totalVolume: Math.round(todayVol),
            exercises: countStats?.ex ?? 0,
          });
        }
      } catch {}

      // Week stats — per-side-corrected volume
      try {
        const wsMeta = db.getFirstSync<{ days: number; sets: number }>(
          `SELECT COUNT(DISTINCT w.date) as days, COUNT(s.id) as sets
           FROM workouts w LEFT JOIN sets s ON s.workout_id = w.id
           WHERE w.date >= ?`,
          [monday]
        );

        const thisWeekRows = db.getAllSync<{ exercise_id: string | null; vol: number }>(
          `SELECT s.exercise_id, COALESCE(SUM(s.weight * s.reps), 0) as vol
           FROM workouts w LEFT JOIN sets s ON s.workout_id = w.id
           WHERE w.date >= ? AND s.is_warmup IS NOT 1
           GROUP BY s.exercise_id`,
          [monday]
        );
        const thisWeekVol = (thisWeekRows ?? []).reduce((total, row) => {
          const multiplier = isPerSideExercise(row.exercise_id ?? "") ? 2 : 1;
          return total + row.vol * multiplier;
        }, 0);

        const prevMonday = getPrevMonday();
        const prevWeekRows = db.getAllSync<{ exercise_id: string | null; vol: number }>(
          `SELECT s.exercise_id, COALESCE(SUM(s.weight * s.reps), 0) as vol
           FROM workouts w LEFT JOIN sets s ON s.workout_id = w.id
           WHERE w.date >= ? AND w.date < ? AND s.is_warmup IS NOT 1
           GROUP BY s.exercise_id`,
          [prevMonday, monday]
        );
        const prevWeekVol = (prevWeekRows ?? []).reduce((total, row) => {
          const multiplier = isPerSideExercise(row.exercise_id ?? "") ? 2 : 1;
          return total + row.vol * multiplier;
        }, 0);

        if (prevWeekVol > 0) {
          const pct = Math.round(((thisWeekVol - prevWeekVol) / prevWeekVol) * 100);
          const dir = pct > 3 ? "up" : pct < -3 ? "down" : "flat";
          setVolumeTrend({ pct: Math.abs(pct), dir });
        } else {
          setVolumeTrend(null);
        }

        const rpeRow = db.getFirstSync<{ avg: number | null }>(
          `SELECT AVG(s.rpe) as avg
           FROM sets s JOIN workouts w ON s.workout_id = w.id
           WHERE w.date >= ? AND s.rpe IS NOT NULL`,
          [monday]
        );
        const avgRpe = rpeRow?.avg != null ? Math.round(rpeRow.avg * 10) / 10 : null;

        if (wsMeta) setWeekStats({
          days: wsMeta.days ?? 0,
          sets: wsMeta.sets ?? 0,
          volume: Math.round(thisWeekVol),
          avgRpe,
        });
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
        if (!hasToday && alive) {
          const programMode = (await getSettingAsync("programMode")) || "normal";
          const programId = await getSettingAsync(`activeProgramId_${programMode}`);
          if (programId && alive) {
            const nextIdxStr = await getSettingAsync(`nextSuggestedDayIndex_${programId}`);
            const parsed = parseInt(nextIdxStr ?? "", 10);
            const nextIdx = Number.isFinite(parsed) ? parsed : 0;
            const preview = await getNextWorkoutPreview(programId, nextIdx);
            if (alive) setNextWorkout(preview);
          }
        }
      } catch {}

      // Load progression suggestions
      try {
        if (alive) {
          const programMode = (await getSettingAsync("programMode")) || "normal";
          const programId = await getSettingAsync(`activeProgramId_${programMode}`);
          if (programId && alive) {
            const pending = await getPendingSuggestions(programId);
            if (alive) setSuggestions(pending);
          }
        }
      } catch {}

      // Backup reminder
      try {
        const wCount = db.getFirstSync<{ c: number }>(`SELECT COUNT(1) as c FROM workouts`);
        if (alive && (wCount?.c ?? 0) >= 3) {
          const lastBackup = await getSettingAsync("last_backup_at");
          if (!lastBackup) {
            setBackupDaysAgo(-1); // never backed up
          } else {
            const diff = Math.floor((Date.now() - Date.parse(lastBackup)) / 86_400_000);
            if (diff >= BACKUP_REMINDER_DAYS) setBackupDaysAgo(diff);
          }
        }
      } catch {}

      // Active gym name for passive indicator
      try {
        const gym = getActiveGym();
        if (alive) setActiveGymName(gym?.name ?? null);
      } catch {}

      if (alive) setReady(true);
    });
    return () => { alive = false; };
  }, []);

  useFocusEffect(
    useCallback(() => {
      try {
        const gym = getActiveGym();
        setActiveGymName(gym?.name ?? null);
      } catch {}
    }, [])
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const mode = (await getSettingAsync("programMode")) || "normal";
        const progId = await getSettingAsync(`activeProgramId_${mode}`);
        if (alive) setActiveProgramId(progId);
        const result = await computeTrainingStatus(progId);
        if (alive) setTrainingStatus(result);
      } catch {}
      if (alive) setTrainingStatusLoading(false);
    })();
    return () => { alive = false; };
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

        {/* Backup Reminder */}
        {backupDaysAgo != null && !backupDismissed && (
          <View style={{
            backgroundColor: theme.isDark ? "rgba(249,115,22,0.12)" : "rgba(249,115,22,0.08)",
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.warn,
            padding: 14,
            gap: 8,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <MaterialIcons name="cloud-off" size={20} color={theme.warn} />
                <Text style={{ color: theme.warn, fontFamily: theme.fontFamily.semibold, fontSize: 13, flex: 1 }}>
                  {backupDaysAgo < 0
                    ? t("home.backupNever")
                    : t("home.backupReminder", { days: String(backupDaysAgo) })}
                </Text>
              </View>
              <Pressable onPress={() => setBackupDismissed(true)} hitSlop={10}>
                <MaterialIcons name="close" size={18} color={theme.muted} />
              </Pressable>
            </View>
            <Pressable
              onPress={() => router.push("/settings")}
              style={{
                backgroundColor: theme.warn,
                borderRadius: 10,
                paddingVertical: 8,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontFamily: theme.fontFamily.semibold, fontSize: 13 }}>
                {t("home.backupNow")}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Today's Workout */}
        <Card>
          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
            {t("home.todayWorkout")}
          </Text>
          {activeGymName ? (
            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12, opacity: 0.7 }}>
              {activeGymName}
            </Text>
          ) : null}
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
                  <BackImpactDot exerciseId={exId} />
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
            {weekStats.avgRpe != null && (
              <StatBadge
                label={t("home.avgRpe")}
                value={weekStats.avgRpe.toFixed(1)}
                theme={theme}
                accentColor={weekStats.avgRpe <= 7 ? "#22c55e" : weekStats.avgRpe <= 8.5 ? "#F97316" : "#ef4444"}
              />
            )}
          </View>
          {volumeTrend && (
            <Text style={{
              color: volumeTrend.dir === "up" ? theme.success : volumeTrend.dir === "down" ? theme.danger : theme.muted,
              fontFamily: theme.mono,
              fontSize: 11,
              marginTop: 4,
            }}>
              {volumeTrend.dir === "up"
                ? t("home.volumeTrend.up", { pct: String(volumeTrend.pct) })
                : volumeTrend.dir === "down"
                  ? t("home.volumeTrend.down", { pct: String(volumeTrend.pct) })
                  : t("home.volumeTrend.flat")}
            </Text>
          )}
        </Card>

        {/* Training Status */}
        <TrainingStatusCard
          result={trainingStatus}
          loading={trainingStatusLoading}
          onViewAnalysis={() => router.push("/analysis")}
          onStartDeload={async () => {
            try {
              const programMode = (await getSettingAsync("programMode")) || "normal";
              const programId = await getSettingAsync(`activeProgramId_${programMode}`);
              if (!programId) return;
              await toggleManualDeload(programId);
              const freshStatus = await computeTrainingStatus(programId);
              setTrainingStatus(freshStatus);
              showDeloadToast();
            } catch {}
          }}
        />

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
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ color: theme.text, fontFamily: theme.fontFamily.medium, fontSize: 14 }}>
                        {displayNameFor(s.exerciseId)}
                      </Text>
                      <BackImpactDot exerciseId={s.exerciseId} />
                    </View>
                    <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                      {wu.formatWeight(s.oldWeightKg)} {"\u2192"} {wu.formatWeight(s.newWeightKg)}
                    </Text>
                    {s.reason ? (
                      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>{s.reason}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={async () => {
                      try {
                        await applySuggestion(s.id);
                        setSuggestions((prev) => prev.filter((x) => x.id !== s.id));
                      } catch {}
                    }}
                    style={{ borderColor: theme.accent, borderWidth: 1, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 }}
                  >
                    <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: 11 }}>{t("progression.apply")}</Text>
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      try {
                        await dismissSuggestion(s.id);
                        setSuggestions((prev) => prev.filter((x) => x.id !== s.id));
                      } catch {}
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
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ color: theme.text, fontFamily: theme.fontFamily.medium, fontSize: 14 }}>
                        {displayNameFor(pr.exercise_id)}
                      </Text>
                      <BackImpactDot exerciseId={pr.exercise_id} />
                    </View>
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
      {/* Deload activated toast */}
      {deloadToast && (
        <View
          style={{
            position: "absolute",
            bottom: 50,
            left: 24,
            right: 24,
            backgroundColor: theme.glass,
            borderColor: theme.success,
            borderWidth: 1,
            borderRadius: 14,
            paddingVertical: 12,
            paddingHorizontal: 18,
            alignItems: "center",
            zIndex: 9999,
          }}
        >
          <Text style={{ color: theme.success, fontFamily: theme.fontFamily.semibold, fontSize: 14 }}>
            {t("home.deloadStarted")}
          </Text>
        </View>
      )}
    </Screen>
  );
}

function StatBadge({ label, value, theme, accent, accentColor }: { label: string; value: string; theme: any; accent?: boolean; accentColor?: string }) {
  const highlighted = accent || !!accentColor;
  const color = accentColor ?? theme.accent;
  return (
    <View style={{
      flex: 1,
      minWidth: 80,
      backgroundColor: highlighted
        ? (theme.isDark ? `${color}26` : `${color}1A`)
        : theme.glass,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: highlighted ? color : theme.glassBorder,
      alignItems: "center",
    }}>
      <Text style={{ color: highlighted ? color : theme.text, fontFamily: theme.fontFamily.bold, fontSize: 18 }}>
        {value}
      </Text>
      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>{label}</Text>
    </View>
  );
}
