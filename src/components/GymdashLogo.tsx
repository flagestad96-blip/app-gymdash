import React from "react";
import { View, Text } from "react-native";
import Svg, { Rect, Circle, Line, Path } from "react-native-svg";
import { theme } from "../theme";

type LogoProps = {
  size?: number;
  variant?: "mark" | "lockup";
};

function Mark({ size }: { size: number }) {
  const stroke = theme.line;
  const fill = theme.panel2;
  const accent = theme.accent;
  const s = size;
  const c = s / 2;
  const ring = s * 0.22;
  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Rect x={1} y={1} width={s - 2} height={s - 2} rx={s * 0.22} fill={fill} stroke={stroke} strokeWidth={2} />
      <Circle cx={c} cy={c} r={ring} stroke={accent} strokeWidth={2.6} fill="none" />
      <Path
        d={`M ${c + ring * 0.6} ${c + ring * 0.5} L ${c + ring * 1.3} ${c + ring * 1.1}`}
        stroke={accent}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <Line
        x1={c - ring * 0.8}
        y1={c - ring * 1.1}
        x2={c - ring * 0.2}
        y2={c - ring * 0.5}
        stroke={accent}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function GymdashLogo({ size = 48, variant = "mark" }: LogoProps) {
  if (variant === "lockup") {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Mark size={size} />
        <Text style={{ color: theme.text, fontSize: size * 0.42, fontFamily: theme.mono }}>Gymdash</Text>
      </View>
    );
  }
  return <Mark size={size} />;
}
