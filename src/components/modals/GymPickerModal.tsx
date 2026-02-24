// src/components/modals/GymPickerModal.tsx — Gym picker modal (presentational)
import React from "react";
import { View, Text, Pressable, Modal, Alert } from "react-native";
import { useTheme } from "../../theme";
import { useI18n } from "../../i18n";
import { Btn } from "../../ui";
import type { GymLocation } from "../../gymStore";

export type GymPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  gyms: GymLocation[];
  activeGymId: string | null;
  onSelect: (gymId: string | null) => void;
  disabled?: boolean;
};

export default function GymPickerModal({
  visible,
  onClose,
  gyms,
  activeGymId,
  onSelect,
  disabled,
}: GymPickerModalProps) {
  const theme = useTheme();
  const { t } = useI18n();

  const activeBg = theme.isDark ? "rgba(182, 104, 245, 0.18)" : "rgba(124, 58, 237, 0.12)";

  function handleSelect(gymId: string | null) {
    if (disabled) {
      Alert.alert(t("gym.lockedMidSession"));
      return;
    }
    onSelect(gymId);
    onClose();
  }

  const isNoGymActive = activeGymId === null;

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
            shadowColor: theme.shadow.lg.color,
            shadowOpacity: theme.shadow.lg.opacity,
            shadowRadius: theme.shadow.lg.radius,
            shadowOffset: theme.shadow.lg.offset,
            elevation: theme.shadow.lg.elevation,
          }}
        >
          <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 18 }}>
            {t("gym.selectGym")}
          </Text>

          <View style={{ gap: 8 }}>
            {/* No gym option */}
            <Pressable
              onPress={() => handleSelect(null)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                padding: 10,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: isNoGymActive ? theme.accent : theme.glassBorder,
                backgroundColor: isNoGymActive ? activeBg : theme.glass,
              }}
            >
              <Text style={{
                color: isNoGymActive ? theme.accent : theme.text,
                fontFamily: theme.fontFamily.medium,
                fontSize: 15,
              }}>
                {t("gym.noGym")}
              </Text>
            </Pressable>

            {/* Gym list */}
            {gyms.map((gym) => {
              const isActive = gym.id === activeGymId;
              return (
                <Pressable
                  key={gym.id}
                  onPress={() => handleSelect(gym.id)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    padding: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isActive ? theme.accent : theme.glassBorder,
                    backgroundColor: isActive ? activeBg : theme.glass,
                  }}
                >
                  <View style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: gym.color ?? theme.muted,
                  }} />
                  <Text style={{
                    color: isActive ? theme.accent : theme.text,
                    fontFamily: theme.fontFamily.medium,
                    fontSize: 15,
                  }}>
                    {gym.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Btn label={t("common.close")} onPress={onClose} />
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}
