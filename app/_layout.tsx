import React, { useEffect, useState } from "react";
import { Drawer } from "expo-router/drawer";
import { usePathname, useRouter } from "expo-router";
import { DrawerContentScrollView } from "@react-navigation/drawer";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import { Pressable, Text, View, InteractionManager } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useFonts } from "@expo-google-fonts/inter";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { InstrumentSerif_400Regular } from "@expo-google-fonts/instrument-serif";
import { JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono";
import { initDb, getSettingAsync } from "../src/db";
import { ThemeProvider, useTheme } from "../src/theme";
import { I18nProvider, loadLocale, useI18n } from "../src/i18n";
import { AppBackground } from "../src/components/AppBackground";
import GymdashLogo from "../src/components/GymdashLogo";
import ProgramStore from "../src/programStore";
import { loadWeightUnit } from "../src/units";
import SplashScreen from "../components/SplashScreen";
import { RestTimerProvider } from "../src/restTimerContext";
import FloatingRestTimer from "../src/components/FloatingRestTimer";
import ErrorBoundary, { DARK_FALLBACK_COLORS } from "../src/components/ErrorBoundary";

type DrawerIcon = keyof typeof MaterialIcons.glyphMap;
type DrawerItem = {
  label: string;
  path: string;
  icon: DrawerIcon;
};
type DrawerGroup = {
  title: string;
  items: DrawerItem[];
};

function DrawerRow({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: DrawerIcon;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: theme.space.md,
        borderColor: active ? theme.accent : "transparent",
        borderWidth: 1,
        borderRadius: theme.radius.lg,
        paddingVertical: 12,
        paddingHorizontal: 14,
        backgroundColor: active ? theme.accent + "26" : "transparent",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <MaterialIcons name={icon} size={20} color={active ? theme.accent : theme.muted} />
      <Text
        style={{
          color: active ? theme.accent : theme.text,
          fontSize: theme.fontSize.md,
          fontFamily: active ? theme.fontFamily.semibold : theme.fontFamily.medium,
          letterSpacing: 0.2,
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

  const groups: DrawerGroup[] = [
    {
      title: t("nav.group.train"),
      items: [
        { label: t("nav.home"), path: "/", icon: "home" },
        { label: t("nav.log"), path: "/log", icon: "fitness-center" },
        { label: t("nav.program"), path: "/program", icon: "list-alt" },
      ],
    },
    {
      title: t("nav.group.insight"),
      items: [
        { label: t("nav.analysis"), path: "/analysis", icon: "insights" },
        { label: t("nav.calendar"), path: "/calendar", icon: "calendar-today" },
        { label: t("nav.history"), path: "/history", icon: "history" },
        { label: t("nav.body"), path: "/body", icon: "monitor-weight" },
        { label: t("nav.achievements"), path: "/achievements", icon: "emoji-events" },
      ],
    },
    {
      title: t("nav.group.app"),
      items: [{ label: t("nav.settings"), path: "/settings", icon: "settings" }],
    },
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
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.space.sm, marginBottom: theme.space.xl }}>
        <GymdashLogo size={44} variant="mark" />
        <View style={{ gap: 2 }}>
          <Text style={{ color: theme.text, fontSize: theme.fontSize.xl, fontFamily: theme.fontFamily.semibold }}>
            Gymdash
          </Text>
          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>
            v{version}
          </Text>
        </View>
      </View>

      <View style={{ gap: theme.space.lg }}>
        {groups.map((group) => (
          <View key={group.title} style={{ gap: theme.space.xs }}>
            <Text
              style={{
                color: theme.muted,
                fontFamily: theme.mono,
                fontSize: theme.fontSize.xs,
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: 2,
                paddingHorizontal: 14,
              }}
            >
              {group.title}
            </Text>
            {group.items.map((item) => (
              <DrawerRow
                key={item.path}
                label={item.label}
                icon={item.icon}
                active={isActive(item.path)}
                onPress={() => navigate(item.path)}
              />
            ))}
          </View>
        ))}
      </View>
    </DrawerContentScrollView>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    // Aurora type system
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    InstrumentSerif_400Regular,
    JetBrainsMono_500Medium,
  });

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary fallbackColors={DARK_FALLBACK_COLORS}>
      <ThemeProvider>
        <I18nProvider>
          <ErrorBoundary>
            <RootLayoutInner />
          </ErrorBoundary>
        </I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
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

  // Background preload tab data after app is ready (low priority)
  useEffect(() => {
    if (!appReady) return;

    const task = InteractionManager.runAfterInteractions(async () => {
      try {
        // Preload active program and its data
        const pmRaw = await getSettingAsync("programMode");
        const pm = pmRaw === "back" ? "back" : "normal";
        const activeProgram = await ProgramStore.getActiveProgram(pm);
        await ProgramStore.getAlternativesForProgram(activeProgram.id);
        // This warm-loads the data into memory for faster tab opens
      } catch {
        // Silent fail - tabs will load their own data
      }
    });

    return () => task.cancel();
  }, [appReady]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <RestTimerProvider>
          <StatusBar style="light" backgroundColor="transparent" translucent />
          <View style={{ flex: 1, backgroundColor: theme.bg }}>
            <AppBackground />
            {appReady ? (
              <Drawer
                drawerContent={(props) => <CustomDrawerContent {...props} />}
                screenOptions={{
                  headerShown: false,
                  drawerStyle: { backgroundColor: "rgba(8, 10, 18, 0.94)" },
                  sceneStyle: { backgroundColor: "transparent" },
                }}
              >
                <Drawer.Screen name="(tabs)" />
              </Drawer>
            ) : null}
            {appReady ? <FloatingRestTimer /> : null}
            {showSplash && !appReady ? (
              <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
                <SplashScreen fadeOut={fadeOut} onFadeOutEnd={() => setShowSplash(false)} />
              </View>
            ) : null}
          </View>
        </RestTimerProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
