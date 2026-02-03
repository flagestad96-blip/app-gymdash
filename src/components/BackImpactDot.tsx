// src/components/BackImpactDot.tsx — Colored dot indicator for lower-back impact
import React from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { useTheme } from "../theme";
import { useI18n } from "../i18n";
import { backImpactFor, type BackImpact } from "../exerciseLibrary";

const COLORS: Record<BackImpact, string> = {
  red: "#ef4444",
  yellow: "#eab308",
  green: "#22c55e",
};

const I18N_KEY: Record<BackImpact, string> = {
  red: "back.red",
  yellow: "back.yellow",
  green: "back.green",
};

type Props = {
  exerciseId: string;
  size?: number;
  showLabel?: boolean;
};

export default function BackImpactDot({ exerciseId, size = 8, showLabel }: Props) {
  const theme = useTheme();
  const { t } = useI18n();
  const impact = backImpactFor(exerciseId);
  if (!impact) return null;

  const color = COLORS[impact];
  const label = t(I18N_KEY[impact]);

  return (
    <Pressable
      onPress={() => Alert.alert(label)}
      hitSlop={8}
      style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        }}
      />
      {showLabel ? (
        <Text style={{ color: theme.muted, fontSize: theme.fontSize.xs, fontFamily: theme.fontFamily.regular }}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}
