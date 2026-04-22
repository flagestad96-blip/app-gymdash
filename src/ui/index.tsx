import React from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  type TextInputProps,
  type ViewStyle,
  type TextStyle,
  type StyleProp,
  StyleSheet,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { GlassCard } from "./modern";

const WATERMARK = "Aurora";

export function Screen({
  children,
  style,
  edges = ["top", "left", "right"],
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  edges?: Edge[];
}) {
  const theme = useTheme();
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: "transparent" }, style]}>
      {children}
    </SafeAreaView>
  );
}

export function TopBar({
  title,
  subtitle,
  left,
  right,
  serif = true,
}: {
  title: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  /** Render the title in Instrument Serif (design default). Set false for all-caps labels. */
  serif?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: theme.space.md,
        paddingVertical: theme.space.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.space.sm, flex: 1 }}>
        {left}
        <View style={{ gap: 2, flex: 1 }}>
          <Text
            style={{
              color: theme.text,
              fontSize: theme.fontSize.xxl,
              fontFamily: serif ? theme.fontFamily.serif : theme.fontFamily.semibold,
              lineHeight: theme.fontSize.xxl * 1.1,
              letterSpacing: serif ? -0.3 : 0,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{
                color: theme.muted,
                fontSize: theme.fontSize.sm,
                fontFamily: theme.fontFamily.regular,
                lineHeight: theme.fontSize.sm * 1.4,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        {right}
        {__DEV__ ? (
          <View
            style={{
              borderRadius: theme.radius.pill,
              borderWidth: 1,
              borderColor: theme.glassBorder,
              backgroundColor: theme.glass,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Text style={{ color: theme.muted2, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>
              {WATERMARK}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <Text
        style={{
          color: theme.muted2,
          fontFamily: theme.mono,
          fontSize: theme.fontSize.xs,
          letterSpacing: 1.4,
          textTransform: "uppercase",
        }}
      >
        {title}
      </Text>
      {action}
    </View>
  );
}

export function Card({
  children,
  style,
  title,
  strong,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  title?: string;
  /** Use stronger glass for hero cards (matches the aurora redesign). */
  strong?: boolean;
}) {
  const theme = useTheme();
  // Delegate to the prototype-accurate GlassCard so every card in the app
  // renders the same 155° fill + radial specular + inset highlight stack.
  return (
    <GlassCard strong={strong} radius={theme.radius.xl} padding={theme.space.lg} style={style as ViewStyle}>
      <View style={{ gap: theme.space.sm }}>
        {title ? <SectionHeader title={title} /> : null}
        {children}
      </View>
    </GlassCard>
  );
}

export function Button({
  label,
  onPress,
  tone = "normal",
  small,
  disabled,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  tone?: "normal" | "danger" | "accent" | "ghost";
  small?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const isGhost = tone === "ghost";
  const isPrimary = tone === "accent";
  const isDanger = tone === "danger";

  const textColor = isPrimary || isDanger ? "#FFFFFF" : isGhost ? theme.accent : theme.text;
  const height = small ? 34 : 46;
  const paddingH = small ? 12 : 18;

  const inner = (
    <Text style={{ color: textColor, fontSize: theme.fontSize.sm, fontFamily: theme.fontFamily.semibold }}>
      {label}
    </Text>
  );

  // Primary (accent) — aurora gradient fill for the signature CTA look
  if (isPrimary) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        hitSlop={small ? theme.hitSlop.sm : undefined}
        style={({ pressed }) => ({
          opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          borderRadius: theme.radius.lg,
          shadowColor: theme.shadow.glow.color,
          shadowOpacity: theme.shadow.glow.opacity,
          shadowRadius: theme.shadow.glow.radius,
          shadowOffset: theme.shadow.glow.offset,
          elevation: 6,
        })}
      >
        <LinearGradient
          colors={theme.auroraGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            height,
            paddingHorizontal: paddingH,
            borderRadius: theme.radius.lg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {inner}
        </LinearGradient>
      </Pressable>
    );
  }

  const bg = isDanger ? theme.danger : isGhost ? "transparent" : theme.glass;
  const borderColor = isGhost ? "transparent" : isDanger ? theme.danger : theme.glassBorder;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={small ? theme.hitSlop.sm : undefined}
      style={({ pressed }) => ({
        height,
        paddingHorizontal: paddingH,
        borderRadius: theme.radius.lg,
        borderWidth: isGhost ? 0 : 1,
        borderColor,
        backgroundColor: bg,
        opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        alignItems: "center",
        justifyContent: "center",
      })}
    >
      {inner}
    </Pressable>
  );
}

export function Chip({
  text,
  active,
  onPress,
  tone,
  accessibilityLabel,
}: {
  text: string;
  active?: boolean;
  onPress?: () => void;
  tone?: "normal" | "accent" | "danger";
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const isAccent = tone === "accent" || active;
  const borderColor = tone === "danger" ? theme.danger : isAccent ? theme.accent : theme.glassBorder;
  // Aurora tints keyed off the palette (pulled from theme.aurora so both themes work)
  const accentBg = theme.isDark ? "rgba(192, 132, 252, 0.18)" : "rgba(139, 92, 246, 0.14)";
  const dangerBg = theme.isDark ? "rgba(251, 113, 133, 0.18)" : "rgba(225, 29, 72, 0.12)";
  const bg = tone === "danger" ? dangerBg : isAccent ? accentBg : theme.glass;
  const textColor = tone === "danger" ? theme.danger : isAccent ? theme.accent : theme.text;
  const body = (
    <View
      style={{
        borderColor,
        borderWidth: 1,
        borderRadius: theme.radius.pill,
        paddingHorizontal: 12,
        paddingVertical: 7,
        backgroundColor: bg,
      }}
    >
      <Text style={{ color: textColor, fontSize: theme.fontSize.xs, fontFamily: theme.fontFamily.medium }}>
        {text}
      </Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} hitSlop={theme.hitSlop.md} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? text} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      {body}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  size = 18,
  tone = "normal",
  disabled,
  accessibilityLabel,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  size?: number;
  tone?: "normal" | "accent" | "danger";
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const borderColor = tone === "danger" ? theme.danger : tone === "accent" ? theme.accent : theme.glassBorder;
  const tint = tone === "danger" ? theme.danger : tone === "accent" ? theme.accent : theme.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={theme.hitSlop.md}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? String(icon)}
      style={({ pressed }) => ({
        minWidth: 44,
        minHeight: 44,
        alignItems: "center",
        justifyContent: "center",
        borderColor,
        borderWidth: 1,
        borderRadius: theme.radius.md,
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: theme.glass,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <MaterialIcons name={icon} size={size} color={tint} />
    </Pressable>
  );
}

export function TextField({
  style,
  suffix,
  ...rest
}: TextInputProps & { style?: StyleProp<TextStyle>; suffix?: string }) {
  const theme = useTheme();
  const [focused, setFocused] = React.useState(false);
  const error = (rest as { error?: string }).error;
  const helperText = (rest as { helperText?: string }).helperText;
  const flatStyle = (StyleSheet.flatten(style as any) || {}) as any;
  const layoutStyle: ViewStyle = {
    flex: flatStyle.flex,
    width: flatStyle.width,
    minWidth: flatStyle.minWidth,
    maxWidth: flatStyle.maxWidth,
    alignSelf: flatStyle.alignSelf,
    marginTop: flatStyle.marginTop,
    marginBottom: flatStyle.marginBottom,
    marginLeft: flatStyle.marginLeft,
    marginRight: flatStyle.marginRight,
  };
  return (
    <View style={[{ gap: 6 }, layoutStyle]}>
      <View style={{ position: "relative", justifyContent: "center" }}>
        <TextInput
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          placeholderTextColor={theme.muted}
          selectionColor={theme.accent}
          style={[
            {
              color: theme.text,
              backgroundColor: theme.glass,
              borderColor: error ? theme.danger : focused ? theme.accent : theme.glassBorder,
              borderWidth: 1,
              borderRadius: theme.radius.lg,
              paddingHorizontal: theme.space.md,
              paddingRight: suffix ? 36 : theme.space.md,
              paddingVertical: 10,
              fontSize: theme.fontSize.md,
              lineHeight: theme.lineHeight.md,
            },
            style,
          ]}
        />
        {suffix ? (
          <Text
            style={{
              position: "absolute",
              right: 8,
              color: theme.muted,
              fontFamily: theme.mono,
              fontSize: 10,
              letterSpacing: 0.5,
            }}
            pointerEvents="none"
          >
            {suffix}
          </Text>
        ) : null}
      </View>
      {error ? (
        <Text style={{ color: theme.danger, fontSize: theme.fontSize.xs, fontFamily: theme.mono }}>
          {error}
        </Text>
      ) : helperText ? (
        <Text style={{ color: theme.muted, fontSize: theme.fontSize.xs, fontFamily: theme.mono }}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

export function NumberField(props: TextInputProps) {
  return <TextField {...props} keyboardType="numeric" />;
}

export function ListRow({
  title,
  subtitle,
  right,
  onPress,
  divider,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  divider?: boolean;
}) {
  const theme = useTheme();
  const row = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: theme.space.sm,
      }}
    >
      <View style={{ gap: 4, flex: 1 }}>
        <Text style={{ color: theme.text, fontSize: theme.fontSize.md, fontFamily: theme.fontFamily.medium }}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>{subtitle}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );

  const body = (
    <View
      style={{
        gap: theme.space.xs,
        paddingVertical: theme.space.sm,
        paddingHorizontal: theme.space.md,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.glassBorder,
        backgroundColor: theme.glass,
      }}
    >
      {row}
      {divider ? <View style={{ height: 1, backgroundColor: theme.divider }} /> : null}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      {body}
    </Pressable>
  );
}

export function SegButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        height: 38,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: active ? theme.accent : theme.glassBorder,
        backgroundColor: active ? (theme.isDark ? "rgba(192, 132, 252, 0.18)" : "rgba(139, 92, 246, 0.14)") : theme.glass,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: active ? theme.accent : theme.text, fontSize: theme.fontSize.sm, fontFamily: theme.fontFamily.medium }}>
        {label}
      </Text>
    </Pressable>
  );
}

// Backwards-compatible names for existing screens
export const Header = TopBar;
export const Btn = Button;
