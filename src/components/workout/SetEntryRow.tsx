// src/components/workout/SetEntryRow.tsx
import React from "react";
import { View, Text, Animated } from "react-native";
import { useTheme } from "../../theme";
import { useI18n } from "../../i18n";
import { useWeightUnit } from "../../units";
import { IconButton } from "../../ui";
import { isBodyweight, bodyweightFactorFor } from "../../exerciseLibrary";

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
};

function formatWeight(n: number) {
  if (!Number.isFinite(n)) return "";
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function setTypeLabel(setType?: string | null, isWarmup?: number | null) {
  if (isWarmup === 1 || setType === "warmup") return "WU";
  if (setType === "dropset") return "DS";
  if (setType === "restpause") return "RP";
  return "";
}

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

  const badge = setTypeLabel(s.set_type ?? null, s.is_warmup ?? null);
  const isBw = s.exercise_id ? isBodyweight(s.exercise_id) : false;
  const bwFactor = s.bodyweight_factor ?? (s.exercise_id ? bodyweightFactorFor(s.exercise_id) : 1);
  const ext = Number.isFinite(s.external_load_kg ?? NaN) ? (s.external_load_kg as number) : s.weight ?? 0;
  const bwInfo =
    isBw && s.est_total_load_kg != null && s.bodyweight_kg_used != null
      ? `BW ${formatWeight(wu.toDisplay(s.bodyweight_kg_used))}×${bwFactor} + ${formatWeight(wu.toDisplay(ext))} = ${formatWeight(wu.toDisplay(s.est_total_load_kg))}`
      : isBw
        ? t("log.bwMissing")
        : null;

  return (
    <Animated.View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: theme.space.sm,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.glassBorder,
        backgroundColor: highlight ? highlightBg : theme.glass,
      }}
    >
      <Text style={{ width: 28, color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>
        {s.set_index + 1}
      </Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontWeight: theme.fontWeight.semibold }}>
          {formatWeight(wu.toDisplay(s.weight))}
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
      <View style={{ width: 48, alignItems: "flex-start" }}>
        {badge ? (
          <View
            style={{
              paddingHorizontal: 6,
              paddingVertical: 3,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.isDark ? "rgba(182, 104, 245, 0.18)" : "rgba(124, 58, 237, 0.12)",
              borderWidth: 1,
              borderColor: theme.accent,
            }}
          >
            <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>
              {badge}
            </Text>
          </View>
        ) : (
          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>—</Text>
        )}
      </View>
      <View style={{ flexDirection: "row", gap: 6 }}>
        <IconButton icon="edit" onPress={() => onEdit(s)} />
        <IconButton icon="delete-outline" onPress={() => onDelete(s)} tone="danger" />
      </View>
    </Animated.View>
  );
}
