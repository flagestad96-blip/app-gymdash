// app/(tabs)/achievements.tsx
// Achievement gallery and tracking screen

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  Modal,
  StyleSheet,
} from "react-native";
import { useNavigation } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../src/theme";
import { useI18n } from "../../src/i18n";
import { Screen, TopBar, IconButton } from "../../src/ui";
import { GlassCard, ProgressRing, GradientButton } from "../../src/ui/modern";
import {
  getAllAchievements,
  getUserAchievements,
  getTotalPoints,
  getAchievementProgress,
  type Achievement,
  type UserAchievement,
  type AchievementTier,
} from "../../src/achievements";
import { shareAchievementText } from "../../src/sharing";

type AchievementWithStatus = Achievement & {
  unlocked: boolean;
  unlockedAt?: string;
  progress?: number;
};

export default function AchievementsScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const navigation = useNavigation();
  const openDrawer = useCallback(() => {
    const parent = (navigation as any)?.getParent?.();
    if (parent?.openDrawer) parent.openDrawer();
    else if ((navigation as any)?.openDrawer) (navigation as any).openDrawer();
  }, [navigation]);

  const [achievements, setAchievements] = useState<AchievementWithStatus[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [progress, setProgress] = useState<{
    total: number;
    unlocked: number;
    byTier: Record<AchievementTier, { total: number; unlocked: number }>;
  }>({ total: 0, unlocked: 0, byTier: { common: { total: 0, unlocked: 0 }, rare: { total: 0, unlocked: 0 }, epic: { total: 0, unlocked: 0 }, legendary: { total: 0, unlocked: 0 } } });

  const [refreshing, setRefreshing] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<AchievementWithStatus | null>(null);
  const [filterTier, setFilterTier] = useState<AchievementTier | "all">("all");
  const [showUnlockedOnly, setShowUnlockedOnly] = useState(false);

  const loadAchievements = useCallback(async () => {
    try {
      const [allAchievements, userAchievements, points, progressData] = await Promise.all([
        getAllAchievements(),
        getUserAchievements(),
        getTotalPoints(),
        getAchievementProgress(),
      ]);

      const unlockedMap = new Map<string, UserAchievement>();
      userAchievements.forEach((ua) => {
        unlockedMap.set(ua.achievementId, ua);
      });

      const withStatus: AchievementWithStatus[] = allAchievements.map((a) => {
        const userAchievement = unlockedMap.get(a.id);
        return {
          ...a,
          unlocked: !!userAchievement,
          unlockedAt: userAchievement?.unlockedAt,
        };
      });

      setAchievements(withStatus);
      setTotalPoints(points);
      setProgress(progressData);
    } catch (error) {
      console.error("Failed to load achievements:", error);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAchievements();
    setRefreshing(false);
  }, [loadAchievements]);

  useFocusEffect(
    useCallback(() => {
      loadAchievements();
    }, [loadAchievements])
  );

  const filteredAchievements = achievements.filter((a) => {
    if (showUnlockedOnly && !a.unlocked) return false;
    if (filterTier !== "all" && a.tier !== filterTier) return false;
    return true;
  });

  const tierColors: Record<AchievementTier, string> = {
    common: theme.muted,
    rare: theme.accent,
    epic: "#9C27B0",
    legendary: "#FFD700",
  };

  const tierLabels: Record<AchievementTier, string> = {
    common: t("achievements.tierCommon"),
    rare: t("achievements.tierRare"),
    epic: t("achievements.tierEpic"),
    legendary: t("achievements.tierLegendary"),
  };

  return (
    <Screen>
      <TopBar
        title={t("achievements.title")}
        subtitle={t("achievements.subtitle", { n: progress.unlocked, total: progress.total })}
        left={<IconButton icon="menu" onPress={openDrawer} />}
      />
      <ScrollView
        contentContainerStyle={{ padding: theme.space.md, gap: theme.space.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header Card */}
        <GlassCard gradient shadow="lg">
          <View style={{ gap: theme.space.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: theme.space.md }}>
              <ProgressRing
                progress={progress.total > 0 ? progress.unlocked / progress.total : 0}
                size={80}
                strokeWidth={6}
                color="accent"
                showPercentage={true}
              />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: theme.text, fontSize: theme.fontSize.lg, fontFamily: theme.fontFamily.semibold }}>
                  {progress.unlocked} / {progress.total}
                </Text>
                <Text style={{ color: theme.muted, fontSize: theme.fontSize.sm, fontFamily: theme.mono }}>
                  {t("achievements.totalPoints", { n: totalPoints })}
                </Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
                  {(["common", "rare", "epic", "legendary"] as AchievementTier[]).map((tier) => (
                    <View key={tier} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: tierColors[tier],
                        }}
                      />
                      <Text style={{ color: theme.muted, fontSize: 10, fontFamily: theme.mono }}>
                        {progress.byTier[tier].unlocked}/{progress.byTier[tier].total}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>
        </GlassCard>

        {/* Filters */}
        <View style={{ gap: theme.space.sm }}>
          <Text style={{ color: theme.text, fontSize: theme.fontSize.md, fontFamily: theme.fontFamily.semibold }}>
            {t("achievements.filter")}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Pressable
              onPress={() => {
                setFilterTier("all");
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: theme.radius.pill,
                backgroundColor: filterTier === "all" ? theme.accent : theme.panel2,
                borderWidth: 1,
                borderColor: filterTier === "all" ? theme.accent : theme.line,
              }}
            >
              <Text
                style={{
                  color: filterTier === "all" ? "#FFFFFF" : theme.text,
                  fontSize: theme.fontSize.sm,
                  fontFamily: theme.fontFamily.medium,
                }}
              >
                {t("achievements.all")}
              </Text>
            </Pressable>
            {(["common", "rare", "epic", "legendary"] as AchievementTier[]).map((tier) => (
              <Pressable
                key={tier}
                onPress={() => {
                  setFilterTier(tier);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: theme.radius.pill,
                  backgroundColor: filterTier === tier ? tierColors[tier] : theme.panel2,
                  borderWidth: 1,
                  borderColor: filterTier === tier ? tierColors[tier] : theme.line,
                }}
              >
                <Text
                  style={{
                    color: filterTier === tier ? "#FFFFFF" : theme.text,
                    fontSize: theme.fontSize.sm,
                    fontFamily: theme.fontFamily.medium,
                  }}
                >
                  {tierLabels[tier]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            onPress={() => {
              setShowUnlockedOnly(!showUnlockedOnly);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}
          >
            <MaterialIcons
              name={showUnlockedOnly ? "check-box" : "check-box-outline-blank"}
              size={24}
              color={theme.accent}
            />
            <Text style={{ color: theme.text, fontSize: theme.fontSize.sm }}>
              {t("achievements.showUnlocked")}
            </Text>
          </Pressable>
        </View>

        {/* Achievement Grid */}
        <View style={{ gap: theme.space.sm }}>
          <Text style={{ color: theme.text, fontSize: theme.fontSize.md, fontFamily: theme.fontFamily.semibold }}>
            {t("achievements.count", { n: filteredAchievements.length })}
          </Text>
          <View style={{ gap: theme.space.sm }}>
            {filteredAchievements.map((achievement) => (
              <AchievementCard
                key={achievement.id}
                achievement={achievement}
                tierColor={tierColors[achievement.tier]}
                onPress={() => setSelectedAchievement(achievement)}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Achievement Details Modal */}
      {selectedAchievement && (
        <AchievementDetailModal
          achievement={selectedAchievement}
          tierColor={tierColors[selectedAchievement.tier]}
          tierLabel={tierLabels[selectedAchievement.tier]}
          onClose={() => setSelectedAchievement(null)}
        />
      )}
    </Screen>
  );
}

/**
 * Achievement Card Component
 */
function AchievementCard({
  achievement,
  tierColor,
  onPress,
}: {
  achievement: AchievementWithStatus;
  tierColor: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
    >
      <GlassCard
        shadow="sm"
        style={{
          opacity: achievement.unlocked ? 1 : 0.6,
        }}
      >
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
                style={{
                  color: theme.text,
                  fontSize: theme.fontSize.md,
                  fontFamily: theme.fontFamily.semibold,
                  flex: 1,
                }}
              >
                {achievement.name}
              </Text>
              {achievement.unlocked && (
                <MaterialIcons name="check-circle" size={20} color={theme.success} />
              )}
            </View>
            <Text style={{ color: theme.muted, fontSize: theme.fontSize.sm }}>
              {achievement.description}
            </Text>
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
                  {new Date(achievement.unlockedAt).toLocaleDateString("no-NO")}
                </Text>
              )}
            </View>
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
}

/**
 * Achievement Detail Modal
 */
function AchievementDetailModal({
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
  const { t } = useI18n();

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
                    {new Date(achievement.unlockedAt).toLocaleDateString("no-NO", {
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
