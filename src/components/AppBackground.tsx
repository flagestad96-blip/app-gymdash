// src/components/AppBackground.tsx
// Blurred abstract background matching the purple/orange glassmorphism theme

import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

function BlurredOrb({
  size,
  color,
  top,
  left,
  opacity = 0.5,
}: {
  size: number;
  color: string;
  top: number;
  left: number;
  opacity?: number;
}) {
  return (
    <View
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        top,
        left,
        opacity,
      }}
    />
  );
}

export function AppBackground() {
  const theme = useTheme();

  if (theme.isDark) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Base gradient - deep purple to near-black */}
        <LinearGradient
          colors={["#1A0533", "#0D0B1A", "#0A0618", "#120825"]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Large purple orb - top left */}
        <BlurredOrb
          size={SCREEN_W * 1.2}
          color="#5B21B6"
          top={-SCREEN_W * 0.4}
          left={-SCREEN_W * 0.5}
          opacity={0.25}
        />

        {/* Orange orb - center right */}
        <BlurredOrb
          size={SCREEN_W * 0.9}
          color="#F97316"
          top={SCREEN_H * 0.2}
          left={SCREEN_W * 0.3}
          opacity={0.14}
        />

        {/* Purple orb - center */}
        <BlurredOrb
          size={SCREEN_W * 0.7}
          color="#7C3AED"
          top={SCREEN_H * 0.15}
          left={-SCREEN_W * 0.1}
          opacity={0.18}
        />

        {/* Pink orb - bottom */}
        <BlurredOrb
          size={SCREEN_W * 0.8}
          color="#DB2777"
          top={SCREEN_H * 0.55}
          left={SCREEN_W * 0.1}
          opacity={0.10}
        />

        {/* Small accent orb - top right */}
        <BlurredOrb
          size={SCREEN_W * 0.4}
          color="#F59E0B"
          top={SCREEN_H * 0.05}
          left={SCREEN_W * 0.65}
          opacity={0.12}
        />

        {/* Bottom gradient fade */}
        <LinearGradient
          colors={["transparent", "rgba(13, 11, 26, 0.6)"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[StyleSheet.absoluteFill, { top: SCREEN_H * 0.6 }]}
        />
      </View>
    );
  }

  // Light mode
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Base gradient - warm light purple */}
      <LinearGradient
        colors={["#F3E8FF", "#F8F5FF", "#FFF7ED", "#F5F0FF"]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Purple orb - top left */}
      <BlurredOrb
        size={SCREEN_W * 1.1}
        color="#C4B5FD"
        top={-SCREEN_W * 0.35}
        left={-SCREEN_W * 0.45}
        opacity={0.40}
      />

      {/* Orange orb - center right */}
      <BlurredOrb
        size={SCREEN_W * 0.8}
        color="#FDBA74"
        top={SCREEN_H * 0.2}
        left={SCREEN_W * 0.35}
        opacity={0.25}
      />

      {/* Purple orb - center */}
      <BlurredOrb
        size={SCREEN_W * 0.6}
        color="#A78BFA"
        top={SCREEN_H * 0.15}
        left={-SCREEN_W * 0.05}
        opacity={0.22}
      />

      {/* Pink orb - bottom */}
      <BlurredOrb
        size={SCREEN_W * 0.7}
        color="#F9A8D4"
        top={SCREEN_H * 0.5}
        left={SCREEN_W * 0.15}
        opacity={0.18}
      />

      {/* Bottom fade */}
      <LinearGradient
        colors={["transparent", "rgba(248, 245, 255, 0.5)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[StyleSheet.absoluteFill, { top: SCREEN_H * 0.65 }]}
      />
    </View>
  );
}
