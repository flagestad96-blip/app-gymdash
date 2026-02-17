// src/components/workout/RestTimer.tsx
import React, { useState } from "react";
import { View, Text, Pressable, Switch, Modal, Alert, TextInput } from "react-native";
import { useTheme } from "../../theme";
import { useI18n } from "../../i18n";
import { Btn } from "../../ui";
import { mmss } from "../../format";

export type RestTimerInlineProps = {
  restEnabled: boolean;
  restRunning: boolean;
  restLabel: string;
  onToggle: () => void;
};

/** Inline rest timer button shown inside exercise cards */
export function RestTimerInline({ restEnabled, restRunning, restLabel, onToggle }: RestTimerInlineProps) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <Pressable
      onPress={onToggle}
      style={{
        borderColor: restEnabled ? theme.glassBorder : theme.danger,
        borderWidth: 1,
        borderRadius: theme.radius.lg,
        paddingVertical: 8,
        paddingHorizontal: 14,
        backgroundColor: theme.glass,
      }}
    >
      <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 12 }}>
        {t("log.restPrefix", { time: restLabel })}
      </Text>
    </Pressable>
  );
}

export type RestSettingsModalProps = {
  visible: boolean;
  onClose: () => void;
  restEnabled: boolean;
  onRestEnabledChange: (value: boolean) => void;
  restHaptics: boolean;
  onRestHapticsChange: (value: boolean) => void;
  restVibrate: boolean;
  onRestVibrateChange: (value: boolean) => void;
  restSeconds: number;
  onRestSecondsChange: (seconds: number) => void;
  recommendedSeconds: number | null;
  onUseRecommended: () => void;
  onReset: () => void;
  // Custom presets
  presets: number[];
  onAddPreset: (seconds: number) => void;
  onRemovePreset: (seconds: number) => void;
  // Per-exercise override
  focusedExerciseName: string | null;
  focusedExerciseRest: number | null;
  focusedExerciseType: string | null;
  onSetExerciseRest: (seconds: number | null) => void;
};

const DEFAULT_PRESETS = [60, 90, 120, 150, 180];

/** Modal for configuring rest timer settings */
export default function RestSettingsModal({
  visible,
  onClose,
  restEnabled,
  onRestEnabledChange,
  restHaptics,
  onRestHapticsChange,
  restVibrate,
  onRestVibrateChange,
  restSeconds,
  onRestSecondsChange,
  recommendedSeconds,
  onUseRecommended,
  onReset,
  presets,
  onAddPreset,
  onRemovePreset,
  focusedExerciseName,
  focusedExerciseRest,
  focusedExerciseType,
  onSetExerciseRest,
}: RestSettingsModalProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [addingPreset, setAddingPreset] = useState(false);
  const [newPresetText, setNewPresetText] = useState("");
  const [exerciseRestText, setExerciseRestText] = useState("");

  const sortedPresets = [...presets].sort((a, b) => a - b);

  function handleAddPreset() {
    const sec = parseInt(newPresetText, 10);
    if (Number.isFinite(sec) && sec >= 10 && sec <= 600 && !presets.includes(sec)) {
      onAddPreset(sec);
    }
    setNewPresetText("");
    setAddingPreset(false);
  }

  function handleSetExerciseRest() {
    const sec = parseInt(exerciseRestText, 10);
    if (Number.isFinite(sec) && sec >= 10 && sec <= 600) {
      onSetExerciseRest(sec);
    }
    setExerciseRestText("");
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: theme.modalOverlay, justifyContent: "center", padding: 16 }} onPress={onClose}>
        <View
          onStartShouldSetResponder={() => true}
          style={{
            backgroundColor: theme.modalGlass,
            borderColor: theme.glassBorder,
            borderWidth: 1,
            borderRadius: theme.radius.xl,
            padding: 18,
            gap: 14,
            maxHeight: "85%",
            shadowColor: theme.shadow.lg.color,
            shadowOpacity: theme.shadow.lg.opacity,
            shadowRadius: theme.shadow.lg.radius,
            shadowOffset: theme.shadow.lg.offset,
            elevation: theme.shadow.lg.elevation,
          }}
        >
          <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 18 }}>{t("log.restTimerTitle")}</Text>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: theme.text }}>{t("log.restActive")}</Text>
            <Switch value={restEnabled} onValueChange={onRestEnabledChange} />
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: theme.text }}>{t("log.restHaptics")}</Text>
            <Switch value={restHaptics} onValueChange={onRestHapticsChange} />
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: theme.text }}>{t("log.restVibrate")}</Text>
            <Switch value={restVibrate} onValueChange={onRestVibrateChange} />
          </View>

          {/* Preset chips */}
          <Text style={{ color: theme.muted, marginTop: 6 }}>{t("log.restLength")}</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {sortedPresets.map((sec) => (
              <Pressable
                key={`rest_${sec}`}
                onPress={() => onRestSecondsChange(sec)}
                onLongPress={() => {
                  if (!DEFAULT_PRESETS.includes(sec)) {
                    Alert.alert(t("log.restRemovePreset"), `${sec}s`, [
                      { text: t("common.cancel"), style: "cancel" },
                      { text: t("program.remove"), style: "destructive", onPress: () => onRemovePreset(sec) },
                    ]);
                  }
                }}
              >
                <View
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: theme.radius.md,
                    borderWidth: 1,
                    borderColor: restSeconds === sec ? theme.accent : theme.glassBorder,
                    backgroundColor: restSeconds === sec ? theme.accent + "22" : theme.glass,
                  }}
                >
                  <Text style={{
                    color: restSeconds === sec ? theme.accent : theme.text,
                    fontFamily: theme.mono,
                    fontSize: 13,
                  }}>
                    {sec}s
                  </Text>
                </View>
              </Pressable>
            ))}
            {/* Add custom preset */}
            {addingPreset ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <TextInput
                  value={newPresetText}
                  onChangeText={setNewPresetText}
                  keyboardType="number-pad"
                  placeholder={t("log.restCustomSeconds")}
                  placeholderTextColor={theme.muted}
                  autoFocus
                  style={{
                    color: theme.text,
                    fontFamily: theme.mono,
                    fontSize: 13,
                    borderWidth: 1,
                    borderColor: theme.glassBorder,
                    borderRadius: theme.radius.md,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    width: 60,
                    backgroundColor: theme.glass,
                  }}
                  onSubmitEditing={handleAddPreset}
                />
                <Pressable onPress={handleAddPreset}>
                  <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: 13 }}>{t("log.restAddPreset")}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => setAddingPreset(true)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: theme.radius.md,
                  borderWidth: 1,
                  borderColor: theme.glassBorder,
                  borderStyle: "dashed",
                  backgroundColor: theme.glass,
                }}
              >
                <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 13 }}>+</Text>
              </Pressable>
            )}
          </View>

          {/* Recommended for current exercise */}
          {recommendedSeconds != null ? (
            <Pressable
              onPress={onUseRecommended}
              style={{
                borderColor: theme.glassBorder,
                borderWidth: 1,
                borderRadius: theme.radius.md,
                paddingVertical: 8,
                paddingHorizontal: 14,
                backgroundColor: theme.glass,
                alignSelf: "flex-start",
              }}
            >
              <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: 12 }}>
                {t("log.useRecommended", { seconds: recommendedSeconds })}
              </Text>
            </Pressable>
          ) : null}

          {/* Per-exercise override */}
          {focusedExerciseName ? (
            <View style={{ borderTopWidth: 1, borderTopColor: theme.glassBorder, paddingTop: 12, gap: 8 }}>
              <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 14 }}>
                {t("log.restForExercise", { name: focusedExerciseName })}
              </Text>
              {focusedExerciseType ? (
                <Text style={{ color: theme.muted, fontSize: 12 }}>
                  {t("log.restExerciseType", {
                    type: focusedExerciseType,
                    seconds: recommendedSeconds ?? 120,
                  })}
                </Text>
              ) : null}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TextInput
                  value={exerciseRestText || (focusedExerciseRest != null ? String(focusedExerciseRest) : "")}
                  onChangeText={setExerciseRestText}
                  keyboardType="number-pad"
                  placeholder={String(recommendedSeconds ?? 120)}
                  placeholderTextColor={theme.muted}
                  style={{
                    color: theme.text,
                    fontFamily: theme.mono,
                    fontSize: 14,
                    borderWidth: 1,
                    borderColor: focusedExerciseRest != null ? theme.accent : theme.glassBorder,
                    borderRadius: theme.radius.md,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    width: 70,
                    backgroundColor: theme.glass,
                    textAlign: "center",
                  }}
                  onSubmitEditing={handleSetExerciseRest}
                />
                <Text style={{ color: theme.muted, fontSize: 12 }}>s</Text>
                <Btn label={t("common.save")} onPress={handleSetExerciseRest} small />
                {focusedExerciseRest != null ? (
                  <Btn label={t("log.restUseDefault")} onPress={() => { onSetExerciseRest(null); setExerciseRestText(""); }} small />
                ) : null}
              </View>
            </View>
          ) : null}

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Btn label={t("common.close")} onPress={onClose} />
            <Btn label={t("log.reset")} onPress={onReset} />
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}
