// app/(tabs)/log.tsx — Log (month calendar)
//
// Port of Gymdash.html's <LogScreen> component. The prototype's structure:
//
//   ScreenHeader "Log"
//   GlassCard strong radius=22:
//     • Month nav row: ← [Month Year] →   (month name in Instrument Serif)
//     • Day-of-week header: M T W T F S S (ink-3, 9px uppercase)
//     • 7-col grid of aspect-ratio:1 day cells, gap 4:
//         – Cells with a session: gradient-tinted by type (push / pull / legs)
//         – No session: transparent fill, faint border
//         – Today: 1.5px white border
//         – Inside each cell: Mono day number + small dot if session
//   Legend row: Push · Pull · Legs with colored chips
//   Two stat glass cards:
//     • "This month" — session count
//     • "Consistency" — planned-days-hit percentage
//
// Session type classification reads the workout's program day name
// ("Push day", "Pull", "Legs", …) and case-insensitive substring-matches.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ensureDb, getDb } from "../../src/db";
import { useTheme } from "../../src/theme";
import { useI18n } from "../../src/i18n";
import { useUserPreferences } from "../../src/userPreferences";
import { GlassCard, Mono } from "../../src/ui/modern";

// ── Session type classification ──────────────────────────────────────────────

type SessionType = "push" | "pull" | "legs" | "other";

function classify(dayName: string | null | undefined): SessionType | null {
  if (!dayName) return null;
  const n = dayName.toLowerCase();
  if (n.includes("push")) return "push";
  if (n.includes("pull")) return "pull";
  if (n.includes("leg") || n.includes("ben")) return "legs";
  return "other";
}

// Gradient tints matching the prototype exactly.
const TINTS: Record<SessionType, [string, string]> = {
  push: ["#60a5fa", "#c084fc"],   // blue → violet
  pull: ["#c084fc", "#f472b6"],   // violet → pink
  legs: ["#67e8f9", "#60a5fa"],   // cyan → blue
  other: ["#94a3b8", "#cbd5e1"],  // slate, used when classification fails
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function isoFromYMD(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function todayLocal(): { y: number; m: number; d: number; iso: string } {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate(), iso: isoFromYMD(d.getFullYear(), d.getMonth(), d.getDate()) };
}

// ── Screen ───────────────────────────────────────────────────────────────────

type CalSession = { date: string; type: SessionType };

export default function LogScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const prefs = useUserPreferences();

  const TODAY = useMemo(todayLocal, []);
  const [monthOffset, setMonthOffset] = useState(0);
  const [sessions, setSessions] = useState<Map<string, SessionType>>(new Map());

  // Current month anchor (relative to today's month + offset)
  const monthAnchor = useMemo(() => {
    const d = new Date(TODAY.y, TODAY.m + monthOffset, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  }, [TODAY, monthOffset]);

  const monthName = useMemo(() => {
    const d = new Date(monthAnchor.y, monthAnchor.m, 1);
    try {
      const s = d.toLocaleDateString(locale === "nb" ? "nb-NO" : "en-US", { month: "long", year: "numeric" });
      return s.charAt(0).toUpperCase() + s.slice(1);
    } catch {
      return `${d.getMonth() + 1}/${d.getFullYear()}`;
    }
  }, [monthAnchor, locale]);

  // Load workouts for the displayed month + classify them.
  const load = useCallback(async () => {
    await ensureDb();
    const db = getDb();
    const monthStart = isoFromYMD(monthAnchor.y, monthAnchor.m, 1);
    const nextMonth = new Date(monthAnchor.y, monthAnchor.m + 1, 1);
    const monthEnd = isoFromYMD(nextMonth.getFullYear(), nextMonth.getMonth(), nextMonth.getDate());

    type WorkoutRow = { id: string; date: string; program_id: string | null; day_index: number | null };
    let rows: WorkoutRow[] = [];
    try {
      rows = db.getAllSync<WorkoutRow>(
        `SELECT id, date, program_id, day_index FROM workouts
         WHERE date >= ? AND date < ?`,
        [monthStart, monthEnd],
      ) ?? [];
    } catch {}

    // Batch-fetch program day names for all (programId, dayIndex) pairs we need.
    type ProgDayRow = { program_id: string; day_index: number; name: string };
    const programIds = Array.from(new Set(rows.map((r) => r.program_id).filter((x): x is string => !!x)));
    let dayNames: Record<string, string> = {};
    if (programIds.length > 0) {
      const placeholders = programIds.map(() => "?").join(",");
      try {
        const dayRows = db.getAllSync<ProgDayRow>(
          `SELECT program_id, day_index, name FROM program_days WHERE program_id IN (${placeholders})`,
          programIds,
        ) ?? [];
        for (const r of dayRows) {
          dayNames[`${r.program_id}:${r.day_index}`] = r.name;
        }
      } catch {}
    }

    const next = new Map<string, SessionType>();
    for (const r of rows) {
      const name = r.program_id != null && r.day_index != null
        ? dayNames[`${r.program_id}:${r.day_index}`]
        : null;
      const cls = classify(name) ?? "other";
      next.set(r.date, cls);
    }
    setSessions(next);
  }, [monthAnchor]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Grid generation — Monday-first week like the prototype.
  // JS getDay() returns 0..6 with 0=Sunday. Convert to Monday-first (0=Mon).
  const firstOfMonth = useMemo(() => new Date(monthAnchor.y, monthAnchor.m, 1), [monthAnchor]);
  const daysInMonth = useMemo(() => new Date(monthAnchor.y, monthAnchor.m + 1, 0).getDate(), [monthAnchor]);
  const firstDow = useMemo(() => {
    const js = firstOfMonth.getDay(); // 0=Sun..6=Sat
    return (js + 6) % 7;              // 0=Mon..6=Sun
  }, [firstOfMonth]);

  const grid = useMemo<(number | null)[]>(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [firstDow, daysInMonth]);

  const sessionsThisMonth = sessions.size;
  const consistencyPct = useMemo(() => {
    // Naive estimate: expected = trainingDays × weeks in the month.
    const weeks = Math.max(1, Math.ceil(daysInMonth / 7));
    const expected = Math.max(1, (prefs.trainingDays ?? 4) * weeks);
    return Math.max(0, Math.min(100, Math.round((sessionsThisMonth / expected) * 100)));
  }, [sessionsThisMonth, daysInMonth, prefs.trainingDays]);

  const todayDay = monthAnchor.y === TODAY.y && monthAnchor.m === TODAY.m ? TODAY.d : -1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4, marginBottom: 14 }}>
          <View style={{ width: 38 }} />
          <Text
            style={{
              flex: 1,
              fontSize: 22,
              color: theme.text,
              fontFamily: theme.fontFamily.serif,
              letterSpacing: -0.2,
            }}
          >
            {t("nav.log")}
          </Text>
          <Pressable
            onPress={() => {}}
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
            <MaterialIcons name="more-horiz" size={16} color="#fff" />
          </Pressable>
        </View>

        {/* Calendar card */}
        <GlassCard strong radius={22} padding={16}>
          {/* Month nav row */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <NavArrow direction="left" onPress={() => setMonthOffset((x) => x - 1)} />
            <Text
              style={{
                color: theme.text,
                fontSize: 15,
                fontFamily: theme.fontFamily.serif,
                letterSpacing: -0.1,
              }}
            >
              {monthName}
            </Text>
            <NavArrow
              direction="right"
              onPress={() => setMonthOffset((x) => x + 1)}
              disabled={monthOffset >= 0}
            />
          </View>

          {/* Day-of-week header */}
          <View style={{ flexDirection: "row", marginBottom: 6 }}>
            {(["M", "T", "W", "T", "F", "S", "S"]).map((d, i) => (
              <View key={i} style={{ flex: 1, alignItems: "center" }}>
                <Text
                  style={{
                    color: theme.ink3,
                    fontSize: 9,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    fontFamily: theme.fontFamily.medium,
                  }}
                >
                  {d}
                </Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {grid.map((d, i) => {
              if (d == null) {
                return <View key={`empty-${i}`} style={calendarCellStyle} />;
              }
              const iso = isoFromYMD(monthAnchor.y, monthAnchor.m, d);
              const type = sessions.get(iso) ?? null;
              const isToday = d === todayDay;
              return (
                <DayCell key={`d-${d}`} day={d} type={type} isToday={isToday} theme={theme} />
              );
            })}
          </View>
        </GlassCard>

        {/* Legend */}
        <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
          {(["push", "pull", "legs"] as const).map((k) => (
            <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 14, height: 14, borderRadius: 5, overflow: "hidden" }}>
                <LinearGradient
                  colors={TINTS[k]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ flex: 1 }}
                />
              </View>
              <Text style={{ color: theme.muted, fontSize: 11 }}>{t(`log.legend.${k}`)}</Text>
            </View>
          ))}
        </View>

        {/* Month summary */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
          <GlassCard radius={18} padding={14} style={{ flex: 1 }}>
            <Text style={{ color: theme.muted2, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", fontFamily: theme.fontFamily.medium }}>
              {t("log.thisMonth")}
            </Text>
            <Mono style={{ fontSize: 26, color: theme.text, marginTop: 4 }}>{sessionsThisMonth}</Mono>
            <Text style={{ color: theme.muted2, fontSize: 11, marginTop: 1 }}>{t("log.sessions")}</Text>
          </GlassCard>
          <GlassCard radius={18} padding={14} style={{ flex: 1 }}>
            <Text style={{ color: theme.muted2, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", fontFamily: theme.fontFamily.medium }}>
              {t("log.consistency")}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 4 }}>
              <Mono style={{ fontSize: 26, color: theme.text }}>{consistencyPct}</Mono>
              <Text style={{ color: theme.muted2, fontSize: 14, marginLeft: 2 }}>%</Text>
            </View>
            <Text style={{ color: theme.aurora.cyan, fontSize: 11, marginTop: 1 }}>
              {consistencyPct >= 80 ? t("log.onTrack") : t("log.keepGoing")}
            </Text>
          </GlassCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function NavArrow({ direction, onPress, disabled }: { direction: "left" | "right"; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        width: 30,
        height: 30,
        borderRadius: 10,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
      })}
    >
      <MaterialIcons
        name={direction === "left" ? "chevron-left" : "chevron-right"}
        size={18}
        color="#fff"
      />
    </Pressable>
  );
}

// Fixed width — 1/7 of the grid minus the small gap between cells.
// Using percentage via (100/7)% keeps cells equal regardless of card width.
const CELL_WIDTH_PCT = `${100 / 7}%` as const;
const CELL_PADDING = 2; // half of the 4px gap on each side

const calendarCellStyle = {
  width: CELL_WIDTH_PCT,
  aspectRatio: 1,
  padding: CELL_PADDING,
} as const;

function DayCell({ day, type, isToday, theme }: { day: number; type: SessionType | null; isToday: boolean; theme: any }) {
  return (
    <View style={calendarCellStyle}>
      <View
        style={{
          flex: 1,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          borderWidth: isToday ? 1.5 : 1,
          borderColor: isToday ? "#ffffff" : "rgba(255,255,255,0.05)",
          backgroundColor: type ? "transparent" : "rgba(255,255,255,0.03)",
          shadowColor: type ? "#c084fc" : "transparent",
          shadowOpacity: type ? 0.35 : 0,
          shadowRadius: type ? 8 : 0,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        {type ? (
          <LinearGradient
            colors={TINTS[type]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <Mono
          style={{
            fontSize: 11,
            color: type ? "#fff" : theme.muted,
            fontFamily: isToday ? theme.mono : theme.mono,
          }}
        >
          {day}
        </Mono>
        {type ? (
          <View
            style={{
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: "#fff",
              marginTop: 2,
              opacity: 0.8,
            }}
          />
        ) : null}
      </View>
    </View>
  );
}
