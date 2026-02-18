import React from "react";
import { Appearance, type TextStyle, Platform } from "react-native";

export type ThemeMode = "light" | "dark" | "system";

export type Theme = {
  mode: "light" | "dark";
  isDark: boolean;

  bg: string;
  panel: string;
  panel2: string;
  text: string;
  muted: string;
  line: string;
  divider: string;

  glass: string;
  glassBorder: string;
  modalOverlay: string;
  modalGlass: string;

  accent: string;
  accentGradient: [string, string];
  success: string;
  successGradient: [string, string];
  warn: string;
  danger: string;
  dangerGradient: [string, string];

  fontFamily: {
    regular: string;
    medium: string;
    semibold: string;
    bold: string;
  };
  mono: string;
  fontSize: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  fontWeight: {
    regular: TextStyle["fontWeight"];
    medium: TextStyle["fontWeight"];
    semibold: TextStyle["fontWeight"];
    bold: TextStyle["fontWeight"];
  };
  lineHeight: { sm: number; md: number; lg: number };

  space: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number };
  radius: { sm: number; md: number; lg: number; xl: number; pill: number };

  shadow: {
    sm: { color: string; opacity: number; radius: number; offset: { width: number; height: number }; elevation: number };
    md: { color: string; opacity: number; radius: number; offset: { width: number; height: number }; elevation: number };
    lg: { color: string; opacity: number; radius: number; offset: { width: number; height: number }; elevation: number };
    glow: { color: string; opacity: number; radius: number; offset: { width: number; height: number }; elevation: number };
  };

  animation: { fast: number; normal: number; slow: number; spring: { damping: number; stiffness: number } };
  hitSlop: {
    sm: { top: number; bottom: number; left: number; right: number };
    md: { top: number; bottom: number; left: number; right: number };
  };

  textSize: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number };
};

const TOKENS = {
  fontFamily: {
    regular: "SpaceGrotesk_400Regular",
    medium: "SpaceGrotesk_500Medium",
    semibold: "SpaceGrotesk_600SemiBold",
    bold: "SpaceGrotesk_700Bold",
  },
  fontSize: { xs: 10, sm: 12, md: 15, lg: 20, xl: 28, xxl: 36 },
  fontWeight: { regular: "400", medium: "500", semibold: "600", bold: "700" } as const,
  lineHeight: { sm: 18, md: 22, lg: 36 },
  space: { xs: 4, sm: 8, md: 12, lg: 20, xl: 28, xxl: 40 },
  radius: { sm: 0, md: 2, lg: 4, xl: 8, pill: 999 },
  hitSlop: {
    sm: { top: 8, bottom: 8, left: 8, right: 8 },
    md: { top: 14, bottom: 14, left: 14, right: 14 },
  },
};

function createTheme(mode: "light" | "dark"): Theme {
  if (mode === "dark") {
    return {
      mode,
      isDark: true,

      bg: "#000000",
      panel: "#111111",
      panel2: "#1A1A1A",
      text: "#FFFFFF",
      muted: "#666666",
      line: "#222222",
      divider: "#111111",

      glass: "#111111",
      glassBorder: "#222222",
      modalOverlay: "rgba(0,0,0,0.88)",
      modalGlass: "#111111",

      accent: "#14B8A6",
      accentGradient: ["#14B8A6", "#0D9488"],
      success: "#22C55E",
      successGradient: ["#22C55E", "#16A34A"],
      warn: "#F59E0B",
      danger: "#DC2626",
      dangerGradient: ["#DC2626", "#B91C1C"],

      fontFamily: TOKENS.fontFamily,
      mono: "monospace",
      fontSize: TOKENS.fontSize,
      fontWeight: TOKENS.fontWeight,
      lineHeight: TOKENS.lineHeight,
      space: TOKENS.space,
      radius: TOKENS.radius,

      shadow: {
        sm: { color: "#000", opacity: 0.5, radius: 4, offset: { width: 0, height: 2 }, elevation: 2 },
        md: { color: "#000", opacity: 0.6, radius: 8, offset: { width: 0, height: 4 }, elevation: 4 },
        lg: { color: "#000", opacity: 0.7, radius: 16, offset: { width: 0, height: 8 }, elevation: 8 },
        glow: { color: "#14B8A6", opacity: 0.3, radius: 20, offset: { width: 0, height: 0 }, elevation: 0 },
      },

      animation: { fast: 120, normal: 200, slow: 350, spring: { damping: 20, stiffness: 300 } },
      hitSlop: TOKENS.hitSlop,
      textSize: TOKENS.fontSize,
    };
  }

  return {
    mode,
    isDark: false,

    bg: "#F5F4F0",
    panel: "#FFFFFF",
    panel2: "#ECE9E2",
    text: "#111111",
    muted: "#8A8A80",
    line: "#DDD8CE",
    divider: "#ECE9E2",

    glass: "#FFFFFF",
    glassBorder: "#DDD8CE",
    modalOverlay: "rgba(0,0,0,0.5)",
    modalGlass: "#FFFFFF",

    accent: "#0D9488",
    accentGradient: ["#0D9488", "#0F766E"],
    success: "#16A34A",
    successGradient: ["#16A34A", "#15803D"],
    warn: "#D97706",
    danger: "#DC2626",
    dangerGradient: ["#DC2626", "#B91C1C"],

    fontFamily: TOKENS.fontFamily,
    mono: "monospace",
    fontSize: TOKENS.fontSize,
    fontWeight: TOKENS.fontWeight,
    lineHeight: TOKENS.lineHeight,
    space: TOKENS.space,
    radius: TOKENS.radius,

    shadow: {
      sm: { color: "#8A8A80", opacity: 0.08, radius: 4, offset: { width: 0, height: 2 }, elevation: 2 },
      md: { color: "#8A8A80", opacity: 0.12, radius: 8, offset: { width: 0, height: 4 }, elevation: 4 },
      lg: { color: "#8A8A80", opacity: 0.16, radius: 16, offset: { width: 0, height: 8 }, elevation: 8 },
      glow: { color: "#0D9488", opacity: 0.15, radius: 20, offset: { width: 0, height: 0 }, elevation: 0 },
    },

    animation: { fast: 120, normal: 200, slow: 350, spring: { damping: 20, stiffness: 300 } },
    hitSlop: TOKENS.hitSlop,
    textSize: TOKENS.fontSize,
  };
}

const listeners = new Set<() => void>();
let currentMode: ThemeMode = "system";

function getSystemColorScheme(): "dark" | "light" {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return Appearance.getColorScheme() === "dark" ? "dark" : "light";
}

let currentTheme: Theme = createTheme(getSystemColorScheme());

function resolveMode(mode: ThemeMode) {
  return mode === "system" ? getSystemColorScheme() : mode;
}

function notify() {
  listeners.forEach((cb) => cb());
}

export function setThemeMode(mode: ThemeMode) {
  currentMode = mode;
  currentTheme = createTheme(resolveMode(mode));
  notify();
}

export function getThemeMode(): ThemeMode {
  return currentMode;
}

export function getTheme(): Theme {
  return currentTheme;
}

let appearanceSubAttached = false;
function ensureAppearanceListener() {
  if (appearanceSubAttached) return;
  appearanceSubAttached = true;
  Appearance.addChangeListener(() => {
    if (currentMode === "system") {
      currentTheme = createTheme(resolveMode("system"));
      notify();
    }
  });
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", () => {
      if (currentMode === "system") {
        currentTheme = createTheme(resolveMode("system"));
        notify();
      }
    });
  }
}

const ThemeContext = React.createContext<Theme>(currentTheme);

function useThemeState() {
  const [s, setS] = React.useState(currentTheme);
  React.useEffect(() => {
    ensureAppearanceListener();
    const cb = () => setS(currentTheme);
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }, []);
  return s;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const s = useThemeState();
  return React.createElement(ThemeContext.Provider, { value: s }, children);
}

export function useTheme(): Theme {
  return React.useContext(ThemeContext);
}

export const theme = new Proxy({} as Theme, {
  get(_t, p) { return (currentTheme as any)[p as keyof Theme]; },
});
