// src/components/workout/SetTable.tsx — header + rows for an exercise's logged sets.
import React from "react";
import { View, Text, Animated } from "react-native";
import { useTheme } from "../../theme";
import { useI18n } from "../../i18n";
import { useWeightUnit } from "../../units";
import SetEntryRow, { type SetRow } from "./SetEntryRow";

type SetTableProps = {
  sets: SetRow[];
  lastAddedSetId: string | null;
  lastAddedAnim: Animated.Value;
  onEditSet: (row: SetRow) => void;
  onDeleteSet: (row: SetRow) => void;
};

export default function SetTable({ sets, lastAddedSetId, lastAddedAnim, onEditSet, onDeleteSet }: SetTableProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const wu = useWeightUnit();

  if (sets.length === 0) {
    return (
      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>
        {t("log.noSetsYet")}
      </Text>
    );
  }

  const highlightBg = lastAddedAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.glass, theme.aurora.violet + "8C"],
  });

  return (
    <View style={{ gap: theme.space.xs }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: theme.space.sm,
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: theme.radius.md,
          backgroundColor: theme.panel2,
          borderWidth: 1,
          borderColor: theme.glassBorder,
        }}
      >
        <Text style={{ width: 28, color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>#</Text>
        <Text style={{ flex: 1, color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>{wu.unitLabel()}</Text>
        <Text style={{ width: 44, color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>{t("common.reps").toUpperCase()}</Text>
        <Text style={{ width: 48, color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>{t("log.type").toUpperCase()}</Text>
        <View style={{ width: 70 }} />
      </View>
      {sets.map((s) => (
        <SetEntryRow
          key={s.id}
          set={s}
          highlight={s.id === lastAddedSetId}
          highlightBg={highlightBg}
          onEdit={onEditSet}
          onDelete={onDeleteSet}
        />
      ))}
    </View>
  );
}
