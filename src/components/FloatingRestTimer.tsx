// src/components/FloatingRestTimer.tsx — Floating rest timer overlay visible across the app
import React, { useEffect, useRef } from "react";
import { View, Text, Pressable, Animated, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../theme";
import { useI18n } from "../i18n";
import { useRestTimer, mmss } from "../restTimerContext";
import { displayNameFor, tagsFor } from "../exerciseLibrary";
import RestSettingsModal from "./workout/RestTimer";

export default function FloatingRestTimer() {
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const {
    restEnabled,
    restSeconds,
    restRunning,
    displaySeconds,
    restVibrate,
    restHaptics,
    restPresets,
    exerciseRestOverrides,
    focusedExerciseId,
    activeWorkoutId,
    setRestEnabled,
    setRestSeconds,
    setRestVibrate,
    setRestHaptics,
    addPreset,
    removePreset,
    setExerciseRest,
    getRestForExercise,
    startRestTimer,
    stopRestTimer,
    restSettingsOpen,
    setRestSettingsOpen,
  } = useRestTimer();

  // Pulsing animation when timer is running
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (restRunning) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [restRunning, pulseAnim]);

  // Don't show if no active workout
  if (!activeWorkoutId) return null;

  // Compute display values for settings modal
  const focusedExerciseName = focusedExerciseId ? displayNameFor(focusedExerciseId) : null;
  const focusedExerciseRest = focusedExerciseId ? (exerciseRestOverrides[focusedExerciseId] ?? null) : null;
  const focusedTags = focusedExerciseId ? tagsFor(focusedExerciseId) : [];
  const focusedExerciseType = focusedTags.includes("compound")
    ? t("log.restCompound")
    : focusedTags.includes("isolation")
      ? t("log.restIsolation")
      : null;
  const recommendedSeconds = focusedExerciseId ? getRestForExercise(focusedExerciseId) : null;

  function handleTap() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRestSettingsOpen(true);
  }

  function handleLongPress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (restRunning) {
      stopRestTimer();
    } else if (restEnabled) {
      const duration = focusedExerciseId ? getRestForExercise(focusedExerciseId) : restSeconds;
      startRestTimer(duration);
    }
  }

  const displayLabel = mmss(displaySeconds);

  return (
    <>
      <Animated.View
        style={[
          styles.container,
          {
            bottom: insets.bottom + 70, // Above tab bar
            right: 16,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <Pressable
          onPress={handleTap}
          onLongPress={handleLongPress}
          delayLongPress={400}
          style={({ pressed }) => [
            styles.pill,
            {
              backgroundColor: theme.modalGlass,
              borderColor: restRunning ? theme.accent : theme.glassBorder,
              borderWidth: restRunning ? 2 : 1,
              opacity: pressed ? 0.9 : 1,
              shadowColor: theme.shadow.md.color,
              shadowOpacity: theme.shadow.md.opacity,
              shadowRadius: theme.shadow.md.radius,
              shadowOffset: theme.shadow.md.offset,
              elevation: theme.shadow.md.elevation,
            },
          ]}
        >
          <MaterialIcons
            name={restRunning ? "timer" : "timer-off"}
            size={18}
            color={restRunning ? theme.accent : theme.muted}
          />
          <Text
            style={[
              styles.label,
              {
                color: restRunning ? theme.accent : theme.text,
                fontFamily: theme.mono,
              },
            ]}
          >
            {displayLabel}
          </Text>
        </Pressable>
      </Animated.View>

      <RestSettingsModal
        visible={restSettingsOpen}
        onClose={() => setRestSettingsOpen(false)}
        restEnabled={restEnabled}
        onRestEnabledChange={setRestEnabled}
        restHaptics={restHaptics}
        onRestHapticsChange={setRestHaptics}
        restVibrate={restVibrate}
        onRestVibrateChange={setRestVibrate}
        restSeconds={restSeconds}
        onRestSecondsChange={setRestSeconds}
        recommendedSeconds={recommendedSeconds}
        onUseRecommended={() => {
          if (recommendedSeconds != null) setRestSeconds(recommendedSeconds);
        }}
        onReset={() => {
          stopRestTimer();
          setRestSeconds(120);
        }}
        presets={restPresets}
        onAddPreset={addPreset}
        onRemovePreset={removePreset}
        focusedExerciseName={focusedExerciseName}
        focusedExerciseRest={focusedExerciseRest}
        focusedExerciseType={focusedExerciseType}
        onSetExerciseRest={(seconds) => {
          if (focusedExerciseId) {
            setExerciseRest(focusedExerciseId, seconds);
          }
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    zIndex: 1000,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
});
