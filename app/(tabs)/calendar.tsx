// app/(tabs)/calendar.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ensureDb, getDb } from "../../src/db";
import { theme } from "../../src/theme";
import { Screen, TopBar, IconButton, Card, ListRow } from "../../src/ui";

type WorkoutRow = {
  id: string;
  date: string;
  day_index?: number | null;
  started_at?: string | null;
};

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

export default function CalendarScreen() {
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

  useEffect(() => {
    ensureDb().then(async () => {
      const w = await getDb().getAllAsync<WorkoutRow>(
        `SELECT id, date, day_index, started_at FROM workouts ORDER BY date ASC`
      );
      setWorkouts(Array.isArray(w) ? w : []);

      const rows = await getDb().getAllAsync<{ workout_id: string; c: number }>(
        `SELECT workout_id, COUNT(1) as c FROM sets GROUP BY workout_id`
      );
      const map: Record<string, number> = {};
      for (const r of rows ?? []) map[r.workout_id] = r.c ?? 0;
      setSetsByWorkout(map);
    });
  }, []);

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

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.md, paddingBottom: 80 }}>
        <TopBar title="Kalender" subtitle={monthKey} left={<IconButton icon="menu" onPress={openDrawer} />} />

        <Card title="MÅNED">
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <BtnSmall label="‹" onPress={() => setMonthOffset((v) => v - 1)} />
            <Text style={{ color: theme.text, fontFamily: theme.mono }}>{monthKey}</Text>
            <BtnSmall label="›" onPress={() => setMonthOffset((v) => v + 1)} />
          </View>
        </Card>

        <Card title="DAGER">
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {["M", "T", "O", "T", "F", "L", "S"].map((d, i) => (
              <Text key={`${d}_${i}`} style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12, width: 28, textAlign: "center" }}>
                {d}
              </Text>
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
            {days.map((cell, idx) => {
              const hasWorkout = cell.date ? (workoutsByDate[cell.date]?.length ?? 0) > 0 : false;
              const isSelected = cell.date && cell.date === selectedDate;
              return (
                <Pressable
                  key={`${cell.label}_${idx}`}
                  onPress={() => cell.date && setSelectedDate(cell.date)}
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
                      borderColor: isSelected ? theme.accent : theme.line,
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
                        backgroundColor: theme.accent,
                        marginTop: 4,
                      }}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card title="ØKTER">
          {!selectedDate ? (
            <Text style={{ color: theme.muted }}>Velg en dato for å se økter.</Text>
          ) : selectedWorkouts.length === 0 ? (
            <Text style={{ color: theme.muted }}>Ingen økter på {selectedDate}.</Text>
          ) : (
            <View style={{ gap: 8 }}>
              <Text style={{ color: theme.muted, fontFamily: theme.mono }}>{selectedDate}</Text>
              {selectedWorkouts.map((w, idx) => {
                const setsCount = setsByWorkout[w.id] ?? 0;
                const dayLabel = Number.isFinite(w.day_index ?? NaN) ? `Dag ${(w.day_index ?? 0) + 1}` : "";
                return (
                  <ListRow
                    key={w.id}
                    title={dayLabel || "Økt"}
                    subtitle={`${setsCount} sett`}
                    right={
                      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>
                        {w.date.slice(5)}
                      </Text>
                    }
                    divider={idx < selectedWorkouts.length - 1}
                  />
                );
              })}
            </View>
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

function BtnSmall({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderColor: theme.line,
        borderWidth: 1,
        borderRadius: theme.radius.md,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: theme.panel2,
      }}
    >
      <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: theme.textSize.sm }}>{label}</Text>
    </Pressable>
  );
}

