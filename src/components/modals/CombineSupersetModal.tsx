// src/components/modals/CombineSupersetModal.tsx — Combine an exercise with another into a session-only superset
import React from "react";
import { View, Text, Pressable, Modal, ScrollView } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../theme";
import { useI18n } from "../../i18n";
import { displayNameFor, getExercise } from "../../exerciseLibrary";
import type { Equipment } from "../../exerciseLibrary";
import BackImpactDot from "../BackImpactDot";

type Candidate = {
  baseExId: string;
  exId: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  sourceBaseExId: string | null;
  candidates: Candidate[];
  onPick: (sourceBaseExId: string, targetBaseExId: string) => void;
};

export default function CombineSupersetModal({ visible, onClose, sourceBaseExId, candidates, onPick }: Props) {
  const theme = useTheme();
  const { t } = useI18n();

  const sourceName = sourceBaseExId ? displayNameFor(sourceBaseExId) : "";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
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
            {t("log.combineSupersetFor", { name: sourceName })}
          </Text>
          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>
            {t("log.combineSupersetHint", { name: sourceName })}
          </Text>

          {candidates.length === 0 ? (
            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12, paddingVertical: 18 }}>
              {t("log.combineSupersetEmpty")}
            </Text>
          ) : (
            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
              {candidates.map((c) => {
                const eq = getExercise(c.exId)?.equipment as Equipment | undefined;
                return (
                  <Pressable
                    key={c.baseExId}
                    onPress={() => {
                      if (!sourceBaseExId) return;
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      onPick(sourceBaseExId, c.baseExId);
                    }}
                    style={({ pressed }) => ({
                      padding: 12,
                      borderRadius: theme.radius.lg,
                      borderWidth: 1,
                      borderColor: theme.glassBorder,
                      backgroundColor: pressed
                        ? (theme.isDark ? "rgba(182, 104, 245, 0.12)" : "rgba(124, 58, 237, 0.06)")
                        : theme.glass,
                      gap: 3,
                    })}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <Text style={{ color: theme.text, fontSize: 14, fontFamily: theme.fontFamily.medium }}>
                        {displayNameFor(c.exId)}
                      </Text>
                      <BackImpactDot exerciseId={c.exId} />
                      {eq ? (
                        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>{eq}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <Pressable
            onPress={onClose}
            style={{
              paddingVertical: 12,
              alignItems: "center",
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: theme.glassBorder,
              backgroundColor: theme.glass,
            }}
          >
            <Text style={{ color: theme.text, fontFamily: theme.fontFamily.medium }}>{t("common.cancel")}</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
