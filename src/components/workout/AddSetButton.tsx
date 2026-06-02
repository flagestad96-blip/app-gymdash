// src/components/workout/AddSetButton.tsx — gradient "add set" button with press animation.
import React, { useRef } from "react";
import { Text, Pressable, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../theme";

export default function AddSetButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => Promise<void> | void;
}) {
  const t = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const runPressAnim = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.96, duration: 90, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <Pressable
        onPress={async () => {
          runPressAnim();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          try {
            await onPress();
          } catch {}
        }}
        style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
      >
        <LinearGradient
          colors={t.accentGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            height: 52,
            borderRadius: t.radius.lg,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: t.shadow.glow.color,
            shadowOpacity: t.shadow.glow.opacity,
            shadowRadius: t.shadow.glow.radius,
            shadowOffset: t.shadow.glow.offset,
            elevation: 4,
          }}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: t.fontWeight.semibold, fontSize: t.fontSize.sm }}>{label}</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}
