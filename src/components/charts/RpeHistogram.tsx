// src/components/charts/RpeHistogram.tsx
import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "../../theme";
import { useI18n } from "../../i18n";

export type RpeHistogramData = {
  light: number;    // % of sets with RPE 6-7 (0-100)
  moderate: number; // % of sets with RPE 7.5-8.5 (0-100)
  hard: number;     // % of sets with RPE 9+ (0-100)
};

type RpeHistogramProps = {
  data: RpeHistogramData;
};

// Healthy target range bands (% fill)
const HEALTHY_RANGES = {
  light:    { min: 20, max: 40 },
  moderate: { min: 40, max: 60 },
  hard:     { min: 10, max: 25 },
};

export default function RpeHistogram({ data }: RpeHistogramProps) {
  const theme = useTheme();
  const { t } = useI18n();

  const rows: Array<{
    labelKey: string;
    pct: number;
    color: string;
    range: { min: number; max: number };
  }> = [
    { labelKey: "analysis.rpeLight",    pct: data.light,    color: theme.success,              range: HEALTHY_RANGES.light },
    { labelKey: "analysis.rpeModerate", pct: data.moderate, color: theme.warn, range: HEALTHY_RANGES.moderate },
    { labelKey: "analysis.rpeHard",     pct: data.hard,     color: theme.danger,               range: HEALTHY_RANGES.hard },
  ];

  return (
    <View style={{ gap: 10 }}>
      {rows.map((row) => (
        <View key={row.labelKey} style={{ gap: 4 }}>
          {/* Label + value */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
              {t(row.labelKey)}
            </Text>
            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
              {Math.round(row.pct)}%
            </Text>
          </View>

          {/* Track */}
          <View
            style={{
              height: 10,
              borderRadius: 5,
              backgroundColor: theme.glass,
              borderWidth: 1,
              borderColor: theme.glassBorder,
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Healthy range band (faint background) */}
            <View
              style={{
                position: "absolute",
                left: `${row.range.min}%`,
                width: `${row.range.max - row.range.min}%`,
                top: 0,
                bottom: 0,
                backgroundColor: row.color + "22",
              }}
            />
            {/* Actual fill bar */}
            {row.pct > 0 && (
              <View
                style={{
                  height: "100%",
                  width: `${Math.min(100, row.pct)}%`,
                  backgroundColor: row.color,
                  borderRadius: 5,
                }}
              />
            )}
          </View>
        </View>
      ))}
    </View>
  );
}
