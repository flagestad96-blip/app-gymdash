// src/components/charts/RadarChart.tsx — SVG radar/spider chart for muscle balance
import React from "react";
import { View, Text } from "react-native";
import Svg, { Polygon, Line, Circle, Text as SvgText } from "react-native-svg";
import { useTheme } from "../../theme";

export type RadarDataPoint = {
  label: string;
  value: number;
  max: number;
};

type Props = {
  data: RadarDataPoint[];
  size?: number;
  color?: string;
  fillOpacity?: number;
};

export default function RadarChart({ data, size = 240, color, fillOpacity = 0.25 }: Props) {
  const theme = useTheme();
  const accentColor = color ?? theme.accent;

  if (!data.length) return null;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.38;
  const n = data.length;
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2; // Start from top

  // Helper: get x,y for an axis at a given fraction (0-1) of radius
  function point(index: number, fraction: number): { x: number; y: number } {
    const angle = startAngle + index * angleStep;
    return {
      x: cx + Math.cos(angle) * radius * fraction,
      y: cy + Math.sin(angle) * radius * fraction,
    };
  }

  // Grid rings (3 concentric)
  const rings = [0.33, 0.66, 1.0];

  // Data polygon points
  const dataPoints = data.map((d, i) => {
    const fraction = d.max > 0 ? Math.min(1, d.value / d.max) : 0;
    return point(i, fraction);
  });
  const polygonPoints = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  // Axis endpoints
  const axisEnds = data.map((_, i) => point(i, 1));

  // Label positions (slightly outside the chart)
  const labelPoints = data.map((_, i) => point(i, 1.22));

  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={size} height={size}>
        {/* Grid rings */}
        {rings.map((r) => {
          const ringPoints = data.map((_, i) => point(i, r));
          const pts = ringPoints.map((p) => `${p.x},${p.y}`).join(" ");
          return (
            <Polygon
              key={`ring_${r}`}
              points={pts}
              fill="none"
              stroke={theme.glassBorder}
              strokeWidth={0.8}
              opacity={0.5}
            />
          );
        })}

        {/* Axis lines */}
        {axisEnds.map((end, i) => (
          <Line
            key={`axis_${i}`}
            x1={cx}
            y1={cy}
            x2={end.x}
            y2={end.y}
            stroke={theme.glassBorder}
            strokeWidth={0.8}
            opacity={0.5}
          />
        ))}

        {/* Data polygon */}
        <Polygon
          points={polygonPoints}
          fill={accentColor}
          fillOpacity={fillOpacity}
          stroke={accentColor}
          strokeWidth={2}
        />

        {/* Data points */}
        {dataPoints.map((p, i) => (
          <Circle
            key={`dot_${i}`}
            cx={p.x}
            cy={p.y}
            r={3.5}
            fill={accentColor}
          />
        ))}

        {/* Labels */}
        {labelPoints.map((p, i) => (
          <SvgText
            key={`label_${i}`}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            alignmentBaseline="central"
            fontSize={10}
            fill={theme.muted}
            fontWeight="500"
          >
            {data[i].label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}
