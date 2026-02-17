// src/i18n/index.ts — Re-exports everything so existing imports keep working
import React, { createContext, useContext, useState, useCallback } from "react";
import * as Localization from "expo-localization";
import { getSettingAsync, setSettingAsync } from "../db";
import { nb, en } from "./merge";

export type { TranslationMap } from "./types";
export type { Locale } from "./types";
import type { Locale } from "./types";

const translations: Record<Locale, Record<string, string>> = { nb, en };

// ── State ──
let currentLocale: Locale = "en";
let listeners: Array<() => void> = [];

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale) {
  if (locale === currentLocale) return;
  currentLocale = locale;
  setSettingAsync("locale", locale).catch(() => {});
  for (const fn of listeners) fn();
}

export async function loadLocale() {
  try {
    const saved = await getSettingAsync("locale");
    if (saved === "en" || saved === "nb") {
      currentLocale = saved;
      return;
    }
    // No saved setting - detect from device
    const deviceLocale = Localization.getLocales()[0];
    const languageCode = deviceLocale?.languageCode ?? "en";
    // Default to Norwegian only if device language is Norwegian
    currentLocale = languageCode === "nb" || languageCode === "no" ? "nb" : "en";
    // Save the detected default so it persists
    await setSettingAsync("locale", currentLocale);
  } catch {
    currentLocale = "en";
  }
}

function subscribe(fn: () => void) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

/**
 * Get a translated string. Supports simple {key} interpolation.
 * Example: t("log.dayLabel", { n: 3 }) → "Dag 3"
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const map = translations[currentLocale] ?? nb;
  let str = map[key] ?? nb[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return str;
}

// ── React integration ──

type I18nContextValue = {
  locale: Locale;
  t: typeof t;
  setLocale: typeof setLocale;
};

const I18nContext = createContext<I18nContextValue>({
  locale: "nb",
  t,
  setLocale,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(currentLocale);

  React.useEffect(() => {
    return subscribe(() => {
      setLocaleState(currentLocale);
    });
  }, []);

  const value = React.useMemo<I18nContextValue>(
    () => ({ locale, t, setLocale }),
    [locale]
  );

  return React.createElement(I18nContext.Provider, { value }, children);
}

export function useI18n() {
  return useContext(I18nContext);
}
