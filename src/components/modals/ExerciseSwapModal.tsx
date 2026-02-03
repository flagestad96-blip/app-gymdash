// src/components/modals/ExerciseSwapModal.tsx
import React from "react";
import { View, Text, Pressable, Modal, ScrollView } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../theme";
import { useI18n } from "../../i18n";
import { useWeightUnit } from "../../units";
import { Btn } from "../../ui";
import { displayNameFor, getExercise, tagsFor, backImpactFor } from "../../exerciseLibrary";
import BackImpactDot from "../BackImpactDot";

function formatWeight(n: number) {
  if (!Number.isFinite(n)) return "";
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export type LastSetInfo = {
  weight: number;
  reps: number;
  rpe?: number | null;
  created_at: string;
  workout_id?: string | null;
};

export type ExerciseSwapModalProps = {
  visible: boolean;
  onClose: () => void;
  baseExId: string | null;
  /** All alternative exercise IDs (including the base) */
  alternativeIds: string[];
  /** Currently resolved/selected exercise ID */
  resolvedExId: string | null;
  /** Called when user picks an alternative */
  onChoose: (baseExId: string, exId: string) => void;
  /** Last sets lookup for showing history */
  lastSets: Record<string, LastSetInfo>;
};

export default function ExerciseSwapModal({
  visible,
  onClose,
  baseExId,
  alternativeIds,
  resolvedExId,
  onChoose,
  lastSets,
}: ExerciseSwapModalProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const wu = useWeightUnit();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.modalOverlay, justifyContent: "center", padding: 16 }}>
        <View
          style={{
            backgroundColor: theme.modalGlass,
            borderColor: theme.glassBorder,
            borderWidth: 1,
            borderRadius: theme.radius.xl,
            padding: 18,
            gap: 14,
            shadowColor: theme.shadow.lg.color,
            shadowOpacity: theme.shadow.lg.opacity,
            shadowRadius: theme.shadow.lg.radius,
            shadowOffset: theme.shadow.lg.offset,
            elevation: theme.shadow.lg.elevation,
            maxHeight: "70%",
          }}
        >
          <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 18 }}>{t("log.chooseAlternative")}</Text>
          {baseExId ? (
            <Text style={{ color: theme.muted, fontFamily: theme.mono }}>
              {displayNameFor(baseExId)}
            </Text>
          ) : null}
          <ScrollView contentContainerStyle={{ gap: 8 }}>
            {alternativeIds.map((exId) => {
              const selected = resolvedExId === exId;
              const exercise = getExercise(exId);
              const lastSet = lastSets[exId];

              return (
                <Pressable
                  key={`alt_choose_${exId}`}
                  onPress={() => {
                    if (baseExId) {
                      onChoose(baseExId, exId);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }}
                  style={{
                    padding: 14,
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: selected ? theme.accent : theme.glassBorder,
                    backgroundColor: selected ? (theme.isDark ? "rgba(182, 104, 245, 0.18)" : "rgba(124, 58, 237, 0.12)") : theme.glass,
                    gap: 6,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                      <Text style={{ color: theme.text, fontSize: 16 }}>{displayNameFor(exId)}</Text>
                      <BackImpactDot exerciseId={exId} />
                    </View>
                    {selected && (
                      <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: 11 }}>
                        {t("log.selected")}
                      </Text>
                    )}
                  </View>

                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                    {exercise?.equipment && (
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 8,
                          backgroundColor: theme.glass,
                          borderWidth: 1,
                          borderColor: theme.glassBorder,
                        }}
                      >
                        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>
                          {exercise.equipment}
                        </Text>
                      </View>
                    )}
                    <BackImpactDot exerciseId={exId} showLabel size={7} />
                  </View>

                  {lastSet && (
                    <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                      {t("log.lastSet", { weight: formatWeight(wu.toDisplay(lastSet.weight)), reps: lastSet.reps, date: lastSet.created_at.slice(0, 10) })}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Btn label={t("common.close")} onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
