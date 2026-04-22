// src/components/AppBackground.tsx
// Aurora background — port of the prototype's <Aurora> component.
//
// Prototype uses:
//   • base gradient: linear-gradient(160deg, #0a0d1a 0%, #070814 60%, #040510 100%)
//   • four 520×520 blobs with `radial-gradient(closest-side, color, transparent)`,
//     `filter: blur(40px)`, `opacity: 0.55`, `mix-blend-mode: screen`
//   • each blob drifts on a slow ease-in-out cycle (18–26s)
//
// On native we:
//   • use react-native-svg's RadialGradient for the true soft falloff
//     (RN can't apply `backdrop-filter`/`mix-blend-mode` at the View level)
//   • keep the motion via Animated transforms (driver: native)
//   • read the palette from `theme.aurora`, so switching palette in Profile
//     actually repaints the backdrop

import React from "react";
import { View, StyleSheet, Dimensions, Animated, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Circle,
  Defs,
  RadialGradient as SvgRadialGradient,
  Stop,
} from "react-native-svg";
import { useTheme } from "../theme";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

type BlobDef = {
  color: string;
  /** Distance to drift in each axis (matches prototype's floatA..D). */
  dx: number;
  dy: number;
  scaleTo: number;
  duration: number;
  /** Initial center point in screen coordinates. */
  left: number;
  top: number;
  /** Blob diameter. Prototype is 520px; we scale by screen width so phones of
   *  any size feel the same. */
  size: number;
};

function makeBlobs(accent: { blue: string; violet: string; cyan: string; pink: string }): BlobDef[] {
  // Sizes scale with screen width, same layout as the prototype corners.
  const S = Math.max(420, Math.round(SCREEN_W * 1.3)); // 520 on a ~400-wide phone

  return [
    // blob-a — top-left
    {
      color: accent.blue,
      dx: 60,
      dy: 120,
      scaleTo: 1.12,
      duration: 18000,
      left: -120,
      top: -160,
      size: S,
    },
    // blob-b — top-right
    {
      color: accent.violet,
      dx: -80,
      dy: 80,
      scaleTo: 1.08,
      duration: 22000,
      left: SCREEN_W - S + 180,
      top: -80,
      size: S,
    },
    // blob-c — bottom-left
    {
      color: accent.cyan,
      dx: 100,
      dy: -80,
      scaleTo: 0.95,
      duration: 26000,
      left: -100,
      top: SCREEN_H - S + 200,
      size: S,
    },
    // blob-d — bottom-right
    {
      color: accent.pink,
      dx: -60,
      dy: -100,
      scaleTo: 1.10,
      duration: 20000,
      left: SCREEN_W - S + 120,
      top: SCREEN_H - S + 140,
      size: S,
    },
  ];
}

function Blob({ def, idx }: { def: BlobDef; idx: number }) {
  const anim = React.useRef(new Animated.Value(0)).current;
  const gradId = `blob-grad-${idx}`;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: def.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: def.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, def.duration]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, def.dx] });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, def.dy] });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, def.scaleTo] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: def.left,
        top: def.top,
        width: def.size,
        height: def.size,
        // `mix-blend-mode: screen` isn't supported on RN Views. The closest
        // native approximation is a high opacity with additive visual effect
        // from overlapping light colors on a dark backdrop.
        opacity: 0.65,
        transform: [{ translateX }, { translateY }, { scale }],
      }}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <SvgRadialGradient id={gradId} cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <Stop offset="0%" stopColor={def.color} stopOpacity="1" />
            <Stop offset="100%" stopColor={def.color} stopOpacity="0" />
          </SvgRadialGradient>
        </Defs>
        <Circle cx="50%" cy="50%" r="50%" fill={`url(#${gradId})`} />
      </Svg>
    </Animated.View>
  );
}

export function AppBackground() {
  const theme = useTheme();
  const blobs = React.useMemo(() => makeBlobs(theme.aurora), [theme.aurora]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Base gradient — matches prototype's linear-gradient(160deg,...) */}
      <LinearGradient
        colors={["#0a0d1a", "#070814", "#040510"]}
        locations={[0, 0.6, 1]}
        // 160deg ≈ mostly-down with a slight right drift
        start={{ x: 0.25, y: 0 }}
        end={{ x: 0.75, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Aurora blobs */}
      {blobs.map((def, i) => (
        <Blob key={i} def={def} idx={i} />
      ))}

      {/* Top vignette shimmer + bottom fade, matches prototype's overlays */}
      <LinearGradient
        colors={["rgba(255,255,255,0.03)", "rgba(255,255,255,0)", "rgba(0,0,0,0.35)"]}
        locations={[0, 0.35, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
