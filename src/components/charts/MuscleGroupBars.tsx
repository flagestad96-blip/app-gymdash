// src/components/charts/MuscleGroupBars.tsx
import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "../../theme";
import { useI18n } from "../../i18n";
import { tagsFor, resolveExerciseId } from "../../exerciseLibrary";
import { ListRow } from "../../ui";

export const MUSCLE_GROUPS = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
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

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
        {t("analysis.weekFrom", { week })}
      </Text>
      {rows.map((r, idx) => (
        <ListRow
          key={r.group}
          title={r.group}
          subtitle={`${r.count} ${t("common.sets").toLowerCase()} · ${r.status}${r.delta === 0 ? "" : r.delta > 0 ? ` (+${r.delta})` : ` (${r.delta})`}`}
          divider={idx < rows.length - 1}
        />
      ))}
    </View>
  );
}

export default MuscleGroupBars;
