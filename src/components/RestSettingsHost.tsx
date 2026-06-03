// src/components/RestSettingsHost.tsx
// Hosts the rest-timer settings modal at the app root. The modal is opened from
// the Log screen's top-bar gear icon (restTimer.setRestSettingsOpen(true)); the
// running timer itself is shown by RestOverlay, so there is no on-screen chrome
// here — this component renders nothing until the settings modal is open.
import React from "react";
import { useI18n } from "../i18n";
import { useRestTimer } from "../restTimerContext";
import { displayNameFor, tagsFor } from "../exerciseLibrary";
import RestSettingsModal from "./workout/RestTimer";

export default function RestSettingsHost() {
  const { t } = useI18n();
  const {
    restEnabled,
    restSeconds,
    restVibrate,
    restHaptics,
    restPresets,
    exerciseRestOverrides,
    focusedExerciseId,
    setRestEnabled,
    setRestSeconds,
    setRestVibrate,
    setRestHaptics,
    addPreset,
    removePreset,
    setExerciseRest,
    getRestForExercise,
    stopRestTimer,
    restSettingsOpen,
    setRestSettingsOpen,
  } = useRestTimer();

  // Values for the per-exercise section, derived from the focused exercise.
  const focusedExerciseName = focusedExerciseId ? displayNameFor(focusedExerciseId) : null;
  const focusedExerciseRest = focusedExerciseId ? (exerciseRestOverrides[focusedExerciseId] ?? null) : null;
  const focusedTags = focusedExerciseId ? tagsFor(focusedExerciseId) : [];
  const focusedExerciseType = focusedTags.includes("compound")
    ? t("log.restCompound")
    : focusedTags.includes("isolation")
      ? t("log.restIsolation")
      : null;
  const recommendedSeconds = focusedExerciseId ? getRestForExercise(focusedExerciseId) : null;

  return (
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
  );
}
