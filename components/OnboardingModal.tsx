import React, { useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, Text, View, ScrollView } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../src/theme";
import { useI18n } from "../src/i18n";
import { useWeightUnit } from "../src/units";

type Slide = {
  titleKey: string;
  bodyKey: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  interactive?: "unit-picker";
};

const SLIDES: Slide[] = [
  {
    titleKey: "onboarding.welcome.title",
    bodyKey: "onboarding.welcome.body",
    icon: "fitness-center",
  },
  {
    titleKey: "onboarding.setup.title",
    bodyKey: "onboarding.setup.body",
    icon: "tune",
    interactive: "unit-picker",
  },
  {
    titleKey: "onboarding.ready.title",
    bodyKey: "onboarding.ready.body",
    icon: "rocket-launch",
  },
];

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
  const { t } = useI18n();
  const { unit, setUnit } = useWeightUnit();
  const [step, setStep] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    setStep(0);
    opacity.setValue(0);
    const anim = Animated.timing(opacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    });
    anim.start();
    return () => { anim.stop(); };
  }, [visible, opacity]);

  const current = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose ?? onDone}>
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
            maxHeight: "80%",
            shadowColor: theme.shadow.lg.color,
            shadowOpacity: theme.shadow.lg.opacity,
            shadowRadius: theme.shadow.lg.radius,
            shadowOffset: theme.shadow.lg.offset,
            elevation: theme.shadow.lg.elevation,
          }}
        >
          <View style={{ alignItems: "center", gap: theme.space.sm }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.accent + "22",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcons name={current.icon} size={32} color={theme.accent} />
            </View>
            <Text style={{ color: theme.text, fontSize: 20, fontFamily: theme.fontFamily.semibold, textAlign: "center" }}>
              {t(current.titleKey)}
            </Text>
          </View>

          <ScrollView style={{ flexShrink: 1 }}>
            <Text style={{ color: theme.muted, textAlign: "center", lineHeight: 22, fontSize: 14 }}>
              {t(current.bodyKey)}
            </Text>

            {/* Interactive unit picker on slide 2 */}
            {current.interactive === "unit-picker" && (
              <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 16 }}>
                {(["kg", "lbs"] as const).map((u) => {
                  const selected = unit === u;
                  return (
                    <Pressable
                      key={u}
                      onPress={() => setUnit(u)}
                      style={{
                        flex: 1,
                        maxWidth: 160,
                        paddingVertical: 14,
                        borderRadius: theme.radius.md,
                        borderWidth: 2,
                        borderColor: selected ? theme.accent : theme.glassBorder,
                        backgroundColor: selected ? theme.accent + "18" : theme.glass,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: selected ? theme.accent : theme.muted,
                          fontFamily: theme.fontFamily.semibold,
                          fontSize: 15,
                        }}
                      >
                        {t(u === "kg" ? "onboarding.setup.kg" : "onboarding.setup.lbs")}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </ScrollView>

          {/* Step counter */}
          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11, textAlign: "center" }}>
            {step + 1} / {SLIDES.length}
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
              onPress={() => {
                if (isLast) onDone();
                else setStep((s) => Math.min(SLIDES.length - 1, s + 1));
              }}
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
    </Modal>
  );
}
