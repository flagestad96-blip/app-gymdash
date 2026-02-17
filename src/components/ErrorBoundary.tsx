// src/components/ErrorBoundary.tsx
import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import * as Clipboard from "expo-clipboard";

export type FallbackColors = {
  bg: string;
  text: string;
  muted: string;
  accent: string;
};

/** Dark-theme fallback colors — used when ThemeProvider may have crashed */
export const DARK_FALLBACK_COLORS: FallbackColors = {
  bg: "#0D0B1A",
  text: "#F5F0FF",
  muted: "#A89CC8",
  accent: "#B668F5",
};

type Props = {
  children: React.ReactNode;
  fallbackColors?: FallbackColors;
};

type State = {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
};

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo.componentStack);
    this.setState({ componentStack: errorInfo.componentStack ?? null });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, componentStack: null });
  };

  handleCopy = async () => {
    const { error, componentStack } = this.state;
    const text = [
      error?.name ?? "Error",
      error?.message ?? "Unknown error",
      "",
      "Component stack:",
      componentStack ?? "(unavailable)",
    ].join("\n");
    try {
      await Clipboard.setStringAsync(text);
    } catch {}
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const c = this.props.fallbackColors ?? DARK_FALLBACK_COLORS;
    const { error } = this.state;

    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <Text style={{ fontSize: 40, marginBottom: 16 }}>{"\uD83D\uDEE0\uFE0F"}</Text>

        <Text style={{ color: c.text, fontSize: 20, fontWeight: "600", textAlign: "center", marginBottom: 8 }}>
          Something went wrong
        </Text>
        <Text style={{ color: c.muted, fontSize: 14, textAlign: "center", marginBottom: 20 }}>
          Noe gikk galt
        </Text>

        {error?.message ? (
          <ScrollView
            style={{ maxHeight: 80, marginBottom: 24, width: "100%" }}
            contentContainerStyle={{ paddingHorizontal: 4 }}
          >
            <Text
              style={{ color: c.muted, fontFamily: "monospace", fontSize: 12, textAlign: "center" }}
              numberOfLines={3}
            >
              {error.message}
            </Text>
          </ScrollView>
        ) : null}

        <Pressable
          onPress={this.handleRetry}
          style={({ pressed }) => ({
            backgroundColor: c.accent,
            borderRadius: 12,
            paddingVertical: 14,
            paddingHorizontal: 32,
            opacity: pressed ? 0.7 : 1,
            marginBottom: 12,
            minWidth: 200,
            alignItems: "center",
          })}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Try again / Pr\u00f8v igjen</Text>
        </Pressable>

        <Pressable
          onPress={this.handleCopy}
          style={({ pressed }) => ({
            borderColor: c.muted,
            borderWidth: 1,
            borderRadius: 12,
            paddingVertical: 12,
            paddingHorizontal: 32,
            opacity: pressed ? 0.7 : 1,
            minWidth: 200,
            alignItems: "center",
          })}
        >
          <Text style={{ color: c.muted, fontSize: 14 }}>Copy error / Kopier feil</Text>
        </Pressable>
      </View>
    );
  }
}
