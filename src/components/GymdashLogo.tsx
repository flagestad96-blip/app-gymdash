import React from "react";
import { View, Text } from "react-native";
import Svg, { Rect, G, Defs, LinearGradient, Stop } from "react-native-svg";
import { theme } from "../theme";

type LogoProps = { size?: number; variant?: "mark" | "lockup" };

function Mark({ size }: { size: number }) {
  const y = 50;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="teal" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={theme.accentGradient[0]} />
          <Stop offset="100%" stopColor={theme.accentGradient[1]} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={100} height={100} rx={4} fill={theme.panel} />
      <G>
        <Rect x={26} y={y - 4} width={48} height={8} rx={2} fill="url(#teal)" />
        <Rect x={18} y={y - 16} width={8} height={32} rx={2} fill="url(#teal)" />
        <Rect x={10} y={y - 12} width={6} height={24} rx={1.5} fill="url(#teal)" opacity={0.65} />
        <Rect x={74} y={y - 16} width={8} height={32} rx={2} fill="url(#teal)" />
        <Rect x={84} y={y - 12} width={6} height={24} rx={1.5} fill="url(#teal)" opacity={0.65} />
      </G>
    </Svg>
  );
}

export default function GymdashLogo({ size = 48, variant = "mark" }: LogoProps) {
  if (variant === "lockup") {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Mark size={size} />
        <Text style={{ color: theme.text, fontSize: size * 0.38, fontFamily: theme.fontFamily.bold, letterSpacing: -1 }}>
          Gymdash
        </Text>
      </View>
    );
  }
  return <Mark size={size} />;
}
