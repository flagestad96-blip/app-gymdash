import React from "react";
import { Appearance, type TextStyle } from "react-native";

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
  accent: string;
  warn: string;
  danger: string;
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
  lineHeight: {
    sm: number;
    md: number;
    lg: number;
  };
  space: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    pill: number;
  };
  shadow: {
    sm: {
      color: string;
      opacity: number;
      radius: number;
      offset: { width: number; height: number };
      elevation: number;
    };
    md: {
      color: string;
      opacity: number;
      radius: number;
      offset: { width: number; height: number };
      elevation: number;
    };
  };
  hitSlop: {
    sm: { top: number; bottom: number; left: number; right: number };
    md: { top: number; bottom: number; left: number; right: number };
  };
  textSize: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
};

const TOKENS = {
  fontSize: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 22,
    xxl: 28,
  },
  fontWeight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  } as const,
  lineHeight: {
    sm: 16,
    md: 22,
    lg: 28,
  },
  space: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    xxl: 32,
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 18,
    xl: 22,
    pill: 999,
  },
  hitSlop: {
    sm: { top: 6, bottom: 6, left: 6, right: 6 },
    md: { top: 10, bottom: 10, left: 10, right: 10 },
  },
};

function createTheme(mode: "light" | "dark"): Theme {
  if (mode === "dark") {
    return {
      mode,
      isDark: true,
      bg: "#0B0F14",
      panel: "#141A23",
      panel2: "#1B2330",
      text: "#E8ECF3",
      muted: "#A1AEC0",
      line: "#2A3442",
      accent: "#22D3EE",
      warn: "#F59E0B",
      danger: "#F87171",
      mono: "monospace",
      fontSize: TOKENS.fontSize,
      fontWeight: TOKENS.fontWeight,
      lineHeight: TOKENS.lineHeight,
      space: TOKENS.space,
      radius: TOKENS.radius,
      shadow: {
        sm: {
          color: "#000000",
          opacity: 0.35,
          radius: 10,
          offset: { width: 0, height: 6 },
          elevation: 3,
        },
        md: {
          color: "#000000",
          opacity: 0.45,
          radius: 18,
          offset: { width: 0, height: 12 },
          elevation: 7,
        },
      },
      hitSlop: TOKENS.hitSlop,
      textSize: TOKENS.fontSize,
    };
  }

  return {
    mode,
    isDark: false,
    bg: "#F6F7FB",
    panel: "#FFFFFF",
    panel2: "#EEF1F7",
    text: "#0F172A",
    muted: "#64748B",
    line: "#E2E8F0",
    accent: "#4F46E5",
    warn: "#F59E0B",
    danger: "#EF4444",
    mono: "monospace",
    fontSize: TOKENS.fontSize,
    fontWeight: TOKENS.fontWeight,
    lineHeight: TOKENS.lineHeight,
    space: TOKENS.space,
    radius: TOKENS.radius,
    shadow: {
      sm: {
        color: "#0F172A",
        opacity: 0.08,
        radius: 8,
        offset: { width: 0, height: 4 },
        elevation: 2,
      },
      md: {
        color: "#0F172A",
        opacity: 0.12,
        radius: 16,
        offset: { width: 0, height: 10 },
        elevation: 6,
      },
    },
    hitSlop: TOKENS.hitSlop,
    textSize: TOKENS.fontSize,
  };
}

const listeners = new Set<() => void>();
let currentMode: ThemeMode = "system";
let currentTheme: Theme = createTheme(Appearance.getColorScheme() === "dark" ? "dark" : "light");

function resolveMode(mode: ThemeMode) {
  if (mode === "system") {
    return Appearance.getColorScheme() === "dark" ? "dark" : "light";
  }
  return mode;
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
}

const ThemeContext = React.createContext<Theme>(currentTheme);

function useThemeState() {
  const [themeState, setThemeState] = React.useState(currentTheme);
  React.useEffect(() => {
    ensureAppearanceListener();
    const cb = () => setThemeState(currentTheme);
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);
  return themeState;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeState = useThemeState();
  return React.createElement(ThemeContext.Provider, { value: themeState }, children);
}

export function useTheme(): Theme {
  return React.useContext(ThemeContext);
}

// Legacy export for screens still importing { theme }
export const theme = new Proxy({} as Theme, {
  get(_target, prop) {
    return (currentTheme as any)[prop as keyof Theme];
  },
});
