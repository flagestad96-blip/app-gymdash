// src/restTimerContext.tsx — Global rest timer state shared across the app
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { Platform, Vibration, AppState } from "react-native";
import * as Haptics from "expo-haptics";
import { getSettingAsync, setSettingAsync, updateSetNote } from "./db";
import { tagsFor, isPerSideExercise, type ExerciseTag } from "./exerciseLibrary";
import {
  scheduleRestNotification,
  cancelAllRestTimerNotifications,
  ensureRestNotificationPermission,
} from "./notifications";
import { mmss, clampInt } from "./format";

function recommendedRestSeconds(tags: ExerciseTag[]) {
  if (tags.includes("compound")) return 150;
  if (tags.includes("isolation")) return 90;
  return 120;
}

export type RestPhase = "normal" | "transition" | "round";

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
  transitionRestSeconds: number;
  restPhase: RestPhase;
  restPhaseLabel: string | null;

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
  setTransitionRestSeconds: (v: number) => void;

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
  startRestTimer: (
    seconds?: number,
    opts?: { phase?: RestPhase; phaseLabel?: string | null; durationSec?: number },
  ) => Promise<void>;
  stopRestTimer: () => void;

  // Settings modal state
  restSettingsOpen: boolean;
  setRestSettingsOpen: (v: boolean) => void;

  // Last logged set — lets the rest overlay attach a quick note to the set you
  // just finished, while the timer runs.
  lastSet: { id: string; note: string } | null;
  setLastSet: (v: { id: string; note: string } | null) => void;
  updateLastSetNote: (note: string) => void;

  // Label of the next exercise/block, shown on the rest overlay when one is done.
  nextUpLabel: string | null;
  setNextUpLabel: (v: string | null) => void;
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
  const [lastSet, setLastSet] = useState<{ id: string; note: string } | null>(null);
  const [nextUpLabel, setNextUpLabel] = useState<string | null>(null);
  const [perSideOverrides, setPerSideOverrides] = useState<Record<string, boolean>>({});
  const [transitionRestSeconds, setTransitionRestSecondsState] = useState(15);
  const [restPhase, setRestPhase] = useState<RestPhase>("normal");
  const [restPhaseLabel, setRestPhaseLabel] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const restDoneRef = useRef(false);
  // Serializes async notification cancel/reschedule across rapid start/adjust/stop
  // calls — without this, overlapping sequences can leave two scheduled notifications.
  const notifSeqRef = useRef(0);
  const notifChainRef = useRef<Promise<void>>(Promise.resolve());
  const appStateRef = useRef(AppState.currentState);
  const lastSetRef = useRef(lastSet);
  useEffect(() => { lastSetRef.current = lastSet; }, [lastSet]);

  // Update the note on the most-recently-logged set (rest overlay quick note).
  // Persists on every change so nothing is lost if the timer runs out mid-typing.
  const updateLastSetNote = useCallback((note: string) => {
    const cur = lastSetRef.current;
    if (!cur) return;
    setLastSet({ id: cur.id, note });
    updateSetNote(cur.id, note).catch(() => {});
  }, []);

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

        // Load transition rest seconds (between superset slots)
        try {
          const trRaw = await getSettingAsync("transitionRestSeconds");
          if (trRaw != null) {
            const parsed = parseInt(trRaw, 10);
            if (Number.isFinite(parsed)) setTransitionRestSecondsState(clampInt(parsed, 0, 60));
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
        setRestPhase("normal");
        setRestPhaseLabel(null);
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
            setRestPhase("normal");
            setRestPhaseLabel(null);
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
    setRestPhase("normal");
    setRestPhaseLabel(null);
    setSettingAsync("restEndsAt", "").catch(() => {});
    setSettingAsync("restDurationSec", "").catch(() => {});
    // Supersede any in-flight start so a queued schedule can't fire after stop.
    const seq = ++notifSeqRef.current;
    notifChainRef.current = notifChainRef.current
      .then(async () => {
        if (seq !== notifSeqRef.current) return;
        await cancelAllRestTimerNotifications();
      })
      .catch(() => {});
    setRestNotificationId(null);
  }, [restSeconds]);

  const startRestTimer = useCallback(
    async (seconds?: number, opts?: { phase?: RestPhase; phaseLabel?: string | null; durationSec?: number }) => {
      if (!restEnabled) return;
      const requestedRemaining = seconds ?? restSeconds;
      // Clamp to the same range used for restSeconds so an out-of-range value can't produce a giant timer.
      const remaining = clampInt(Math.floor(requestedRemaining), 1, 600);
      // The progress-ring denominator. Callers adjusting a RUNNING timer (±15s/+30s)
      // pass the original total via opts.durationSec so the ring doesn't flash back
      // to full on every adjustment; a fresh start just uses the remaining time.
      const duration = clampInt(Math.floor(opts?.durationSec ?? remaining), remaining, 600);
      const end = Date.now() + remaining * 1000;
      setRestEndsAt(end);
      setRestDurationSec(duration);
      setRestRunning(true);
      restDoneRef.current = false;
      setRestRemaining(remaining);
      setRestPhase(opts?.phase ?? "normal");
      setRestPhaseLabel(opts?.phaseLabel ?? null);
      setSettingAsync("restEndsAt", String(end)).catch(() => {});
      setSettingAsync("restDurationSec", String(duration)).catch(() => {});
      // Reschedule the background notification. Chained + sequence-guarded so rapid
      // adjustments can't interleave cancel/schedule and leave a stale duplicate;
      // only the latest call ends up scheduling.
      const seq = ++notifSeqRef.current;
      notifChainRef.current = notifChainRef.current
        .then(async () => {
          if (seq !== notifSeqRef.current) return; // superseded by a newer start/stop
          // Request the OS notification permission on first use — without this
          // Android 13+ silently drops every scheduled rest notification.
          await ensureRestNotificationPermission();
          if (seq !== notifSeqRef.current) return;
          await cancelAllRestTimerNotifications();
          if (seq !== notifSeqRef.current) return;
          const notificationId = await scheduleRestNotification(remaining);
          setRestNotificationId(notificationId);
        })
        .catch(() => {});
      await notifChainRef.current;
    },
    [restEnabled, restSeconds]
  );

  const setTransitionRestSeconds = useCallback((v: number) => {
    const clamped = clampInt(v, 0, 60);
    setTransitionRestSecondsState(clamped);
    setSettingAsync("transitionRestSeconds", String(clamped)).catch(() => {});
  }, []);

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
    transitionRestSeconds,
    restPhase,
    restPhaseLabel,
    restLabel,
    displaySeconds,
    setRestEnabled,
    setRestSeconds,
    setRestVibrate,
    setRestHaptics,
    setFocusedExerciseId,
    setActiveWorkoutId,
    setTransitionRestSeconds,
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
    lastSet,
    setLastSet,
    updateLastSetNote,
    nextUpLabel,
    setNextUpLabel,
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
