// app/nutrition.tsx — Nutrition (aurora)
//
// Port of Gymdash.html's <Nutrition> component:
//
//   ScreenHeader "Nutrition" (back)
//   Strong glass card:
//     • 110px aurora progress ring with Mono consumed kcal + "of {target} kcal"
//     • 3 stacked macro bars: Protein (blue) · Carbs (violet) · Fat (pink)
//   "Today's meals" list — glass cards with time + items + kcal
//   Gradient-border "Log a meal" CTA
//
// v1 is mock data (the DB has no nutrition tables yet). The structure is in
// place so logging can be wired later without a layout change.

import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../src/theme";
import { useI18n } from "../src/i18n";
import { GlassCard, Mono, ProgressRing } from "../src/ui/modern";

type Macro = { key: "protein" | "carbs" | "fat"; cur: number; tgt: number; color: string };
type Meal = { time: string; items: string; kcal: number };

export default function NutritionScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  // Placeholder data — swap for real tables when nutrition tracking lands.
  const [macros] = useState<Macro[]>([
    { key: "protein", cur: 128, tgt: 165, color: theme.aurora.blue },
    { key: "carbs",   cur: 210, tgt: 280, color: theme.aurora.violet },
    { key: "fat",     cur: 62,  tgt: 75,  color: theme.aurora.pink },
  ]);
  const [meals] = useState<Meal[]>([
    { time: "Breakfast · 8:10", items: "Oats, berries, whey", kcal: 480 },
    { time: "Lunch · 12:45", items: "Chicken bowl, rice, avocado", kcal: 720 },
    { time: "Snack · 16:00", items: "Greek yogurt, almonds", kcal: 310 },
  ]);

  const consumed = useMemo(() => meals.reduce((a, m) => a + m.kcal, 0), [meals]);
  const target = 2400;
  const ringPct = Math.min(1, consumed / target);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top", "left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4, marginBottom: 14 }}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({
              width: 38, height: 38, borderRadius: 12,
              backgroundColor: "rgba(255,255,255,0.05)",
              borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
              alignItems: "center", justifyContent: "center",
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <MaterialIcons name="arrow-back" size={16} color="#fff" />
          </Pressable>
          <Text
            style={{
              flex: 1,
              color: theme.text,
              fontSize: 22,
              fontFamily: theme.fontFamily.serif,
              letterSpacing: -0.2,
            }}
          >
            {t("nav.nutrition")}
          </Text>
        </View>

        {/* Hero — ring + macro bars */}
        <GlassCard strong radius={24} padding={18}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            {/* Ring with label in the center */}
            <View style={{ width: 110, height: 110, alignItems: "center", justifyContent: "center" }}>
              <ProgressRing
                progress={ringPct}
                size={110}
                strokeWidth={7}
                color="aurora"
                showPercentage={false}
              />
              <View style={{ position: "absolute", alignItems: "center", justifyContent: "center" }}>
                <Mono style={{ fontSize: 24, color: theme.text, lineHeight: 26 }}>{consumed}</Mono>
                <Text style={{ color: theme.muted2, fontSize: 9, marginTop: 2, letterSpacing: 0.5 }}>
                  {t("nutrition.ofTarget", { target: String(target) })}
                </Text>
              </View>
            </View>

            {/* Macros */}
            <View style={{ flex: 1, gap: 10 }}>
              {macros.map((m) => {
                const pct = Math.min(1, m.cur / m.tgt);
                return (
                  <View key={m.key}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                      <Text style={{ color: theme.muted, fontSize: 11 }}>{t(`nutrition.macro.${m.key}`)}</Text>
                      <Mono style={{ color: theme.muted2, fontSize: 10 }}>
                        {m.cur}/{m.tgt}g
                      </Mono>
                    </View>
                    <View
                      style={{
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: "rgba(255,255,255,0.06)",
                        overflow: "hidden",
                      }}
                    >
                      <View
                        style={{
                          width: `${pct * 100}%`,
                          height: "100%",
                          backgroundColor: m.color,
                          borderRadius: 3,
                        }}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </GlassCard>

        {/* Today's meals */}
        <Text
          style={{
            color: theme.muted,
            fontSize: 13,
            fontFamily: theme.fontFamily.medium,
            letterSpacing: 0.3,
            marginTop: 18,
            marginBottom: 10,
          }}
        >
          {t("nutrition.todayMeals")}
        </Text>
        <View style={{ gap: 8 }}>
          {meals.map((m, i) => (
            <GlassCard key={i} radius={16} padding={12}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 38, height: 38, borderRadius: 11,
                    backgroundColor: "rgba(255,255,255,0.05)",
                    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
                    alignItems: "center", justifyContent: "center",
                  }}
                >
                  <MaterialIcons name="local-fire-department" size={18} color="rgba(255,255,255,0.7)" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: theme.muted2, fontSize: 12 }}>{m.time}</Text>
                  <Text
                    style={{
                      color: theme.text,
                      fontSize: 13,
                      fontFamily: theme.fontFamily.medium,
                      marginTop: 1,
                    }}
                    numberOfLines={1}
                  >
                    {m.items}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
                    <Mono style={{ color: theme.text, fontSize: 12 }}>{m.kcal}</Mono>
                    <Text style={{ color: theme.muted2, fontSize: 9 }}>kcal</Text>
                  </View>
                </View>
              </View>
            </GlassCard>
          ))}
        </View>

        {/* Log a meal — gradient-bordered, softer than a full gradient button */}
        <Pressable
          onPress={() => {}}
          style={({ pressed }) => ({
            height: 52, borderRadius: 16,
            marginTop: 14,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: "rgba(192,132,252,0.35)",
            alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <LinearGradient
            colors={["rgba(96,165,250,0.25)", "rgba(192,132,252,0.25)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <MaterialIcons name="add" size={16} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 14, fontFamily: theme.fontFamily.semibold }}>
            {t("nutrition.logMeal")}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
