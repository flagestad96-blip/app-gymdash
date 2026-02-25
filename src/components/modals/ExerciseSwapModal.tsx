// src/components/modals/ExerciseSwapModal.tsx
import React, { useState } from "react";
import { View, Text, Pressable, Modal, ScrollView } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../theme";
import { useI18n } from "../../i18n";
import { useWeightUnit } from "../../units";
import { TextField, Btn } from "../../ui";
import { displayNameFor, getExercise, tagsFor } from "../../exerciseLibrary";
import type { Equipment, ExerciseTag } from "../../exerciseLibrary";
import BackImpactDot from "../BackImpactDot";
import { formatWeight } from "../../format";

const EQUIPMENT_OPTIONS: Equipment[] = [
  "barbell", "dumbbell", "machine", "cable", "bodyweight", "smith", "trapbar", "other",
];

const TAG_OPTIONS: ExerciseTag[] = [
  "chest", "back", "shoulders", "biceps", "triceps", "forearms",
  "quads", "hamstrings", "glutes", "calves", "core",
  "compound", "isolation",
];

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
  /** Called when user wants to make the current selection the new default */
  onSetDefault?: (baseExId: string, newDefaultExId: string) => void;
  /** Called when user creates a new custom exercise from the picker */
  onCreateCustom?: (baseExId: string, name: string, equipment: Equipment, tags: ExerciseTag[], isPerSide: boolean) => void;
  /** Last sets lookup for showing history */
  lastSets: Record<string, LastSetInfo>;
  /** Exercise notes lookup */
  exerciseNotes?: Record<string, string>;
};

export default function ExerciseSwapModal({
  visible,
  onClose,
  baseExId,
  alternativeIds,
  resolvedExId,
  onChoose,
  onSetDefault,
  onCreateCustom,
  lastSets,
  exerciseNotes = {},
}: ExerciseSwapModalProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const wu = useWeightUnit();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEquipment, setNewEquipment] = useState<Equipment>("machine");
  const [newTags, setNewTags] = useState<ExerciseTag[]>([]);
  const [newIsPerSide, setNewIsPerSide] = useState(false);

  function startCreating() {
    // Pre-populate tags from base exercise (only user-facing tags)
    const baseTags = baseExId ? tagsFor(baseExId).filter((t) => TAG_OPTIONS.includes(t)) : [];
    setNewTags(baseTags);
    setCreating(true);
  }

  function resetForm() {
    setCreating(false);
    setNewName("");
    setNewEquipment("machine");
    setNewTags([]);
    setNewIsPerSide(false);
  }

  function handleSaveCustom() {
    const name = newName.trim();
    if (!name || !baseExId || !onCreateCustom) return;
    onCreateCustom(baseExId, name, newEquipment, newTags, newIsPerSide);
    resetForm();
  }

  // Reset form when modal closes
  function handleClose() {
    resetForm();
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={{ flex: 1, backgroundColor: theme.modalOverlay, justifyContent: "center", padding: 16 }} onPress={handleClose}>
        <View
          onStartShouldSetResponder={() => true}
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
            maxHeight: "80%",
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
                  {exerciseNotes[exId] ? (
                    <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11, fontStyle: "italic" }}>
                      {exerciseNotes[exId]}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}

            {/* Create new custom exercise */}
            {onCreateCustom && baseExId ? (
              creating ? (
                <View
                  style={{
                    padding: 14,
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: theme.accent,
                    borderStyle: "dashed",
                    backgroundColor: theme.glass,
                    gap: 10,
                  }}
                >
                  <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 13 }}>
                    {t("log.exerciseName")}
                  </Text>
                  <TextField
                    value={newName}
                    onChangeText={setNewName}
                    placeholder={t("log.exerciseName")}
                    placeholderTextColor={theme.muted}
                    autoFocus
                    style={{
                      color: theme.text,
                      backgroundColor: theme.panel2,
                      borderColor: theme.line,
                      borderWidth: 1,
                      borderRadius: 12,
                      padding: 10,
                      fontSize: 14,
                      fontFamily: theme.mono,
                    }}
                  />
                  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                    {t("log.selectEquipment")}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {EQUIPMENT_OPTIONS.map((eq) => (
                      <Pressable
                        key={`eq_${eq}`}
                        onPress={() => setNewEquipment(eq)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: theme.radius.md,
                          borderWidth: 1,
                          borderColor: newEquipment === eq ? theme.accent : theme.glassBorder,
                          backgroundColor: newEquipment === eq
                            ? (theme.isDark ? "rgba(182, 104, 245, 0.18)" : "rgba(124, 58, 237, 0.12)")
                            : theme.glass,
                        }}
                      >
                        <Text style={{ color: newEquipment === eq ? theme.accent : theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                          {eq}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                    {t("log.selectTags")}
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {TAG_OPTIONS.map((tag) => {
                      const active = newTags.includes(tag);
                      return (
                        <Pressable
                          key={`tag_${tag}`}
                          onPress={() => {
                            setNewTags((prev) =>
                              prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length < 4 ? [...prev, tag] : prev
                            );
                          }}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: theme.radius.md,
                            borderWidth: 1,
                            borderColor: active ? theme.accent : theme.glassBorder,
                            backgroundColor: active
                              ? (theme.isDark ? "rgba(182, 104, 245, 0.18)" : "rgba(124, 58, 237, 0.12)")
                              : theme.glass,
                          }}
                        >
                          <Text style={{ color: active ? theme.accent : theme.muted, fontFamily: theme.mono, fontSize: 10 }}>
                            {tag}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {/* Per-side toggle */}
                  <Pressable
                    onPress={() => setNewIsPerSide((p) => !p)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 8,
                      paddingHorizontal: 4,
                    }}
                  >
                    <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                      {t("common.perSide")}
                    </Text>
                    <View
                      style={{
                        width: 36,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: newIsPerSide ? theme.accent : theme.glassBorder,
                        justifyContent: "center",
                        paddingHorizontal: 2,
                      }}
                    >
                      <View
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 8,
                          backgroundColor: "#FFFFFF",
                          alignSelf: newIsPerSide ? "flex-end" : "flex-start",
                        }}
                      />
                    </View>
                  </Pressable>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Btn label={t("common.save")} tone="accent" onPress={handleSaveCustom} />
                    <Btn label={t("common.cancel")} onPress={resetForm} />
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={startCreating}
                  style={{
                    padding: 14,
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: theme.accent,
                    borderStyle: "dashed",
                    backgroundColor: theme.glass,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: 14 }}>
                    {t("log.createNew")}
                  </Text>
                </Pressable>
              )
            ) : null}
          </ScrollView>
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            <Btn label={t("common.close")} onPress={handleClose} />
            {onSetDefault && resolvedExId && baseExId && resolvedExId !== baseExId && (
              <Btn
                label={t("log.setAsDefault")}
                tone="accent"
                onPress={() => {
                  onSetDefault(baseExId, resolvedExId);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}
              />
            )}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}
