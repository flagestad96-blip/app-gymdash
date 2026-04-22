// src/ui/modern.tsx
// Modern UI components — aurora glassmorphism redesign.
//
// Glass pieces sit over an animated aurora background (see AppBackground).
// The look follows the "Gymdash test" prototype:
//   • neutral white glass with a soft top-left specular highlight
//   • the three-stop aurora gradient (blue → violet → pink) reserved for CTAs
//   • Instrument Serif for editorial headlines, JetBrains Mono for numeric readouts

import React, { useCallback, useEffect, useState } from "react";
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
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme, AURORA, glassTokensFor, DEFAULT_GLASS_INTENSITY } from "../theme";
import { useI18n } from "../i18n";

// ─── Typography helpers ───────────────────────────────────────────────────────

/**
 * SerifText — Instrument Serif headline. Italic is the design's signature
 * accent (used on key words like "beautifully" or em-dashes in greetings).
 */
export function SerifText({
  children,
  italic = false,
  style,
}: {
  children: React.ReactNode;
  italic?: boolean;
  style?: TextStyle | TextStyle[];
}) {
  const theme = useTheme();
  return (
    <Text
      style={[
        {
          color: theme.text,
          fontFamily: italic
            ? "InstrumentSerif_400Regular_Italic"
            : theme.fontFamily.serif,
        },
        style as any,
      ]}
    >
      {children}
    </Text>
  );
}

/** Mono — JetBrains Mono for numeric readouts (weights, timers, counts). */
export function Mono({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: TextStyle | TextStyle[];
}) {
  const theme = useTheme();
  return (
    <Text style={[{ color: theme.text, fontFamily: theme.mono }, style as any]}>
      {children}
    </Text>
  );
}

/** GradientText — aurora-colored text, used for emphasized words inline. */
export function GradientText({
  text,
  style,
  colors,
}: {
  text: string;
  style?: TextStyle;
  colors?: [string, string, ...string[]];
}) {
  const theme = useTheme();
  const stops = colors ?? theme.auroraGradient;
  // MaskedView would give a true gradient fill; on RN we approximate by
  // painting text on top of a clipped gradient. Good enough for headline accents.
  return (
    <View style={{ position: "relative" }}>
      <Text style={[{ color: stops[1] }, style]}>{text}</Text>
    </View>
  );
}

// ─── Pill ─────────────────────────────────────────────────────────────────────

type PillTone = "neutral" | "accent" | "violet" | "cyan" | "pink" | "success" | "danger";

const PILL_TONES: Record<
  PillTone,
  { bg: string; color: string; stroke: string }
> = {
  neutral: { bg: "rgba(255,255,255,0.08)", color: "#f3f5ff", stroke: "rgba(255,255,255,0.14)" },
  accent:  { bg: "rgba(96,165,250,0.16)",  color: "#cfe0ff", stroke: "rgba(96,165,250,0.35)" },
  violet:  { bg: "rgba(192,132,252,0.16)", color: "#ecd7ff", stroke: "rgba(192,132,252,0.35)" },
  cyan:    { bg: "rgba(103,232,249,0.16)", color: "#d2fbff", stroke: "rgba(103,232,249,0.35)" },
  pink:    { bg: "rgba(244,114,182,0.16)", color: "#ffd9ec", stroke: "rgba(244,114,182,0.35)" },
  success: { bg: "rgba(103,232,249,0.16)", color: "#d2fbff", stroke: "rgba(103,232,249,0.35)" },
  danger:  { bg: "rgba(251,113,133,0.16)", color: "#ffd5dc", stroke: "rgba(251,113,133,0.40)" },
};

/**
 * Pill — small frosted capsule. Accepts tone from the aurora palette.
 *
 * Children may be a single string, multiple strings/numbers (e.g. "4×/week"),
 * or nested React elements. We always wrap the children in a styled <Text> so
 * raw strings never slip through a View (which crashes on native RN).
 */
export function Pill({
  children,
  tone = "neutral",
  icon,
  style,
}: {
  children: React.ReactNode;
  tone?: PillTone;
  icon?: keyof typeof MaterialIcons.glyphMap;
  style?: ViewStyle;
}) {
  const t = PILL_TONES[tone];
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          alignSelf: "flex-start",
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: t.bg,
          borderWidth: 1,
          borderColor: t.stroke,
        },
        style,
      ]}
    >
      {icon ? <MaterialIcons name={icon} size={12} color={t.color} /> : null}
      <Text style={{ color: t.color, fontSize: 11, fontWeight: "500", letterSpacing: 0.2 }}>
        {children}
      </Text>
    </View>
  );
}

// ─── GradientButton ───────────────────────────────────────────────────────────

type GradientButtonProps = {
  text: string;
  onPress: () => void;
  /** Variant controls the gradient stops used. */
  variant?: "accent" | "success" | "danger" | "aurora";
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
  iconPosition?: "left" | "right";
  haptic?: boolean;
  /** Makes the pill bigger for hero placements. */
  size?: "md" | "lg";
  style?: ViewStyle;
};

export function GradientButton({
  text,
  onPress,
  variant = "aurora",
  loading = false,
  disabled = false,
  icon,
  iconPosition = "left",
  haptic = true,
  size = "md",
  style,
}: GradientButtonProps) {
  const theme = useTheme();
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const gradientColors: readonly string[] = (() => {
    switch (variant) {
      case "success": return theme.successGradient;
      case "danger":  return theme.dangerGradient;
      case "aurora":  return theme.auroraGradient;
      case "accent":
      default:        return theme.accentGradient;
    }
  })();

  const handlePressIn = () => {
    if (disabled || loading) return;
    Animated.spring(scaleAnim, {
      toValue: 0.96,
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
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const height = size === "lg" ? 56 : 48;
  const radius = size === "lg" ? 18 : 16;

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled || loading}
      >
        <LinearGradient
          colors={gradientColors as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            {
              paddingHorizontal: 22,
              borderRadius: radius,
              alignItems: "center",
              justifyContent: "center",
              height,
              shadowColor: AURORA.violet,
              shadowOpacity: 0.55,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 10 },
              elevation: 8,
            },
            disabled && { opacity: 0.5 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {icon && iconPosition === "left" ? (
                <MaterialIcons name={icon} size={size === "lg" ? 20 : 18} color="#FFFFFF" />
              ) : null}
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: size === "lg" ? 15 : 14,
                  fontFamily: theme.fontFamily.semibold,
                  letterSpacing: 0.1,
                }}
              >
                {text}
              </Text>
              {icon && iconPosition === "right" ? (
                <MaterialIcons name={icon} size={size === "lg" ? 20 : 18} color="#FFFFFF" />
              ) : null}
            </View>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ─── GlassCard ────────────────────────────────────────────────────────────────
//
// Direct port of Gymdash.html's <Glass> component. The numeric formula for
// blur / saturate / fillA / fillB / strokeA lives in `glassTokensFor()`; the
// rest of the card (shadow layering, radial specular, prototype-matching
// defaults) is reproduced here 1:1.
//
// Prop defaults mirror the prototype: `radius = 22`, `padding = 18`,
// `intensity = 65`, `strong = false`.
//
// On native RN we can't apply a real `backdrop-filter`, so the card relies on
// the aurora background diffusing behind it and on two layered fills to read
// as "frosted". The specular highlight uses react-native-svg's radial
// gradient for a true top-left sheen (matches the prototype's
// `radial-gradient(240px 120px at 20% 0%, ...)`).

type GlassCardProps = {
  children: React.ReactNode;
  /** 0..100, default 65. Leave unset to follow the theme's current intensity. */
  intensity?: number;
  /** Hero-card variant: thicker border highlight + deeper drop shadow. */
  strong?: boolean;
  /** Draw the top-left specular sheen. Default true. */
  highlight?: boolean;
  /** Lift the card 1px when true (prototype's `active` prop). */
  active?: boolean;
  /** Overlay a subtle aurora-tint inside the card. */
  gradient?: boolean;
  gradientColors?: readonly string[];
  /** Border radius. Default 22 (prototype). */
  radius?: number;
  /** Inner padding. Default 18 (prototype). */
  padding?: number;
  /** Kept for backwards-compat with callers passing `shadow="sm"` etc. */
  shadow?: "sm" | "md" | "lg";
  /** Kept for back-compat; no runtime effect. */
  blur?: boolean;
  style?: ViewStyle;
};

export function GlassCard({
  children,
  intensity,
  strong = false,
  highlight = true,
  active = false,
  gradient = false,
  gradientColors,
  radius = 22,
  padding = 18,
  shadow: _shadow,
  blur: _blur,
  style,
}: GlassCardProps) {
  const theme = useTheme();
  const i = typeof intensity === "number" ? intensity : theme.glassIntensity ?? DEFAULT_GLASS_INTENSITY;
  const g = glassTokensFor(i);

  // ── Layered styling, in z-order ────────────────────────────────────────────
  //
  // 1. Root View — border + drop shadow.
  // 2. 155° linear fill gradient (fillA → fillB).
  // 3. Top-left radial specular (strong white near 20% 0%, fading to transparent).
  // 4. 1px highlight line along the top edge (inset highlight in CSS).
  // 5. 1px dark line along the bottom edge (inset dark in CSS).
  // 6. Optional aurora-tint overlay when `gradient` is true.
  // 7. Children.

  const topInsetAlpha = strong ? 0.35 : 0.20;
  const bottomInsetAlpha = strong ? 0.25 : 0.18;

  // Drop shadow — prototype uses `0 18px 40px -12px rgba(0,0,0,0.55)` (strong)
  // and `0 10px 26px -10px rgba(0,0,0,0.45)` (regular).
  const dropShadow = strong
    ? {
        shadowColor: "#000",
        shadowOpacity: 0.55,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 18 },
        elevation: 14,
      }
    : {
        shadowColor: "#000",
        shadowOpacity: 0.45,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 8,
      };

  const overlayColors = gradient
    ? (gradientColors ?? [
        "rgba(96,165,250,0.14)",
        "rgba(192,132,252,0.08)",
        "rgba(244,114,182,0.10)",
      ])
    : null;

  // The card is built from three stacked layers, in this order:
  //
  //   ┌───────────────────────────────────────────────────┐
  //   │ OUTER — no border, no background. Provides radius │
  //   │   and drop shadow only. Children stack inside it. │
  //   │                                                   │
  //   │  ┌─────────────────────────────────────────────┐  │
  //   │  │ COMPOSITION (absoluteFill, clipped)          │  │
  //   │  │   155° fill • radial specular • inset lines  │  │
  //   │  └─────────────────────────────────────────────┘  │
  //   │                                                   │
  //   │  ┌─────────────────────────────────────────────┐  │
  //   │  │ CHILDREN wrapper — gets the padding          │  │
  //   │  └─────────────────────────────────────────────┘  │
  //   │                                                   │
  //   │  ┌─────────────────────────────────────────────┐  │
  //   │  │ BORDER OVERLAY (absoluteFill, pointer-none)  │  │
  //   │  │   borderWidth 1 with the same radius.        │  │
  //   │  └─────────────────────────────────────────────┘  │
  //   └───────────────────────────────────────────────────┘
  //
  // Keeping the border on a separate overlay instead of on the outer View
  // avoids RN's quirk where absoluteFill siblings are positioned INSIDE the
  // border (creating a 2px-smaller rectangle with its own rounded corners
  // that didn't align with the outer corners — the "lighter square" artifact).
  // Border drawn as a pointer-events:none overlay sits ON TOP of the glass
  // composition, so the composition fills the full card edge-to-edge.

  // The entire card is ONE View. This is deliberate — nested Views with
  // `borderRadius` + `overflow: hidden` have been the source of the "inner
  // rectangle" artifact. Each nested rounded-rect renders its own clip path
  // and Android sub-pixel rasterization can reveal tiny offsets where those
  // paths disagree, reading as a ghost rectangle inside the card.
  //
  // Stack, from back to front:
  //   • View itself — border + rounded shape + `overflow: hidden` +
  //     `backgroundColor` as a dark veil (fallback if BlurView doesn't work).
  //   • BlurView (absoluteFill) — real GPU backdrop blur of the aurora below.
  //   • 155° white-tint LinearGradient (absoluteFill) — the prototype's
  //     subtle top-left highlight.
  //   • Optional aurora-tint overlay.
  //   • Children in flow, wrapped by a View with `padding`.
  //
  // `intensity` (0..100) drives BOTH the BlurView intensity AND the fallback
  // veil opacity, so the slider stays meaningful in either path.

  const k = i / 100;
  const veilAlpha = 0.18 + k * 0.22; // 0.18..0.40 — fallback darkening
  const whiteFillA = g.fillA + k * 0.05;
  const whiteFillB = g.fillB + k * 0.03;
  const blurIntensity = Math.max(0, Math.min(100, Math.round(i)));

  return (
    <View
      style={[
        {
          borderRadius: radius,
          borderWidth: 1,
          borderColor: `rgba(255,255,255,${g.stroke.toFixed(3)})`,
          // Flat dark veil as the card's own background — also the fallback
          // when BlurView's native module isn't available (Expo Go warning),
          // and the surface Android uses for the elevation clip path.
          backgroundColor: `rgba(10, 13, 26, ${veilAlpha.toFixed(3)})`,
          overflow: "hidden",
          transform: active ? [{ translateY: -1 }] : undefined,
        },
        dropShadow,
        style,
      ]}
    >
      {/* Real backdrop blur — GPU on iOS, software blur on Android dev
          builds. Falls through (renders nothing) inside Expo Go when the
          SDK's native module isn't registered; the dark veil above handles
          that gracefully. */}
      <BlurView intensity={blurIntensity} tint="dark" style={StyleSheet.absoluteFill} />

      {/* 155° white tint gradient — the diffuse top-left highlight */}
      <LinearGradient
        colors={[
          `rgba(255,255,255,${whiteFillA.toFixed(3)})`,
          `rgba(255,255,255,${whiteFillB.toFixed(3)})`,
        ]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Optional aurora-tint overlay */}
      {overlayColors ? (
        <LinearGradient
          colors={overlayColors as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {/* Inset 1px highlight + 1px shadow — fakes CSS inset box-shadow */}
      {highlight ? (
        <>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: `rgba(255,255,255,${topInsetAlpha})` }} />
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, backgroundColor: `rgba(0,0,0,${bottomInsetAlpha})` }} />
        </>
      ) : null}

      {/* Children — padding on this wrapper so the card's height auto-sizes
          around the content without a padding "ring" between fill and border. */}
      <View style={{ padding }}>{children}</View>
    </View>
  );
}

// ─── ProgressRing ─────────────────────────────────────────────────────────────

type ProgressRingProps = {
  progress: number; // 0 to 1
  size?: number;
  strokeWidth?: number;
  /** Accent uses the aurora gradient stroke. */
  color?: "accent" | "success" | "danger" | "aurora";
  showPercentage?: boolean;
  animated?: boolean;
  /** Optional label rendered inside the ring (overrides percentage). */
  label?: React.ReactNode;
};

export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 8,
  color = "aurora",
  showPercentage = true,
  animated = true,
  label,
}: ProgressRingProps) {
  const theme = useTheme();
  const [displayProgress, setDisplayProgress] = useState(animated ? 0 : progress);
  const animatedProgress = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = animatedProgress.addListener(({ value }) => setDisplayProgress(value));
    return () => animatedProgress.removeListener(id);
  }, [animatedProgress]);

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

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference * (1 - displayProgress);

  // For aurora we render a two-stop gradient stroke; for solid variants we
  // use the theme token. This avoids branching in the stroke value.
  const solidColor =
    color === "success" ? theme.success : color === "danger" ? theme.danger : theme.accent;
  const useGradient = color === "accent" || color === "aurora";
  const gradId = `pr-grad-${useGradient ? "aurora" : "solid"}`;

  return (
    <View style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }]}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        {useGradient ? (
          <Defs>
            <SvgLinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={theme.auroraGradient[0]} />
              <Stop offset="60%" stopColor={theme.auroraGradient[1]} />
              <Stop offset="100%" stopColor={theme.auroraGradient[2]} />
            </SvgLinearGradient>
          </Defs>
        ) : null}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.line}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={useGradient ? `url(#${gradId})` : solidColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      <View style={{ position: "absolute", alignItems: "center", justifyContent: "center" }}>
        {label !== undefined ? (
          label
        ) : showPercentage ? (
          <Text
            style={{
              color: theme.text,
              fontSize: Math.max(14, size / 6),
              fontWeight: "600",
              fontFamily: theme.mono,
            }}
          >
            {Math.round(progress * 100)}%
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ─── StatPill (existing API kept) ─────────────────────────────────────────────

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
      <Text style={[styles.statPillLabel, { color: isPR ? "#FFFFFF" : theme.muted, fontFamily: theme.mono }]}>
        {label}
      </Text>
      <Text style={[styles.statPillValue, { color: isPR ? "#FFFFFF" : theme.text, fontFamily: theme.mono }]}>
        {value}
      </Text>
      {rpe !== undefined && (
        <Text style={[styles.statPillRpe, { color: isPR ? "#FFFFFF" : theme.muted, fontFamily: theme.mono }]}>
          RPE {rpe}
        </Text>
      )}
    </View>
  );

  if (isPR) {
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <LinearGradient
          colors={theme.auroraGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.statPill, compact && styles.statPillCompact, style]}
        >
          <Text style={[styles.statPillLabel, { color: "#FFFFFF", fontFamily: theme.mono }]}>{label}</Text>
          <Text style={[styles.statPillValue, { color: "#FFFFFF", fontFamily: theme.mono }]}>{value}</Text>
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

// ─── AnimatedNumber ───────────────────────────────────────────────────────────

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

// ─── SkeletonLoader ───────────────────────────────────────────────────────────

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
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View style={[{ opacity }, style]}>
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

// ─── Toasts ───────────────────────────────────────────────────────────────────

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
  const { t } = useI18n();
  const translateY = React.useRef(new Animated.Value(-200)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;
  const onDismissRef = React.useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const tierGradient: Record<typeof tier, [string, string]> = {
    common:     [theme.muted, theme.muted],
    rare:       [theme.aurora.blue, theme.aurora.violet],
    epic:       [theme.aurora.violet, theme.aurora.pink],
    legendary:  ["#FFD700", "#FFA500"],
  };

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
          duration: theme.animation.normal,
          useNativeDriver: true,
        }),
      ]).start();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

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
          colors={tierGradient[tier]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.toastContent}
        >
          <View style={styles.toastIconContainer}>
            <MaterialIcons name={achievementIcon as any} size={32} color="#FFFFFF" />
          </View>
          <View style={styles.toastTextContainer}>
            <Text style={styles.toastTitle}>🏆 {t("achievements.toast")}</Text>
            <Text style={styles.toastName}>{achievementName}</Text>
            <Text style={styles.toastPoints}>+{t("achievements.points", { n: points })}</Text>
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
  const onDismissRef = React.useRef(onDismiss);
  onDismissRef.current = onDismiss;

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
        ]).start(() => onDismissRef.current());
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
        <Text style={{ color: theme.text, fontFamily: theme.fontFamily.medium, fontSize: 14, flex: 1 }}>
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
          <Text style={{ color: "#FFFFFF", fontFamily: theme.fontFamily.semibold, fontSize: 13 }}>
            {undoLabel}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

export function SuccessToast({
  visible,
  message,
  onDismiss,
}: {
  visible: boolean;
  message: string;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const stableDismiss = useCallback(onDismiss, [onDismiss]);

  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(stableDismiss, 3000);
    return () => clearTimeout(id);
  }, [visible, stableDismiss]);

  if (!visible) return null;

  return (
    <View
      style={{
        position: "absolute",
        bottom: 50,
        left: 24,
        right: 24,
        backgroundColor: theme.glass,
        borderColor: theme.success,
        borderWidth: 1,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 18,
        alignItems: "center",
        zIndex: 9999,
      }}
    >
      <Text style={{ color: theme.success, fontFamily: theme.fontFamily.semibold, fontSize: 14 }}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    overflow: "hidden",
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
