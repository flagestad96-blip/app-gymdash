import React from "react";
import { View, StyleSheet } from "react-native";
import { useTheme } from "../theme";

export function AppBackground() {
  const t = useTheme();
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: t.bg }]} pointerEvents="none" />;
}
