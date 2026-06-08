// src/components/workout/RestBar.tsx
// Docked rest bar — the middle ground between a tiny corner bubble and a full-screen
// takeover.
//
// While a rest runs it shows a slim bar docked at the bottom: countdown + inline
// −15s / Skip / +30s, always visible so adjusting is zero taps away. The rest of the
// screen stays free and scrollable above it (study upcoming exercises, history, …) —
// the timer never "becomes the whole world". Tap the bar to expand it into a compact
// control card with the next-up exercise and a quick set note; tap the chevron or
// outside to collapse back to the bar.
//
// Root-rendered and visible across the whole app while a rest is running; it reads
// everything it needs from the rest-timer context.

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../theme";
import { useI18n } from "../../i18n";
import { useRestTimer, mmss } from "../../restTimerContext";

function Ring({
  size,
  stroke,
  progress,
  color,
  track,
}: {
  size: number;
  stroke: number;
  progress: number;
  color: string;
  track: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - progress);
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      {progress > 0 ? (
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      ) : null}
    </Svg>
  );
}

/** Compact pill button for the inline ± controls on the bar / expanded card. */
function StepButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: theme.radius.pill,
        borderWidth: 1,
        borderColor: theme.glassBorder,
        backgroundColor: theme.glass,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: theme.fontSize.sm }}>{label}</Text>
    </Pressable>
  );
}

export default function RestBar() {
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const rt = useRestTimer();
  const [expanded, setExpanded] = useState(false);

  const running = rt.restRunning && rt.restRemaining > 0;
  const total = rt.restDurationSec > 0 ? rt.restDurationSec : rt.restRemaining;
  const progress = running ? Math.max(0, Math.min(1, rt.restRemaining / total)) : 0;

  const isTransition = running && rt.restPhase === "transition";
  const tint = isTransition ? theme.warn : theme.accent;

  // Collapse back to the bar whenever the rest ends, so the card never lingers.
  useEffect(() => {
    if (!running) setExpanded(false);
  }, [running]);

  // The bar exists only while a rest is actually counting down.
  if (!running) return null;

  const adjust = (delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    const next = Math.max(1, rt.restRemaining + delta);
    rt.startRestTimer(next, { phase: rt.restPhase, phaseLabel: rt.restPhaseLabel });
  };

  const skip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    rt.stopRestTimer();
  };

  const SkipButton = (
    <Pressable
      onPress={skip}
      accessibilityRole="button"
      accessibilityLabel={t("log.skipRest")}
      style={({ pressed }) => ({
        paddingHorizontal: 16,
        paddingVertical: 11,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.accent,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: "#fff", fontFamily: theme.fontFamily.semibold, fontSize: theme.fontSize.sm }}>
        {t("log.skipRest")}
      </Text>
    </Pressable>
  );

  // ---- Collapsed: docked rest bar ----
  if (!expanded) {
    return (
      <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]} pointerEvents="box-none">
        <View style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
          <View
            style={{
              marginHorizontal: 12,
              marginBottom: insets.bottom + 12,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: theme.modalGlass,
              borderColor: tint,
              borderWidth: 1,
              borderRadius: theme.radius.xl,
              paddingVertical: 10,
              paddingHorizontal: 12,
              gap: theme.space.sm,
              shadowColor: theme.shadow.lg.color,
              shadowOpacity: theme.shadow.lg.opacity,
              shadowRadius: theme.shadow.lg.radius,
              shadowOffset: theme.shadow.lg.offset,
            }}
          >
            {/* Tap zone → expand to the full card */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setExpanded(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={t("log.restExpand")}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: theme.space.sm }}
            >
              <View style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}>
                <Ring size={34} stroke={3} progress={progress} color={tint} track={theme.glassBorder} />
              </View>
              <View style={{ flexShrink: 1 }}>
                {rt.restPhaseLabel ? (
                  <Text
                    numberOfLines={1}
                    style={{
                      color: tint,
                      fontFamily: theme.mono,
                      fontSize: 9,
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                    }}
                  >
                    {rt.restPhaseLabel}
                  </Text>
                ) : null}
                <Text
                  numberOfLines={1}
                  style={{ color: theme.text, fontFamily: theme.mono, fontSize: 20, fontVariant: ["tabular-nums"] }}
                >
                  {mmss(rt.restRemaining)}
                </Text>
              </View>
            </Pressable>

            {/* Inline controls — always visible, zero taps to adjust. Skip is a
                compact icon here (the expanded card has the full labelled button). */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: theme.space.xs }}>
              <StepButton label="−15s" onPress={() => adjust(-15)} />
              <Pressable
                onPress={skip}
                accessibilityRole="button"
                accessibilityLabel={t("log.skipRest")}
                style={({ pressed }) => ({
                  width: 44,
                  height: 40,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: theme.radius.pill,
                  backgroundColor: theme.accent,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <MaterialIcons name="skip-next" size={22} color="#fff" />
              </Pressable>
              <StepButton label="+30s" onPress={() => adjust(30)} />
            </View>
          </View>
        </View>
      </View>
    );
  }

  // ---- Expanded: compact control card (no full-screen scrim) ----
  const ringSize = Math.min(Dimensions.get("window").width - 160, 150);
  const showNote = rt.lastSet && rt.restPhase !== "transition";

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]} pointerEvents="box-none">
      {/* Transparent touch-catcher: tap outside the card to collapse. No dark scrim —
          the screen behind stays fully visible, so the timer never "takes over". */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => setExpanded(false)}
        accessibilityRole="button"
        accessibilityLabel={t("log.restMinimize")}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, justifyContent: "flex-end" }}
        pointerEvents="box-none"
      >
        <View
          style={{
            marginHorizontal: 12,
            marginBottom: insets.bottom + 12,
            backgroundColor: theme.modalGlass,
            borderColor: tint,
            borderWidth: 1,
            borderRadius: theme.radius.xl,
            padding: 18,
            gap: theme.space.md,
            shadowColor: theme.shadow.lg.color,
            shadowOpacity: theme.shadow.lg.opacity,
            shadowRadius: theme.shadow.lg.radius,
            shadowOffset: theme.shadow.lg.offset,
          }}
        >
          {/* Header: phase label + collapse */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text
              style={{
                color: tint,
                fontFamily: theme.mono,
                fontSize: theme.fontSize.xs,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              {rt.restPhaseLabel ?? t("log.rest")}
            </Text>
            <Pressable
              onPress={() => setExpanded(false)}
              accessibilityRole="button"
              accessibilityLabel={t("log.restMinimize")}
              hitSlop={10}
            >
              <MaterialIcons name="expand-more" size={24} color={theme.muted} />
            </Pressable>
          </View>

          {/* Next up — what's coming after this rest */}
          {rt.nextUpLabel ? (
            <View>
              <Text
                style={{
                  color: theme.muted,
                  fontFamily: theme.mono,
                  fontSize: theme.fontSize.xs,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                {t("log.nextUp")}
              </Text>
              <Text
                style={{
                  color: theme.accent,
                  fontFamily: theme.fontFamily.semibold,
                  fontSize: theme.fontSize.md,
                  marginTop: 2,
                }}
                numberOfLines={2}
              >
                {rt.nextUpLabel}
              </Text>
            </View>
          ) : null}

          {/* Countdown ring + controls */}
          <View style={{ alignItems: "center", gap: theme.space.lg }}>
            <View style={{ width: ringSize, height: ringSize, alignItems: "center", justifyContent: "center" }}>
              <Ring size={ringSize} stroke={10} progress={progress} color={tint} track={theme.glassBorder} />
              <View style={{ position: "absolute", alignItems: "center" }}>
                <Text
                  style={{ color: theme.text, fontFamily: theme.mono, fontSize: 40, fontVariant: ["tabular-nums"] }}
                >
                  {mmss(rt.restRemaining)}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: theme.space.md }}>
              <StepButton label="−15s" onPress={() => adjust(-15)} />
              {SkipButton}
              <StepButton label="+30s" onPress={() => adjust(30)} />
            </View>
          </View>

          {/* Quick note for the set you just finished — captured before time runs out. */}
          {showNote ? (
            <View>
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
                value={rt.lastSet?.note}
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
                  maxHeight: 90,
                  textAlignVertical: "top",
                }}
              />
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
