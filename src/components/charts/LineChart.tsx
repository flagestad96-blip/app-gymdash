// src/components/charts/LineChart.tsx
import React from "react";
import { View, Text } from "react-native";
import Svg, { Path, Circle, Line, Rect, Text as SvgText } from "react-native-svg";
import { useTheme } from "../../theme";
import { useI18n } from "../../i18n";

function buildLinePath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  let d = `M ${first.x} ${first.y}`;
  for (const p of rest) d += ` L ${p.x} ${p.y}`;
  return d;
}

function niceStep(range: number, targetTicks: number): number {
  const rough = range / targetTicks;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const frac = rough / pow;
  let step: number;
  if (frac <= 1.5) step = 1;
  else if (frac <= 3) step = 2;
  else if (frac <= 7) step = 5;
  else step = 10;
  return step * pow;
}

export type LineChartProps = {
  values: number[];
  labels: string[];
  height?: number;
  unit?: string;
};

function LineChart({
  values,
  labels,
  height = 160,
  unit = "kg",
}: LineChartProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [containerWidth, setContainerWidth] = React.useState(320);
  const [activeIdx, setActiveIdx] = React.useState<number | null>(null);

  const leftPad = 45;
  const rightPad = 12;
  const topPad = 16;
  const bottomPad = 24;
  const chartW = containerWidth - leftPad - rightPad;
  const chartH = height - topPad - bottomPad;

  const safeValues = values.filter((v) => Number.isFinite(v));
  const rawMin = safeValues.length ? Math.min(...safeValues) : 0;
  const rawMax = safeValues.length ? Math.max(...safeValues) : 1;

  // Nice Y-axis ticks
  const yTicks = React.useMemo(() => {
    const range = rawMax - rawMin || 1;
    const step = niceStep(range, 4);
    const lo = Math.floor(rawMin / step) * step;
    const hi = Math.ceil(rawMax / step) * step;
    const ticks: number[] = [];
    for (let v = lo; v <= hi + step * 0.01; v += step) ticks.push(Math.round(v * 100) / 100);
    return ticks;
  }, [rawMin, rawMax]);

  const minV = yTicks[0];
  const maxV = yTicks[yTicks.length - 1];
  const span = Math.max(1e-9, maxV - minV);

  const points = values.map((v, i) => {
    const x = leftPad + (i * chartW) / Math.max(1, values.length - 1);
    const y = topPad + ((maxV - v) * chartH) / span;
    return { x, y, value: v };
  });

  const d = buildLinePath(points);

  // X-axis labels (3-5 evenly spaced)
  const xLabelCount = Math.min(5, labels.length);
  const xLabelIndices = React.useMemo(() => {
    if (labels.length <= 5) return labels.map((_, i) => i);
    const indices: number[] = [];
    for (let i = 0; i < xLabelCount; i++) {
      indices.push(Math.round((i * (labels.length - 1)) / (xLabelCount - 1)));
    }
    return indices;
  }, [labels.length, xLabelCount]);

  if (values.length === 0) {
    return (
      <View style={{ paddingVertical: 10 }}>
        <Text style={{ color: theme.muted }}>{t("analysis.noData")}</Text>
      </View>
    );
  }

  // Format date label: "2026-01-15" -> "15.01"
  function fmtDate(s: string) {
    if (!s || s.length < 5) return s;
    const parts = s.split("-");
    if (parts.length >= 3) return `${parts[2]}.${parts[1]}`;
    return s.slice(-5);
  }

  return (
    <View
      style={{ gap: 4 }}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Svg width={containerWidth} height={height}>
        {/* Horizontal grid lines */}
        {yTicks.map((tick) => {
          const y = topPad + ((maxV - tick) * chartH) / span;
          return (
            <Line
              key={`grid_${tick}`}
              x1={leftPad}
              y1={y}
              x2={containerWidth - rightPad}
              y2={y}
              stroke={theme.line}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          );
        })}

        {/* Y-axis labels */}
        {yTicks.map((tick) => {
          const y = topPad + ((maxV - tick) * chartH) / span;
          return (
            <SvgText
              key={`ylabel_${tick}`}
              x={leftPad - 6}
              y={y + 4}
              fill={theme.muted}
              fontSize={10}
              fontFamily={theme.mono}
              textAnchor="end"
            >
              {tick % 1 === 0 ? String(tick) : tick.toFixed(1)}
            </SvgText>
          );
        })}

        {/* Data line */}
        <Path d={d} stroke={theme.accent} strokeWidth={2} fill="none" />

        {/* Data points */}
        {points.map((p, idx) => (
          <Circle
            key={idx}
            cx={p.x}
            cy={p.y}
            r={activeIdx === idx ? 5 : 3}
            fill={activeIdx === idx ? theme.text : theme.accent}
          />
        ))}

        {/* Invisible touch targets */}
        {points.map((p, idx) => (
          <Rect
            key={`hit_${idx}`}
            x={p.x - 12}
            y={p.y - 12}
            width={24}
            height={24}
            fill="transparent"
            onPress={() => setActiveIdx(activeIdx === idx ? null : idx)}
          />
        ))}

        {/* X-axis labels */}
        {xLabelIndices.map((i) => {
          if (!points[i]) return null;
          return (
            <SvgText
              key={`xlabel_${i}`}
              x={points[i].x}
              y={height - 4}
              fill={theme.muted}
              fontSize={10}
              fontFamily={theme.mono}
              textAnchor="middle"
            >
              {fmtDate(labels[i] ?? "")}
            </SvgText>
          );
        })}
      </Svg>

      {/* Tooltip for active point */}
      {activeIdx !== null && points[activeIdx] ? (
        <View style={{
          alignSelf: "center",
          backgroundColor: theme.glass,
          borderColor: theme.glassBorder,
          borderWidth: 1,
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 4,
          flexDirection: "row",
          gap: 8,
        }}>
          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
            {fmtDate(labels[activeIdx] ?? "")}
          </Text>
          <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 11 }}>
            {points[activeIdx].value.toFixed(1)} {unit}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default LineChart;
