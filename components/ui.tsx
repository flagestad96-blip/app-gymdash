import React from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { theme } from "../src/theme";

export function Screen({
  children,
  style,
  edges = ["top", "left", "right"],
}: {
  children: React.ReactNode;
  style?: object;
  edges?: Edge[];
}) {
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: theme.bg }, style]}>
      {children}
    </SafeAreaView>
  );
}

export function Header({
  title,
  left,
  right,
}: {
  title: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
        {left}
        <Text style={{ color: theme.text, fontSize: 22, fontFamily: theme.mono }}>{title}</Text>
      </View>
      {right ? <View style={{ alignItems: "flex-end", gap: 6 }}>{right}</View> : null}
    </View>
  );
}

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: theme.panel,
        borderColor: theme.line,
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        gap: 10,
      }}
    >
      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>{title}</Text>
      {children}
    </View>
  );
}

export function Chip({
  text,
  active,
  onPress,
}: {
  text: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const body = (
    <View
      style={{
        borderColor: active ? theme.accent : theme.line,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 7,
        backgroundColor: theme.panel2,
      }}
    >
      <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 12 }}>{text}</Text>
    </View>
  );
  if (!onPress) return body;
  return <Pressable onPress={onPress}>{body}</Pressable>;
}

export function Btn({
  label,
  onPress,
  tone = "normal",
}: {
  label: string;
  onPress: () => void;
  tone?: "normal" | "danger" | "accent";
}) {
  const borderColor = tone === "danger" ? theme.danger : tone === "accent" ? theme.accent : theme.line;
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderColor,
        borderWidth: 1,
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: theme.panel2,
        alignItems: "center",
      }}
    >
      <Text style={{ color: theme.text, fontFamily: theme.mono }}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  size = 18,
  tone = "normal",
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  size?: number;
  tone?: "normal" | "accent";
}) {
  const borderColor = tone === "accent" ? theme.accent : theme.line;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={{
        borderColor,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: theme.panel2,
      }}
    >
      <MaterialIcons name={icon} size={size} color={theme.text} />
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
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: active ? theme.accent : theme.line,
        backgroundColor: theme.panel2,
        alignItems: "center",
      }}
    >
      <Text style={{ color: theme.text, fontFamily: theme.mono }}>{label}</Text>
    </Pressable>
  );
}
