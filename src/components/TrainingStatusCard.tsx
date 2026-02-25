// src/components/TrainingStatusCard.tsx
import React from "react";
import { View, Text, Pressable } from "react-native";
import { GlassCard, SkeletonLoader } from "../ui/modern";
import { useTheme } from "../theme";
import { useI18n } from "../i18n";
import type { TrainingStatusResult } from "../trainingStatus";

export type TrainingStatusCardProps = {
  result: TrainingStatusResult | null;
  loading: boolean;
  onViewAnalysis: () => void;
  onStartDeload?: () => void;
};

function statusColor(level: TrainingStatusResult["level"], theme: ReturnType<typeof useTheme>): string {
  switch (level) {
    case "green": return theme.success;
    case "yellow": return "#F97316";
    case "red": return theme.danger;
    default: return theme.muted;
  }
}

function trendArrow(dir: "up" | "flat" | "down" | "stable"): string {
  if (dir === "up") return "\u2191";
  if (dir === "down") return "\u2193";
  return "\u2192";
}

export default function TrainingStatusCard({
  result,
  loading,
  onViewAnalysis,
  onStartDeload,
}: TrainingStatusCardProps) {
  const theme = useTheme();
  const { t } = useI18n();

  if (loading) {
    return (
      <GlassCard style={{ gap: 10 }}>
        <SkeletonLoader width="60%" height={14} borderRadius={7} />
        <SkeletonLoader width="100%" height={18} borderRadius={9} />
        <SkeletonLoader width="80%" height={12} borderRadius={6} />
        <SkeletonLoader width="80%" height={12} borderRadius={6} />
        <SkeletonLoader width="80%" height={12} borderRadius={6} />
      </GlassCard>
    );
  }

  if (!result) return null;

  const dotColor = statusColor(result.level, theme);
  const isInsufficient = result.level === "insufficient_data";
  const isDeloadActive = result.level === "deload_active";
  const showDeloadButton =
    !isInsufficient &&
    !isDeloadActive &&
    (result.level === "red" || result.level === "yellow") &&
    !!onStartDeload;

  const statusLabel = (() => {
    switch (result.level) {
      case "green": return t("home.status.green");
      case "yellow": return t("home.status.yellow");
      case "red": return t("home.status.red");
      case "deload_active": return t("home.status.deloadActive");
      case "insufficient_data": return t("home.status.insufficientData");
    }
  })();

  return (
    <GlassCard
      style={{
        borderColor: dotColor,
        gap: 12,
      }}
    >
      {/* Status header row */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: dotColor,
          }}
        />
        <Text
          style={{
            color: dotColor,
            fontFamily: theme.fontFamily.semibold,
            fontSize: 14,
            flex: 1,
          }}
        >
          {statusLabel}
        </Text>
      </View>

      {/* Insufficient data coaching state */}
      {isInsufficient && (
        <Text
          style={{
            color: theme.muted,
            fontFamily: theme.mono,
            fontSize: 12,
            lineHeight: 18,
          }}
        >
          {t("home.status.collectingHint", {
            n: String(Math.max(0, 4 - (result.sessionsInWindow ?? 0))),
          })}
        </Text>
      )}

      {/* Factor rows — only when data available */}
      {!isInsufficient && !isDeloadActive && (
        <View style={{ gap: 6 }}>
          {/* e1RM trend */}
          {result.factors.e1rmTrend && (
            <FactorRow
              label={t("home.status.e1rmTrend")}
              direction={result.factors.e1rmTrend.direction}
              value={`${result.factors.e1rmTrend.pctChange > 0 ? "+" : ""}${result.factors.e1rmTrend.pctChange}%`}
              dirLabel={
                result.factors.e1rmTrend.direction === "up"
                  ? t("home.status.trendUp")
                  : result.factors.e1rmTrend.direction === "down"
                  ? t("home.status.trendDown")
                  : t("home.status.trendFlat")
              }
              theme={theme}
            />
          )}

          {/* RPE drift */}
          {result.factors.rpeDrift && (
            <FactorRow
              label={t("home.status.rpeDrift")}
              direction={
                result.factors.rpeDrift.direction === "up"
                  ? "down"   // rising RPE is bad — show red/down arrow
                  : result.factors.rpeDrift.direction === "down"
                  ? "up"     // falling RPE is good
                  : "flat"
              }
              value={`${result.factors.rpeDrift.delta > 0 ? "+" : ""}${result.factors.rpeDrift.delta}`}
              dirLabel={
                result.factors.rpeDrift.direction === "up"
                  ? t("home.status.trendDown")
                  : result.factors.rpeDrift.direction === "down"
                  ? t("home.status.trendUp")
                  : t("home.status.trendFlat")
              }
              theme={theme}
            />
          )}

          {/* Volume trend */}
          {result.factors.volumeTrend && (
            <FactorRow
              label={t("home.status.volumeTrend")}
              direction={result.factors.volumeTrend.direction}
              value={`${result.factors.volumeTrend.pctChange > 0 ? "+" : ""}${result.factors.volumeTrend.pctChange}%`}
              dirLabel={
                result.factors.volumeTrend.direction === "up"
                  ? t("home.status.trendUp")
                  : result.factors.volumeTrend.direction === "down"
                  ? t("home.status.trendDown")
                  : t("home.status.trendFlat")
              }
              theme={theme}
            />
          )}
        </View>
      )}

      {/* Links */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <Pressable onPress={onViewAnalysis} hitSlop={8}>
          <Text
            style={{
              color: theme.accent,
              fontFamily: theme.mono,
              fontSize: 12,
              textDecorationLine: "underline",
            }}
          >
            {t("home.status.viewAnalysis")}
          </Text>
        </Pressable>

        {showDeloadButton && (
          <Pressable
            onPress={onStartDeload}
            hitSlop={8}
            style={{
              borderColor: theme.danger,
              borderWidth: 1,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Text
              style={{
                color: theme.danger,
                fontFamily: theme.mono,
                fontSize: 12,
              }}
            >
              {t("home.status.startDeload")}
            </Text>
          </Pressable>
        )}
      </View>
    </GlassCard>
  );
}

function FactorRow({
  label,
  direction,
  value,
  dirLabel,
  theme,
}: {
  label: string;
  direction: "up" | "flat" | "down";
  value: string;
  dirLabel: string;
  theme: ReturnType<typeof useTheme>;
}) {
  const arrowColor =
    direction === "up"
      ? theme.success
      : direction === "down"
      ? theme.danger
      : theme.muted;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11, flex: 1 }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={{ color: arrowColor, fontFamily: theme.mono, fontSize: 11 }}>
          {trendArrow(direction)}
        </Text>
        <Text style={{ color: arrowColor, fontFamily: theme.mono, fontSize: 11 }}>
          {dirLabel}
        </Text>
        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>
          ({value})
        </Text>
      </View>
    </View>
  );
}
