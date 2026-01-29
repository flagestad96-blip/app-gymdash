import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, Pressable, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { theme } from "../src/theme";

type Slide = {
  title: string;
  body: string;
  icon: keyof typeof MaterialIcons.glyphMap;
};

export default function OnboardingModal({
  visible,
  onDone,
  onClose,
}: {
  visible: boolean;
  onDone: () => void;
  onClose?: () => void;
}) {
  const slides = useMemo<Slide[]>(
    () => [
    {
      title: "Lag program",
      body: "Start i Program. Velg dager, øvelser og mål (sett × reps) før første økt.",
      icon: "event-available",
    },
    {
      title: "Logg økten",
      body: "Trykk Start økt. Legg inn kg + reps, og bruk forslag når de dukker opp.",
      icon: "fitness-center",
    },
    {
      title: "Kropp & kroppsvekt",
      body: "Legg inn vekt i Kropp-fanen. Bodyweight-øvelser bruker dette automatisk.",
      icon: "monitor-weight",
    },
    {
      title: "Analyse + Kalender",
      body: "Følg progresjon over tid. Kalenderen markerer treningsdager.",
      icon: "insights",
    },
    {
      title: "Backup & deling",
      body: "I Settings kan du ta backup, eksportere CSV og dele programmer.",
      icon: "cloud-upload",
    },
  ],
    []
  );

  const [step, setStep] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    setStep(0);
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  const current = slides[step];
  const isLast = step === slides.length - 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose ?? onDone}>
      <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "center", padding: 18 }}>
        <Animated.View
          style={{
            opacity,
            backgroundColor: theme.panel,
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: theme.line,
            padding: theme.space.lg,
            gap: theme.space.md,
            shadowColor: theme.shadow.md.color,
            shadowOpacity: theme.shadow.md.opacity,
            shadowRadius: theme.shadow.md.radius,
            shadowOffset: theme.shadow.md.offset,
            elevation: theme.shadow.md.elevation,
          }}
        >
          <View style={{ alignItems: "center", gap: theme.space.sm }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: theme.radius.pill,
                backgroundColor: "#E0E7FF",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcons name={current.icon} size={28} color={theme.accent} />
            </View>
            <Text style={{ color: theme.text, fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold }}>
              {current.title}
            </Text>
            <Text style={{ color: theme.muted, textAlign: "center", lineHeight: theme.lineHeight.md }}>
              {current.body}
            </Text>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Pressable
              onPress={() => setStep((s) => Math.max(0, s - 1))}
              style={({ pressed }) => ({
                opacity: step === 0 ? 0 : pressed ? 0.75 : 1,
                pointerEvents: step === 0 ? "none" : "auto",
              })}
            >
              <Text style={{ color: theme.muted, fontFamily: theme.mono }}>Tilbake</Text>
            </Pressable>

            <View style={{ flexDirection: "row", gap: 6 }}>
              {slides.map((_, i) => (
                <View
                  key={`dot_${i}`}
                  style={{
                    width: i === step ? 18 : 8,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: i === step ? theme.accent : theme.line,
                  }}
                />
              ))}
            </View>

            <Pressable
              onPress={() => {
                if (isLast) onDone();
                else setStep((s) => Math.min(slides.length - 1, s + 1));
              }}
            >
              <Text style={{ color: theme.accent, fontFamily: theme.mono }}>
                {isLast ? "Kom i gang" : "Neste"}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}


