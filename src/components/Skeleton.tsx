// src/components/Skeleton.tsx — Skeleton loading placeholders
import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { useTheme } from "../theme";

/**
 * Animated skeleton box that pulses to indicate loading
 */
export function SkeletonBox({
  width,
  height = 16,
  borderRadius = 8,
  style,
}: {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
}) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width ?? "100%",
          height,
          borderRadius,
          backgroundColor: theme.isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
          opacity,
        },
        style,
      ]}
    />
  );
}

/**
 * Skeleton card matching the Card component styling
 */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.glass,
        borderColor: theme.glassBorder,
        borderWidth: 1,
        borderRadius: theme.radius.xl,
        padding: theme.space.lg,
        gap: theme.space.md,
      }}
    >
      {/* Title skeleton */}
      <SkeletonBox width={120} height={12} />

      {/* Content lines */}
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox
          key={i}
          width={i === lines - 1 ? "60%" : "100%"}
          height={16}
        />
      ))}
    </View>
  );
}

/**
 * Skeleton for exercise card (used in log tab)
 */
export function SkeletonExerciseCard() {
  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.glass,
        borderColor: theme.glassBorder,
        borderWidth: 1,
        borderRadius: theme.radius.xl,
        padding: theme.space.lg,
        gap: theme.space.md,
      }}
    >
      {/* Exercise name */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <SkeletonBox width={150} height={20} />
        <SkeletonBox width={60} height={24} borderRadius={12} />
      </View>

      {/* Input row */}
      <View style={{ flexDirection: "row", gap: theme.space.sm }}>
        <SkeletonBox width={80} height={44} borderRadius={12} />
        <SkeletonBox width={60} height={44} borderRadius={12} />
        <SkeletonBox width={50} height={44} borderRadius={12} />
        <SkeletonBox width={44} height={44} borderRadius={12} />
      </View>

      {/* Set rows */}
      <View style={{ gap: theme.space.xs }}>
        <SkeletonBox height={36} borderRadius={8} />
        <SkeletonBox height={36} borderRadius={8} />
      </View>
    </View>
  );
}

/**
 * Skeleton for program day card
 */
export function SkeletonProgramCard() {
  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.glass,
        borderColor: theme.glassBorder,
        borderWidth: 1,
        borderRadius: theme.radius.xl,
        padding: theme.space.lg,
        gap: theme.space.sm,
      }}
    >
      {/* Day header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <SkeletonBox width={100} height={18} />
        <SkeletonBox width={40} height={24} borderRadius={12} />
      </View>

      {/* Exercise list */}
      <View style={{ gap: theme.space.xs }}>
        <SkeletonBox height={24} />
        <SkeletonBox height={24} />
        <SkeletonBox height={24} width="80%" />
      </View>
    </View>
  );
}

export default SkeletonCard;
