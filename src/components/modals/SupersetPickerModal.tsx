// src/components/modals/SupersetPickerModal.tsx — pick 1–2 exercises to merge
// with the current one into a mid-session superset (presentational).
import React, { useEffect, useState } from "react";
import { View, Text, Pressable, Modal, ScrollView } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { useI18n } from "../../i18n";
import { Btn } from "../../ui";
import { displayNameFor } from "../../exerciseLibrary";

export type SupersetPartnerOption = {
  /** Base (program) exercise id — what manual superset groups are keyed on. */
  baseExId: string;
  /** Resolved exercise id (after alternative swaps) — used for display. */
  exId: string;
};

export type SupersetPickerModalProps = {
  visible: boolean;
  /** Base exercise id of the card the picker was opened from. */
  baseExId: string | null;
  /** Resolved exercise id of that card (for display). */
  exId: string | null;
  options: SupersetPartnerOption[];
  onClose: () => void;
  onCreate: (partnerBaseExIds: string[]) => void;
};

const MAX_PARTNERS = 2; // supersets cap at 3 exercises (A/B/C)

export default function SupersetPickerModal({
  visible,
  baseExId,
  exId,
  options,
  onClose,
  onCreate,
}: SupersetPickerModalProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (visible) setSelected([]);
  }, [visible, baseExId]);

  if (!baseExId) return null;

  function toggle(base: string) {
    setSelected((prev) => {
      if (prev.includes(base)) return prev.filter((b) => b !== base);
      if (prev.length >= MAX_PARTNERS) return prev;
      return [...prev, base];
    });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: theme.modalOverlay, justifyContent: "center", padding: 16 }}
        onPress={onClose}
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
            maxHeight: "80%",
            shadowColor: theme.shadow.lg.color,
            shadowOpacity: theme.shadow.lg.opacity,
            shadowRadius: theme.shadow.lg.radius,
            shadowOffset: theme.shadow.lg.offset,
          }}
        >
          <Text style={{ color: theme.text, fontFamily: theme.fontFamily.semibold, fontSize: 18 }}>
            {t("log.createSuperset")}
          </Text>
          <Text style={{ color: theme.muted, fontFamily: theme.fontFamily.regular, fontSize: 13 }}>
            {t("log.createSupersetWith", { name: displayNameFor(exId ?? baseExId) })}
          </Text>

          {options.length === 0 ? (
            <Text style={{ color: theme.muted, fontFamily: theme.fontFamily.regular, fontSize: 14 }}>
              {t("log.noSupersetPartners")}
            </Text>
          ) : (
            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
              {options.map((opt) => {
                const isSelected = selected.includes(opt.baseExId);
                const selectionFull = !isSelected && selected.length >= MAX_PARTNERS;
                return (
                  <Pressable
                    key={opt.baseExId}
                    onPress={() => toggle(opt.baseExId)}
                    disabled={selectionFull}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      padding: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: isSelected ? theme.accent : theme.glassBorder,
                      backgroundColor: isSelected ? theme.accent + "2E" : theme.glass,
                      opacity: selectionFull ? 0.45 : 1,
                    }}
                  >
                    <MaterialIcons
                      name={isSelected ? "check-circle" : "radio-button-unchecked"}
                      size={20}
                      color={isSelected ? theme.accent : theme.muted}
                    />
                    <Text
                      numberOfLines={1}
                      style={{
                        color: isSelected ? theme.accent : theme.text,
                        fontFamily: theme.fontFamily.medium,
                        fontSize: 15,
                        flex: 1,
                      }}
                    >
                      {displayNameFor(opt.exId)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <Text style={{ color: theme.muted2, fontFamily: theme.fontFamily.regular, fontSize: 12 }}>
            {t("log.createSupersetMax")}
          </Text>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Btn label={t("common.cancel")} onPress={onClose} />
            </View>
            <View style={{ flex: 1 }}>
              <Btn
                label={t("log.createSupersetConfirm")}
                tone="accent"
                disabled={selected.length === 0}
                onPress={() => onCreate(selected)}
              />
            </View>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}
