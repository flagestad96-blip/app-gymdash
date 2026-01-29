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

const WATERMARK = "UI v2";

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
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: theme.bg }, style]}>
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
        <View style={{ gap: 4, flex: 1 }}>
          <Text
            style={{
              color: theme.text,
              fontSize: theme.fontSize.xxl,
              fontWeight: theme.fontWeight.semibold,
              lineHeight: theme.lineHeight.lg,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{
                color: theme.muted,
                fontSize: theme.fontSize.sm,
                lineHeight: theme.lineHeight.md,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        {right}
        <View
          style={{
            borderRadius: theme.radius.pill,
            borderWidth: 1,
            borderColor: theme.line,
            backgroundColor: theme.panel2,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>
            {WATERMARK}
          </Text>
        </View>
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
          color: theme.muted,
          fontFamily: theme.mono,
          fontSize: theme.fontSize.xs,
          letterSpacing: 1,
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
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.panel,
          borderColor: theme.line,
          borderWidth: 1,
          borderRadius: theme.radius.xl,
          padding: theme.space.lg,
          gap: theme.space.sm,
          shadowColor: theme.shadow.sm.color,
          shadowOpacity: theme.shadow.sm.opacity,
          shadowRadius: theme.shadow.sm.radius,
          shadowOffset: theme.shadow.sm.offset,
          elevation: theme.shadow.sm.elevation,
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
  const theme = useTheme();
  const isGhost = tone === "ghost";
  const isPrimary = tone === "accent";
  const isDanger = tone === "danger";
  const bg = isPrimary ? theme.accent : isDanger ? theme.danger : isGhost ? "transparent" : theme.panel;
  const borderColor = isGhost ? "transparent" : isPrimary ? theme.accent : isDanger ? theme.danger : theme.line;
  const textColor = isPrimary || isDanger ? "#FFFFFF" : isGhost ? theme.accent : theme.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        height: small ? 34 : 46,
        paddingHorizontal: small ? 12 : 18,
        borderRadius: theme.radius.lg,
        borderWidth: isGhost ? 0 : 1,
        borderColor,
        backgroundColor: bg,
        opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        alignItems: "center",
        justifyContent: "center",
        shadowColor: isPrimary ? theme.shadow.sm.color : "transparent",
        shadowOpacity: isPrimary ? theme.shadow.sm.opacity : 0,
        shadowRadius: isPrimary ? theme.shadow.sm.radius : 0,
        shadowOffset: isPrimary ? theme.shadow.sm.offset : { width: 0, height: 0 },
        elevation: isPrimary ? theme.shadow.sm.elevation : 0,
      })}
    >
      <Text style={{ color: textColor, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold }}>
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
  const theme = useTheme();
  const isAccent = tone === "accent" || active;
  const borderColor = tone === "danger" ? theme.danger : isAccent ? theme.accent : theme.line;
  const bg = tone === "danger" ? "#FEE2E2" : isAccent ? "#E0E7FF" : theme.panel2;
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
      <Text style={{ color: textColor, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.medium }}>
        {text}
      </Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
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
  const theme = useTheme();
  const borderColor = tone === "danger" ? theme.danger : tone === "accent" ? theme.accent : theme.line;
  const tint = tone === "danger" ? theme.danger : tone === "accent" ? theme.accent : theme.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={theme.hitSlop.md}
      style={({ pressed }) => ({
        borderColor,
        borderWidth: 1,
        borderRadius: theme.radius.md,
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: theme.panel,
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
  ...rest
}: TextInputProps & { style?: StyleProp<TextStyle> }) {
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
          style,
          {
            color: theme.text,
            backgroundColor: theme.panel,
            borderColor: error ? theme.danger : focused ? theme.accent : theme.line,
            borderWidth: 1,
            borderRadius: theme.radius.lg,
            paddingHorizontal: theme.space.md,
            paddingVertical: 10,
            fontSize: theme.fontSize.md,
            lineHeight: theme.lineHeight.md,
          },
        ]}
      />
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
        <Text style={{ color: theme.text, fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.medium }}>
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
        borderColor: theme.line,
        backgroundColor: theme.panel,
      }}
    >
      {row}
      {divider ? <View style={{ height: 1, backgroundColor: theme.line }} /> : null}
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
        borderColor: active ? theme.accent : theme.line,
        backgroundColor: active ? "#E0E7FF" : theme.panel,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: active ? theme.accent : theme.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium }}>
        {label}
      </Text>
    </Pressable>
  );
}

// Backwards-compatible names for existing screens
export const Header = TopBar;
export const Btn = Button;
