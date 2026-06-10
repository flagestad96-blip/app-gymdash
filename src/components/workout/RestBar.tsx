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
// When the countdown reaches zero naturally the bar lingers for a couple of seconds
// in a "rest done" state before fading out, so the moment isn't a silent vanish.
//
// Root-rendered and visible across the whole app while a rest is running; it reads
// everything it needs from the rest-timer context.

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../theme";
import { useI18n } from "../../i18n";
import { useRestTimer, mmss } from "../../restTimerContext";

// Vertical space the docked bar occupies above the safe-area inset. Screens with
// bottom-anchored content add this as paddingBottom while a rest runs so the bar
// never covers their last buttons/rows.
export const REST_BAR_CLEARANCE = 96;

// How long the "rest done" state lingers before fading out.
const DONE_LINGER_MS = 2200;

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
        minWidth: 48,
        minHeight: 44,
        paddingHorizontal: 12,
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
  const { width: windowWidth } = useWindowDimensions();
  const rt = useRestTimer();
  const [expanded, setExpanded] = useState(false);
  const [justDone, setJustDone] = useState(false);

  const running = rt.restRunning && rt.restRemaining > 0;
  const total = rt.restDurationSec > 0 ? rt.restDurationSec : rt.restRemaining;
  const progress = running ? Math.max(0, Math.min(1, rt.restRemaining / total)) : 0;

  const isTransition = running && rt.restPhase === "transition";
  const tint = isTransition ? theme.warn : theme.accent;

  // "Rest done" lingering state. A natural completion leaves restRemaining at 0;
  // skip/stop resets it to the default, so this only triggers when time ran out.
  const remainingRef = useRef(rt.restRemaining);
  remainingRef.current = rt.restRemaining;
  const prevRunningRef = useRef(running);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const was = prevRunningRef.current;
    prevRunningRef.current = running;
    if (was && !running && remainingRef.current === 0) {
      setJustDone(true);
      doneOpacity.setValue(1);
      doneTimerRef.current = setTimeout(() => {
        Animated.timing(doneOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() =>
          setJustDone(false),
        );
      }, DONE_LINGER_MS);
    } else if (running) {
      // A new rest started — clear any lingering done state immediately.
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
      setJustDone(false);
    }
  }, [running, doneOpacity]);

  useEffect(() => () => { if (doneTimerRef.current) clearTimeout(doneTimerRef.current); }, []);

  // Collapse back to the bar whenever the rest ends, so the card never lingers.
  useEffect(() => {
    if (!running) setExpanded(false);
  }, [running]);

  // ---- "Rest done" linger: brief success bar, then fade out ----
  if (!running) {
    if (!justDone) return null;
    return (
      <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]} pointerEvents="box-none">
        <View style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
          <Animated.View style={{ opacity: doneOpacity }}>
            <Pressable
              onPress={() => {
                if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
                setJustDone(false);
              }}
              accessibilityRole="button"
              accessibilityLabel={t("log.restDone")}
              style={{
                marginHorizontal: 12,
                marginBottom: insets.bottom + 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: theme.space.sm,
                backgroundColor: theme.modalGlass,
                borderColor: theme.success,
                borderWidth: 1,
                borderRadius: theme.radius.xl,
                paddingVertical: 16,
                paddingHorizontal: 12,
                shadowColor: theme.shadow.lg.color,
                shadowOpacity: theme.shadow.lg.opacity,
                shadowRadius: theme.shadow.lg.radius,
                shadowOffset: theme.shadow.lg.offset,
              }}
            >
              <MaterialIcons name="check-circle" size={22} color={theme.success} />
              <Text style={{ color: theme.success, fontFamily: theme.fontFamily.semibold, fontSize: theme.fontSize.md }}>
                {t("log.restDone")}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    );
  }

  const adjust = (delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    const next = Math.max(1, rt.restRemaining + delta);
    // Keep the ring's denominator stable: extend the total when adding time, keep it
    // when subtracting, so the progress ring never flashes back to full on a tap.
    const newTotal = Math.max(next, total + Math.max(0, delta));
    rt.startRestTimer(next, { phase: rt.restPhase, phaseLabel: rt.restPhaseLabel, durationSec: newTotal });
  };

  const skip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    rt.stopRestTimer();
  };

  // ---- Collapsed: docked rest bar ----
  if (!expanded) {
    // The chevron is an expand affordance; drop it on very narrow screens where the
    // time display needs the room.
    const showChevron = windowWidth >= 340;
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
              paddingVertical: 8,
              paddingHorizontal: 12,
              gap: theme.space.sm,
              shadowColor: theme.shadow.lg.color,
              shadowOpacity: theme.shadow.lg.opacity,
              shadowRadius: theme.shadow.lg.radius,
              shadowOffset: theme.shadow.lg.offset,
            }}
          >
            {/* Tap zone → expand to the full card (next-up + set note live there) */}
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
              {showChevron ? <MaterialIcons name="expand-less" size={16} color={theme.muted} /> : null}
            </Pressable>

            {/* Inline controls — always visible, zero taps to adjust. Skip is a
                compact icon here (the expanded card has the full labelled button);
                the wider margin around it guards against fat-finger ± taps. */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: theme.space.xs }}>
              <StepButton label="−15s" onPress={() => adjust(-15)} />
              <Pressable
                onPress={skip}
                accessibilityRole="button"
                accessibilityLabel={t("log.skipRest")}
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  marginHorizontal: 2,
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
  const ringSize = Math.min(windowWidth - 160, 150);
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
