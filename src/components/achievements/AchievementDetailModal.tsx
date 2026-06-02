// src/components/achievements/AchievementDetailModal.tsx
import React from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { useI18n } from "../../i18n";
import { GlassCard, GradientButton } from "../../ui/modern";
import { shareAchievementText } from "../../sharing";
import type { AchievementWithStatus } from "../../achievements";

export default function AchievementDetailModal({
  achievement,
  tierColor,
  tierLabel,
  onClose,
}: {
  achievement: AchievementWithStatus;
  tierColor: string;
  tierLabel: string;
  onClose: () => void;
}) {
  const theme = useTheme();
  const { t, locale } = useI18n();

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.modalContent, { backgroundColor: theme.modalGlass }]}>
          <GlassCard gradient shadow="lg">
            {/* Icon */}
            <View style={{ alignItems: "center", gap: theme.space.md }}>
              <View
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  backgroundColor: achievement.unlocked ? tierColor : theme.panel2,
                  alignItems: "center",
                  justifyContent: "center",
                  ...theme.shadow.glow,
                }}
              >
                <MaterialIcons
                  name={achievement.icon as any}
                  size={64}
                  color={achievement.unlocked ? "#FFFFFF" : theme.muted}
                />
              </View>

              {/* Title and Tier */}
              <View style={{ alignItems: "center", gap: 8 }}>
                <Text
                  style={{
                    color: theme.text,
                    fontSize: theme.fontSize.xl,
                    fontFamily: theme.fontFamily.semibold,
                    textAlign: "center",
                  }}
                >
                  {achievement.name}
                </Text>
                <View
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 6,
                    borderRadius: theme.radius.pill,
                    backgroundColor: tierColor,
                  }}
                >
                  <Text style={{ color: "#FFFFFF", fontSize: theme.fontSize.sm, fontFamily: theme.fontFamily.semibold }}>
                    {tierLabel}
                  </Text>
                </View>
              </View>

              {/* Description */}
              <Text
                style={{
                  color: theme.muted,
                  fontSize: theme.fontSize.md,
                  textAlign: "center",
                  lineHeight: theme.lineHeight.md,
                }}
              >
                {achievement.description}
              </Text>

              {/* Points */}
              <View
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.glass,
                  borderWidth: 1,
                  borderColor: theme.glassBorder,
                }}
              >
                <Text style={{ color: theme.text, fontSize: theme.fontSize.lg, fontFamily: theme.fontFamily.semibold }}>
                  {t("achievements.points", { n: achievement.points })}
                </Text>
              </View>

              {/* Unlock Date */}
              {achievement.unlocked && achievement.unlockedAt && (
                <View style={{ alignItems: "center", gap: 4 }}>
                  <MaterialIcons name="check-circle" size={32} color={theme.success} />
                  <Text style={{ color: theme.success, fontSize: theme.fontSize.sm, fontFamily: theme.fontFamily.semibold }}>
                    {t("achievements.unlocked")}
                  </Text>
                  <Text style={{ color: theme.muted, fontSize: theme.fontSize.sm, fontFamily: theme.mono }}>
                    {new Date(achievement.unlockedAt).toLocaleDateString(locale === "nb" ? "no-NO" : "en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </Text>
                </View>
              )}

              {/* Share Button */}
              {achievement.unlocked && (
                <Pressable
                  onPress={() => {
                    shareAchievementText(achievement.name, achievement.description, achievement.tier).catch(() => {});
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: theme.radius.md,
                    backgroundColor: theme.glass,
                    borderWidth: 1,
                    borderColor: theme.glassBorder,
                  }}
                >
                  <MaterialIcons name="share" size={18} color={theme.accent} />
                  <Text style={{ color: theme.accent, fontSize: theme.fontSize.sm, fontFamily: theme.fontFamily.semibold }}>
                    {t("share.achievement")}
                  </Text>
                </Pressable>
              )}

              {/* Close Button */}
              <GradientButton text={t("common.close")} onPress={onClose} variant="accent" style={{ width: "100%" }} />
            </View>
          </GlassCard>
        </View>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
  },
  modalContent: {
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: "hidden",
  },
});
