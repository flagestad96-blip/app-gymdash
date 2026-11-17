// components/OnboardingModal.tsx — 10 practical setup steps, every one skippable.
//
// Each step DOES something (sets language/unit/palette, saves body data,
// activates a program, enables reminders, tunes the rest timer) instead of
// just describing the app. "Hopp over" is always available: it ends the
// whole flow, and every individual step can be passed with "Neste" without
// choosing anything.

import React, { useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, Text, View, ScrollView, TextInput, KeyboardAvoidingView } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme, setPalette, getPalette, PALETTE_LIST, getPaletteColors, type Palette } from "../src/theme";
import { useI18n } from "../src/i18n";
import { useWeightUnit } from "../src/units";
import { upsertBodyMetric, setSettingAsync } from "../src/db";
import { isoDateOnly } from "../src/storage";
import { useRestTimerOptional } from "../src/restTimerContext";
import {
  requestNotificationPermissions,
  cancelAllNotificationsOfType,
  getReminderSchedule,
  saveReminderSchedule,
  applyWorkoutReminders,
} from "../src/notifications";
import {
  setActiveProgram,
  NYBEGYNNER3_PROGRAM,
  STYRKE4_PROGRAM,
  HYPERTROFI4_PROGRAM,
  HJEMME3_PROGRAM,
  PPL5_BRYSTFOKUS_PROGRAM,
} from "../src/programStore";

type StepKind =
  | "welcome"
  | "language"
  | "unit"
  | "palette"
  | "body"
  | "program"
  | "reminders"
  | "rest"
  | "howto"
  | "ready";

type Step = {
  kind: StepKind;
  titleKey: string;
  bodyKey: string;
  icon: keyof typeof MaterialIcons.glyphMap;
};

const STEPS: Step[] = [
  { kind: "welcome", titleKey: "onboarding.welcome.title", bodyKey: "onboarding.welcome.body", icon: "fitness-center" },
  { kind: "language", titleKey: "onboarding.language.title", bodyKey: "onboarding.language.body", icon: "language" },
  { kind: "unit", titleKey: "onboarding.setup.title", bodyKey: "onboarding.setup.body", icon: "tune" },
  { kind: "palette", titleKey: "onboarding.palette.title", bodyKey: "onboarding.palette.body", icon: "palette" },
  { kind: "body", titleKey: "onboarding.body.title", bodyKey: "onboarding.body.body", icon: "monitor-weight" },
  { kind: "program", titleKey: "onboarding.program.title", bodyKey: "onboarding.program.body", icon: "event-note" },
  { kind: "reminders", titleKey: "onboarding.reminders.title", bodyKey: "onboarding.reminders.body", icon: "notifications-active" },
  { kind: "rest", titleKey: "onboarding.rest.title", bodyKey: "onboarding.rest.body", icon: "timer" },
  { kind: "howto", titleKey: "onboarding.howto.title", bodyKey: "onboarding.howto.body", icon: "playlist-add-check" },
  { kind: "ready", titleKey: "onboarding.ready.title", bodyKey: "onboarding.ready.body", icon: "rocket-launch" },
];

// Built-in programs offered during onboarding, with a one-line goal each.
const PROGRAM_CHOICES = [
  { program: NYBEGYNNER3_PROGRAM, goalKey: "onboarding.program.goal.beginner" },
  { program: STYRKE4_PROGRAM, goalKey: "onboarding.program.goal.strength" },
  { program: HYPERTROFI4_PROGRAM, goalKey: "onboarding.program.goal.hypertrophy" },
  { program: HJEMME3_PROGRAM, goalKey: "onboarding.program.goal.home" },
  { program: PPL5_BRYSTFOKUS_PROGRAM, goalKey: "onboarding.program.goal.marius" },
];

const REST_PRESETS = [60, 90, 120, 150, 180];

export default function OnboardingModal({
  visible,
  onDone,
  onClose,
}: {
  visible: boolean;
  onDone: () => void;
  onClose?: () => void;
}) {
  const theme = useTheme();
  const { t, locale, setLocale } = useI18n();
  const wu = useWeightUnit();
  const { unit, setUnit } = wu;
  const rest = useRestTimerOptional();
  const [step, setStep] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;

  // Per-step state
  const [paletteChoice, setPaletteChoice] = useState<Palette>(getPalette());
  const [weightTxt, setWeightTxt] = useState("");
  const [heightTxt, setHeightTxt] = useState("");
  const [bodySaved, setBodySaved] = useState(false);
  const [programChoice, setProgramChoice] = useState<string | null>(null);
  const [remindersOn, setRemindersOn] = useState<boolean | null>(null);
  const [remindersDenied, setRemindersDenied] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setStep(0);
    setBodySaved(false);
    opacity.setValue(0);
    const anim = Animated.timing(opacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    });
    anim.start();
    return () => { anim.stop(); };
  }, [visible, opacity]);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // Save optional body data when leaving the body step.
  async function applyBodyStep() {
    const w = Number(String(weightTxt).replace(",", "."));
    const h = Number(String(heightTxt).replace(",", "."));
    try {
      if (Number.isFinite(w) && w > 0 && !bodySaved) {
        await upsertBodyMetric(isoDateOnly(), wu.toKg(w), null, null);
        setBodySaved(true);
      }
      if (Number.isFinite(h) && h > 0) {
        await setSettingAsync("height_cm", String(Math.round(h)));
      }
    } catch {}
  }

  async function chooseProgram(programId: string) {
    setProgramChoice(programId);
    try {
      await setActiveProgram("normal", programId);
      await setSettingAsync("activeDayIndex", "0");
    } catch {}
  }

  async function toggleReminders(on: boolean) {
    setRemindersDenied(false);
    if (on) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        setRemindersOn(false);
        setRemindersDenied(true);
        return;
      }
      const schedule = await getReminderSchedule();
      const scheduled = await applyWorkoutReminders(schedule);
      if (scheduled === 0) {
        setRemindersOn(false);
        setRemindersDenied(true);
        return;
      }
      await saveReminderSchedule(schedule).catch(() => {});
      setSettingAsync("reminderEnabled", "1").catch(() => {});
      setRemindersOn(true);
    } else {
      await cancelAllNotificationsOfType("workout_reminder");
      setSettingAsync("reminderEnabled", "0").catch(() => {});
      setRemindersOn(false);
    }
  }

  function goNext() {
    if (current.kind === "body") void applyBodyStep();
    if (isLast) onDone();
    else setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  const choiceStyle = (selected: boolean) => ({
    borderRadius: theme.radius.md,
    borderWidth: 2,
    borderColor: selected ? theme.accent : theme.glassBorder,
    backgroundColor: selected ? theme.accent + "18" : theme.glass,
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose ?? onDone}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: theme.modalOverlay, justifyContent: "center", padding: 18 }}>
        <Animated.View
          style={{
            opacity,
            backgroundColor: theme.modalGlass,
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: theme.glassBorder,
            padding: theme.space.lg,
            gap: theme.space.md,
            maxHeight: "85%",
            shadowColor: theme.shadow.lg.color,
            shadowOpacity: theme.shadow.lg.opacity,
            shadowRadius: theme.shadow.lg.radius,
            shadowOffset: theme.shadow.lg.offset,
          }}
        >
          <View style={{ alignItems: "center", gap: theme.space.sm }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.accent + "22",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcons name={current.icon} size={28} color={theme.accent} />
            </View>
            <Text style={{ color: theme.text, fontSize: 20, fontFamily: theme.fontFamily.semibold, textAlign: "center" }}>
              {t(current.titleKey)}
            </Text>
          </View>

          <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
            <Text style={{ color: theme.muted, textAlign: "center", lineHeight: 22, fontSize: 14 }}>
              {t(current.bodyKey)}
            </Text>

            {current.kind === "language" && (
              <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 16 }}>
                {([["nb", "Norsk"], ["en", "English"]] as const).map(([code, label]) => {
                  const selected = locale === code;
                  return (
                    <Pressable
                      key={code}
                      onPress={() => setLocale(code)}
                      style={[{ flex: 1, maxWidth: 160, paddingVertical: 14, alignItems: "center" }, choiceStyle(selected)]}
                    >
                      <Text style={{ color: selected ? theme.accent : theme.muted, fontFamily: theme.fontFamily.semibold, fontSize: 15 }}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {current.kind === "unit" && (
              <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 16 }}>
                {(["kg", "lbs"] as const).map((u) => {
                  const selected = unit === u;
                  return (
                    <Pressable
                      key={u}
                      onPress={() => setUnit(u)}
                      style={[{ flex: 1, maxWidth: 160, paddingVertical: 14, alignItems: "center" }, choiceStyle(selected)]}
                    >
                      <Text style={{ color: selected ? theme.accent : theme.muted, fontFamily: theme.fontFamily.semibold, fontSize: 15 }}>
                        {t(u === "kg" ? "onboarding.setup.kg" : "onboarding.setup.lbs")}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {current.kind === "palette" && (
              <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
                {PALETTE_LIST.map((p) => {
                  const colors = getPaletteColors(p);
                  const selected = paletteChoice === p;
                  return (
                    <Pressable
                      key={p}
                      onPress={() => { setPalette(p); setPaletteChoice(p); setSettingAsync("palette", p).catch(() => {}); }}
                      style={[{ padding: 10, alignItems: "center", gap: 6, minWidth: 72 }, choiceStyle(selected)]}
                    >
                      <View style={{ flexDirection: "row", gap: 3 }}>
                        {[colors.blue, colors.violet, colors.cyan, colors.pink].map((c, i) => (
                          <View key={i} style={{ width: 10, height: 22, borderRadius: 5, backgroundColor: c }} />
                        ))}
                      </View>
                      <Text style={{ color: selected ? theme.accent : theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                        {p}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {current.kind === "body" && (
              <View style={{ gap: 10, marginTop: 16 }}>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                      {t("onboarding.body.weight", { unit: wu.unitLabel() })}
                    </Text>
                    <TextInput
                      value={weightTxt}
                      onChangeText={setWeightTxt}
                      keyboardType="decimal-pad"
                      placeholder={unit === "kg" ? "80" : "175"}
                      placeholderTextColor={theme.muted + "66"}
                      style={{
                        color: theme.text,
                        borderWidth: 1,
                        borderColor: theme.glassBorder,
                        borderRadius: theme.radius.md,
                        backgroundColor: theme.glass,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        fontFamily: theme.mono,
                      }}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                      {t("onboarding.body.height")}
                    </Text>
                    <TextInput
                      value={heightTxt}
                      onChangeText={setHeightTxt}
                      keyboardType="number-pad"
                      placeholder="180"
                      placeholderTextColor={theme.muted + "66"}
                      style={{
                        color: theme.text,
                        borderWidth: 1,
                        borderColor: theme.glassBorder,
                        borderRadius: theme.radius.md,
                        backgroundColor: theme.glass,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        fontFamily: theme.mono,
                      }}
                    />
                  </View>
                </View>
                <Text style={{ color: theme.muted, fontSize: 12, textAlign: "center" }}>
                  {t("onboarding.body.note")}
                </Text>
              </View>
            )}

            {current.kind === "program" && (
              <View style={{ gap: 8, marginTop: 16 }}>
                {PROGRAM_CHOICES.map(({ program, goalKey }) => {
                  const selected = programChoice === program.id;
                  return (
                    <Pressable
                      key={program.id}
                      onPress={() => { void chooseProgram(program.id); }}
                      style={[{ padding: 12, gap: 2 }, choiceStyle(selected)]}
                    >
                      <Text style={{ color: selected ? theme.accent : theme.text, fontFamily: theme.fontFamily.semibold, fontSize: 14 }}>
                        {program.name}
                      </Text>
                      <Text style={{ color: theme.muted, fontSize: 12 }}>
                        {t(goalKey)} · {t("onboarding.program.days", { n: program.days.length })}
                      </Text>
                    </Pressable>
                  );
                })}
                <Text style={{ color: theme.muted, fontSize: 12, textAlign: "center", marginTop: 4 }}>
                  {t("onboarding.program.note")}
                </Text>
              </View>
            )}

            {current.kind === "reminders" && (
              <View style={{ gap: 10, marginTop: 16 }}>
                <View style={{ flexDirection: "row", justifyContent: "center", gap: 12 }}>
                  {([true, false] as const).map((on) => {
                    const selected = remindersOn === on;
                    return (
                      <Pressable
                        key={String(on)}
                        onPress={() => { void toggleReminders(on); }}
                        style={[{ flex: 1, maxWidth: 160, paddingVertical: 14, alignItems: "center" }, choiceStyle(selected)]}
                      >
                        <Text style={{ color: selected ? theme.accent : theme.muted, fontFamily: theme.fontFamily.semibold, fontSize: 15 }}>
                          {t(on ? "onboarding.reminders.on" : "onboarding.reminders.off")}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {remindersOn === true ? (
                  <Text style={{ color: theme.muted, fontSize: 12, textAlign: "center" }}>
                    {t("onboarding.reminders.enabled")}
                  </Text>
                ) : null}
                {remindersDenied ? (
                  <Text style={{ color: theme.warn, fontSize: 12, textAlign: "center" }}>
                    {t("onboarding.reminders.denied")}
                  </Text>
                ) : null}
              </View>
            )}

            {current.kind === "rest" && (
              <View style={{ gap: 12, marginTop: 16 }}>
                <View style={{ flexDirection: "row", justifyContent: "center", gap: 12 }}>
                  {([true, false] as const).map((on) => {
                    const selected = (rest?.restEnabled ?? true) === on;
                    return (
                      <Pressable
                        key={String(on)}
                        onPress={() => {
                          if (rest) rest.setRestEnabled(on);
                          else setSettingAsync("restEnabled", on ? "1" : "0").catch(() => {});
                        }}
                        style={[{ flex: 1, maxWidth: 160, paddingVertical: 14, alignItems: "center" }, choiceStyle(selected)]}
                      >
                        <Text style={{ color: selected ? theme.accent : theme.muted, fontFamily: theme.fontFamily.semibold, fontSize: 15 }}>
                          {t(on ? "onboarding.rest.on" : "onboarding.rest.off")}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {(rest?.restEnabled ?? true) ? (
                  <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                    {REST_PRESETS.map((sec) => {
                      const selected = (rest?.restSeconds ?? 120) === sec;
                      return (
                        <Pressable
                          key={sec}
                          onPress={() => {
                            if (rest) rest.setRestSeconds(sec);
                            else setSettingAsync("restSeconds", String(sec)).catch(() => {});
                          }}
                          style={[{ paddingVertical: 8, paddingHorizontal: 14, alignItems: "center" }, choiceStyle(selected)]}
                        >
                          <Text style={{ color: selected ? theme.accent : theme.muted, fontFamily: theme.mono, fontSize: 13 }}>
                            {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, "0")}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
                <Text style={{ color: theme.muted, fontSize: 12, textAlign: "center" }}>
                  {t("onboarding.rest.note")}
                </Text>
              </View>
            )}

            {current.kind === "howto" && (
              <View style={{ gap: 10, marginTop: 16 }}>
                {[
                  { icon: "play-arrow" as const, key: "onboarding.howto.step1" },
                  { icon: "edit" as const, key: "onboarding.howto.step2" },
                  { icon: "timer" as const, key: "onboarding.howto.step3" },
                  { icon: "emoji-events" as const, key: "onboarding.howto.step4" },
                ].map(({ icon, key }) => (
                  <View key={key} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: theme.radius.pill,
                        backgroundColor: theme.accent + "18",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MaterialIcons name={icon} size={18} color={theme.accent} />
                    </View>
                    <Text style={{ color: theme.text, fontSize: 13, flex: 1, lineHeight: 19 }}>{t(key)}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Step counter */}
          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11, textAlign: "center" }}>
            {step + 1} / {STEPS.length}
          </Text>

          {/* Navigation */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Pressable
              onPress={() => setStep((s) => Math.max(0, s - 1))}
              style={({ pressed }) => ({
                opacity: step === 0 ? 0.3 : pressed ? 0.75 : 1,
                paddingVertical: 8,
                paddingHorizontal: 12,
              })}
              disabled={step === 0}
            >
              <Text style={{ color: theme.muted, fontFamily: theme.mono }}>{t("onboarding.back")}</Text>
            </Pressable>

            {!isLast ? (
              <Pressable
                onPress={() => { (onClose ?? onDone)(); }}
                style={{ paddingVertical: 8, paddingHorizontal: 12 }}
              >
                <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>{t("onboarding.skip")}</Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={goNext}
              style={{
                backgroundColor: isLast ? theme.accent : theme.glass,
                borderColor: isLast ? theme.accent : theme.glassBorder,
                borderWidth: 1,
                borderRadius: theme.radius.md,
                paddingVertical: 8,
                paddingHorizontal: 16,
              }}
            >
              <Text style={{ color: isLast ? "#FFFFFF" : theme.accent, fontFamily: theme.mono }}>
                {isLast ? t("onboarding.start") : t("onboarding.next")}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
