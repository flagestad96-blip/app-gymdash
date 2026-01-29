import React, { useEffect, useState } from "react";
import { Drawer } from "expo-router/drawer";
import { usePathname, useRouter } from "expo-router";
import { DrawerContentScrollView } from "@react-navigation/drawer";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import { Pressable, Text, View } from "react-native";
import { initDb, getSettingAsync } from "../src/db";
import { ThemeProvider, useTheme, setThemeMode, type ThemeMode } from "../src/theme";
import GymdashLogo from "../src/components/GymdashLogo";
import ProgramStore from "../src/programStore";
import SplashScreen from "../components/SplashScreen";

type DrawerItem = {
  label: string;
  path: string;
};

function DrawerRow({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const activeBg = theme.isDark ? "rgba(34, 211, 238, 0.16)" : "#E0E7FF";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        borderColor: active ? theme.accent : theme.line,
        borderWidth: 1,
        borderRadius: theme.radius.xl,
        paddingVertical: 14,
        paddingHorizontal: 18,
        backgroundColor: active ? activeBg : theme.panel,
        opacity: pressed ? 0.9 : 1,
        shadowColor: theme.shadow.sm.color,
        shadowOpacity: theme.shadow.sm.opacity,
        shadowRadius: theme.shadow.sm.radius,
        shadowOffset: theme.shadow.sm.offset,
        elevation: theme.shadow.sm.elevation,
      })}
    >
      <Text style={{ color: theme.text, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold }}>
        {label}
      </Text>
    </Pressable>
  );
}

function CustomDrawerContent(props: any) {
  const theme = useTheme();
  const router = useRouter();
  const pathnameRaw = usePathname();
  const pathname = pathnameRaw === "/index" ? "/" : pathnameRaw;
  const version =
    Constants.expoConfig?.version ?? (Constants as unknown as { manifest?: { version?: string } })?.manifest?.version ?? "dev";

  const items: DrawerItem[] = [
    { label: "Logg", path: "/" },
    { label: "Program", path: "/program" },
    { label: "Analyse", path: "/analysis" },
    { label: "Kropp", path: "/body" },
    { label: "Kalender", path: "/calendar" },
    { label: "Innstillinger", path: "/settings" },
    { label: "Backup / Import", path: "/settings" },
  ];

  function isActive(path: string) {
    if (path === "/") return pathname === "/" || pathname === "";
    return pathname.startsWith(path);
  }

  function navigate(path: string) {
    props?.navigation?.closeDrawer?.();
    router.replace(path as any);
  }

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={{ flexGrow: 1, padding: theme.space.xl, backgroundColor: theme.bg }}
    >
      <View style={{ gap: 6 }}>
        <GymdashLogo size={48} variant="mark" />
        <Text style={{ color: theme.text, fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.semibold }}>
          Gymdash
        </Text>
        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>
          v{version}
        </Text>
      </View>

      <View style={{ flex: 1 }} />

      <View style={{ gap: theme.space.sm, marginTop: theme.space.xl, marginBottom: theme.space.xl }}>
        {items.map((item) => (
          <DrawerRow
            key={item.label}
            label={item.label}
            active={isActive(item.path)}
            onPress={() => navigate(item.path)}
          />
        ))}
      </View>
    </DrawerContentScrollView>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}

function RootLayoutInner() {
  const theme = useTheme();
  const MIN_DURATION_MS = 1400;
  const [appReady, setAppReady] = useState(false);
  const [minPassed, setMinPassed] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      if (alive) setMinPassed(true);
    }, MIN_DURATION_MS);

    (async () => {
      try {
        await initDb();
        await ProgramStore.ensurePrograms();
        const modeRaw = await getSettingAsync("themeMode");
        const mode: ThemeMode =
          modeRaw === "light" || modeRaw === "dark" || modeRaw === "system" ? modeRaw : "system";
        setThemeMode(mode);
      } finally {
        if (alive) setAppReady(true);
      }
    })();

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (appReady && minPassed) setFadeOut(true);
  }, [appReady, minPassed]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={theme.isDark ? "light" : "dark"} backgroundColor={theme.bg} />
        {appReady ? (
          <Drawer
            drawerContent={(props) => <CustomDrawerContent {...props} />}
            screenOptions={{
              headerShown: false,
              drawerStyle: { backgroundColor: theme.bg },
            }}
          >
            <Drawer.Screen name="(tabs)" />
          </Drawer>
        ) : null}
        {showSplash ? (
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
            <SplashScreen fadeOut={fadeOut} onFadeOutEnd={() => setShowSplash(false)} />
          </View>
        ) : null}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
