// src/theme.ts — Aurora redesign theme (dark only).
//
// One aesthetic. No light mode. Personalization knobs come from the prototype's
// Tweaks panel:
//
//   palette          aurora / violet / emerald / sunset
//   glassIntensity   0..100 slider (prototype default 65)
//
// The glass look is driven by `glassIntensity` via the *exact* formula from
// Gymdash.html's Glass component. See `glassTokensFor()` below — everything
// else on the screen (buttons, chips, inputs) inherits those same numbers
// through `theme.glass` / `theme.glassBorder`, so the whole app feels like
// one frosted surface.

import React from "react";
import { type TextStyle } from "react-native";

export type Theme = {
  /** Kept for back-compat with callers that branch on isDark; always true now. */
  isDark: true;
  mode: "dark";

  // Base
  bg: string;
  panel: string;
  panel2: string;
  text: string;
  muted: string;
  muted2: string;
  /** Tertiary ink (for labels that need to recede further). */
  ink3: string;
  line: string;
  divider: string;

  /** Raw intensity value (0..100) — read by GlassCard. */
  glassIntensity: number;
  /** Pre-computed glass numbers at the current intensity. */
  glassBlur: number;          // px, maps to CSS backdrop-filter on web
  glassSat: number;           // saturation % (same)
  glassFillA: number;         // gradient start alpha
  glassFillB: number;         // gradient end alpha
  glassStroke: number;        // border alpha
  /** Flat-average glass fill used by non-GlassCard surfaces. */
  glass: string;
  glassStrong: string;
  glassBorder: string;
  glassBorderStrong: string;
  glassHighlight: string;
  modalOverlay: string;
  modalGlass: string;

  // Accents
  accent: string;
  accentGradient: [string, string];
  auroraGradient: [string, string, string];
  aurora: { blue: string; violet: string; cyan: string; pink: string };
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
    serif: string;
  };
  mono: string;
  fontSize: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number };
  fontWeight: {
    regular: TextStyle["fontWeight"];
    medium: TextStyle["fontWeight"];
    semibold: TextStyle["fontWeight"];
    bold: TextStyle["fontWeight"];
  };
  lineHeight: { sm: number; md: number; lg: number };

  // Tokens
  space: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number };
  radius: { sm: number; md: number; lg: number; xl: number; pill: number };

  // Shadows
  shadow: {
    sm: { color: string; opacity: number; radius: number; offset: { width: number; height: number }; elevation: number };
    md: { color: string; opacity: number; radius: number; offset: { width: number; height: number }; elevation: number };
    lg: { color: string; opacity: number; radius: number; offset: { width: number; height: number }; elevation: number };
    glow: { color: string; opacity: number; radius: number; offset: { width: number; height: number }; elevation: number };
  };

  // Animation
  animation: {
    fast: number;
    normal: number;
    slow: number;
    spring: { damping: number; stiffness: number };
  };

  hitSlop: {
    sm: { top: number; bottom: number; left: number; right: number };
    md: { top: number; bottom: number; left: number; right: number };
  };

  /** @deprecated Alias of fontSize, kept for a handful of older call sites. */
  textSize: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number };
};

// ── Aurora palette (the signature accent colors behind the glass) ────────────

export const AURORA = {
  blue: "#60a5fa",
  violet: "#c084fc",
  cyan: "#67e8f9",
  pink: "#f472b6",
} as const;

export type Palette = "aurora" | "violet" | "emerald" | "sunset";

const PALETTES: Record<Palette, { blue: string; violet: string; cyan: string; pink: string }> = {
  aurora:  { blue: "#60a5fa", violet: "#c084fc", cyan: "#67e8f9", pink: "#f472b6" },
  violet:  { blue: "#8b5cf6", violet: "#ec4899", cyan: "#6366f1", pink: "#a78bfa" },
  emerald: { blue: "#34d399", violet: "#22d3ee", cyan: "#a7f3d0", pink: "#60a5fa" },
  sunset:  { blue: "#fb7185", violet: "#f59e0b", cyan: "#ef4444", pink: "#e879f9" },
};

export const PALETTE_LIST: Palette[] = ["aurora", "violet", "emerald", "sunset"];

export function getPaletteColors(p: Palette) {
  return PALETTES[p];
}

// ── Glass intensity (0..100) ─────────────────────────────────────────────────
//
// Values below mirror the prototype's Glass component verbatim:
//   const blur    = 8 + (intensity / 100) * 24;       // 8..32
//   const sat     = 120 + (intensity / 100) * 60;     // 120..180
//   const fillA   = 0.04 + (intensity / 100) * 0.10;  // 0.04..0.14
//   const fillB   = 0.02 + (intensity / 100) * 0.06;  // 0.02..0.08
//   const strokeA = 0.12 + (intensity / 100) * 0.22;  // 0.12..0.34

export const DEFAULT_GLASS_INTENSITY = 65;

export function glassTokensFor(intensity: number) {
  const i = Math.max(0, Math.min(100, intensity));
  const k = i / 100;
  return {
    intensity: i,
    blur: 8 + k * 24,
    sat: 120 + k * 60,
    fillA: 0.04 + k * 0.10,
    fillB: 0.02 + k * 0.06,
    stroke: 0.12 + k * 0.22,
  };
}

// ── Token plumbing ───────────────────────────────────────────────────────────

const TOKENS = {
  // Body font stack — Inter, matches the prototype's `font-family: 'Inter'`.
  fontFamily: {
    regular: "Inter_400Regular",
    medium: "Inter_500Medium",
    semibold: "Inter_600SemiBold",
    bold: "Inter_700Bold",
    serif: "InstrumentSerif_400Regular",
  },
  mono: "JetBrainsMono_500Medium",
  fontSize: { xs: 11, sm: 13, md: 15, lg: 18, xl: 22, xxl: 28 },
  fontWeight: { regular: "400", medium: "500", semibold: "600", bold: "700" } as const,
  lineHeight: { sm: 20, md: 24, lg: 36 },
  space: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, xxl: 32 },
  radius: { sm: 10, md: 14, lg: 18, xl: 22, pill: 999 },
  hitSlop: {
    sm: { top: 6, bottom: 6, left: 6, right: 6 },
    md: { top: 10, bottom: 10, left: 10, right: 10 },
  },
};

function rgba(r: number, g: number, b: number, a: number) {
  const clamped = Math.max(0, Math.min(1, a));
  return `rgba(${r}, ${g}, ${b}, ${clamped.toFixed(3)})`;
}

function createTheme(palette: Palette, intensity: number): Theme {
  const P = PALETTES[palette];
  const g = glassTokensFor(intensity);

  // Flat-average fill for non-GlassCard surfaces (buttons, inputs, chips).
  // We bump the strong variant ~1.6× to match the prototype's `strong` feel.
  const avgFill = (g.fillA + g.fillB) / 2;
  const strongFill = Math.min(0.95, avgFill * 1.6);
  const strongStroke = Math.min(0.95, g.stroke * 1.15);

  return {
    mode: "dark",
    isDark: true,

    bg: "#05070f",
    panel: rgba(255, 255, 255, avgFill),
    panel2: rgba(255, 255, 255, strongFill),
    text: "#f3f5ff",
    muted: "rgba(243, 245, 255, 0.72)",
    muted2: "rgba(243, 245, 255, 0.48)",
    ink3: "rgba(243, 245, 255, 0.28)",
    line: rgba(255, 255, 255, g.stroke),
    divider: "rgba(255, 255, 255, 0.06)",

    // Raw + averaged glass tokens — GlassCard reads the raw numbers and
    // composes its own gradient; everyone else reads the averaged values.
    glassIntensity: g.intensity,
    glassBlur: g.blur,
    glassSat: g.sat,
    glassFillA: g.fillA,
    glassFillB: g.fillB,
    glassStroke: g.stroke,
    glass: rgba(255, 255, 255, avgFill),
    glassStrong: rgba(255, 255, 255, strongFill),
    glassBorder: rgba(255, 255, 255, g.stroke),
    glassBorderStrong: rgba(255, 255, 255, strongStroke),
    glassHighlight: "rgba(255, 255, 255, 0.20)",
    modalOverlay: "rgba(0, 0, 0, 0.72)",
    modalGlass: "rgba(15, 17, 28, 0.88)",

    accent: P.violet,
    accentGradient: [P.blue, P.violet],
    auroraGradient: [P.blue, P.violet, P.pink],
    aurora: P,
    success: P.cyan,
    successGradient: [P.blue, P.cyan],
    warn: "#f59e0b",
    danger: "#fb7185",
    dangerGradient: ["#fb7185", "#f43f5e"],

    fontFamily: TOKENS.fontFamily,
    mono: TOKENS.mono,
    fontSize: TOKENS.fontSize,
    fontWeight: TOKENS.fontWeight,
    lineHeight: TOKENS.lineHeight,
    space: TOKENS.space,
    radius: TOKENS.radius,

    shadow: {
      sm:   { color: "#000000", opacity: 0.35, radius: 8,  offset: { width: 0, height: 4 },  elevation: 2 },
      md:   { color: "#000000", opacity: 0.45, radius: 26, offset: { width: 0, height: 10 }, elevation: 6 },
      lg:   { color: "#000000", opacity: 0.55, radius: 40, offset: { width: 0, height: 18 }, elevation: 12 },
      glow: { color: P.violet,  opacity: 0.45, radius: 24, offset: { width: 0, height: 0 },  elevation: 0 },
    },

    animation: { fast: 180, normal: 280, slow: 450, spring: { damping: 14, stiffness: 160 } },
    hitSlop: TOKENS.hitSlop,
    textSize: TOKENS.fontSize,
  };
}

// ── State + listeners ────────────────────────────────────────────────────────

const listeners = new Set<() => void>();
let currentPalette: Palette = "aurora";
let currentIntensity: number = DEFAULT_GLASS_INTENSITY;
let currentTheme: Theme = createTheme(currentPalette, currentIntensity);

function notify() {
  listeners.forEach((cb) => cb());
}

function rebuild() {
  currentTheme = createTheme(currentPalette, currentIntensity);
  notify();
}

export function setPalette(p: Palette) {
  currentPalette = p;
  rebuild();
}

export function getPalette(): Palette {
  return currentPalette;
}

/** Accepts any 0..100 number; clamped on set. */
export function setGlassIntensity(i: number) {
  const clamped = Math.max(0, Math.min(100, Math.round(i)));
  if (clamped === currentIntensity) return;
  currentIntensity = clamped;
  rebuild();
}

export function getGlassIntensity(): number {
  return currentIntensity;
}

export function getTheme(): Theme {
  return currentTheme;
}

// ── React context ────────────────────────────────────────────────────────────

const ThemeContext = React.createContext<Theme>(currentTheme);

function useThemeState() {
  const [themeState, setThemeState] = React.useState(currentTheme);
  React.useEffect(() => {
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

/** Legacy proxy for files still importing `{ theme }` as a value. */
export const theme = new Proxy({} as Theme, {
  get(_target, prop) {
    return (currentTheme as any)[prop as keyof Theme];
  },
});
