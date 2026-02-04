import React from "react";
import { Appearance, type TextStyle, Platform } from "react-native";

export type ThemeMode = "light" | "dark" | "system";

export type Theme = {
  mode: "light" | "dark";
  isDark: boolean;

  // Base colors
  bg: string;
  panel: string;
  panel2: string;
  text: string;
  muted: string;
  line: string;
  divider: string;

  // Glass effects
  glass: string;
  glassBorder: string;
  modalOverlay: string;
  modalGlass: string;

  // Accent colors
  accent: string;
  accentGradient: [string, string];
  success: string;
  successGradient: [string, string];
  warn: string;
  danger: string;
  dangerGradient: [string, string];

  // Typography
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
  lineHeight: {
    sm: number;
    md: number;
    lg: number;
  };

  // Spacing
  space: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };

  // Radius
  radius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    pill: number;
  };

  // Shadows
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
    lg: {
      color: string;
      opacity: number;
      radius: number;
      offset: { width: number; height: number };
      elevation: number;
    };
    glow: {
      color: string;
      opacity: number;
      radius: number;
      offset: { width: number; height: number };
      elevation: number;
    };
  };

  // Animation
  animation: {
    fast: number;
    normal: number;
    slow: number;
    spring: {
      damping: number;
      stiffness: number;
    };
  };

  // Interaction
  hitSlop: {
    sm: { top: number; bottom: number; left: number; right: number };
    md: { top: number; bottom: number; left: number; right: number };
  };

  // Legacy
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
  fontFamily: {
    regular: "Inter_400Regular",
    medium: "Inter_500Medium",
    semibold: "Inter_600SemiBold",
    bold: "Inter_700Bold",
  },
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
    sm: 20,
    md: 24,
    lg: 36,
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

      // Base colors - Deep purple-black with warmth
      bg: "#0D0B1A",
      panel: "rgba(30, 20, 55, 0.55)",
      panel2: "rgba(45, 30, 75, 0.35)",
      text: "#F5F0FF",
      muted: "#A89CC8",
      line: "rgba(255, 255, 255, 0.07)",
      divider: "rgba(255, 255, 255, 0.04)",

      // Glass effects - frosted purple glass
      glass: "rgba(80, 50, 140, 0.28)",
      glassBorder: "rgba(120, 80, 200, 0.22)",
      modalOverlay: "rgba(0, 0, 0, 0.85)",
      modalGlass: "rgba(30, 20, 55, 0.92)",

      // Accent: purple-to-orange gradient
      accent: "#B668F5",
      accentGradient: ["#9C44DC", "#F97316"],
      success: "#6EE7A0",
      successGradient: ["#34D399", "#10B981"],
      warn: "#FBBF24",
      danger: "#FB7185",
      dangerGradient: ["#FB7185", "#F43F5E"],

      // Typography
      fontFamily: TOKENS.fontFamily,
      mono: "monospace",
      fontSize: TOKENS.fontSize,
      fontWeight: TOKENS.fontWeight,
      lineHeight: TOKENS.lineHeight,

      // Spacing
      space: TOKENS.space,

      // Radius
      radius: TOKENS.radius,

      // Soft shadows with purple glow
      shadow: {
        sm: {
          color: "#1A0A30",
          opacity: 0.25,
          radius: 6,
          offset: { width: 0, height: 3 },
          elevation: 2,
        },
        md: {
          color: "#1A0A30",
          opacity: 0.35,
          radius: 12,
          offset: { width: 0, height: 6 },
          elevation: 5,
        },
        lg: {
          color: "#1A0A30",
          opacity: 0.45,
          radius: 24,
          offset: { width: 0, height: 10 },
          elevation: 10,
        },
        glow: {
          color: "#B668F5",
          opacity: 0.35,
          radius: 18,
          offset: { width: 0, height: 0 },
          elevation: 0,
        },
      },

      // Animation
      animation: {
        fast: 180,
        normal: 280,
        slow: 450,
        spring: {
          damping: 14,
          stiffness: 160,
        },
      },

      // Interaction
      hitSlop: TOKENS.hitSlop,

      // Legacy
      textSize: TOKENS.fontSize,
    };
  }

  return {
    mode,
    isDark: false,

    // Base colors - Warm light with purple tint
    bg: "#F8F5FF",
    panel: "rgba(255, 255, 255, 0.55)",
    panel2: "rgba(243, 237, 255, 0.40)",
    text: "#1A0E2E",
    muted: "#6E5C8E",
    line: "rgba(100, 60, 160, 0.1)",
    divider: "rgba(100, 60, 160, 0.06)",

    // Glass effects - uniform purple-tinted glass
    glass: "rgba(160, 120, 220, 0.18)",
    glassBorder: "rgba(140, 100, 200, 0.22)",
    modalOverlay: "rgba(0, 0, 0, 0.85)",
    modalGlass: "rgba(248, 245, 255, 0.95)",

    // Accent: purple-to-orange gradient
    accent: "#7C3AED",
    accentGradient: ["#7C3AED", "#F97316"],
    success: "#22C55E",
    successGradient: ["#22C55E", "#16A34A"],
    warn: "#F59E0B",
    danger: "#EF4444",
    dangerGradient: ["#EF4444", "#DC2626"],

    // Typography
    fontFamily: TOKENS.fontFamily,
    mono: "monospace",
    fontSize: TOKENS.fontSize,
    fontWeight: TOKENS.fontWeight,
    lineHeight: TOKENS.lineHeight,

    // Spacing
    space: TOKENS.space,

    // Radius
    radius: TOKENS.radius,

    // Soft shadows with purple tint
    shadow: {
      sm: {
        color: "#7C3AED",
        opacity: 0.06,
        radius: 6,
        offset: { width: 0, height: 3 },
        elevation: 2,
      },
      md: {
        color: "#7C3AED",
        opacity: 0.1,
        radius: 12,
        offset: { width: 0, height: 6 },
        elevation: 5,
      },
      lg: {
        color: "#7C3AED",
        opacity: 0.14,
        radius: 24,
        offset: { width: 0, height: 10 },
        elevation: 10,
      },
      glow: {
        color: "#7C3AED",
        opacity: 0.3,
        radius: 18,
        offset: { width: 0, height: 0 },
        elevation: 0,
      },
    },

    // Animation
    animation: {
      fast: 180,
      normal: 280,
      slow: 450,
      spring: {
        damping: 14,
        stiffness: 160,
      },
    },

    // Interaction
    hitSlop: TOKENS.hitSlop,

    // Legacy
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
  if (mode === "system") {
    return getSystemColorScheme();
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

  // Listen to React Native Appearance changes (mobile)
  Appearance.addChangeListener(() => {
    if (currentMode === "system") {
      currentTheme = createTheme(resolveMode("system"));
      notify();
    }
  });

  // Listen to web theme changes
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (currentMode === "system") {
        currentTheme = createTheme(resolveMode("system"));
        notify();
      }
    };
    mediaQuery.addEventListener("change", handleChange);
  }
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
