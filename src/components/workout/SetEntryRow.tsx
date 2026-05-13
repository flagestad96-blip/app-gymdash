// src/components/workout/SetEntryRow.tsx
import React from "react";
import { View, Text, Animated } from "react-native";
import { useTheme } from "../../theme";
import { useI18n } from "../../i18n";
import { useWeightUnit } from "../../units";
import { IconButton } from "../../ui";
import { isBodyweight, bodyweightFactorFor, isPerSideExercise } from "../../exerciseLibrary";
import { formatWeight } from "../../format";

export type SetRow = {
  id: string;
  workout_id: string;
  exercise_name: string;
  set_index: number;
  weight: number;
  reps: number;
  rpe?: number | null;
  created_at: string;
  exercise_id?: string | null;
  set_type?: string | null;
  is_warmup?: number | null;
  external_load_kg?: number | null;
  bodyweight_kg_used?: number | null;
  bodyweight_factor?: number | null;
  est_total_load_kg?: number | null;
  rest_seconds?: number | null;
  notes?: string | null;
};

export type SetEntryRowProps = {
  set: SetRow;
  highlight: boolean;
  highlightBg: Animated.AnimatedInterpolation<string | number>;
  onEdit: (row: SetRow) => void;
  onDelete: (row: SetRow) => void;
};

export default function SetEntryRow({ set: s, highlight, highlightBg, onEdit, onDelete }: SetEntryRowProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const wu = useWeightUnit();

  const isBw = s.exercise_id ? isBodyweight(s.exercise_id) : false;
  const bwFactor = s.bodyweight_factor ?? (s.exercise_id ? bodyweightFactorFor(s.exercise_id) : 1);
  const ext = Number.isFinite(s.external_load_kg ?? NaN) ? (s.external_load_kg as number) : s.weight ?? 0;
  const bwInfo =
    isBw && s.est_total_load_kg != null && s.bodyweight_kg_used != null
      ? `BW ${formatWeight(wu.toDisplay(s.bodyweight_kg_used))}×${bwFactor} + ${formatWeight(wu.toDisplay(ext))} = ${formatWeight(wu.toDisplay(s.est_total_load_kg))}`
      : isBw
        ? t("log.bwMissing")
        : null;

  const hasNote = !!(s.notes && s.notes.trim());

  return (
    <Animated.View
      style={{
        gap: 4,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: hasNote ? theme.accent : theme.glassBorder,
        backgroundColor: highlight ? highlightBg : theme.glass,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.space.sm }}>
        <Text style={{ width: 28, color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>
          {s.set_index + 1}
        </Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontWeight: theme.fontWeight.semibold }}>
            {formatWeight(wu.toDisplay(s.weight))}
            {s.exercise_id && isPerSideExercise(s.exercise_id)
              ? ` (${t("log.each")})`
              : null}
          </Text>
          {bwInfo ? (
            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>
              {bwInfo}
            </Text>
          ) : null}
        </View>
        <View style={{ width: 44 }}>
          <Text style={{ color: theme.text, fontWeight: theme.fontWeight.medium }}>{s.reps}</Text>
          {s.rpe != null ? (
            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>
              @{s.rpe}
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <IconButton
            icon={hasNote ? "note" : "note-add"}
            onPress={() => onEdit(s)}
            tone={hasNote ? "accent" : "normal"}
            accessibilityLabel={t("log.setNote")}
          />
          <IconButton icon="edit" onPress={() => onEdit(s)} />
          <IconButton icon="delete-outline" onPress={() => onDelete(s)} tone="danger" />
        </View>
      </View>
      {hasNote ? (
        <Text
          style={{
            color: theme.muted,
            fontSize: theme.fontSize.xs,
            fontStyle: "italic",
            paddingLeft: 28 + theme.space.sm,
            paddingRight: 4,
          }}
          numberOfLines={2}
        >
          {s.notes}
        </Text>
      ) : null}
    </Animated.View>
  );
}
