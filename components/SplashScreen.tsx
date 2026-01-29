import React, { useEffect, useRef } from "react";
import { Animated, View, Text } from "react-native";
import { theme } from "../src/theme";
import GymdashLogo from "../src/components/GymdashLogo";

export default function SplashScreen({
  label = "Gymdash",
  subtitle = "Laster...",
  fadeOut = false,
  onFadeOutEnd,
}: {
  label?: string;
  subtitle?: string;
  fadeOut?: boolean;
  onFadeOutEnd?: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  useEffect(() => {
    if (!fadeOut) return;
    Animated.timing(opacity, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onFadeOutEnd?.();
    });
  }, [fadeOut, opacity, onFadeOutEnd]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View style={{ opacity, alignItems: "center", gap: 12 }}>
        <GymdashLogo size={72} variant="mark" />
        <Text
          style={{
            color: theme.text,
            fontSize: theme.fontSize.xl,
            fontWeight: theme.fontWeight.semibold,
          }}
        >
          {label}
        </Text>
        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>
          {subtitle}
        </Text>
      </Animated.View>
    </View>
  );
}
