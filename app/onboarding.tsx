// app/onboarding.tsx — Aurora onboarding flow
//
// Three steps matching the redesign prototype:
//   0. Welcome (editorial serif hero + tilted preview glass cards)
//   1. Goals (multi-select from 5 training goals)
//   2. Days (1–7 training days per week + program suggestion)
//
// Writes: user_goals, user_training_days, onboarding_completed.

import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../src/theme";
import { useI18n } from "../src/i18n";
import {
  GlassCard,
  GradientButton,
  Pill,
  ProgressRing,
  Mono,
} from "../src/ui/modern";
import {
  setUserGoals,
  setTrainingDays,
  setOnboardingCompleted,
  type UserGoal,
} from "../src/userPreferences";

// Icon + tint for each goal (matches the design)
const GOAL_VISUALS: Record<UserGoal, { icon: keyof typeof MaterialIcons.glyphMap }> = {
  strength:    { icon: "fitness-center" },
  endurance:   { icon: "directions-run" },
  weight:      { icon: "local-fire-department" },
  mobility:    { icon: "self-improvement" },
  consistency: { icon: "auto-awesome" },
};

const GOAL_ORDER: UserGoal[] = ["strength", "endurance", "weight", "mobility", "consistency"];

export default function OnboardingScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [goals, setGoalsLocal] = useState<UserGoal[]>(["strength"]);
  const [days, setDaysLocal] = useState<number>(4);

  const toggleGoal = (g: UserGoal) => {
    setGoalsLocal((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );
  };

  const suggestionKey =
    days >= 5 ? "onboarding.days.suggestPPL"
    : days >= 3 ? "onboarding.days.suggestUpperLower"
    : "onboarding.days.suggestFullBody";

  const onFinish = () => {
    setUserGoals(goals.length > 0 ? goals : ["strength"]);
    setTrainingDays(days);
    setOnboardingCompleted(true);
    router.replace("/");
  };

  const onNext = () => {
    if (step < 2) setStep((s) => (s + 1) as 0 | 1 | 2);
    else onFinish();
  };

  const canContinue = step !== 1 || goals.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top", "left", "right", "bottom"]}>
      <View style={{ flex: 1, paddingHorizontal: 22, paddingBottom: 24, paddingTop: 8 }}>
        {/* Step indicator */}
        <StepDots step={step} />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {step === 0 ? <StepWelcome t={t} theme={theme} /> : null}
          {step === 1 ? <StepGoals t={t} theme={theme} goals={goals} toggleGoal={toggleGoal} /> : null}
          {step === 2 ? <StepDays t={t} theme={theme} days={days} setDays={setDaysLocal} suggestionKey={suggestionKey} /> : null}
        </ScrollView>

        {/* Footer buttons */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          {step > 0 ? (
            <Pressable
              onPress={() => setStep((s) => (s - 1) as 0 | 1 | 2)}
              style={({ pressed }) => ({
                height: 56,
                paddingHorizontal: 18,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: theme.glassBorder,
                backgroundColor: theme.glass,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.8 : 1,
              })}
              accessibilityRole="button"
              accessibilityLabel={t("onboarding.back")}
            >
              <MaterialIcons name="arrow-back" size={20} color={theme.text} />
            </Pressable>
          ) : null}
          <View style={{ flex: 1 }}>
            <GradientButton
              text={step < 2 ? t("onboarding.continue") : t("onboarding.enter")}
              onPress={onNext}
              variant="aurora"
              icon="arrow-forward"
              iconPosition="right"
              size="lg"
              disabled={!canContinue}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ── Step indicator ──────────────────────────────────────────────────────────

function StepDots({ step }: { step: 0 | 1 | 2 }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 6, marginTop: 4, marginBottom: 20 }}>
      {[0, 1, 2].map((i) => {
        const active = i <= step;
        const dot = (
          <View
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              backgroundColor: active ? "transparent" : "rgba(255,255,255,0.12)",
              overflow: "hidden",
            }}
          >
            {active ? (
              <LinearGradient
                colors={theme.accentGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
          </View>
        );
        return dot;
      })}
    </View>
  );
}

// ── Step 0 — Welcome ────────────────────────────────────────────────────────

function StepWelcome({ t, theme }: { t: any; theme: any }) {
  return (
    <View style={{ paddingTop: 12 }}>
      {/* Hero */}
      <Pill tone="accent" icon="auto-awesome" style={{ alignSelf: "flex-start", marginBottom: 16 }}>
        {t("onboarding.welcome.pill")}
      </Pill>

      <Text
        style={{
          color: theme.text,
          fontFamily: theme.fontFamily.serif,
          fontSize: 44,
          lineHeight: 48,
          letterSpacing: -0.5,
        }}
      >
        {t("onboarding.welcome.headlineLead")}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap" }}>
        <Text
          style={{
            color: theme.aurora.violet,
            fontFamily: "InstrumentSerif_400Regular_Italic",
            fontSize: 44,
            lineHeight: 48,
            letterSpacing: -0.5,
          }}
        >
          {t("onboarding.welcome.headlineAccent")}
        </Text>
        <Text
          style={{
            color: theme.text,
            fontFamily: theme.fontFamily.serif,
            fontSize: 44,
            lineHeight: 48,
            letterSpacing: -0.5,
          }}
        >
          {" "}{t("onboarding.welcome.headlineTail")}
        </Text>
      </View>

      <Text
        style={{
          color: theme.muted,
          fontFamily: theme.fontFamily.regular,
          fontSize: 15,
          lineHeight: 22,
          marginTop: 14,
          maxWidth: 320,
        }}
      >
        {t("onboarding.welcome.tagline")}
      </Text>

      {/* Three preview glass cards — tilted, matches the design */}
      <View style={{ marginTop: 32, height: 270, position: "relative" }}>
        <GlassCard
          strong
          style={{
            position: "absolute",
            left: 10,
            right: 50,
            top: 0,
            transform: [{ rotate: "-3deg" }],
            padding: 14,
          }}
          radius={20}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 36, height: 36, borderRadius: 10,
                alignItems: "center", justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <LinearGradient
                colors={[theme.aurora.blue, theme.aurora.violet]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <MaterialIcons name="local-fire-department" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.muted2, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", fontFamily: theme.mono }}>
                {t("onboarding.preview.streak")}
              </Text>
              <Mono style={{ fontSize: 22, color: theme.text, marginTop: 2 }}>27</Mono>
            </View>
          </View>
        </GlassCard>

        <GlassCard
          strong
          style={{
            position: "absolute",
            left: 30,
            right: 20,
            top: 90,
            transform: [{ rotate: "1.5deg" }],
            padding: 14,
          }}
          radius={20}
        >
          <Text style={{ color: theme.muted2, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", fontFamily: theme.mono }}>
            {t("onboarding.preview.today")}
          </Text>
          <Text style={{ color: theme.text, fontSize: 15, fontFamily: theme.fontFamily.semibold, marginTop: 4 }}>
            {t("onboarding.preview.todayBody")}
          </Text>
          <View style={{ flexDirection: "row", gap: 4, marginTop: 10 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: i < 3 ? "transparent" : "rgba(255,255,255,0.12)",
                  overflow: "hidden",
                }}
              >
                {i < 3 ? (
                  <LinearGradient
                    colors={theme.accentGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                ) : null}
              </View>
            ))}
          </View>
        </GlassCard>

        <GlassCard
          strong
          style={{
            position: "absolute",
            left: 50,
            right: 10,
            top: 180,
            transform: [{ rotate: "-1.5deg" }],
            padding: 14,
          }}
          radius={20}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <ProgressRing progress={0.72} size={44} strokeWidth={4} color="aurora" showPercentage={false} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.muted2, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", fontFamily: theme.mono }}>
                {t("onboarding.preview.volume")}
              </Text>
              <Mono style={{ fontSize: 17, color: theme.text, marginTop: 2 }}>
                12,480 <Text style={{ fontSize: 11, color: theme.muted2 }}>kg</Text>
              </Mono>
            </View>
          </View>
        </GlassCard>
      </View>
    </View>
  );
}

// ── Step 1 — Goals ──────────────────────────────────────────────────────────

function StepGoals({
  t,
  theme,
  goals,
  toggleGoal,
}: {
  t: any;
  theme: any;
  goals: UserGoal[];
  toggleGoal: (g: UserGoal) => void;
}) {
  return (
    <View style={{ paddingTop: 12 }}>
      <Text style={{ color: theme.text, fontFamily: theme.fontFamily.serif, fontSize: 30, letterSpacing: -0.3 }}>
        {t("onboarding.goals.title")}
      </Text>
      <Text style={{ color: theme.muted, fontFamily: theme.fontFamily.regular, fontSize: 13, marginTop: 6, marginBottom: 20 }}>
        {t("onboarding.goals.subtitle")}
      </Text>

      <View style={{ gap: 10 }}>
        {GOAL_ORDER.map((g) => {
          const on = goals.includes(g);
          const visual = GOAL_VISUALS[g];
          return (
            <Pressable key={g} onPress={() => toggleGoal(g)}>
              <GlassCard
                strong={on}
                padding={14}
                radius={18}
                style={{
                  borderColor: on ? theme.aurora.violet + "99" : theme.glassBorder,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <GoalIconBox on={on} theme={theme} icon={visual.icon} />
                  <Text style={{ flex: 1, color: theme.text, fontSize: 15, fontFamily: theme.fontFamily.medium }}>
                    {t(`onboarding.goals.${g}`)}
                  </Text>
                  <CheckDot on={on} theme={theme} />
                </View>
              </GlassCard>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function GoalIconBox({ on, theme, icon }: { on: boolean; theme: any; icon: keyof typeof MaterialIcons.glyphMap }) {
  return (
    <View
      style={{
        width: 42, height: 42, borderRadius: 12,
        alignItems: "center", justifyContent: "center",
        backgroundColor: on ? "transparent" : "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: on ? "transparent" : theme.glassBorder,
        overflow: "hidden",
      }}
    >
      {on ? (
        <LinearGradient
          colors={[theme.aurora.blue, theme.aurora.violet]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <MaterialIcons name={icon} size={20} color="#fff" />
    </View>
  );
}

function CheckDot({ on, theme }: { on: boolean; theme: any }) {
  return (
    <View
      style={{
        width: 22, height: 22, borderRadius: 11,
        backgroundColor: on ? "#fff" : "transparent",
        borderWidth: on ? 0 : 1.5,
        borderColor: on ? "transparent" : "rgba(255,255,255,0.25)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {on ? <MaterialIcons name="check" size={14} color={theme.isDark ? "#0b0f1a" : "#1a1b4b"} /> : null}
    </View>
  );
}

// ── Step 2 — Days ───────────────────────────────────────────────────────────

function StepDays({
  t,
  theme,
  days,
  setDays,
  suggestionKey,
}: {
  t: any;
  theme: any;
  days: number;
  setDays: (n: number) => void;
  suggestionKey: string;
}) {
  const dayButtons = useMemo(() => [1, 2, 3, 4, 5, 6, 7], []);
  return (
    <View style={{ paddingTop: 12 }}>
      <Text style={{ color: theme.text, fontFamily: theme.fontFamily.serif, fontSize: 30, letterSpacing: -0.3 }}>
        {t("onboarding.days.title")}
      </Text>
      <Text style={{ color: theme.muted, fontFamily: theme.fontFamily.regular, fontSize: 13, marginTop: 6, marginBottom: 20 }}>
        {t("onboarding.days.subtitle")}
      </Text>

      <GlassCard strong radius={24} padding={22}>
        <View style={{ alignItems: "center", gap: 10 }}>
          <Mono style={{ fontSize: 72, lineHeight: 72, color: theme.aurora.violet }}>
            {String(days)}
          </Mono>
          <Text
            style={{
              color: theme.muted2,
              fontSize: 11,
              letterSpacing: 1.4,
              textTransform: "uppercase",
              fontFamily: theme.mono,
            }}
          >
            {t("onboarding.days.unit")}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 20, justifyContent: "center" }}>
          {dayButtons.map((n) => {
            const active = days === n;
            return (
              <Pressable key={n} onPress={() => setDays(n)}>
                <View
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    alignItems: "center", justifyContent: "center",
                    backgroundColor: active ? "transparent" : "rgba(255,255,255,0.06)",
                    borderWidth: active ? 0 : 1,
                    borderColor: theme.glassBorder,
                    overflow: "hidden",
                  }}
                >
                  {active ? (
                    <LinearGradient
                      colors={[theme.aurora.blue, theme.aurora.violet]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                  ) : null}
                  <Text style={{ color: "#fff", fontSize: 13, fontFamily: theme.fontFamily.semibold }}>{n}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </GlassCard>

      <GlassCard radius={18} padding={14} style={{ marginTop: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 36, height: 36, borderRadius: 10,
              alignItems: "center", justifyContent: "center",
              backgroundColor: "rgba(103,232,249,0.18)",
              borderWidth: 1,
              borderColor: "rgba(103,232,249,0.3)",
            }}
          >
            <MaterialIcons name="auto-awesome" size={18} color={theme.aurora.cyan} />
          </View>
          <Text style={{ flex: 1, color: theme.muted, fontFamily: theme.fontFamily.regular, fontSize: 12, lineHeight: 17 }}>
            {t(suggestionKey)}
          </Text>
        </View>
      </GlassCard>
    </View>
  );
}
