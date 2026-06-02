// src/components/achievements/AchievementCard.tsx
import React from "react";
import { View, Text, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { useI18n } from "../../i18n";
import { GlassCard } from "../../ui/modern";
import type { AchievementWithStatus } from "../../achievements";

export default function AchievementCard({
  achievement,
  tierColor,
  onPress,
}: {
  achievement: AchievementWithStatus;
  tierColor: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { t, locale } = useI18n();

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
    >
      <GlassCard shadow="sm" style={{ opacity: achievement.unlocked ? 1 : 0.6 }}>
        <View style={{ flexDirection: "row", gap: theme.space.md, alignItems: "center" }}>
          {/* Icon */}
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: achievement.unlocked ? tierColor : theme.panel2,
              alignItems: "center",
              justifyContent: "center",
              ...theme.shadow.md,
            }}
          >
            <MaterialIcons
              name={achievement.icon as any}
              size={32}
              color={achievement.unlocked ? "#FFFFFF" : theme.muted}
            />
          </View>

          {/* Content */}
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text
                style={{ color: theme.text, fontSize: theme.fontSize.md, fontFamily: theme.fontFamily.semibold, flex: 1 }}
              >
                {achievement.name}
              </Text>
              {achievement.unlocked && <MaterialIcons name="check-circle" size={20} color={theme.success} />}
            </View>
            <Text style={{ color: theme.muted, fontSize: theme.fontSize.sm }}>{achievement.description}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 8,
                  backgroundColor: theme.glass,
                  borderWidth: 1,
                  borderColor: tierColor,
                }}
              >
                <Text style={{ color: tierColor, fontSize: 10, fontFamily: theme.mono }}>
                  {t("achievements.points", { n: achievement.points })}
                </Text>
              </View>
              {achievement.unlocked && achievement.unlockedAt && (
                <Text style={{ color: theme.muted, fontSize: 10, fontFamily: theme.mono }}>
                  {new Date(achievement.unlockedAt).toLocaleDateString(locale === "nb" ? "no-NO" : "en-US")}
                </Text>
              )}
            </View>
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
}
