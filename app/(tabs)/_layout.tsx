// app/(tabs)/_layout.tsx
import React, { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { Platform, Text, View } from "react-native";
import { useTheme } from "../../src/theme";
import { getDbInfo } from "../../src/db";

type WebInfo = {
  persistent: boolean;
  note: string;
};

export default function TabLayout() {
  const theme = useTheme();
  const [webInfo, setWebInfo] = useState<WebInfo | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const update = () => setWebInfo(getDbInfo());
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const showWebBanner = Platform.OS === "web" && webInfo && !webInfo.persistent;

  return (
    <View style={{ flex: 1, backgroundColor: "transparent" }}>
      {showWebBanner ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            paddingVertical: 8,
            paddingHorizontal: 12,
            backgroundColor: theme.glass,
            borderBottomColor: theme.glassBorder,
            borderBottomWidth: 1,
          }}
        >
          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>
            Web: lagring er deaktivert ({webInfo.note}).
          </Text>
        </View>
      ) : null}

      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="log" />
        <Stack.Screen name="program" />
        <Stack.Screen name="analysis" />
        <Stack.Screen name="achievements" />
        <Stack.Screen name="body" />
        <Stack.Screen name="calendar" />
        <Stack.Screen name="history" />
        <Stack.Screen name="settings" />
      </Stack>
    </View>
  );
}
