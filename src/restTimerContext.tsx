// src/restTimerContext.tsx — Global rest timer state shared across the app
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { Platform, Vibration, AppState } from "react-native";
import * as Haptics from "expo-haptics";
import { getSettingAsync, setSettingAsync } from "./db";
import { tagsFor, isPerSideExercise, type ExerciseTag } from "./exerciseLibrary";
import {
  scheduleRestNotification,
  cancelAllRestTimerNotifications,
} from "./notifications";
import { mmss, clampInt } from "./format";

function recommendedRestSeconds(tags: ExerciseTag[]) {
  if (tags.includes("compound")) return 150;
  if (tags.includes("isolation")) return 90;
  return 120;
}

export type RestTimerContextValue = {
  // State
  restEnabled: boolean;
  restSeconds: number;
  restRemaining: number;
  restRunning: boolean;
  restEndsAt: number | null;
  restDurationSec: number; // Duration the active timer was started with (caps remaining display)
  restVibrate: boolean;
  restHaptics: boolean;
  exerciseRestOverrides: Record<string, number>;
  restPresets: number[];
  focusedExerciseId: string | null;
  activeWorkoutId: string | null;
  perSideOverrides: Record<string, boolean>;

  // Computed
  restLabel: string;
  displaySeconds: number; // What the floating timer should show

  // Setters
  setRestEnabled: (v: boolean) => void;
  setRestSeconds: (v: number) => void;
  setRestVibrate: (v: boolean) => void;
  setRestHaptics: (v: boolean) => void;
  setFocusedExerciseId: (id: string | null) => void;
  setActiveWorkoutId: (id: string | null) => void;

  // Preset management
  addPreset: (seconds: number) => void;
  removePreset: (seconds: number) => void;

  // Exercise override management
  setExerciseRest: (exId: string, seconds: number | null) => void;
  getRestForExercise: (exId: string) => number;

  // Per-side management
  setPerSideOverride: (exId: string, isPerSide: boolean | null) => void;
  isPerSide: (exId: string) => boolean;

  // Timer controls
  startRestTimer: (seconds?: number) => Promise<void>;
  stopRestTimer: () => void;

  // Settings modal state
  restSettingsOpen: boolean;
  setRestSettingsOpen: (v: boolean) => void;
};

const RestTimerContext = createContext<RestTimerContextValue | null>(null);

export function useRestTimer() {
  const ctx = useContext(RestTimerContext);
  if (!ctx) throw new Error("useRestTimer must be used within RestTimerProvider");
  return ctx;
}

type Props = { children: React.ReactNode };

export function RestTimerProvider({ children }: Props) {
  const [restEnabled, setRestEnabledState] = useState(true);
  const [restSeconds, setRestSecondsState] = useState(120);
  const [restRemaining, setRestRemaining] = useState(120);
  const [restRunning, setRestRunning] = useState(false);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restDurationSec, setRestDurationSec] = useState<number>(120);
  const [restVibrate, setRestVibrateState] = useState(false);
  const [restHaptics, setRestHapticsState] = useState(true);
  const [restNotificationId, setRestNotificationId] = useState<string | null>(null);
  const [exerciseRestOverrides, setExerciseRestOverrides] = useState<Record<string, number>>({});
  const [restPresets, setRestPresets] = useState<number[]>([60, 90, 120, 150, 180]);
  const [focusedExerciseId, setFocusedExerciseId] = useState<string | null>(null);
  const [activeWorkoutId, setActiveWorkoutIdState] = useState<string | null>(null);
  const [restSettingsOpen, setRestSettingsOpen] = useState(false);
  const [perSideOverrides, setPerSideOverrides] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  const restDoneRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  // Load settings on mount
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const reRaw = await getSettingAsync("restEnabled");
        const rsRaw = await getSettingAsync("restSeconds");
        const rvRaw = await getSettingAsync("restVibrate");
        const rhRaw = await getSettingAsync("restHaptics");
        const reAtRaw = await getSettingAsync("restEndsAt");

        if (!alive) return;

        setRestEnabledState(reRaw === null ? true : reRaw === "1");
        setRestSecondsState(clampInt(parseInt(rsRaw ?? "120", 10), 10, 600));
        setRestVibrateState(rvRaw === "1");
        setRestHapticsState(rhRaw === null ? true : rhRaw === "1");

        // Load per-exercise rest overrides
        try {
          const eroRaw = await getSettingAsync("exerciseRestOverrides");
          if (eroRaw) {
            const parsed = JSON.parse(eroRaw);
            if (parsed && typeof parsed === "object") setExerciseRestOverrides(parsed);
          }
        } catch {}

        // Load custom rest presets
        try {
          const rpRaw = await getSettingAsync("restPresets");
          if (rpRaw) {
            const parsed = JSON.parse(rpRaw);
            if (Array.isArray(parsed) && parsed.length > 0) setRestPresets(parsed);
          }
        } catch {}

        // Load per-side overrides
        try {
          const psoRaw = await getSettingAsync("perSideOverrides");
          if (psoRaw) {
            const parsed = JSON.parse(psoRaw);
            if (parsed && typeof parsed === "object") setPerSideOverrides(parsed);
          }
        } catch {}

        // Resume ongoing timer if still within window
        const endsAt = reAtRaw ? Number(reAtRaw) : NaN;
        const rdRaw = await getSettingAsync("restDurationSec");
        const persistedDuration = clampInt(parseInt(rdRaw ?? "0", 10), 0, 600);
        const fallbackDuration = clampInt(parseInt(rsRaw ?? "120", 10), 10, 600);
        const computedRemaining = Number.isFinite(endsAt) ? Math.ceil((endsAt - Date.now()) / 1000) : NaN;
        const validDuration = persistedDuration > 0 ? persistedDuration : fallbackDuration;
        // Resume only if the remaining is within [1, validDuration] — guards against system clock skew.
        if (Number.isFinite(computedRemaining) && computedRemaining > 0 && computedRemaining <= validDuration) {
          setRestEndsAt(endsAt);
          setRestDurationSec(validDuration);
          setRestRunning(true);
          setRestRemaining(computedRemaining);
        } else {
          // Discard a stale or skewed timer so the user never sees a runaway value.
          if (Number.isFinite(computedRemaining) && computedRemaining > validDuration) {
            console.warn("[RestTimerContext] discarded stale timer", { computedRemaining, validDuration });
          }
          setRestEndsAt(null);
          setRestRunning(false);
          setRestDurationSec(fallbackDuration);
          setRestRemaining(fallbackDuration);
          setSettingAsync("restEndsAt", "").catch(() => {});
          setSettingAsync("restDurationSec", "").catch(() => {});
        }

        // Load active workout ID
        const activeId = await getSettingAsync("activeWorkoutId");
        if (activeId) setActiveWorkoutIdState(activeId);

        setLoaded(true);
      } catch (err) {
        console.warn("[RestTimerContext] load failed", err);
        setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Haptic callbacks
  const fireHapticDone = useCallback(async () => {
    if (!restHaptics || Platform.OS === "web") return;
    try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
    catch { try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {} }
  }, [restHaptics]);

  // Timer countdown effect
  useEffect(() => {
    if (!restRunning || !restEndsAt) return;
    const id = setInterval(() => {
      // Cap at restDurationSec so a backwards system-clock change can never produce a runaway value.
      const raw = Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000));
      const remaining = restDurationSec > 0 ? Math.min(raw, restDurationSec) : raw;
      setRestRemaining(remaining);
      if (remaining === 0 && !restDoneRef.current) {
        restDoneRef.current = true;
        setRestRunning(false);
        setRestEndsAt(null);
        setRestNotificationId(null);
        setSettingAsync("restEndsAt", "").catch(() => {});
        setSettingAsync("restDurationSec", "").catch(() => {});
        cancelAllRestTimerNotifications().catch(() => {});
        if (restVibrate && Platform.OS !== "web") Vibration.vibrate(300);
        fireHapticDone();
      }
    }, 500);
    return () => clearInterval(id);
  }, [restRunning, restEndsAt, restDurationSec, restVibrate, fireHapticDone]);

  // Sync restRemaining with restSeconds when not running
  useEffect(() => {
    if (!restRunning) setRestRemaining(restSeconds);
  }, [restSeconds, restRunning]);

  // App state resume handler
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === "active") {
        if (restEndsAt) {
          const raw = Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000));
          const remaining = restDurationSec > 0 ? Math.min(raw, restDurationSec) : raw;
          setRestRemaining(remaining);
          if (remaining === 0 && !restDoneRef.current) {
            restDoneRef.current = true;
            setRestRunning(false);
            setRestEndsAt(null);
            setRestNotificationId(null);
            setSettingAsync("restEndsAt", "").catch(() => {});
            setSettingAsync("restDurationSec", "").catch(() => {});
            cancelAllRestTimerNotifications().catch(() => {});
          }
        }
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [restEndsAt, restDurationSec]);

  // Persist settings on change
  const setRestEnabled = useCallback((v: boolean) => {
    setRestEnabledState(v);
    setSettingAsync("restEnabled", v ? "1" : "0").catch(() => {});
  }, []);

  const setRestSeconds = useCallback((v: number) => {
    const clamped = clampInt(v, 10, 600);
    setRestSecondsState(clamped);
    setSettingAsync("restSeconds", String(clamped)).catch(() => {});
  }, []);

  const setRestVibrate = useCallback((v: boolean) => {
    setRestVibrateState(v);
    setSettingAsync("restVibrate", v ? "1" : "0").catch(() => {});
  }, []);

  const setRestHaptics = useCallback((v: boolean) => {
    setRestHapticsState(v);
    setSettingAsync("restHaptics", v ? "1" : "0").catch(() => {});
  }, []);

  const setActiveWorkoutId = useCallback((id: string | null) => {
    setActiveWorkoutIdState(id);
    // Note: activeWorkoutId is persisted in log.tsx when starting/ending workout
  }, []);

  // Preset management
  const addPreset = useCallback((seconds: number) => {
    setRestPresets((prev) => {
      if (prev.includes(seconds)) return prev;
      const next = [...prev, seconds].sort((a, b) => a - b);
      setSettingAsync("restPresets", JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const removePreset = useCallback((seconds: number) => {
    setRestPresets((prev) => {
      const next = prev.filter((s) => s !== seconds);
      setSettingAsync("restPresets", JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  // Exercise override management
  const setExerciseRest = useCallback((exId: string, seconds: number | null) => {
    setExerciseRestOverrides((prev) => {
      const next = { ...prev };
      if (seconds === null) {
        delete next[exId];
      } else {
        next[exId] = seconds;
      }
      setSettingAsync("exerciseRestOverrides", JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const getRestForExercise = useCallback((exId: string): number => {
    const override = exerciseRestOverrides[exId];
    if (override != null && Number.isFinite(override)) return override;
    return recommendedRestSeconds(tagsFor(exId));
  }, [exerciseRestOverrides]);

  // Per-side override management
  const setPerSideOverride = useCallback((exId: string, val: boolean | null) => {
    setPerSideOverrides((prev) => {
      const next = { ...prev };
      if (val === null) {
        delete next[exId];
      } else {
        next[exId] = val;
      }
      setSettingAsync("perSideOverrides", JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const isPerSide = useCallback((exId: string): boolean => {
    const override = perSideOverrides[exId];
    if (override !== undefined) return override;
    return isPerSideExercise(exId);
  }, [perSideOverrides]);

  // Timer controls
  const stopRestTimer = useCallback(() => {
    setRestRunning(false);
    setRestEndsAt(null);
    restDoneRef.current = false;
    setRestRemaining(restSeconds);
    setRestDurationSec(restSeconds);
    setSettingAsync("restEndsAt", "").catch(() => {});
    setSettingAsync("restDurationSec", "").catch(() => {});
    cancelAllRestTimerNotifications().catch(() => {});
    setRestNotificationId(null);
  }, [restSeconds]);

  const startRestTimer = useCallback(async (seconds?: number) => {
    if (!restEnabled) return;
    const requestedDuration = seconds ?? restSeconds;
    // Clamp duration to the same range used for restSeconds so an out-of-range value can't produce a giant timer.
    const duration = clampInt(Math.floor(requestedDuration), 1, 600);
    const end = Date.now() + duration * 1000;
    setRestEndsAt(end);
    setRestDurationSec(duration);
    setRestRunning(true);
    restDoneRef.current = false;
    setRestRemaining(duration);
    setSettingAsync("restEndsAt", String(end)).catch(() => {});
    setSettingAsync("restDurationSec", String(duration)).catch(() => {});
    // Cancel ALL rest-timer notifications before scheduling new one
    await cancelAllRestTimerNotifications();
    const notificationId = await scheduleRestNotification(duration);
    setRestNotificationId(notificationId);
  }, [restEnabled, restSeconds]);

  // Computed values
  const restLabel = restEnabled ? mmss(restRemaining) : "OFF";

  // Display seconds: when not running, show the focused exercise's default
  const displaySeconds = restRunning
    ? restRemaining
    : focusedExerciseId
      ? getRestForExercise(focusedExerciseId)
      : restSeconds;

  const value: RestTimerContextValue = {
    restEnabled,
    restSeconds,
    restRemaining,
    restRunning,
    restEndsAt,
    restDurationSec,
    restVibrate,
    restHaptics,
    exerciseRestOverrides,
    restPresets,
    focusedExerciseId,
    activeWorkoutId,
    perSideOverrides,
    restLabel,
    displaySeconds,
    setRestEnabled,
    setRestSeconds,
    setRestVibrate,
    setRestHaptics,
    setFocusedExerciseId,
    setActiveWorkoutId,
    addPreset,
    removePreset,
    setExerciseRest,
    getRestForExercise,
    setPerSideOverride,
    isPerSide,
    startRestTimer,
    stopRestTimer,
    restSettingsOpen,
    setRestSettingsOpen,
  };

  // Don't render children until settings are loaded
  if (!loaded) return null;

  return (
    <RestTimerContext.Provider value={value}>
      {children}
    </RestTimerContext.Provider>
  );
}

export { mmss, recommendedRestSeconds };
