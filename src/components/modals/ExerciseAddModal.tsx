// src/components/modals/ExerciseAddModal.tsx — Add ad-hoc exercise to workout
import React, { useState, useMemo, useEffect } from "react";
import { View, Text, Pressable, Modal, FlatList, Keyboard, KeyboardAvoidingView, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../theme";
import { useI18n } from "../../i18n";
import { TextField } from "../../ui";
import { searchExercises, displayNameFor, getExercise } from "../../exerciseLibrary";
import type { Equipment } from "../../exerciseLibrary";
import BackImpactDot from "../BackImpactDot";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (exerciseId: string) => void;
  existingExerciseIds: string[];
  /** Equipment available at the active gym — sorts matching exercises first
   *  and marks the rest, without hiding anything. */
  gymEquipment?: Set<Equipment> | null;
};

export default function ExerciseAddModal({ visible, onClose, onSelect, existingExerciseIds, gymEquipment }: Props) {
  const theme = useTheme();
  const { t } = useI18n();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const list = searchExercises(query).slice(0, 50);
    if (!gymEquipment) return list.map((item) => ({ item, unavailable: false }));
    const withAvailability = list.map((item) => {
      const eq = getExercise(item.id)?.equipment as Equipment | undefined;
      return { item, unavailable: eq != null && !gymEquipment.has(eq) };
    });
    // Stable partition: available exercises first, original order preserved.
    return [
      ...withAvailability.filter((r) => !r.unavailable),
      ...withAvailability.filter((r) => r.unavailable),
    ];
  }, [query, gymEquipment]);

  const existingSet = useMemo(() => new Set(existingExerciseIds), [existingExerciseIds]);

  useEffect(() => {
    if (!visible) setQuery("");
  }, [visible]);

  function handleSelect(exId: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    onSelect(exId);
  }

  function handleClose() {
    setQuery("");
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
      >
      <Pressable
        onPress={handleClose}
        style={{ flex: 1, backgroundColor: theme.modalOverlay, justifyContent: "center", padding: 16 }}
      >
        <View
          onStartShouldSetResponder={() => true}
          style={{
            backgroundColor: theme.modalGlass,
            borderColor: theme.glassBorder,
            borderWidth: 1,
            borderRadius: theme.radius.xl,
            padding: 18,
            gap: 14,
            // The FlatList below uses flex: 1, which only works when its
            // parent has a concrete height. Without flex/height on this
            // wrapper the list collapses to 0px and search "doesn't work".
            flex: 1,
            maxHeight: "85%",
            shadowColor: theme.shadow.lg.color,
            shadowOpacity: theme.shadow.lg.opacity,
            shadowRadius: theme.shadow.lg.radius,
            shadowOffset: theme.shadow.lg.offset,
          }}
        >
          <Text style={{ color: theme.text, fontFamily: theme.fontFamily.semibold, fontSize: 18 }}>
            {t("log.addExercise")}
          </Text>

          <TextField
            value={query}
            onChangeText={setQuery}
            placeholder={t("log.searchExercise")}
            placeholderTextColor={theme.muted}
            autoFocus
            style={{
              color: theme.text,
              backgroundColor: theme.glass,
              borderColor: theme.glassBorder,
              borderWidth: 1,
              borderRadius: 12,
              padding: 10,
              fontSize: 14,
              fontFamily: theme.mono,
            }}
          />

          <FlatList
            data={results}
            keyExtractor={(r) => r.item.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 240, flexGrow: 1 }}
            renderItem={({ item: row }) => {
              const { item, unavailable } = row;
              const alreadyIn = existingSet.has(item.id);
              return (
                <Pressable
                  onPress={() => { if (!alreadyIn) handleSelect(item.id); }}
                  style={({ pressed }) => ({
                    padding: 12,
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: alreadyIn ? theme.accent : theme.glassBorder,
                    backgroundColor: pressed && !alreadyIn
                      ? theme.accent + "1F"
                      : alreadyIn
                        ? theme.accent + "14"
                        : theme.glass,
                    marginBottom: 6,
                    gap: 3,
                    opacity: alreadyIn ? 0.5 : unavailable ? 0.45 : pressed ? 0.8 : 1,
                  })}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Text style={{ color: theme.text, fontSize: 14, fontFamily: theme.fontFamily.medium }}>
                      {item.displayName}
                    </Text>
                    <BackImpactDot exerciseId={item.id} />
                    {(() => {
                      const eq = getExercise(item.id)?.equipment as Equipment | undefined;
                      return eq ? (
                        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>{eq}</Text>
                      ) : null;
                    })()}
                    {unavailable ? (
                      <Text style={{ color: theme.warn, fontFamily: theme.mono, fontSize: 10 }}>
                        {t("gym.notAtThisGym")}
                      </Text>
                    ) : null}
                  </View>
                  {alreadyIn ? (
                    <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>
                      {t("log.alreadyInWorkout")}
                    </Text>
                  ) : null}
                </Pressable>
              );
            }}
          />
        </View>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
