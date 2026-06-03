// src/components/workout/RestOverlay.tsx
// Large between-sets rest overlay — covers the Log screen while a rest timer
// runs, showing a big countdown ring + quick controls. Self-contained: reads
// everything from the rest-timer context. Rendered at root (above the floating
// pill) and gated to the Log screen by the parent.

import React from "react";
import { View, Text, Pressable, StyleSheet, Dimensions, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import Svg, { Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../theme";
import { useI18n } from "../../i18n";
import { useRestTimer, mmss } from "../../restTimerContext";

function RoundButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        minWidth: 64,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: theme.radius.pill,
        borderWidth: 1,
        borderColor: theme.glassBorder,
        backgroundColor: theme.glass,
        alignItems: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: theme.fontSize.md }}>{label}</Text>
    </Pressable>
  );
}

export default function RestOverlay() {
  const theme = useTheme();
  const { t } = useI18n();
  const rt = useRestTimer();

  if (!rt.restRunning || rt.restRemaining <= 0) return null;

  const total = rt.restDurationSec > 0 ? rt.restDurationSec : rt.restRemaining;
  const progress = Math.max(0, Math.min(1, rt.restRemaining / total));

  const size = Math.min(Dimensions.get("window").width - 96, 300);
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - progress);

  const adjust = (delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    const next = Math.max(1, rt.restRemaining + delta);
    rt.startRestTimer(next, { phase: rt.restPhase, phaseLabel: rt.restPhaseLabel });
  };

  const skip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    rt.stopRestTimer();
  };

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(4, 5, 12, 0.92)", zIndex: 10000 }]}>
      <KeyboardAvoidingView
        style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Text
          style={{
            color: theme.muted,
            fontFamily: theme.mono,
            fontSize: theme.fontSize.sm,
            letterSpacing: 3,
            textTransform: "uppercase",
            marginBottom: theme.space.lg,
          }}
        >
          {rt.restPhaseLabel ?? t("log.rest")}
        </Text>

        <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
          <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.glassBorder} strokeWidth={stroke} fill="none" />
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={theme.accent}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${circ} ${circ}`}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          </Svg>
          <View style={{ position: "absolute", alignItems: "center" }}>
            <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 60, fontVariant: ["tabular-nums"] }}>
              {mmss(rt.restRemaining)}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: theme.space.md, marginTop: theme.space.xxl, alignItems: "center" }}>
          <RoundButton label="−15s" onPress={() => adjust(-15)} />
          <Pressable
            onPress={skip}
            accessibilityRole="button"
            accessibilityLabel={t("log.skipRest")}
            style={({ pressed }) => ({
              paddingHorizontal: 32,
              paddingVertical: 16,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.accent,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: "#fff", fontFamily: theme.fontFamily.semibold, fontSize: theme.fontSize.lg }}>
              {t("log.skipRest")}
            </Text>
          </Pressable>
          <RoundButton label="+30s" onPress={() => adjust(30)} />
        </View>

        {/* Quick note for the set you just finished — captured before time runs out. */}
        {rt.lastSet && rt.restPhase !== "transition" ? (
          <View style={{ width: "100%", maxWidth: 360, marginTop: theme.space.xxl }}>
            <Text
              style={{
                color: theme.muted,
                fontFamily: theme.mono,
                fontSize: theme.fontSize.xs,
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: theme.space.xs,
              }}
            >
              {t("log.setNote")}
            </Text>
            <TextInput
              value={rt.lastSet.note}
              onChangeText={rt.updateLastSetNote}
              placeholder={t("log.setNotePlaceholder")}
              placeholderTextColor={theme.muted}
              multiline
              style={{
                color: theme.text,
                backgroundColor: theme.glass,
                borderColor: theme.glassBorder,
                borderWidth: 1,
                borderRadius: theme.radius.md,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontFamily: theme.mono,
                fontSize: 14,
                minHeight: 48,
                maxHeight: 100,
                textAlignVertical: "top",
              }}
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}
