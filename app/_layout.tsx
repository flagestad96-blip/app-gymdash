// app/_layout.tsx — Root layout for the aurora redesign.
//
// Stack-based navigation:
//   (tabs)           → bottom-tab group (Home / Stats / FAB / Log / Profile)
//   onboarding       → 3-step welcome, gated by onboarding_completed
//   workout          → live session, pushed from the FAB
//   summary          → non-skippable post-workout wrap-up
//   library          → exercise library (pushed from Home or Profile)
//   exercise-detail  → per-exercise drill-down (pushed from Library)
//   nutrition        → macros + log (pushed from Home or Profile)
//
// The drawer and the old light/dark theme switch are gone.

import React, { useEffect, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { View, InteractionManager } from "react-native";
import {
  useFonts,
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from "@expo-google-fonts/instrument-serif";
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium, JetBrainsMono_600SemiBold } from "@expo-google-fonts/jetbrains-mono";
import { initDb, getSettingAsync } from "../src/db";
import {
  ThemeProvider,
  useTheme,
  setPalette,
  setGlassIntensity,
  type Palette,
  PALETTE_LIST,
} from "../src/theme";
import { I18nProvider, loadLocale } from "../src/i18n";
import { AppBackground } from "../src/components/AppBackground";
import ProgramStore from "../src/programStore";
import { loadWeightUnit } from "../src/units";
import { loadUserPreferences, getUserPreferences } from "../src/userPreferences";
import SplashScreen from "../components/SplashScreen";
import ErrorBoundary, { DARK_FALLBACK_COLORS } from "../src/components/ErrorBoundary";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
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
  const router = useRouter();
  const MIN_DURATION_MS = 1400;
  const HARD_TIMEOUT_MS = 6000;
  const [appReady, setAppReady] = useState(false);
  const [minPassed, setMinPassed] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

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
        await loadUserPreferences();

        const paletteRaw = await getSettingAsync("theme_palette");
        if (paletteRaw && (PALETTE_LIST as string[]).includes(paletteRaw)) {
          setPalette(paletteRaw as Palette);
        }
        const intensityRaw = await getSettingAsync("theme_glass_intensity");
        const parsedIntensity = parseInt(intensityRaw ?? "", 10);
        if (Number.isFinite(parsedIntensity)) {
          setGlassIntensity(parsedIntensity);
        }

        if (alive) setOnboardingDone(getUserPreferences().onboardingCompleted);
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
    const id = setTimeout(() => setShowSplash(false), 320);
    return () => clearTimeout(id);
  }, [fadeOut]);

  useEffect(() => {
    if (!appReady || !minPassed) return;
    const id = setTimeout(() => setShowSplash(false), 1200);
    return () => clearTimeout(id);
  }, [appReady, minPassed]);

  // Warm the active program in memory so the first tab open is instant.
  useEffect(() => {
    if (!appReady) return;
    const task = InteractionManager.runAfterInteractions(async () => {
      try {
        const pmRaw = await getSettingAsync("programMode");
        const pm = pmRaw === "back" ? "back" : "normal";
        const active = await ProgramStore.getActiveProgram(pm);
        await ProgramStore.getAlternativesForProgram(active.id);
      } catch {
        // Silent — each tab loads its own data if this fails.
      }
    });
    return () => task.cancel();
  }, [appReady]);

  // Onboarding gate — first-time users land in the aurora welcome flow.
  useEffect(() => {
    if (!appReady) return;
    if (onboardingDone === false) {
      router.replace("/onboarding");
    }
  }, [appReady, onboardingDone, router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="transparent" translucent />
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
          <AppBackground />
          {appReady ? (
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "transparent" },
                animation: "fade",
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
              <Stack.Screen name="workout" options={{ animation: "slide_from_bottom" }} />
              <Stack.Screen name="summary" options={{ animation: "slide_from_bottom", gestureEnabled: false }} />
              <Stack.Screen name="library" />
              <Stack.Screen name="exercise-detail" />
              <Stack.Screen name="nutrition" />
            </Stack>
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
