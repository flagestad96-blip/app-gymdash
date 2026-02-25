// src/components/charts/MuscleGroupBars.tsx
import React from "react";
import { View, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../theme";
import { useI18n } from "../../i18n";
import { tagsFor, resolveExerciseId } from "../../exerciseLibrary";

export const MUSCLE_GROUPS = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
] as const;

export function primaryMuscleGroups(exerciseId?: string | null, exerciseName?: string | null): string[] {
  const exId = exerciseId ? String(exerciseId) : exerciseName ? resolveExerciseId(exerciseName) : null;
  if (!exId) return ["other"];
  const tags = tagsFor(exId);
  const groups = tags.filter((t) => MUSCLE_GROUPS.includes(t as (typeof MUSCLE_GROUPS)[number]));
  if (groups.length === 0) return ["other"];
  return groups.slice(0, 2);
}

export type MuscleGroupRow = {
  group: string;
  count: number;
  delta: number;
  status: string;
};

export type MuscleGroupBarsProps = {
  rows: MuscleGroupRow[];
  week: string;
};

function MuscleGroupBars({ rows, week }: MuscleGroupBarsProps) {
  const theme = useTheme();
  const { t } = useI18n();

  if (rows.length === 0) {
    return (
      <Text style={{ color: theme.muted }}>{t("analysis.noData")}</Text>
    );
  }

  // Compute max count for proportional bar width
  const maxCount = Math.max(...rows.map((r) => r.count), 1);

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
        {t("analysis.weekFrom", { week })}
      </Text>
      {rows.map((r) => {
        const pct = Math.max(4, (r.count / maxCount) * 100); // min 4% so bar is always visible
        const deltaLabel = r.delta === 0 ? "" : r.delta > 0 ? ` +${r.delta}` : ` ${r.delta}`;

        return (
          <View key={r.group} style={{ gap: 4 }}>
            {/* Label row */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{
                color: theme.text,
                fontFamily: theme.fontFamily.medium,
                fontSize: 13,
                textTransform: "capitalize",
              }}>
                {r.group}
              </Text>
              <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                {r.count} {t("common.sets").toLowerCase()}{deltaLabel}
              </Text>
            </View>

            {/* Bar track */}
            <View
              style={{
                height: 8,
                borderRadius: 4,
                backgroundColor: theme.glass,
                borderWidth: 1,
                borderColor: theme.glassBorder,
                overflow: "hidden",
              }}
            >
              {/* Gradient fill */}
              <LinearGradient
                colors={theme.accentGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  borderRadius: 4,
                }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default MuscleGroupBars;
