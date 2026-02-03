import React, { useEffect, useState } from "react";
import { Drawer } from "expo-router/drawer";
import { usePathname, useRouter } from "expo-router";
import { DrawerContentScrollView } from "@react-navigation/drawer";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import { Pressable, Text, View } from "react-native";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { initDb, getSettingAsync } from "../src/db";
import { ThemeProvider, useTheme, setThemeMode, type ThemeMode } from "../src/theme";
import { I18nProvider, loadLocale, useI18n } from "../src/i18n";
import { AppBackground } from "../src/components/AppBackground";
import GymdashLogo from "../src/components/GymdashLogo";
import ProgramStore from "../src/programStore";
import { loadWeightUnit } from "../src/units";
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
  const activeBg = theme.isDark ? "rgba(182, 104, 245, 0.18)" : "rgba(124, 58, 237, 0.1)";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        borderColor: active ? theme.accent : theme.glassBorder,
        borderWidth: 1,
        borderRadius: theme.radius.xl,
        paddingVertical: 14,
        paddingHorizontal: 18,
        backgroundColor: active ? activeBg : theme.glass,
        opacity: pressed ? 0.85 : 1,
        shadowColor: theme.shadow.sm.color,
        shadowOpacity: active ? theme.shadow.md.opacity : 0,
        shadowRadius: active ? theme.shadow.md.radius : 0,
        shadowOffset: theme.shadow.sm.offset,
        elevation: active ? theme.shadow.sm.elevation : 0,
      })}
    >
      <Text
        style={{
          color: active ? theme.accent : theme.text,
          fontSize: theme.fontSize.sm,
          fontFamily: active ? theme.fontFamily.bold : theme.fontFamily.medium,
          letterSpacing: 0.3,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function CustomDrawerContent(props: any) {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const pathnameRaw = usePathname();
  const pathname = pathnameRaw === "/index" ? "/" : pathnameRaw;
  const version =
    Constants.expoConfig?.version ?? (Constants as unknown as { manifest?: { version?: string } })?.manifest?.version ?? "dev";

  const items: DrawerItem[] = [
    { label: t("nav.home"), path: "/" },
    { label: t("nav.log"), path: "/log" },
    { label: t("nav.program"), path: "/program" },
    { label: t("nav.analysis"), path: "/analysis" },
    { label: t("nav.achievements"), path: "/achievements" },
    { label: t("nav.body"), path: "/body" },
    { label: t("nav.calendar"), path: "/calendar" },
    { label: t("nav.settings"), path: "/settings" },
    { label: t("nav.backup"), path: "/settings" },
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
      contentContainerStyle={{ flexGrow: 1, padding: theme.space.xl, backgroundColor: "transparent" }}
    >
      <View style={{ gap: 6 }}>
        <GymdashLogo size={48} variant="mark" />
        <Text style={{ color: theme.text, fontSize: theme.fontSize.xl, fontFamily: theme.fontFamily.semibold }}>
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
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider>
      <I18nProvider>
        <RootLayoutInner />
      </I18nProvider>
    </ThemeProvider>
  );
}

function RootLayoutInner() {
  const theme = useTheme();
  const MIN_DURATION_MS = 1400;
  const HARD_TIMEOUT_MS = 6000;
  const [appReady, setAppReady] = useState(false);
  const [minPassed, setMinPassed] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      if (alive) setMinPassed(true);
    }, MIN_DURATION_MS);
    const hardTimeout = setTimeout(() => {
      if (alive) setAppReady(true);
    }, HARD_TIMEOUT_MS);

    (async () => {
      try {
        await initDb();
        await loadLocale();
        await loadWeightUnit();
        await ProgramStore.ensurePrograms();
        const modeRaw = await getSettingAsync("themeMode");
        const mode: ThemeMode =
          modeRaw === "light" || modeRaw === "dark" || modeRaw === "system" ? modeRaw : "system";
        setThemeMode(mode);
      } catch {
      } finally {
        if (alive) setAppReady(true);
        clearTimeout(hardTimeout);
      }
    })();

    return () => {
      alive = false;
      clearTimeout(timer);
      clearTimeout(hardTimeout);
    };
  }, []);

  useEffect(() => {
    if (appReady && minPassed) setFadeOut(true);
  }, [appReady, minPassed]);

  useEffect(() => {
    if (!fadeOut) return;
    const t = setTimeout(() => setShowSplash(false), 320);
    return () => clearTimeout(t);
  }, [fadeOut]);

  useEffect(() => {
    if (!appReady || !minPassed) return;
    const t = setTimeout(() => setShowSplash(false), 1200);
    return () => clearTimeout(t);
  }, [appReady, minPassed]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={theme.isDark ? "light" : "dark"} backgroundColor="transparent" translucent />
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
          <AppBackground />
          {appReady ? (
            <Drawer
              drawerContent={(props) => <CustomDrawerContent {...props} />}
              screenOptions={{
                headerShown: false,
                drawerStyle: { backgroundColor: theme.isDark ? "rgba(13, 11, 26, 0.92)" : "rgba(248, 245, 255, 0.92)" },
                sceneStyle: { backgroundColor: "transparent" },
              }}
            >
              <Drawer.Screen name="(tabs)" />
            </Drawer>
          ) : null}
          {showSplash && !appReady ? (
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
              <SplashScreen fadeOut={fadeOut} onFadeOutEnd={() => setShowSplash(false)} />
            </View>
          ) : null}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
