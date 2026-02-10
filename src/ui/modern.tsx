// src/ui/modern.tsx
// Modern UI components with glassmorphism, gradients, and animations

import React, { useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Animated,
  Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../theme";

/**
 * GradientButton - Modern button with gradient background and animations
 */
type GradientButtonProps = {
  text: string;
  onPress: () => void;
  variant?: "accent" | "success" | "danger";
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
  haptic?: boolean;
  style?: ViewStyle;
};

export function GradientButton({
  text,
  onPress,
  variant = "accent",
  loading = false,
  disabled = false,
  icon,
  haptic = true,
  style,
}: GradientButtonProps) {
  const theme = useTheme();
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const gradientColors = {
    accent: theme.accentGradient,
    success: theme.successGradient,
    danger: theme.dangerGradient,
  }[variant];

  const handlePressIn = () => {
    if (disabled || loading) return;
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      damping: theme.animation.spring.damping,
      stiffness: theme.animation.spring.stiffness,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled || loading) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      damping: theme.animation.spring.damping,
      stiffness: theme.animation.spring.stiffness,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    if (disabled || loading) return;
    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onPress();
  };

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled || loading}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.gradientButton,
            disabled && styles.gradientButtonDisabled,
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View style={styles.gradientButtonContent}>
              {icon && (
                <MaterialIcons
                  name={icon}
                  size={20}
                  color="#FFFFFF"
                  style={{ marginRight: 8 }}
                />
              )}
              <Text style={styles.gradientButtonText}>{text}</Text>
            </View>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

/**
 * GlassCard - Semi-transparent card with blur effect and optional gradient overlay
 */
type GlassCardProps = {
  children: React.ReactNode;
  blur?: boolean;
  gradient?: boolean;
  shadow?: "sm" | "md" | "lg";
  style?: ViewStyle;
  gradientColors?: string[];
};

export function GlassCard({
  children,
  blur = true,
  gradient = false,
  shadow = "md",
  style,
  gradientColors,
}: GlassCardProps) {
  const theme = useTheme();

  const shadowStyle = {
    shadowColor: theme.shadow[shadow].color,
    shadowOpacity: theme.shadow[shadow].opacity,
    shadowRadius: theme.shadow[shadow].radius,
    shadowOffset: theme.shadow[shadow].offset,
  };

  const defaultGradientColors = gradient
    ? theme.isDark
      ? ["rgba(90, 40, 160, 0.18)", "transparent", "rgba(249, 115, 22, 0.08)"]
      : ["rgba(124, 58, 237, 0.10)", "transparent", "rgba(249, 115, 22, 0.06)"]
    : undefined;

  const colors = gradientColors || defaultGradientColors;

  return (
    <View
      style={[
        styles.glassCard,
        {
          backgroundColor: blur ? theme.glass : theme.panel,
          borderColor: gradient ? theme.accentGradient[0] + "40" : theme.glassBorder,
          borderRadius: theme.radius.xl,
          overflow: "hidden",
        },
        shadowStyle,
        style,
      ]}
    >
      {colors && (
        <LinearGradient
          colors={colors as [string, string, ...string[]]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {children}
    </View>
  );
}

/**
 * ProgressRing - Circular progress indicator with animation
 */
type ProgressRingProps = {
  progress: number; // 0 to 1
  size?: number;
  strokeWidth?: number;
  color?: "accent" | "success" | "danger";
  showPercentage?: boolean;
  animated?: boolean;
};

export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 8,
  color = "accent",
  showPercentage = true,
  animated = true,
}: ProgressRingProps) {
  const theme = useTheme();
  const animatedProgress = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      Animated.timing(animatedProgress, {
        toValue: progress,
        duration: theme.animation.slow,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    } else {
      animatedProgress.setValue(progress);
    }
  }, [progress, animated, animatedProgress, theme.animation.slow]);

  const colorValue = {
    accent: theme.accent,
    success: theme.success,
    danger: theme.danger,
  }[color];

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  return (
    <View style={[styles.progressRing, { width: size, height: size }]}>
      {/* Background circle */}
      <View
        style={[
          styles.progressRingBackground,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: theme.line,
          },
        ]}
      />
      {/* Progress indicator - simplified for now, would use SVG in production */}
      {showPercentage && (
        <View style={styles.progressRingCenter}>
          <Text style={[styles.progressRingText, { color: theme.text }]}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * StatPill - Compact stat display with optional gradient for PRs
 */
type StatPillProps = {
  label: string;
  value: string;
  rpe?: number;
  isPR?: boolean;
  compact?: boolean;
  style?: ViewStyle;
};

export function StatPill({
  label,
  value,
  rpe,
  isPR = false,
  compact = false,
  style,
}: StatPillProps) {
  const theme = useTheme();
  const scaleAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      damping: theme.animation.spring.damping,
      stiffness: theme.animation.spring.stiffness,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim, theme.animation.spring]);

  const content = (
    <View
      style={[
        styles.statPill,
        compact && styles.statPillCompact,
        !isPR && { backgroundColor: theme.panel2, borderColor: theme.line },
        style,
      ]}
    >
      <Text
        style={[
          styles.statPillLabel,
          { color: isPR ? "#FFFFFF" : theme.muted, fontFamily: theme.mono },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.statPillValue,
          { color: isPR ? "#FFFFFF" : theme.text },
        ]}
      >
        {value}
      </Text>
      {rpe !== undefined && (
        <Text
          style={[
            styles.statPillRpe,
            { color: isPR ? "#FFFFFF" : theme.muted, fontFamily: theme.mono },
          ]}
        >
          RPE {rpe}
        </Text>
      )}
    </View>
  );

  if (isPR) {
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <LinearGradient
          colors={theme.successGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.statPill, compact && styles.statPillCompact, style]}
        >
          <Text style={[styles.statPillLabel, { color: "#FFFFFF", fontFamily: theme.mono }]}>
            {label}
          </Text>
          <Text style={[styles.statPillValue, { color: "#FFFFFF" }]}>{value}</Text>
          {rpe !== undefined && (
            <Text style={[styles.statPillRpe, { color: "#FFFFFF", fontFamily: theme.mono }]}>
              RPE {rpe}
            </Text>
          )}
        </LinearGradient>
      </Animated.View>
    );
  }

  return <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>{content}</Animated.View>;
}

/**
 * AnimatedNumber - Smooth counting animation for numbers
 */
type AnimatedNumberProps = {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  style?: TextStyle;
};

export function AnimatedNumber({
  value,
  decimals = 0,
  suffix = "",
  prefix = "",
  duration = 500,
  style,
}: AnimatedNumberProps) {
  const animatedValue = React.useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = React.useState(value);

  useEffect(() => {
    const listener = animatedValue.addListener(({ value: v }) => {
      setDisplayValue(v);
    });

    Animated.timing(animatedValue, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    return () => {
      animatedValue.removeListener(listener);
    };
  }, [value, duration, animatedValue]);

  return (
    <Text style={style}>
      {prefix}
      {displayValue.toFixed(decimals)}
      {suffix}
    </Text>
  );
}

/**
 * SkeletonLoader - Shimmer loading animation
 */
type SkeletonLoaderProps = {
  width?: ViewStyle["width"];
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
};

export function SkeletonLoader({
  width = 200,
  height = 40,
  borderRadius = 12,
  style,
}: SkeletonLoaderProps) {
  const theme = useTheme();
  const shimmerAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          opacity,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.skeleton,
          {
            width,
            height,
            borderRadius,
            backgroundColor: theme.panel2,
          },
        ]}
      />
    </Animated.View>
  );
}

/**
 * AchievementToast - Toast notification for achievement unlocks
 */
type AchievementToastProps = {
  visible: boolean;
  achievementName: string;
  achievementIcon: string;
  points: number;
  tier: "common" | "rare" | "epic" | "legendary";
  onDismiss: () => void;
  onTap?: () => void;
};

export function AchievementToast({
  visible,
  achievementName,
  achievementIcon,
  points,
  tier,
  onDismiss,
  onTap,
}: AchievementToastProps) {
  const theme = useTheme();
  const translateY = React.useRef(new Animated.Value(-200)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;
  const onDismissRef = React.useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const tierColors = {
    common: theme.muted,
    rare: theme.accent,
    epic: "#9C27B0",
    legendary: "#FFD700",
  };

  useEffect(() => {
    if (visible) {
      // Slide in
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: theme.animation.spring.damping,
          stiffness: theme.animation.spring.stiffness,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: theme.animation.normal,
          useNativeDriver: true,
        }),
      ]).start();

      // Haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Auto dismiss after 4 seconds
      const timeout = setTimeout(() => {
        Animated.parallel([
          Animated.spring(translateY, {
            toValue: -200,
            damping: theme.animation.spring.damping,
            stiffness: theme.animation.spring.stiffness,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: theme.animation.normal,
            useNativeDriver: true,
          }),
        ]).start(() => onDismissRef.current());
      }, 4000);

      return () => clearTimeout(timeout);
    }
  }, [visible, translateY, opacity, theme.animation]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Pressable onPress={() => { onDismiss(); onTap?.(); }}>
        <LinearGradient
          colors={tier === "legendary" ? ["#FFD700", "#FFA500"] : theme.successGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.toastContent}
        >
          <View style={styles.toastIconContainer}>
            <MaterialIcons name={achievementIcon as any} size={32} color="#FFFFFF" />
          </View>
          <View style={styles.toastTextContainer}>
            <Text style={styles.toastTitle}>🏆 Prestasjon låst opp!</Text>
            <Text style={styles.toastName}>{achievementName}</Text>
            <Text style={styles.toastPoints}>+{points} poeng</Text>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

type UndoToastProps = {
  visible: boolean;
  message: string;
  undoLabel: string;
  onUndo: () => void;
  onDismiss: () => void;
};

export function UndoToast({ visible, message, undoLabel, onUndo, onDismiss }: UndoToastProps) {
  const theme = useTheme();
  const translateY = React.useRef(new Animated.Value(100)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: theme.animation.spring.damping,
          stiffness: theme.animation.spring.stiffness,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: theme.animation.fast,
          useNativeDriver: true,
        }),
      ]).start();

      const timeout = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: 100,
            duration: theme.animation.normal,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: theme.animation.normal,
            useNativeDriver: true,
          }),
        ]).start(() => onDismiss());
      }, 5000);

      return () => clearTimeout(timeout);
    } else {
      translateY.setValue(100);
      opacity.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        position: "absolute",
        bottom: 40,
        left: 16,
        right: 16,
        zIndex: 9999,
        transform: [{ translateY }],
        opacity,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: theme.modalGlass,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: theme.glassBorder,
          paddingVertical: 12,
          paddingHorizontal: 16,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
        }}
      >
        <Text style={{ color: theme.text, fontFamily: "Manrope_500Medium", fontSize: 14, flex: 1 }}>
          {message}
        </Text>
        <Pressable
          onPress={onUndo}
          style={{
            paddingVertical: 6,
            paddingHorizontal: 14,
            borderRadius: 8,
            backgroundColor: theme.accent,
            marginLeft: 12,
          }}
        >
          <Text style={{ color: "#FFFFFF", fontFamily: "Manrope_600SemiBold", fontSize: 13 }}>
            {undoLabel}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  gradientButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  gradientButtonDisabled: {
    opacity: 0.5,
  },
  gradientButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  gradientButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Manrope_600SemiBold",
  },
  glassCard: {
    borderWidth: 1,
    padding: 18,
  },
  progressRing: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  progressRingBackground: {
    position: "absolute",
  },
  progressRingCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  progressRingText: {
    fontSize: 24,
    fontWeight: "600",
  },
  statPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statPillCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statPillLabel: {
    fontSize: 11,
  },
  statPillValue: {
    fontSize: 15,
    fontWeight: "600",
  },
  statPillRpe: {
    fontSize: 11,
  },
  skeleton: {
    overflow: "hidden",
  },
  toastContainer: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  toastContent: {
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  toastTextContainer: {
    flex: 1,
    gap: 2,
  },
  toastTitle: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    opacity: 0.9,
  },
  toastName: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  toastPoints: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    opacity: 0.9,
  },
});
