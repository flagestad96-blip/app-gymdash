// src/components/modals/ExerciseAddModal.tsx — Add ad-hoc exercise to workout
import React, { useState, useMemo, useEffect } from "react";
import { View, Text, Pressable, Modal, FlatList, Keyboard } from "react-native";
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
};

export default function ExerciseAddModal({ visible, onClose, onSelect, existingExerciseIds }: Props) {
  const theme = useTheme();
  const { t } = useI18n();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    return searchExercises(query).slice(0, 50);
  }, [query]);

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
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
            renderItem={({ item }) => {
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
                      ? (theme.isDark ? "rgba(182, 104, 245, 0.12)" : "rgba(124, 58, 237, 0.06)")
                      : alreadyIn
                        ? (theme.isDark ? "rgba(182, 104, 245, 0.08)" : "rgba(124, 58, 237, 0.04)")
                        : theme.glass,
                    marginBottom: 6,
                    gap: 3,
                    opacity: alreadyIn ? 0.5 : pressed ? 0.8 : 1,
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
    </Modal>
  );
}
