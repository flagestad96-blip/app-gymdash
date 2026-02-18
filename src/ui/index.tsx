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
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../theme";

export function Screen({
  children,
  style,
  edges = ["top", "left", "right"],
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  edges?: Edge[];
}) {
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
}: {
  title: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: t.space.md,
        paddingVertical: t.space.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.sm, flex: 1 }}>
        {left}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: t.text,
              fontSize: t.fontSize.xxl,
              fontFamily: t.fontFamily.bold,
              lineHeight: t.fontSize.xxl * 1.1,
              letterSpacing: -1,
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{
                color: t.muted,
                fontSize: t.fontSize.xs,
                fontFamily: t.mono,
                letterSpacing: 2,
                textTransform: "uppercase",
                marginTop: 2,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {right ? <View style={{ alignItems: "flex-end" }}>{right}</View> : null}
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: t.space.xs }}>
      <Text
        style={{
          color: t.muted,
          fontFamily: t.fontFamily.semibold,
          fontSize: t.fontSize.xs,
          letterSpacing: 2,
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
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  title?: string;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.panel,
          borderLeftWidth: 3,
          borderLeftColor: t.accent,
          borderRadius: 0,
          paddingVertical: t.space.lg,
          paddingHorizontal: t.space.lg,
          gap: t.space.md,
        },
        style,
      ]}
    >
      {title ? <SectionHeader title={title} /> : null}
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  tone = "normal",
  small,
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: "normal" | "danger" | "accent" | "ghost";
  small?: boolean;
  disabled?: boolean;
}) {
  const t = useTheme();
  const isPrimary = tone === "accent";
  const isDanger = tone === "danger";
  const isGhost = tone === "ghost";

  const bg = isPrimary ? t.accent : isDanger ? "transparent" : isGhost ? "transparent" : t.panel;
  const border = isDanger ? t.danger : isPrimary ? t.accent : isGhost ? "transparent" : t.line;
  const txt = isPrimary
    ? (t.isDark ? "#111111" : "#FFFFFF")
    : isDanger
      ? t.danger
      : isGhost
        ? t.accent
        : t.text;
  const rad = isPrimary ? t.radius.pill : t.radius.sm;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        height: small ? 38 : 52,
        paddingHorizontal: small ? 14 : 22,
        borderRadius: rad,
        borderWidth: isGhost ? 0 : isDanger ? 2 : 1,
        borderColor: border,
        backgroundColor: bg,
        opacity: disabled ? 0.35 : pressed ? 0.8 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
        alignItems: "center",
        justifyContent: "center",
      })}
    >
      <Text
        style={{
          color: txt,
          fontSize: small ? t.fontSize.sm : t.fontSize.md,
          fontFamily: t.fontFamily.bold,
          letterSpacing: 0.5,
          textTransform: isPrimary ? "uppercase" : "none",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Chip({
  text,
  active,
  onPress,
  tone,
}: {
  text: string;
  active?: boolean;
  onPress?: () => void;
  tone?: "normal" | "accent" | "danger";
}) {
  const t = useTheme();
  const isAccent = tone === "accent" || active;
  const isDanger = tone === "danger";

  const bg = isAccent ? t.accent : isDanger ? (t.isDark ? "rgba(220,38,38,0.15)" : "#FEE2E2") : "transparent";
  const border = isDanger ? t.danger : isAccent ? t.accent : t.line;
  const txt = isAccent ? (t.isDark ? "#111111" : "#FFFFFF") : isDanger ? t.danger : t.text;

  const body = (
    <View
      style={{
        borderColor: border,
        borderWidth: 1,
        borderRadius: t.radius.md,
        paddingHorizontal: 12,
        paddingVertical: 7,
        backgroundColor: bg,
      }}
    >
      <Text style={{ color: txt, fontSize: t.fontSize.xs, fontFamily: t.fontFamily.semibold, letterSpacing: 0.5 }}>
        {text}
      </Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
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
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  size?: number;
  tone?: "normal" | "accent" | "danger";
  disabled?: boolean;
}) {
  const t = useTheme();
  const tint = tone === "danger" ? t.danger : tone === "accent" ? t.accent : t.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={t.hitSlop.md}
      style={({ pressed }) => ({
        borderWidth: 1,
        borderColor: tone === "danger" ? t.danger : tone === "accent" ? t.accent : t.line,
        borderRadius: t.radius.sm,
        padding: 12,
        backgroundColor: t.panel,
        opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
        transform: [{ scale: pressed ? 0.92 : 1 }],
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
  const t = useTheme();
  const [focused, setFocused] = React.useState(false);
  const error = (rest as { error?: string }).error;
  const helperText = (rest as { helperText?: string }).helperText;
  const flat = (StyleSheet.flatten(style as any) || {}) as any;
  const layout: ViewStyle = {
    flex: flat.flex, width: flat.width, minWidth: flat.minWidth,
    maxWidth: flat.maxWidth, alignSelf: flat.alignSelf,
    marginTop: flat.marginTop, marginBottom: flat.marginBottom,
    marginLeft: flat.marginLeft, marginRight: flat.marginRight,
  };

  return (
    <View style={[{ gap: 4 }, layout]}>
      <View style={{ position: "relative", justifyContent: "center" }}>
        <TextInput
          {...rest}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          placeholderTextColor={t.muted}
          selectionColor={t.accent}
          style={[
            {
              color: t.text,
              backgroundColor: "transparent",
              borderBottomWidth: focused ? 2 : 1,
              borderBottomColor: error ? t.danger : focused ? t.accent : t.line,
              borderRadius: 0,
              paddingHorizontal: 2,
              paddingRight: suffix ? 32 : 2,
              paddingVertical: 12,
              fontSize: t.fontSize.md,
              fontFamily: t.fontFamily.regular,
              lineHeight: t.lineHeight.md,
            },
            style,
          ]}
        />
        {suffix ? (
          <Text
            style={{
              position: "absolute",
              right: 2,
              color: t.muted,
              fontFamily: t.mono,
              fontSize: t.fontSize.xs,
              letterSpacing: 0.5,
            }}
            pointerEvents="none"
          >
            {suffix}
          </Text>
        ) : null}
      </View>
      {error ? (
        <Text style={{ color: t.danger, fontSize: t.fontSize.xs, fontFamily: t.fontFamily.semibold }}>{error}</Text>
      ) : helperText ? (
        <Text style={{ color: t.muted, fontSize: t.fontSize.xs, fontFamily: t.fontFamily.regular }}>{helperText}</Text>
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
  const t = useTheme();

  const body = (
    <View
      style={{
        paddingVertical: t.space.md + 2,
        paddingHorizontal: t.space.md,
        backgroundColor: t.panel,
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: t.line,
        borderRadius: 0,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: t.space.sm }}>
        <View style={{ gap: 2, flex: 1 }}>
          <Text style={{ color: t.text, fontSize: t.fontSize.md, fontFamily: t.fontFamily.medium }}>{title}</Text>
          {subtitle ? (
            <Text style={{ color: t.muted, fontFamily: t.fontFamily.regular, fontSize: t.fontSize.xs }}>{subtitle}</Text>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
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
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        borderBottomWidth: active ? 3 : 1,
        borderBottomColor: active ? t.accent : t.line,
        backgroundColor: "transparent",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          color: active ? t.accent : t.muted,
          fontSize: t.fontSize.sm,
          fontFamily: active ? t.fontFamily.bold : t.fontFamily.regular,
          letterSpacing: 1,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export const Header = TopBar;
export const Btn = Button;
