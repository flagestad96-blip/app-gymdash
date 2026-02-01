import React from "react";
import { View, Text } from "react-native";
import Svg, { Rect, Path, Defs, LinearGradient, Stop, G } from "react-native-svg";
import { theme } from "../theme";

type LogoProps = {
  size?: number;
  variant?: "mark" | "lockup";
};

/**
 * Gymdash logo mark — stylised dumbbell with purple→orange gradient
 * on a rounded-square glass card.
 */
function Mark({ size }: { size: number }) {
  // Dumbbell geometry (centered at 50,50 in a 100×100 viewBox)
  const barY = 50;
  const barLeft = 28;
  const barRight = 72;
  const barH = 5; // half-height of bar
  const plateW = 7;
  const plateH = 18;
  const outerPlateW = 5;
  const outerPlateH = 13;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        {/* Purple → Orange gradient diagonal */}
        <LinearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={theme.accentGradient[0]} />
          <Stop offset="100%" stopColor={theme.accentGradient[1]} />
        </LinearGradient>
        {/* Subtle glass highlight */}
        <LinearGradient id="glass" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.15" />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {/* Background rounded square */}
      <Rect x={2} y={2} width={96} height={96} rx={22} fill={theme.panel2} />
      <Rect x={2} y={2} width={96} height={96} rx={22} fill="url(#glass)" />
      <Rect
        x={2}
        y={2}
        width={96}
        height={96}
        rx={22}
        fill="none"
        stroke={theme.glassBorder}
        strokeWidth={1.5}
      />

      {/* Dumbbell */}
      <G>
        {/* Center bar */}
        <Rect
          x={barLeft}
          y={barY - barH}
          width={barRight - barLeft}
          height={barH * 2}
          rx={barH}
          fill="url(#grad)"
        />

        {/* Left inner plate */}
        <Rect
          x={barLeft - plateW}
          y={barY - plateH}
          width={plateW}
          height={plateH * 2}
          rx={3}
          fill="url(#grad)"
        />
        {/* Left outer plate */}
        <Rect
          x={barLeft - plateW - outerPlateW - 2}
          y={barY - outerPlateH}
          width={outerPlateW}
          height={outerPlateH * 2}
          rx={2.5}
          fill="url(#grad)"
          opacity={0.75}
        />

        {/* Right inner plate */}
        <Rect
          x={barRight}
          y={barY - plateH}
          width={plateW}
          height={plateH * 2}
          rx={3}
          fill="url(#grad)"
        />
        {/* Right outer plate */}
        <Rect
          x={barRight + plateW + 2}
          y={barY - outerPlateH}
          width={outerPlateW}
          height={outerPlateH * 2}
          rx={2.5}
          fill="url(#grad)"
          opacity={0.75}
        />
      </G>

      {/* Subtle upward arrow / dash accent — represents progress */}
      <Path
        d="M 44 40 L 50 34 L 56 40"
        stroke={theme.accentGradient[1]}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.9}
      />
    </Svg>
  );
}

export default function GymdashLogo({ size = 48, variant = "mark" }: LogoProps) {
  if (variant === "lockup") {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Mark size={size} />
        <Text
          style={{
            color: theme.text,
            fontSize: size * 0.38,
            fontFamily: theme.fontFamily.bold,
            letterSpacing: -0.5,
          }}
        >
          Gymdash
        </Text>
      </View>
    );
  }
  return <Mark size={size} />;
}
