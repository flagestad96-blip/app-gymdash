// app/(tabs)/_layout.tsx — Aurora bottom-tab shell.
//
// Home · Stats · ➕ Start (FAB) · Log · You
//
// The FAB is not a tab; it pushes `/workout` and always sits above the glass bar.

import React, { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/theme";
import { useI18n } from "../../src/i18n";
import { getDbInfo } from "../../src/db";

type WebInfo = { persistent: boolean; note: string };

export default function TabLayout() {
  const theme = useTheme();
  const { t } = useI18n();
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
            {t("web.storageDisabled", { note: webInfo.note })}
          </Text>
        </View>
      ) : null}

      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: "transparent" },
        }}
        tabBar={(props) => <AuroraTabBar {...props} />}
      >
        <Tabs.Screen name="index" options={{ title: t("nav.home") }} />
        <Tabs.Screen name="stats" options={{ title: t("nav.stats") }} />
        <Tabs.Screen name="log" options={{ title: t("nav.log") }} />
        <Tabs.Screen name="profile" options={{ title: t("nav.profile") }} />
      </Tabs>
    </View>
  );
}

// ── Tab bar ──────────────────────────────────────────────────────────────────

type IconName = keyof typeof MaterialIcons.glyphMap;

type TabKey = "index" | "stats" | "log" | "profile";

const TAB_ICON: Record<TabKey, IconName> = {
  index: "home",
  stats: "trending-up",
  log: "calendar-today",
  profile: "person",
};

function AuroraTabBar({ state, navigation }: any) {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Two tabs on each side of the center FAB. Drop any route the tabs layout
  // doesn't explicitly surface (belt-and-suspenders in case extra routes
  // sneak into the group).
  const visible = state.routes.filter((r: any) => (TAB_ICON as any)[r.name] !== undefined);
  const left = visible.slice(0, Math.ceil(visible.length / 2));
  const right = visible.slice(Math.ceil(visible.length / 2));

  const renderTab = (route: any) => {
    const focused = state.index === state.routes.indexOf(route);
    const icon = TAB_ICON[route.name as TabKey];
    const label = t(`nav.${route.name === "index" ? "home" : route.name}`);
    const color = focused ? "#ffffff" : "rgba(255,255,255,0.5)";

    return (
      <Pressable
        key={route.key}
        onPress={() => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        }}
        style={{
          flex: 1,
          height: 50,
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <MaterialIcons name={icon} size={22} color={color} />
        <Text style={{ color, fontSize: 9, fontFamily: theme.fontFamily.medium, letterSpacing: 0.2 }}>
          {label}
        </Text>
      </Pressable>
    );
  };

  const onStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push("/workout");
  };

  return (
    <View
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: Math.max(insets.bottom, 12),
        zIndex: 5,
      }}
    >
      {/* Shell — holds the shadow and lets the FAB's translateY(-8) spill
          above. `overflow: visible` is critical for that. */}
      <View
        style={{
          borderRadius: 26,
          shadowColor: "#000",
          shadowOpacity: 0.55,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 14 },
          elevation: 14,
        }}
      >
        {/* Clipped glass layer — absoluteFill sibling of the tab row, holds
            blur + gradient + border + veil, clipped to the rounded shape. */}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: 26,
              borderWidth: 1,
              borderColor: `rgba(255,255,255,${(theme.glassStroke * 1.2).toFixed(3)})`,
              backgroundColor: "rgba(10, 13, 26, 0.72)",
              overflow: "hidden",
            },
          ]}
        >
          <BlurView intensity={theme.glassIntensity} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={[
              `rgba(255,255,255,${(theme.glassFillA * 1.5).toFixed(3)})`,
              `rgba(255,255,255,${(theme.glassFillB * 1.5).toFixed(3)})`,
            ]}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {/* Tab row — in flow (defines the shell's height). FAB spills above
            thanks to shell's overflow: visible. */}
        <View
          style={{
            padding: 8,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
        {left.map(renderTab)}

        {/* Center FAB */}
        <Pressable
          onPress={onStart}
          style={{
            width: 50,
            height: 50,
            borderRadius: 16,
            marginHorizontal: 6,
            transform: [{ translateY: -8 }],
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            shadowColor: theme.aurora.violet,
            shadowOpacity: 0.6,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 10,
          }}
          accessibilityRole="button"
          accessibilityLabel={t("nav.start")}
        >
          <LinearGradient
            colors={theme.auroraGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
          />
          <MaterialIcons name="add" size={24} color="#fff" />
        </Pressable>

        {right.map(renderTab)}
        </View>
      </View>
    </View>
  );
}
