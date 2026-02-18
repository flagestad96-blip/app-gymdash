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
  const t = useTheme();
  const scale = React.useRef(new Animated.Value(1)).current;

  const colors = { accent: t.accentGradient, success: t.successGradient, danger: t.dangerGradient }[variant];
  const txt = variant === "accent" && t.isDark ? "#111111" : "#FFFFFF";

  const pressIn = () => {
    if (disabled || loading) return;
    Animated.spring(scale, { toValue: 0.94, damping: t.animation.spring.damping, stiffness: t.animation.spring.stiffness, useNativeDriver: true }).start();
  };
  const pressOut = () => {
    if (disabled || loading) return;
    Animated.spring(scale, { toValue: 1, damping: t.animation.spring.damping, stiffness: t.animation.spring.stiffness, useNativeDriver: true }).start();
  };
  const press = () => {
    if (disabled || loading) return;
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable onPressIn={pressIn} onPressOut={pressOut} onPress={press} disabled={disabled || loading}>
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            { paddingHorizontal: 28, paddingVertical: 16, borderRadius: t.radius.lg, alignItems: "center", justifyContent: "center", minHeight: 56 },
            disabled && { opacity: 0.35 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={txt} />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
              {icon && <MaterialIcons name={icon} size={20} color={txt} style={{ marginRight: 8 }} />}
              <Text style={{ color: txt, fontSize: 16, fontFamily: t.fontFamily.bold, letterSpacing: 1, textTransform: "uppercase" }}>{text}</Text>
            </View>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

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
  gradient = false,
  shadow = "md",
  style,
  gradientColors,
}: GlassCardProps) {
  const t = useTheme();
  const sh = t.shadow[shadow];
  const bar = gradientColors || (gradient ? (t.accentGradient as string[]) : undefined);

  return (
    <View
      style={[
        {
          backgroundColor: t.panel,
          borderRadius: t.radius.xl,
          overflow: "hidden",
          padding: t.space.lg,
          shadowColor: sh.color,
          shadowOpacity: sh.opacity,
          shadowRadius: sh.radius,
          shadowOffset: sh.offset,
          elevation: sh.elevation,
        },
        style,
      ]}
    >
      {bar && (
        <LinearGradient
          colors={bar as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3 }}
        />
      )}
      {children}
    </View>
  );
}

type ProgressRingProps = {
  progress: number;
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
  showPercentage = true,
  animated = true,
}: ProgressRingProps) {
  const t = useTheme();
  const anim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      Animated.timing(anim, { toValue: progress, duration: t.animation.slow, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    } else {
      anim.setValue(progress);
    }
  }, [progress, animated, anim, t.animation.slow]);

  return (
    <View style={{ width: size, height: size, position: "relative", alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: t.line,
        }}
      />
      {showPercentage && (
        <Text style={{ color: t.text, fontSize: 24, fontFamily: t.fontFamily.bold }}>
          {Math.round(progress * 100)}%
        </Text>
      )}
    </View>
  );
}

type StatPillProps = {
  label: string;
  value: string;
  rpe?: number;
  isPR?: boolean;
  compact?: boolean;
  style?: ViewStyle;
};

export function StatPill({ label, value, rpe, isPR = false, compact = false, style }: StatPillProps) {
  const t = useTheme();
  const scaleAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, damping: t.animation.spring.damping, stiffness: t.animation.spring.stiffness, useNativeDriver: true }).start();
  }, [scaleAnim, t.animation.spring]);

  const vert = !compact;

  const inner = (color: string, mutedColor: string) => (
    <>
      {vert ? (
        <>
          <Text style={{ color, fontSize: t.fontSize.lg, fontFamily: t.fontFamily.bold }}>{value}</Text>
          <Text style={{ color: mutedColor, fontSize: t.fontSize.xs, fontFamily: t.fontFamily.medium, letterSpacing: 1, textTransform: "uppercase" }}>{label}</Text>
          {rpe !== undefined && <Text style={{ color: mutedColor, fontSize: t.fontSize.xs, fontFamily: t.fontFamily.medium }}>RPE {rpe}</Text>}
        </>
      ) : (
        <>
          <Text style={{ color: mutedColor, fontSize: t.fontSize.xs, fontFamily: t.fontFamily.medium }}>{label}</Text>
          <Text style={{ color, fontSize: t.fontSize.md, fontFamily: t.fontFamily.bold }}>{value}</Text>
          {rpe !== undefined && <Text style={{ color: mutedColor, fontSize: t.fontSize.xs, fontFamily: t.fontFamily.medium }}>RPE {rpe}</Text>}
        </>
      )}
    </>
  );

  const container: ViewStyle = {
    flexDirection: vert ? "column" : "row",
    alignItems: vert ? "flex-start" : "center",
    gap: vert ? 2 : 8,
    paddingVertical: vert ? 12 : 6,
    paddingHorizontal: vert ? 14 : 10,
    borderRadius: 0,
  };

  if (isPR) {
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <LinearGradient colors={t.successGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[container, style]}>
          {inner("#FFFFFF", "rgba(255,255,255,0.8)")}
        </LinearGradient>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <View
        style={[
          container,
          { borderLeftWidth: 3, borderLeftColor: t.line, backgroundColor: t.panel2 },
          style,
        ]}
      >
        {inner(t.text, t.muted)}
      </View>
    </Animated.View>
  );
}

type AnimatedNumberProps = {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  style?: TextStyle;
};

export function AnimatedNumber({ value, decimals = 0, suffix = "", prefix = "", duration = 500, style }: AnimatedNumberProps) {
  const av = React.useRef(new Animated.Value(0)).current;
  const [dv, setDv] = React.useState(value);

  useEffect(() => {
    const id = av.addListener(({ value: v }) => setDv(v));
    Animated.timing(av, { toValue: value, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => av.removeListener(id);
  }, [value, duration, av]);

  return <Text style={style}>{prefix}{dv.toFixed(decimals)}{suffix}</Text>;
}

type SkeletonLoaderProps = { width?: ViewStyle["width"]; height?: number; borderRadius?: number; style?: ViewStyle };

export function SkeletonLoader({ width = 200, height = 40, borderRadius = 4, style }: SkeletonLoaderProps) {
  const t = useTheme();
  const shimmer = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
      ]),
    );
    a.start();
    return () => a.stop();
  }, [shimmer]);

  return (
    <Animated.View style={[{ opacity: shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] }) }, style]}>
      <View style={{ width, height, borderRadius, backgroundColor: t.panel2 }} />
    </Animated.View>
  );
}

type AchievementToastProps = {
  visible: boolean;
  achievementName: string;
  achievementIcon: string;
  points: number;
  tier: "common" | "rare" | "epic" | "legendary";
  onDismiss: () => void;
  onTap?: () => void;
};

export function AchievementToast({ visible, achievementName, achievementIcon, points, tier, onDismiss, onTap }: AchievementToastProps) {
  const t = useTheme();
  const translateY = React.useRef(new Animated.Value(-200)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;
  const progress = React.useRef(new Animated.Value(1)).current;
  const onDismissRef = React.useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const tierColor = { common: t.muted, rare: t.accent, epic: "#A855F7", legendary: "#FFD700" }[tier];

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, damping: t.animation.spring.damping, stiffness: t.animation.spring.stiffness, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: t.animation.normal, useNativeDriver: true }),
      ]).start();

      progress.setValue(1);
      Animated.timing(progress, { toValue: 0, duration: 4000, easing: Easing.linear, useNativeDriver: true }).start();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const timeout = setTimeout(() => {
        Animated.parallel([
          Animated.spring(translateY, { toValue: -200, damping: t.animation.spring.damping, stiffness: t.animation.spring.stiffness, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: t.animation.normal, useNativeDriver: true }),
        ]).start(() => onDismissRef.current());
      }, 4000);

      return () => clearTimeout(timeout);
    }
  }, [visible, translateY, opacity, progress, t.animation]);

  if (!visible) return null;

  return (
    <Animated.View style={{ position: "absolute", top: 60, left: 16, right: 16, zIndex: 9999, transform: [{ translateY }], opacity }}>
      <Pressable onPress={() => { onDismiss(); onTap?.(); }}>
        <View
          style={{
            backgroundColor: t.panel,
            borderLeftWidth: 4,
            borderLeftColor: tierColor,
            borderRadius: 0,
            overflow: "hidden",
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Animated.View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 2,
              backgroundColor: tierColor,
              transform: [{ scaleX: progress }],
              transformOrigin: "left",
            }}
          />
          <View style={{ width: 44, height: 44, borderRadius: 0, backgroundColor: tierColor + "20", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
            <MaterialIcons name={achievementIcon as any} size={24} color={tierColor} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: tierColor, fontSize: 9, fontFamily: t.fontFamily.bold, letterSpacing: 2.5, textTransform: "uppercase" }}>
              Achievement unlocked
            </Text>
            <Text style={{ color: t.text, fontSize: t.fontSize.md, fontFamily: t.fontFamily.bold }}>{achievementName}</Text>
            <Text style={{ color: t.muted, fontSize: t.fontSize.xs, fontFamily: t.fontFamily.medium }}>+{points} pts</Text>
          </View>
        </View>
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
  const t = useTheme();
  const translateY = React.useRef(new Animated.Value(100)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;
  const progress = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, damping: t.animation.spring.damping, stiffness: t.animation.spring.stiffness, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: t.animation.fast, useNativeDriver: true }),
      ]).start();

      progress.setValue(1);
      Animated.timing(progress, { toValue: 0, duration: 5000, easing: Easing.linear, useNativeDriver: true }).start();

      const timeout = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: 100, duration: t.animation.normal, easing: Easing.in(Easing.ease), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: t.animation.normal, useNativeDriver: true }),
        ]).start(() => onDismiss());
      }, 5000);

      return () => clearTimeout(timeout);
    } else {
      translateY.setValue(100);
      opacity.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  const btnTxt = t.isDark ? "#111111" : "#FFFFFF";

  return (
    <Animated.View style={{ position: "absolute", bottom: 40, left: 16, right: 16, zIndex: 9999, transform: [{ translateY }], opacity }}>
      <View
        style={{
          backgroundColor: t.panel,
          borderRadius: 0,
          overflow: "hidden",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Animated.View
          style={{
            height: 2,
            backgroundColor: t.accent,
            transform: [{ scaleX: progress }],
            transformOrigin: "left",
          }}
        />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 16 }}>
          <Text style={{ color: t.text, fontFamily: t.fontFamily.medium, fontSize: 14, flex: 1 }}>{message}</Text>
          <Pressable
            onPress={onUndo}
            style={({ pressed }) => ({
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 0,
              backgroundColor: t.accent,
              marginLeft: 12,
              opacity: pressed ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}
          >
            <Text style={{ color: btnTxt, fontFamily: t.fontFamily.bold, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" }}>{undoLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}
